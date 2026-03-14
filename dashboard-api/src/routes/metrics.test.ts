import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import metricsRouter from '../routes/metrics.js'
import * as dockerClient from '../lib/docker-client.js'
import * as config from '../lib/config.js'
import * as fileReader from '../lib/file-reader.js'

// Mock data for session JSONL content
const mockManagerSessionJsonl = `{"type":"message","timestamp":"2026-01-15T10:00:00Z","message":{"role":"assistant","usage":{"input":100,"output":50}}}
{"type":"message","timestamp":"2026-01-15T10:01:00Z","message":{"role":"assistant","usage":{"input":200,"output":100}}}
{"type":"message","timestamp":"2026-01-15T10:02:00Z","message":{"role":"assistant","usage":{"input":150,"output":75}}}
{"type":"message","timestamp":"2026-01-15T10:03:00Z","message":{"role":"user","content":"Hello"}}
{"type":"message","timestamp":"2026-01-15T10:04:00Z","message":{"role":"assistant","usage":{"input":300,"output":150}}}
`

const mockWorkerSessionJsonl = `{"type":"message","timestamp":"2026-01-15T11:00:00Z","message":{"role":"assistant","usage":{"input":80,"output":40}}}
{"type":"message","timestamp":"2026-01-15T11:01:00Z","message":{"role":"assistant","usage":{"input":120,"output":60}}}
`

// Create test app
const createTestApp = () => {
  const app = express()
  app.use('/api/metrics', metricsRouter)
  return app
}

describe('GET /api/metrics', () => {
  let app: express.Express

  beforeEach(() => {
    vi.restoreAllMocks()
    app = createTestApp()
  })

  it('should return zero metrics when no session files exist', async () => {
    vi.spyOn(config, 'getManagerSessionDir').mockReturnValue('/mock/manager-sessions')
    vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/workers-registry.json')
    vi.spyOn(fileReader, 'readDir').mockResolvedValue([])
    vi.spyOn(dockerClient, 'dockerExec').mockResolvedValue('')
    vi.spyOn(fileReader, 'readJsonFile').mockResolvedValue({ version: 1, updatedAt: '', workers: {} })
    vi.spyOn(dockerClient.DockerClient.prototype, 'listContainers').mockResolvedValue([])

    const res = await request(app).get('/api/metrics')

    expect(res.status).toBe(200)
    expect(res.body.metrics.totals.llmCalls).toBe(0)
    expect(res.body.metrics.byAgent).toEqual({})
  })

  it('should return metrics for manager from local session file', async () => {
    vi.spyOn(config, 'getManagerSessionDir').mockReturnValue('/mock/manager-sessions')
    vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/workers-registry.json')
    vi.spyOn(fileReader, 'readDir').mockResolvedValue(['session-001.jsonl'])
    vi.spyOn(fileReader, 'readFileContent').mockResolvedValue(mockManagerSessionJsonl)
    vi.spyOn(fileReader, 'readJsonFile').mockResolvedValue({ version: 1, updatedAt: '', workers: {} })
    vi.spyOn(dockerClient.DockerClient.prototype, 'listContainers').mockResolvedValue([])

    const res = await request(app).get('/api/metrics')

    expect(res.status).toBe(200)
    expect(res.body.metrics.totals.llmCalls).toBe(4)
    expect(res.body.metrics.totals.tokens.input).toBe(750)
    expect(res.body.metrics.totals.tokens.output).toBe(375)
    expect(res.body.metrics.byAgent).toHaveProperty('manager')
    expect(res.body.metrics.byAgent.manager.llmCalls).toBe(4)
  })

  it('should skip workers that are not running', async () => {
    vi.spyOn(config, 'getManagerSessionDir').mockReturnValue('/mock/manager-sessions')
    vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/workers-registry.json')
    vi.spyOn(fileReader, 'readDir').mockResolvedValue([])
    vi.spyOn(fileReader, 'readJsonFile').mockResolvedValue({ version: 1, updatedAt: '', workers: {} })
    vi.spyOn(dockerClient.DockerClient.prototype, 'listContainers').mockResolvedValue([])

    const res = await request(app).get('/api/metrics')

    expect(res.status).toBe(200)
    expect(res.body.metrics.byAgent).toEqual({})
  })

  it('should handle malformed JSONL gracefully', async () => {
    vi.spyOn(config, 'getManagerSessionDir').mockReturnValue('/mock/manager-sessions')
    vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/workers-registry.json')
    vi.spyOn(fileReader, 'readDir').mockResolvedValue(['session-001.jsonl'])
    vi.spyOn(fileReader, 'readFileContent').mockResolvedValue(`{"type":"message"`)
    vi.spyOn(fileReader, 'readJsonFile').mockResolvedValue({ version: 1, updatedAt: '', workers: {} })
    vi.spyOn(dockerClient.DockerClient.prototype, 'listContainers').mockResolvedValue([])

    const res = await request(app).get('/api/metrics')

    expect(res.status).toBe(200)
    expect(res.body.metrics.totals.llmCalls).toBe(0)
  })

  it('should aggregate metrics from running workers', async () => {
    vi.spyOn(config, 'getManagerSessionDir').mockReturnValue('/mock/manager-sessions')
    vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/workers-registry.json')
    vi.spyOn(fileReader, 'readDir').mockResolvedValue([])
    
    const mockRegistry = {
      version: 1,
      updatedAt: '2026-01-15T00:00:00Z',
      workers: {
        alice: {
          name: 'alice',
          matrixId: '@alice:matrix.local',
          roomId: '!room1:matrix.local',
          role: 'frontend-dev',
          skills: ['react'],
          runtime: 'openclaw' as const,
        },
      },
    }
    vi.spyOn(fileReader, 'readJsonFile').mockResolvedValue(mockRegistry)
    vi.spyOn(dockerClient.DockerClient.prototype, 'listContainers').mockResolvedValue([
      { id: 'abc123', name: 'hiclaw-worker-alice', image: 'hiclaw-worker', status: 'running', state: 'running', created: 0, ports: [] }
    ] as any)
    vi.spyOn(dockerClient, 'dockerExec')
      .mockResolvedValueOnce('/root/hiclaw-fs/agents/alice/.openclaw/agents/main/sessions/session-001.jsonl')
      .mockResolvedValueOnce(mockWorkerSessionJsonl)

    const res = await request(app).get('/api/metrics')

    expect(res.status).toBe(200)
    expect(res.body.metrics.byAgent).toHaveProperty('alice')
    expect(res.body.metrics.byAgent.alice.llmCalls).toBe(2)
    expect(res.body.metrics.byAgent.alice.tokens.input).toBe(200)
    expect(res.body.metrics.byAgent.alice.tokens.output).toBe(100)
  })

  it('should calculate totals correctly across all agents', async () => {
    vi.spyOn(config, 'getManagerSessionDir').mockReturnValue('/mock/manager-sessions')
    vi.spyOn(fileReader, 'readDir').mockResolvedValue(['session-001.jsonl'])
    vi.spyOn(fileReader, 'readFileContent').mockResolvedValue(mockManagerSessionJsonl)
    vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/workers-registry.json')
    
    const mockRegistry = {
      version: 1,
      updatedAt: '2026-01-15T00:00:00Z',
      workers: {
        alice: {
          name: 'alice',
          matrixId: '@alice:matrix.local',
          roomId: '!room1:matrix.local',
          role: 'dev',
          skills: [],
          runtime: 'openclaw' as const,
        },
      },
    }
    vi.spyOn(fileReader, 'readJsonFile').mockResolvedValue(mockRegistry)
    vi.spyOn(dockerClient.DockerClient.prototype, 'listContainers').mockResolvedValue([
      { id: 'abc123', name: 'hiclaw-worker-alice', image: 'hiclaw-worker', status: 'running', state: 'running', created: 0, ports: [] }
    ] as any)
    vi.spyOn(dockerClient, 'dockerExec')
      .mockResolvedValueOnce('/root/hiclaw-fs/agents/alice/session.jsonl')
      .mockResolvedValueOnce(mockWorkerSessionJsonl)

    const res = await request(app).get('/api/metrics')

    expect(res.status).toBe(200)
    // Manager: 4 calls, 750 input, 375 output
    // Alice: 2 calls, 200 input, 100 output
    // Total: 6 calls, 950 input, 475 output
    expect(res.body.metrics.totals.llmCalls).toBe(6)
    expect(res.body.metrics.totals.tokens.input).toBe(950)
    expect(res.body.metrics.totals.tokens.output).toBe(475)
  })
})

describe('GET /api/metrics/containers', () => {
  let app: express.Express

  beforeEach(() => {
    vi.restoreAllMocks()
    app = createTestApp()
  })

  it('should return 501 Not Implemented', async () => {
    const res = await request(app).get('/api/metrics/containers')
    expect(res.status).toBe(501)
    expect(res.body.message).toContain('Wave 2')
  })
})

describe('GET /api/metrics/agents', () => {
  let app: express.Express

  beforeEach(() => {
    vi.restoreAllMocks()
    app = createTestApp()
  })

  it('should return 501 Not Implemented', async () => {
    const res = await request(app).get('/api/metrics/agents')
    expect(res.status).toBe(501)
    expect(res.body.message).toContain('Wave 2')
  })
})
