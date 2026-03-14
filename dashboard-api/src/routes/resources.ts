import { Router } from 'express'
import { getDockerClient } from '../lib/docker-client.js'
import type { ContainerResource } from '../types/container.js'

const router = Router()
// GET /api/resources - Get container resource usage
router.get('/', async (_req, res) => {
  try {
    const dockerClient = getDockerClient()

    // Get all containers (including stopped)
    const allContainers = await dockerClient.listContainers({ all: true })

    // Filter for hiclaw- prefixed containers
    const hiclawContainers = allContainers.filter((c) =>
      c.name.startsWith('hiclaw-')
    )

    // Get stats for each container
    const containers: ContainerResource[] = await Promise.all(
      hiclawContainers.map(async (container) => {
        const containerState = container.state.toLowerCase()
        let stats = null

        // Only get stats for running containers
        if (containerState === 'running') {
          try {
            stats = await dockerClient.getContainerStats(container.id)
          } catch {
            // Stats fetch failed - use zeros
            stats = null
          }
        }

        // Map container status to ContainerResourceStatus
        let containerStatus: ContainerResource['containerStatus']
        switch (containerState) {
          case 'running':
            containerStatus = 'running'
            break
          case 'paused':
            containerStatus = 'paused'
            break
          case 'restarting':
            containerStatus = 'restarting'
            break
          case 'exited':
            containerStatus = 'exited'
            break
          default:
            containerStatus = 'stopped'
        }

        return {
          containerId: container.id,
          name: container.name,
          cpuPercent: stats?.cpuPercent ?? 0,
          memoryUsage: stats?.memoryUsage ?? 0,
          memoryLimit: stats?.memoryLimit ?? 0,
          networkRx: stats?.networkRx ?? 0,
          networkTx: stats?.networkTx ?? 0,
          containerStatus,
          idleSince: null,
          autoStoppedAt: null,
          lastStartedAt: null,
        }
      })
    )

    res.json({
      containers,
      available: true,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    // Docker API unavailable - return graceful fallback
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (
      errorMessage.includes('ENOENT') ||
      errorMessage.includes('no such file') ||
      errorMessage.includes('connect')
    ) {
      return res.json({
        containers: [],
        available: false,
        message: 'Docker API not available',
        timestamp: new Date().toISOString(),
      })
    }

    // Other errors
    const message = error instanceof Error ? error.message : 'Unknown error'
    res.status(500).json({
      error: 'Failed to fetch resources',
      message,
    })
  }
})

export default router
