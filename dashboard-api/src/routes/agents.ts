import { Router } from 'express'
import { readJsonFile } from '../lib/file-reader.js'
import { getWorkersRegistryPath, getWorkerLifecyclePath } from '../lib/config.js'
import type { Agent } from '../types/agent.js'
import type { WorkerRegistry } from '../types/agent.js'
import type { WorkerLifecycle } from '../types/container.js'

const router = Router()

// GET /api/agents - List all agents
router.get('/', async (_req, res) => {
  try {
    const registryPath = getWorkersRegistryPath()
    const lifecyclePath = getWorkerLifecyclePath()

    let registry: WorkerRegistry
    let lifecycle: WorkerLifecycle

    try {
      registry = await readJsonFile<WorkerRegistry>(registryPath)
    } catch (error) {
      // Registry file not found - return empty array
      const errorMessage = error instanceof Error ? error.message : ''
      if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
        return res.json({ agents: [], timestamp: new Date().toISOString() })
      }
      // Other errors (like malformed JSON) should be thrown to outer catch
      throw error
    }

    try {
      lifecycle = await readJsonFile<WorkerLifecycle>(lifecyclePath)
    } catch (error) {
      // Lifecycle file not found - use empty object
      const errorMessage = error instanceof Error ? error.message : ''
      if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
        lifecycle = { version: 1, idleTimeoutMinutes: 30, updatedAt: '', workers: {} }
      } else {
        // Other errors (like malformed JSON) should be thrown to outer catch
        throw error
      }
    }

    // Convert registry workers to array and merge with lifecycle data
    const agents: Agent[] = Object.values(registry.workers).map((worker) => {
      const lifecycleEntry = lifecycle.workers[worker.name]

      // Map lifecycle containerStatus to agent containerStatus
      let containerStatus: Agent['containerStatus'] = 'unknown'
      if (lifecycleEntry) {
        const status = lifecycleEntry.containerStatus.toLowerCase()
        if (status === 'running') {
          containerStatus = 'running'
        } else if (status === 'exited' || status === 'stopped') {
          containerStatus = 'stopped'
        } else if (status === 'not_found') {
          containerStatus = 'not_found'
        } else {
          containerStatus = 'unknown'
        }
      }

      return {
        ...worker,
        containerStatus,
      }
    })

    res.json({
      agents,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    res.status(500).json({
      error: 'Failed to fetch agents',
      message,
    })
  }
})

// GET /api/agents/:id - Get agent details
router.get('/:id', (_req, res) => {
  res.status(501).json({ error: 'Not implemented', message: 'Agent details coming in Wave 2' })
})

// POST /api/agents - Create agent (future)
router.post('/', (_req, res) => {
  res.status(501).json({ error: 'Not implemented', message: 'Agent creation coming in Wave 2' })
})

// DELETE /api/agents/:id - Delete agent (future)
router.delete('/:id', (_req, res) => {
  res.status(501).json({ error: 'Not implemented', message: 'Agent deletion coming in Wave 2' })
})

export default router
