import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import agentsRouter from '../routes/agents.js'
import * as fileReader from '../lib/file-reader.js'
import * as config from '../lib/config.js'

// Create test app
const createTestApp = () => {
  const app = express()
  app.use('/api/agents', agentsRouter)
  return app
}

describe('GET /api/agents', () => {
  let app: express.Express

  beforeEach(() => {
    vi.restoreAllMocks()
    app = createTestApp()
  })

  it('should return empty array when registry file not found', async () => {
    vi.spyOn(fileReader, 'readJsonFile').mockRejectedValue(new Error('ENOENT: no such file or directory, open "/root/hiclaw-manager/workers-registry.json"'))

    const res = await request(app).get('/api/agents')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ agents: [], timestamp: expect.any(String) })
  })

  it('should return agents merged with container status', async () => {
    const mockWorkers = {
      version: 1,
      updatedAt: '2026-01-01T00:00:00Z',
      workers: {
        alice: {
          name: 'alice',
          matrixId: '@alice:matrix.local',
          roomId: '!room1:matrix.local',
          role: 'frontend-dev',
          skills: ['react', 'typescript'],
          runtime: 'openclaw' as const,
          containerStatus: 'unknown' as const,
        },
        bob: {
          name: 'bob',
          matrixId: '@bob:matrix.local',
          roomId: '!room2:matrix.local',
          role: 'backend-dev',
          skills: ['nodejs', 'python'],
          runtime: 'copaw' as const,
          containerStatus: 'unknown' as const,
        },
      },
    }

    const mockLifecycle = {
      version: 1,
      idleTimeoutMinutes: 30,
      updatedAt: '2026-01-01T00:00:00Z',
      workers: {
        alice: {
          containerStatus: 'running',
          idleSince: null,
          autoStoppedAt: null,
          lastStartedAt: '2026-01-01T10:00:00Z',
        },
        bob: {
          containerStatus: 'stopped',
          idleSince: '2026-01-01T11:00:00Z',
          autoStoppedAt: null,
          lastStartedAt: '2026-01-01T09:00:00Z',
        },
      },
    }

    vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/workers-registry.json')
    vi.spyOn(config, 'getWorkerLifecyclePath').mockReturnValue('/mock/worker-lifecycle.json')
    vi.spyOn(fileReader, 'readJsonFile')
      .mockResolvedValueOnce(mockWorkers)
      .mockResolvedValueOnce(mockLifecycle)

    const res = await request(app).get('/api/agents')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      agents: [
        {
          name: 'alice',
          matrixId: '@alice:matrix.local',
          roomId: '!room1:matrix.local',
          role: 'frontend-dev',
          skills: ['react', 'typescript'],
          runtime: 'openclaw',
          containerStatus: 'running',
        },
        {
          name: 'bob',
          matrixId: '@bob:matrix.local',
          roomId: '!room2:matrix.local',
          role: 'backend-dev',
          skills: ['nodejs', 'python'],
          runtime: 'copaw',
          containerStatus: 'stopped',
        },
      ],
      timestamp: expect.any(String),
    })
  })

  it('should return empty agents array when registry has no workers', async () => {
    const mockWorkers = {
      version: 1,
      updatedAt: '2026-01-01T00:00:00Z',
      workers: {},
    }

    vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/workers-registry.json')
    vi.spyOn(config, 'getWorkerLifecyclePath').mockReturnValue('/mock/worker-lifecycle.json')
    vi.spyOn(fileReader, 'readJsonFile')
      .mockResolvedValueOnce(mockWorkers)
      .mockResolvedValueOnce({ version: 1, idleTimeoutMinutes: 30, updatedAt: '2026-01-01T00:00:00Z', workers: {} })

    const res = await request(app).get('/api/agents')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ agents: [], timestamp: expect.any(String) })
  })

  it('should handle malformed JSON in registry file', async () => {
    vi.spyOn(fileReader, 'readJsonFile').mockRejectedValue(new Error('Unexpected token } in JSON'))

    const res = await request(app).get('/api/agents')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to fetch agents', message: 'Unexpected token } in JSON' })
  })

  it('should handle malformed JSON in lifecycle file', async () => {
    const mockWorkers = {
      version: 1,
      updatedAt: '2026-01-01T00:00:00Z',
      workers: {
        alice: {
          name: 'alice',
          matrixId: '@alice:matrix.local',
          roomId: '!room1:matrix.local',
          role: 'frontend-dev',
          skills: ['react'],
          runtime: 'openclaw' as const,
          containerStatus: 'unknown' as const,
        },
      },
    }

    vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/workers-registry.json')
    vi.spyOn(config, 'getWorkerLifecyclePath').mockReturnValue('/mock/worker-lifecycle.json')
    vi.spyOn(fileReader, 'readJsonFile')
      .mockResolvedValueOnce(mockWorkers)
      .mockRejectedValueOnce(new Error('Unexpected token } in JSON'))

    const res = await request(app).get('/api/agents')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to fetch agents', message: 'Unexpected token } in JSON' })
  })

  it('should default containerStatus to unknown when worker not in lifecycle', async () => {
    const mockWorkers = {
      version: 1,
      updatedAt: '2026-01-01T00:00:00Z',
      workers: {
        alice: {
          name: 'alice',
          matrixId: '@alice:matrix.local',
          roomId: '!room1:matrix.local',
          role: 'frontend-dev',
          skills: ['react'],
          runtime: 'openclaw' as const,
          containerStatus: 'unknown' as const,
        },
      },
    }

    const mockLifecycle = {
      version: 1,
      idleTimeoutMinutes: 30,
      updatedAt: '2026-01-01T00:00:00Z',
      workers: {}, // alice not in lifecycle
    }

    vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/workers-registry.json')
    vi.spyOn(config, 'getWorkerLifecyclePath').mockReturnValue('/mock/worker-lifecycle.json')
    vi.spyOn(fileReader, 'readJsonFile')
      .mockResolvedValueOnce(mockWorkers)
      .mockResolvedValueOnce(mockLifecycle)

    const res = await request(app).get('/api/agents')

    expect(res.status).toBe(200)
    expect(res.body.agents[0].containerStatus).toBe('unknown')
  })
})
