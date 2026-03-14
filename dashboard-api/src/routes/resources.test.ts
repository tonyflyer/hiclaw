import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express from 'express'
import resourcesRouter from '../routes/resources.js'
import * as dockerClient from '../lib/docker-client.js'

// Create test app
const createTestApp = () => {
  const app = express()
  app.use('/api/resources', resourcesRouter)
  return app
}

describe('GET /api/resources', () => {
  let app: express.Express

  beforeEach(() => {
    vi.restoreAllMocks()
    app = createTestApp()
  })

  it('should return empty containers array when no containers exist', async () => {
    vi.spyOn(dockerClient.DockerClient.prototype, 'listContainers').mockResolvedValue([])

    const res = await request(app).get('/api/resources')

    expect(res.status).toBe(200)
    expect(res.body.containers).toEqual([])
    expect(res.body.available).toBe(true)
    expect(res.body.timestamp).toBeDefined()
  })

  it('should return containers with hiclaw- prefix', async () => {
    vi.spyOn(dockerClient.DockerClient.prototype, 'listContainers').mockResolvedValue([
      { id: 'abc123', name: 'hiclaw-manager', image: 'hiclaw-manager', status: 'running', state: 'running', created: 0, ports: [] },
      { id: 'def456', name: 'hiclaw-worker-alice', image: 'hiclaw-worker', status: 'running', state: 'running', created: 0, ports: [] },
      { id: 'ghi789', name: 'hiclaw-worker-bob', image: 'hiclaw-worker', status: 'exited', state: 'exited', created: 0, ports: [] },
      { id: 'jkl012', name: 'nginx', image: 'nginx', status: 'running', state: 'running', created: 0, ports: [] },
    ] as any)
    vi.spyOn(dockerClient.DockerClient.prototype, 'getContainerStats').mockResolvedValue({
      cpuPercent: 10.5,
      memoryUsage: 1024000,
      memoryLimit: 2048000,
      networkRx: 500,
      networkTx: 300,
    })

    const res = await request(app).get('/api/resources')

    expect(res.status).toBe(200)
    expect(res.body.available).toBe(true)
    expect(res.body.containers).toHaveLength(3) // Only hiclaw-* containers
    // Verify non-hiclaw container is excluded
    const containerNames = res.body.containers.map((c: any) => c.name)
    expect(containerNames).toContain('hiclaw-manager')
    expect(containerNames).toContain('hiclaw-worker-alice')
    expect(containerNames).toContain('hiclaw-worker-bob')
    expect(containerNames).not.toContain('nginx')
  })

  it('should include CPU and memory stats for running containers', async () => {
    vi.spyOn(dockerClient.DockerClient.prototype, 'listContainers').mockResolvedValue([
      { id: 'abc123', name: 'hiclaw-worker-alice', image: 'hiclaw-worker', status: 'running', state: 'running', created: 0, ports: [] },
    ] as any)
    vi.spyOn(dockerClient.DockerClient.prototype, 'getContainerStats').mockResolvedValue({
      cpuPercent: 25.5,
      memoryUsage: 512000000,
      memoryLimit: 1024000000,
      networkRx: 1000,
      networkTx: 500,
    })

    const res = await request(app).get('/api/resources')

    expect(res.status).toBe(200)
    const container = res.body.containers[0]
    expect(container.cpuPercent).toBe(25.5)
    expect(container.memoryUsage).toBe(512000000)
    expect(container.memoryLimit).toBe(1024000000)
    expect(container.networkRx).toBe(1000)
    expect(container.networkTx).toBe(500)
  })

  it('should handle stopped containers with null stats', async () => {
    vi.spyOn(dockerClient.DockerClient.prototype, 'listContainers').mockResolvedValue([
      { id: 'abc123', name: 'hiclaw-worker-alice', image: 'hiclaw-worker', status: 'exited', state: 'exited', created: 0, ports: [] },
    ] as any)
    vi.spyOn(dockerClient.DockerClient.prototype, 'getContainerStats').mockResolvedValue(null)

    const res = await request(app).get('/api/resources')

    expect(res.status).toBe(200)
    const container = res.body.containers[0]
    expect(container.containerStatus).toBe('exited')
    expect(container.cpuPercent).toBe(0)
    expect(container.memoryUsage).toBe(0)
    expect(container.memoryLimit).toBe(0)
  })

  it('should return available: false when Docker API is unavailable', async () => {
    vi.spyOn(dockerClient.DockerClient.prototype, 'listContainers').mockRejectedValue(new Error('connect ENOENT /var/run/docker.sock'))

    const res = await request(app).get('/api/resources')

    expect(res.status).toBe(200)
    expect(res.body.available).toBe(false)
    expect(res.body.containers).toEqual([])
    expect(res.body.message).toContain('Docker API not available')
  })

  it('should handle getContainerStats error gracefully', async () => {
    vi.spyOn(dockerClient.DockerClient.prototype, 'listContainers').mockResolvedValue([
      { id: 'abc123', name: 'hiclaw-worker-alice', image: 'hiclaw-worker', status: 'running', state: 'running', created: 0, ports: [] },
    ] as any)
    vi.spyOn(dockerClient.DockerClient.prototype, 'getContainerStats').mockRejectedValue(new Error('Container not found'))

    const res = await request(app).get('/api/resources')

    expect(res.status).toBe(200)
    const container = res.body.containers[0]
    expect(container.cpuPercent).toBe(0)
    expect(container.memoryUsage).toBe(0)
    expect(container.memoryLimit).toBe(0)
  })

  it('should return timestamp in ISO format', async () => {
    vi.spyOn(dockerClient.DockerClient.prototype, 'listContainers').mockResolvedValue([])

    const res = await request(app).get('/api/resources')

    expect(res.status).toBe(200)
    expect(res.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})
