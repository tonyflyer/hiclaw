import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import http from 'http'
import express from 'express'
import eventsRouter from '../routes/events.js'
import * as stateCollector from '../lib/state-collector.js'

// Create test app
const createTestApp = () => {
  const app = express()
  app.use('/api/events', eventsRouter)
  return app
}

// Helper to make SSE request and collect events
const collectSSEEvents = (
  app: express.Express,
  options: { eventCount?: number; timeout?: number } = {}
): Promise<{ headers: http.IncomingHttpHeaders; events: string }> => {
  const { eventCount = 1, timeout = 2000 } = options

  return new Promise((resolve, reject) => {
    const server = app.listen(0, () => {
      const port = (server.address() as { port: number }).port

      const req = http.request(
        {
          hostname: 'localhost',
          port,
          path: '/api/events',
          method: 'GET',
          headers: { Accept: 'text/event-stream' },
        },
        (res) => {
          let buffer = ''
          let eventsReceived = 0

          const cleanup = () => {
            res.destroy()
            server.close()
          }

          const timeoutId = setTimeout(() => {
            cleanup()
            resolve({ headers: res.headers, events: buffer })
          }, timeout)

          res.on('data', (chunk) => {
            buffer += chunk.toString()
            // Count double newlines as event boundaries
            const eventMatches = buffer.match(/event:\s*\w+/g)
            if (eventMatches && eventMatches.length >= eventCount) {
              clearTimeout(timeoutId)
              cleanup()
              resolve({ headers: res.headers, events: buffer })
            }
          })

          res.on('error', (err) => {
            clearTimeout(timeoutId)
            cleanup()
            reject(err)
          })
        }
      )

      req.on('error', (err) => {
        server.close()
        reject(err)
      })

      req.setTimeout(timeout, () => {
        req.destroy()
        server.close()
        reject(new Error(`Request timeout after ${timeout}ms`))
      })

      req.end()
    })
  })
}

describe('GET /api/events', () => {
  let app: express.Express

  beforeEach(() => {
    vi.restoreAllMocks()
    app = createTestApp()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should set SSE headers correctly', async () => {
    // Mock the StateCollector to avoid real file operations
    vi.spyOn(stateCollector, 'StateCollector').mockImplementation(() => ({
      collect: vi.fn().mockResolvedValue({
        agents: [],
        tasks: [],
        metrics: {
          byAgent: {},
          totals: {
            llmCalls: 0,
            tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            timing: { start: '', end: '' },
          },
        },
        resources: [],
        timestamp: '2026-01-01T00:00:00Z',
      }),
      hasChanged: vi.fn().mockReturnValue(true),
      getPreviousState: vi.fn().mockReturnValue(null),
    }))

    const { headers } = await collectSSEEvents(app, { eventCount: 1, timeout: 1000 })

    expect(headers['content-type']).toContain('text/event-stream')
    expect(headers['cache-control']).toBe('no-cache')
    expect(headers['connection']).toBe('keep-alive')
  })

  it('should send state_update event immediately', async () => {
    vi.spyOn(stateCollector, 'StateCollector').mockImplementation(() => ({
      collect: vi.fn().mockResolvedValue({
        agents: [
          {
            name: 'alice',
            matrixId: '@alice:matrix.local',
            roomId: '!room1:matrix.local',
            role: 'dev',
            skills: [],
            runtime: 'openclaw' as const,
            containerStatus: 'running' as const,
          },
        ],
        tasks: [],
        metrics: {
          byAgent: {},
          totals: {
            llmCalls: 0,
            tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            timing: { start: '', end: '' },
          },
        },
        resources: [],
        timestamp: '2026-01-01T00:00:00Z',
      }),
      hasChanged: vi.fn().mockReturnValue(true),
      getPreviousState: vi.fn().mockReturnValue(null),
    }))

    const { events } = await collectSSEEvents(app, { eventCount: 1, timeout: 1000 })

    // Should contain state_update event
    expect(events).toContain('event: state_update')
    expect(events).toContain('data:')

    // The data should contain agents array
    const stateMatch = events.match(/event: state_update\ndata: (\{[\s\S]*?\})\n\n/)
    expect(stateMatch).toBeTruthy()
    if (stateMatch) {
      const data = JSON.parse(stateMatch[1])
      expect(data).toHaveProperty('agents')
      expect(data).toHaveProperty('timestamp')
    }
  })

  it('should include all data types in state updates', async () => {
    vi.spyOn(stateCollector, 'StateCollector').mockImplementation(() => ({
      collect: vi.fn().mockResolvedValue({
        agents: [],
        tasks: [],
        metrics: {
          byAgent: {},
          totals: {
            llmCalls: 0,
            tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
            timing: { start: '', end: '' },
          },
        },
        resources: [],
        timestamp: '2026-01-01T00:00:00Z',
      }),
      hasChanged: vi.fn().mockReturnValue(true),
      getPreviousState: vi.fn().mockReturnValue(null),
    }))

    const { events } = await collectSSEEvents(app, { eventCount: 1, timeout: 1000 })

    // Should have agent data
    expect(events).toContain('"agents"')

    // Should have tasks data
    expect(events).toContain('"tasks"')

    // Should have metrics data
    expect(events).toContain('"metrics"')

    // Should have resources data
    expect(events).toContain('"resources"')
  })

  it('should handle client disconnect gracefully', async () => {
    const collectSpy = vi.fn().mockResolvedValue({
      agents: [],
      tasks: [],
      metrics: {
        byAgent: {},
        totals: {
          llmCalls: 0,
          tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
          timing: { start: '', end: '' },
        },
      },
      resources: [],
      timestamp: '2026-01-01T00:00:00Z',
    })

    vi.spyOn(stateCollector, 'StateCollector').mockImplementation(() => ({
      collect: collectSpy,
      hasChanged: vi.fn().mockReturnValue(true),
      getPreviousState: vi.fn().mockReturnValue(null),
    }))

    // This test verifies that the endpoint doesn't throw when client disconnects
    // The cleanup happens via req.on('close') handler
    const { events } = await collectSSEEvents(app, { eventCount: 1, timeout: 500 })

    // Should have received at least initial state_update
    expect(events).toContain('event: state_update')

    // collect should have been called for initial state
    expect(collectSpy).toHaveBeenCalled()
  })
})