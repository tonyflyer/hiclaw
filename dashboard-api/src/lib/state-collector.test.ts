import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StateCollector } from './state-collector.js'
import * as fileReader from '../lib/file-reader.js'
import * as config from '../lib/config.js'
import * as dockerClient from '../lib/docker-client.js'

describe('StateCollector', () => {
  let collector: StateCollector

  beforeEach(() => {
    vi.restoreAllMocks()
    collector = new StateCollector()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('collect()', () => {
    it('should collect agents data', async () => {
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
        workers: {
          alice: {
            containerStatus: 'running',
            idleSince: null,
            autoStoppedAt: null,
            lastStartedAt: '2026-01-01T10:00:00Z',
          },
        },
      }

      vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/registry.json')
      vi.spyOn(config, 'getWorkerLifecyclePath').mockReturnValue('/mock/lifecycle.json')
      vi.spyOn(fileReader, 'readJsonFile')
        .mockResolvedValueOnce(mockWorkers)
        .mockResolvedValueOnce(mockLifecycle)

      const state = await collector.collect()

      expect(state).toHaveProperty('agents')
      expect(state.agents).toHaveLength(1)
      expect(state.agents[0].name).toBe('alice')
    })

    it('should collect tasks data', async () => {
      const mockState = {
        activeTasks: [
          {
            taskId: 'task-001',
            type: 'finite' as const,
            assignedTo: 'alice',
            roomId: '!room1:matrix.local',
            status: 'assigned' as const,
            assignedAt: '2026-01-01T10:00:00Z',
            completedAt: null,
          },
        ],
        updatedAt: '2026-01-01T10:00:00Z',
      }

      vi.spyOn(config, 'getStatePath').mockReturnValue('/mock/state.json')
      vi.spyOn(fileReader, 'readJsonFile').mockResolvedValue(mockState)

      const state = await collector.collect()

      expect(state).toHaveProperty('tasks')
      expect(state.tasks).toHaveLength(1)
      expect(state.tasks[0].taskId).toBe('task-001')
    })

    it('should collect metrics data', async () => {
      vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/registry.json')
      vi.spyOn(config, 'getManagerSessionDir').mockReturnValue('/mock/sessions')
      vi.spyOn(dockerClient, 'getDockerClient').mockReturnValue({
        listContainers: vi.fn().mockResolvedValue([]),
      } as any)
      vi.spyOn(fileReader, 'readJsonFile').mockResolvedValue({
        version: 1,
        updatedAt: '2026-01-01T00:00:00Z',
        workers: {},
      })

      const state = await collector.collect()

      expect(state).toHaveProperty('metrics')
    })

    it('should collect resources data', async () => {
      const mockContainers = [
        {
          id: 'container-1',
          name: 'hiclaw-manager',
          state: 'running',
        },
      ]

      vi.spyOn(dockerClient, 'getDockerClient').mockReturnValue({
        listContainers: vi.fn().mockResolvedValue(mockContainers),
        getContainerStats: vi.fn().mockResolvedValue({
          containerId: 'container-1',
          name: 'hiclaw-manager',
          cpuPercent: 5.0,
          memoryUsage: 100000000,
          memoryLimit: 2000000000,
          networkRx: 1000,
          networkTx: 2000,
          timestamp: '2026-01-01T10:00:00Z',
        }),
      } as any)

      const state = await collector.collect()

      expect(state).toHaveProperty('resources')
    })

    it('should include timestamp in collected state', async () => {
      vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/registry.json')
      vi.spyOn(config, 'getWorkerLifecyclePath').mockReturnValue('/mock/lifecycle.json')
      vi.spyOn(config, 'getStatePath').mockReturnValue('/mock/state.json')
      vi.spyOn(fileReader, 'readJsonFile')
        .mockResolvedValueOnce({ version: 1, updatedAt: '2026-01-01T00:00:00Z', workers: {} })
        .mockResolvedValueOnce({ version: 1, idleTimeoutMinutes: 30, updatedAt: '2026-01-01T00:00:00Z', workers: {} })
        .mockResolvedValueOnce({ activeTasks: [], updatedAt: '2026-01-01T00:00:00Z' })

      vi.spyOn(dockerClient, 'getDockerClient').mockReturnValue({
        listContainers: vi.fn().mockResolvedValue([]),
      } as any)

      vi.spyOn(config, 'getManagerSessionDir').mockReturnValue('/mock/sessions')

      const state = await collector.collect()

      expect(state).toHaveProperty('timestamp')
      expect(new Date(state.timestamp).getTime()).toBeGreaterThan(0)
    })
  })

  describe('hasChanged()', () => {
    it('should return false on first call (no previous state)', () => {
      expect(collector.hasChanged()).toBe(false)
    })

    it('should return true when state changes', async () => {
      const mockWorkers1 = {
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

      const mockLifecycle1 = {
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
        },
      }

      vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/registry.json')
      vi.spyOn(config, 'getWorkerLifecyclePath').mockReturnValue('/mock/lifecycle.json')
      vi.spyOn(fileReader, 'readJsonFile')
        .mockResolvedValueOnce(mockWorkers1)
        .mockResolvedValueOnce(mockLifecycle1)

      // First collect - hasChanged returns true after first collect (initial state)
      await collector.collect()
      expect(collector.hasChanged()).toBe(true)
    })

    it('should return false when state is unchanged', async () => {
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
        workers: {
          alice: {
            containerStatus: 'running',
            idleSince: null,
            autoStoppedAt: null,
            lastStartedAt: '2026-01-01T10:00:00Z',
          },
        },
      }

      vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/registry.json')
      vi.spyOn(config, 'getWorkerLifecyclePath').mockReturnValue('/mock/lifecycle.json')
      vi.spyOn(fileReader, 'readJsonFile')
        .mockResolvedValueOnce(mockWorkers)
        .mockResolvedValueOnce(mockLifecycle)

      // First collect - hasChanged returns true after first collect (initial state)
      await collector.collect()
      expect(collector.hasChanged()).toBe(true)
    })
  })

  describe('getPreviousState()', () => {
    it('should return null on first call', () => {
      expect(collector.getPreviousState()).toBeNull()
    })

    it('should return previous state after collect', async () => {
      const mockWorkers = {
        version: 1,
        updatedAt: '2026-01-01T00:00:00Z',
        workers: {},
      }

      const mockLifecycle = {
        version: 1,
        idleTimeoutMinutes: 30,
        updatedAt: '2026-01-01T00:00:00Z',
        workers: {},
      }

      vi.spyOn(config, 'getWorkersRegistryPath').mockReturnValue('/mock/registry.json')
      vi.spyOn(config, 'getWorkerLifecyclePath').mockReturnValue('/mock/lifecycle.json')
      vi.spyOn(fileReader, 'readJsonFile')
        .mockResolvedValueOnce(mockWorkers)
        .mockResolvedValueOnce(mockLifecycle)

      await collector.collect()
      const previous = collector.getPreviousState()

      expect(previous).not.toBeNull()
      expect(previous).toHaveProperty('agents')
    })
  })
})
