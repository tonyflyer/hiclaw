import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { DockerClient, getDockerClient } from '../lib/docker-client.js'

describe('docker-client', () => {
  let client: DockerClient

  beforeEach(() => {
    client = new DockerClient({ socketPath: '/var/run/docker.sock' })
    vi.restoreAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should use socket path when provided', () => {
      const client = new DockerClient({ socketPath: '/custom/docker.sock' })
      expect(client).toBeDefined()
    })

    it('should use baseUrl when provided', () => {
      const client = new DockerClient({ baseUrl: 'http://localhost:2375' })
      expect(client).toBeDefined()
    })

    it('should use default values when no options provided', () => {
      const client = new DockerClient()
      expect(client).toBeDefined()
    })
  })

  describe('listContainers', () => {
    it('should fetch and transform container list', async () => {
      const mockContainers = [
        {
          Id: 'abc123',
          Names: ['/hiclaw-manager'],
          Image: 'hiclaw/manager:latest',
          Status: 'running',
          State: 'running',
          Created: 1234567890,
          Ports: [{ PrivatePort: 8080, PublicPort: 18080, Type: 'tcp' }],
        },
        {
          Id: 'def456',
          Names: ['/hiclaw-worker-alice'],
          Image: 'hiclaw/worker:latest',
          Status: 'exited',
          State: 'exited',
          Created: 1234567891,
          Ports: [],
        },
      ]

      // Mock fetch
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockContainers,
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await client.listContainers()

      // Check the URL contains containers/json
      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('/containers/json')

      expect(result).toHaveLength(2)
      expect(result[0]).toEqual({
        id: 'abc123',
        name: 'hiclaw-manager',
        image: 'hiclaw/manager:latest',
        status: 'running',
        state: 'running',
        created: 1234567890,
        ports: [{ privatePort: 8080, publicPort: 18080, type: 'tcp' }],
      })

      vi.unstubAllGlobals()
    })

    it('should pass filter option', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
      vi.stubGlobal('fetch', mockFetch)

      await client.listContainers({ filter: 'name=hiclaw-manager' })

      const calledUrl = mockFetch.mock.calls[0][0] as string
      expect(calledUrl).toContain('filter=')

      vi.unstubAllGlobals()
    })

    it('should throw on API error', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      })
      vi.stubGlobal('fetch', mockFetch)

      await expect(client.listContainers()).rejects.toThrow('Docker API error: 500')

      vi.unstubAllGlobals()
    })
  })

  describe('getContainer', () => {
    it('should return container when found', async () => {
      const mockContainers = [
        {
          Id: 'abc123',
          Names: ['/hiclaw-manager'],
          Image: 'hiclaw/manager:latest',
          Status: 'running',
          State: 'running',
          Created: 1234567890,
          Ports: [],
        },
      ]

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockContainers,
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await client.getContainer('hiclaw-manager')

      expect(result).not.toBeNull()
      expect(result?.name).toBe('hiclaw-manager')

      vi.unstubAllGlobals()
    })

    it('should return null when not found', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      })
      vi.stubGlobal('fetch', mockFetch)

      const result = await client.getContainer('nonexistent')

      expect(result).toBeNull()

      vi.unstubAllGlobals()
    })
  })

  describe('getDockerClient', () => {
    it('should return singleton instance', () => {
      const client1 = getDockerClient()
      const client2 = getDockerClient()

      expect(client1).toBe(client2)
    })
  })
})
