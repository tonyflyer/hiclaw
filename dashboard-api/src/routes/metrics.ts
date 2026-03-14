import { Router } from 'express'
import path from 'path'
import { readJsonFile, readDir, readFileContent } from '../lib/file-reader.js'
import { dockerExec, getDockerClient } from '../lib/docker-client.js'
import { getWorkersRegistryPath, getManagerSessionDir } from '../lib/config.js'
import { parseSessionMetrics, getLatestSessionFile } from '../lib/jsonl-parser.js'
import type { WorkerRegistry } from '../types/agent.js'
import type { AgentMetrics } from '../types/metrics.js'

const router = Router()

// Manager container name
const MANAGER_CONTAINER = 'hiclaw-manager'

// Maximum number of lines to read from session files (recent metrics optimization)
const MAX_LINES = 1000

/**
 * Get the latest session file path from a local directory
 */
async function getLatestLocalSession(sessionDir: string): Promise<string> {
  try {
    const files = await readDir(sessionDir)
    const jsonlFiles = files.filter((f) => f.endsWith('.jsonl')).sort().reverse()
    if (jsonlFiles.length > 0) {
      return path.join(sessionDir, jsonlFiles[0])
    }
    return ''
  } catch {
    return ''
  }
}

/**
 * Read the tail of a session file (last N lines for recent metrics)
 */
async function readSessionTail(filePath: string, maxLines: number): Promise<string> {
  try {
    const content = await readFileContent(filePath)
    const lines = content.split('\n')
    const recentLines = lines.slice(-maxLines)
    return recentLines.join('\n')
  } catch {
    return ''
  }
}

/**
 * Get session metrics for a container (manager or worker)
 */
async function getContainerSessionMetrics(
  containerName: string,
  sessionDir: string,
  isManager: boolean
): Promise<AgentMetrics | null> {
  try {
    let latestSession: string

    if (isManager) {
      // Manager: read from local filesystem (mounted workspace)
      latestSession = await getLatestLocalSession(sessionDir)
      if (!latestSession) {
        return null
      }
      const content = await readSessionTail(latestSession, MAX_LINES)
      if (!content) {
        return null
      }
      return parseSessionMetrics(content)
    } else {
      // Worker: read from container via docker exec
      // First, get the latest session file path
      const lsOutput = await dockerExec(containerName, [
        'sh', '-c',
        `ls -t '${sessionDir}'/*.jsonl 2>/dev/null | head -1`
      ])

      latestSession = getLatestSessionFile(lsOutput)
      if (!latestSession) {
        return null
      }

      // Read the tail of the session file (last 1000 lines)
      const tailOutput = await dockerExec(containerName, [
        'sh', '-c',
        `tail -n ${MAX_LINES} '${latestSession}' 2>/dev/null`
      ])

      if (!tailOutput) {
        return null
      }

      return parseSessionMetrics(tailOutput)
    }
  } catch (error) {
    // If file not found or container not running, return null (not an error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('ENOENT') || 
        errorMessage.includes('not found') || 
        errorMessage.includes('No such container') ||
        errorMessage.includes('not running')) {
      return null
    }
    // Other errors - log but don't fail
    console.error(`Error getting session metrics for ${containerName}:`, errorMessage)
    return null
  }
}

/**
 * Aggregate metrics from multiple agents
 */
function aggregateMetrics(agentMetrics: Record<string, AgentMetrics | null>): {
  byAgent: Record<string, AgentMetrics>
  totals: AgentMetrics
} {
  const byAgent: Record<string, AgentMetrics> = {}
  
  let totalLlmCalls = 0
  let totalInput = 0
  let totalOutput = 0
  let totalCacheRead = 0
  let totalCacheWrite = 0
  let earliestStart = ''
  let latestEnd = ''

  for (const [agentName, metrics] of Object.entries(agentMetrics)) {
    if (metrics && metrics.llmCalls > 0) {
      byAgent[agentName] = metrics

      // Accumulate totals
      totalLlmCalls += metrics.llmCalls
      totalInput += metrics.tokens.input
      totalOutput += metrics.tokens.output
      totalCacheRead += metrics.tokens.cacheRead
      totalCacheWrite += metrics.tokens.cacheWrite

      // Track timing - earliest start, latest end
      if (metrics.timing.start) {
        if (!earliestStart || metrics.timing.start < earliestStart) {
          earliestStart = metrics.timing.start
        }
      }
      if (metrics.timing.end) {
        if (!latestEnd || metrics.timing.end > latestEnd) {
          latestEnd = metrics.timing.end
        }
      }
    }
  }

  const totals: AgentMetrics = {
    llmCalls: totalLlmCalls,
    tokens: {
      input: totalInput,
      output: totalOutput,
      cacheRead: totalCacheRead,
      cacheWrite: totalCacheWrite,
      total: totalInput + totalOutput,
    },
    timing: {
      start: earliestStart,
      end: latestEnd,
    },
  }

  return { byAgent, totals }
}

// GET /api/metrics - Get system metrics
router.get('/', async (_req, res) => {
  try {
    const agentMetrics: Record<string, AgentMetrics | null> = {}

    // Get Manager session metrics (from local filesystem)
    const managerSessionDir = getManagerSessionDir()
    const managerMetrics = await getContainerSessionMetrics(
      MANAGER_CONTAINER,
      managerSessionDir,
      true // isManager
    )
    agentMetrics['manager'] = managerMetrics

    // Get Worker session metrics (from containers)
    try {
      const registry = await readJsonFile<WorkerRegistry>(getWorkersRegistryPath())
      
      // Get list of running worker containers
      const dockerClient = getDockerClient()
      const containers = await dockerClient.listContainers({ all: true })
      const runningWorkerNames = new Set(
        containers
          .filter((c) => c.state === 'running' && c.name.startsWith('hiclaw-worker-'))
          .map((c) => c.name.replace('hiclaw-worker-', ''))
      )

      // Get metrics for each worker in the registry
      for (const worker of Object.values(registry.workers)) {
        // Only try to get metrics if the container is running
        if (runningWorkerNames.has(worker.name)) {
          const workerContainerName = `hiclaw-worker-${worker.name}`
          const workerSessionDir = `/root/hiclaw-fs/agents/${worker.name}/.openclaw/agents/main/sessions`
          
          const workerMetrics = await getContainerSessionMetrics(
            workerContainerName,
            workerSessionDir,
            false // isManager
          )
          agentMetrics[worker.name] = workerMetrics
        } else {
          // Container not running - skip this worker
          agentMetrics[worker.name] = null
        }
      }
    } catch (error) {
      // If registry file doesn't exist or other error, continue with empty workers
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (!errorMessage.includes('ENOENT') && !errorMessage.includes('no such file')) {
        console.error('Error fetching worker registry:', errorMessage)
      }
    }

    // Aggregate metrics
    const { byAgent, totals } = aggregateMetrics(agentMetrics)

    res.json({
      metrics: {
        byAgent,
        totals,
      },
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    res.status(500).json({
      error: 'Failed to fetch metrics',
      message,
    })
  }
})

// GET /api/metrics/containers - Container-level metrics
router.get('/containers', (_req, res) => {
  res.status(501).json({ error: 'Not implemented', message: 'Container metrics coming in Wave 2' })
})

// GET /api/metrics/agents - Agent-level metrics
router.get('/agents', (_req, res) => {
  res.status(501).json({ error: 'Not implemented', message: 'Agent metrics coming in Wave 2' })
})

export default router
