import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import tasksRouter from '../routes/tasks.js'
import * as fileReader from '../lib/file-reader.js'
import * as config from '../lib/config.js'

// Create test app
const createTestApp = () => {
  const app = express()
  app.use('/api/tasks', tasksRouter)
  return app
}

describe('GET /api/tasks', () => {
  let app: express.Express

  beforeEach(() => {
    vi.restoreAllMocks()
    app = createTestApp()
  })

  it('should return empty array when state.json not found', async () => {
    vi.spyOn(fileReader, 'readJsonFile').mockRejectedValue(new Error('ENOENT: no such file or directory, open "/root/hiclaw-manager/state.json"'))

    const res = await request(app).get('/api/tasks')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ tasks: [], timestamp: expect.any(String) })
  })

  it('should return tasks from state.json with meta enrichment', async () => {
    const mockState = {
      activeTasks: [
        {
          taskId: 'task-001',
          type: 'finite' as const,
          assignedTo: 'alice',
          roomId: '!room1:matrix.local',
          status: 'active' as const,
          assignedAt: '2026-01-01T10:00:00Z',
          completedAt: null,
        },
        {
          taskId: 'task-002',
          type: 'infinite' as const,
          assignedTo: 'bob',
          roomId: '!room2:matrix.local',
          status: 'active' as const,
          assignedAt: '2026-01-01T11:00:00Z',
          completedAt: null,
          schedule: '0 9 * * *',
          timezone: 'Asia/Shanghai',
        },
      ],
      updatedAt: '2026-01-01T12:00:00Z',
    }

    const mockMeta1 = {
      taskId: 'task-001',
      type: 'finite' as const,
      assignedTo: 'alice',
      roomId: '!room1:matrix.local',
      status: 'active' as const,
      assignedAt: '2026-01-01T10:00:00Z',
      completedAt: null,
      description: 'Build login page',
      priority: 'high',
    }

    vi.spyOn(config, 'getStatePath').mockReturnValue('/mock/state.json')
    vi.spyOn(config, 'getTaskMetaPath').mockImplementation((taskId: string) => `/mock/shared/tasks/${taskId}/meta.json`)
    vi.spyOn(fileReader, 'readJsonFile')
      .mockResolvedValueOnce(mockState)
      .mockResolvedValueOnce(mockMeta1)
      .mockRejectedValueOnce(new Error('ENOENT: no such file')) // task-002 meta not found

    const res = await request(app).get('/api/tasks')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      tasks: [
        {
          taskId: 'task-001',
          type: 'finite',
          assignedTo: 'alice',
          roomId: '!room1:matrix.local',
          status: 'active',
          assignedAt: '2026-01-01T10:00:00Z',
          completedAt: null,
          description: 'Build login page',
          priority: 'high',
        },
        {
          taskId: 'task-002',
          type: 'infinite',
          assignedTo: 'bob',
          roomId: '!room2:matrix.local',
          status: 'active',
          assignedAt: '2026-01-01T11:00:00Z',
          completedAt: null,
          schedule: '0 9 * * *',
          timezone: 'Asia/Shanghai',
        },
      ],
      timestamp: expect.any(String),
    })
  })

  it('should return tasks without meta when meta files do not exist', async () => {
    const mockState = {
      activeTasks: [
        {
          taskId: 'task-001',
          type: 'finite' as const,
          assignedTo: 'alice',
          roomId: '!room1:matrix.local',
          status: 'active' as const,
          assignedAt: '2026-01-01T10:00:00Z',
          completedAt: null,
        },
      ],
      updatedAt: '2026-01-01T12:00:00Z',
    }

    vi.spyOn(config, 'getStatePath').mockReturnValue('/mock/state.json')
    vi.spyOn(config, 'getTaskMetaPath').mockReturnValue('/mock/shared/tasks/task-001/meta.json')
    vi.spyOn(fileReader, 'readJsonFile')
      .mockResolvedValueOnce(mockState)
      .mockRejectedValueOnce(new Error('ENOENT: no such file or directory'))

    const res = await request(app).get('/api/tasks')

    expect(res.status).toBe(200)
    expect(res.body.tasks).toHaveLength(1)
    expect(res.body.tasks[0]).toEqual({
      taskId: 'task-001',
      type: 'finite',
      assignedTo: 'alice',
      roomId: '!room1:matrix.local',
      status: 'active',
      assignedAt: '2026-01-01T10:00:00Z',
      completedAt: null,
    })
  })

  it('should return empty tasks array when state has no activeTasks', async () => {
    const mockState = {
      activeTasks: [],
      updatedAt: '2026-01-01T12:00:00Z',
    }

    vi.spyOn(config, 'getStatePath').mockReturnValue('/mock/state.json')
    vi.spyOn(fileReader, 'readJsonFile').mockResolvedValue(mockState)

    const res = await request(app).get('/api/tasks')

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ tasks: [], timestamp: expect.any(String) })
  })

  it('should handle malformed JSON in state file', async () => {
    vi.spyOn(fileReader, 'readJsonFile').mockRejectedValue(new Error('Unexpected token } in JSON'))

    const res = await request(app).get('/api/tasks')

    expect(res.status).toBe(500)
    expect(res.body).toEqual({ error: 'Failed to fetch tasks', message: 'Unexpected token } in JSON' })
  })

  it('should enrich all tasks when all meta files exist', async () => {
    const mockState = {
      activeTasks: [
        {
          taskId: 'task-001',
          type: 'finite' as const,
          assignedTo: 'alice',
          roomId: '!room1:matrix.local',
          status: 'active' as const,
          assignedAt: '2026-01-01T10:00:00Z',
          completedAt: null,
        },
        {
          taskId: 'task-002',
          type: 'finite' as const,
          assignedTo: 'bob',
          roomId: '!room2:matrix.local',
          status: 'active' as const,
          assignedAt: '2026-01-01T11:00:00Z',
          completedAt: null,
        },
      ],
      updatedAt: '2026-01-01T12:00:00Z',
    }

    const mockMeta1 = {
      taskId: 'task-001',
      type: 'finite' as const,
      assignedTo: 'alice',
      roomId: '!room1:matrix.local',
      status: 'active' as const,
      assignedAt: '2026-01-01T10:00:00Z',
      completedAt: null,
      description: 'Task 1 description',
    }

    const mockMeta2 = {
      taskId: 'task-002',
      type: 'finite' as const,
      assignedTo: 'bob',
      roomId: '!room2:matrix.local',
      status: 'active' as const,
      assignedAt: '2026-01-01T11:00:00Z',
      completedAt: null,
      description: 'Task 2 description',
    }

    vi.spyOn(config, 'getStatePath').mockReturnValue('/mock/state.json')
    vi.spyOn(config, 'getTaskMetaPath').mockImplementation((taskId: string) => `/mock/shared/tasks/${taskId}/meta.json`)
    vi.spyOn(fileReader, 'readJsonFile')
      .mockResolvedValueOnce(mockState)
      .mockResolvedValueOnce(mockMeta1)
      .mockResolvedValueOnce(mockMeta2)

    const res = await request(app).get('/api/tasks')

    expect(res.status).toBe(200)
    expect(res.body.tasks).toHaveLength(2)
    expect(res.body.tasks[0].description).toBe('Task 1 description')
    expect(res.body.tasks[1].description).toBe('Task 2 description')
  })
})
