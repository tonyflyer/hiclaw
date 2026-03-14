// State Collector - Aggregates data from all sources for SSE events
import { readJsonFile } from './file-reader.js'
import { getWorkersRegistryPath, getWorkerLifecyclePath, getStatePath, getManagerSessionDir } from './config.js'
import { getDockerClient } from './docker-client.js'
import type { Agent, WorkerRegistry } from '../types/agent.js'
import type { WorkerLifecycle } from '../types/container.js'
import type { Task, TaskState, TaskMeta } from '../types/task.js'
import type { ContainerResource } from '../types/container.js'
import type { AgentMetrics } from '../types/metrics.js'
import { getTaskMetaPath } from './config.js'

/**
 * Aggregated state for SSE events
 */
export interface SystemState {
  /** Current agents in the system */
  agents: Agent[]
  /** Active tasks */
  tasks: Task[]
  /** System metrics */
  metrics: {
    byAgent: Record<string, AgentMetrics>
    totals: AgentMetrics
  }
  /** Container resources */
  resources: ContainerResource[]
  /** ISO-8601 timestamp when state was collected */
  timestamp: string
}

/**
 * State Collector - Periodically aggregates data from agents, tasks, metrics, and resources
 * Detects changes between collections to emit events only when data changes
 */
export class StateCollector {
  private previousState: SystemState | null = null
  private lastSentState: SystemState | null = null
  private isFirstCollection: boolean = true

  constructor() {
    this.previousState = null
    this.lastSentState = null
    this.isFirstCollection = true
  }

  /**
   * Collect current state from all sources
   */
  async collect(): Promise<SystemState> {
    const [agents, tasks, metrics, resources] = await Promise.all([
      this.collectAgents(),
      this.collectTasks(),
      this.collectMetrics(),
      this.collectResources(),
    ])

    const state: SystemState = {
      agents,
      tasks,
      metrics,
      resources,
      timestamp: new Date().toISOString(),
    }

    // Store current state as previous for next comparison
    this.previousState = state

    return state
  }

  /**
   * Check if state has changed since last collection
   * Returns true for first collection (to send initial state)
   * Returns true if current state differs from last sent state
   */
  hasChanged(): boolean {
    // First call - no previous state to compare - send initial state
    if (!this.previousState) {
      return false
    }

    // First collection after init - always send initial state
    if (this.isFirstCollection) {
      this.isFirstCollection = false
      this.lastSentState = this.previousState
      return true
    }

    // Compare with last sent state (excluding timestamp)
    if (!this.lastSentState) {
      this.lastSentState = this.previousState
      return true
    }

    const changed = this.compareStates(this.lastSentState, this.previousState)
    
    // Update last sent state if changed
    if (changed) {
      this.lastSentState = this.previousState
    }
    
    return changed
  }

  /**
   * Compare two states (excluding timestamp)
   */
  private compareStates(a: SystemState, b: SystemState): boolean {
    // Compare agents
    if (a.agents.length !== b.agents.length) return true
    for (let i = 0; i < a.agents.length; i++) {
      if (JSON.stringify(a.agents[i]) !== JSON.stringify(b.agents[i])) return true
    }

    // Compare tasks
    if (a.tasks.length !== b.tasks.length) return true
    for (let i = 0; i < a.tasks.length; i++) {
      if (JSON.stringify(a.tasks[i]) !== JSON.stringify(b.tasks[i])) return true
    }

    // Compare metrics (byAgent)
    const aMetricsKeys = Object.keys(a.metrics.byAgent)
    const bMetricsKeys = Object.keys(b.metrics.byAgent)
    if (aMetricsKeys.length !== bMetricsKeys.length) return true
    for (const key of aMetricsKeys) {
      if (JSON.stringify(a.metrics.byAgent[key]) !== JSON.stringify(b.metrics.byAgent[key])) return true
    }

    // Compare resources
    if (a.resources.length !== b.resources.length) return true
    for (let i = 0; i < a.resources.length; i++) {
      if (JSON.stringify(a.resources[i]) !== JSON.stringify(b.resources[i])) return true
    }

    return false
  }

  /**
   * Get the previous state
   */
  getPreviousState(): SystemState | null {
    return this.previousState
  }

  /**
   * Collect agents data (reused from agents.ts)
   */
  private async collectAgents(): Promise<Agent[]> {
    try {
      const registry = await readJsonFile<WorkerRegistry>(getWorkersRegistryPath())
      let lifecycle: WorkerLifecycle

      try {
        lifecycle = await readJsonFile<WorkerLifecycle>(getWorkerLifecyclePath())
      } catch {
        lifecycle = { version: 1, idleTimeoutMinutes: 30, updatedAt: '', workers: {} }
      }

      // Convert registry workers to array and merge with lifecycle data
      return Object.values(registry.workers).map((worker) => {
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
    } catch (error) {
      // Return empty array on error (e.g., file not found)
      const errorMessage = error instanceof Error ? error.message : ''
      if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
        return []
      }
      console.error('Error collecting agents:', errorMessage)
      return []
    }
  }

  /**
   * Collect tasks data (reused from tasks.ts)
   */
  private async collectTasks(): Promise<Task[]> {
    try {
      const state = await readJsonFile<TaskState>(getStatePath())
      const activeTasks = state.activeTasks || []

      // Enrich each task with meta information
      const enrichedTasks: Task[] = await Promise.all(
        activeTasks.map(async (task) => {
          try {
            const meta = await readJsonFile<TaskMeta>(getTaskMetaPath(task.taskId))
            return { ...task, ...meta } as Task
          } catch {
            return task
          }
        })
      )

      return enrichedTasks
    } catch (error) {
      // Return empty array on error
      const errorMessage = error instanceof Error ? error.message : ''
      if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
        return []
      }
      console.error('Error collecting tasks:', errorMessage)
      return []
    }
  }

  /**
   * Collect metrics data (reused from metrics.ts)
   */
  private async collectMetrics(): Promise<SystemState['metrics']> {
    const agentMetrics: Record<string, AgentMetrics | null> = {}

    try {
      // Get Manager session metrics
      const managerSessionDir = getManagerSessionDir()
      const managerMetrics = await this.getManagerMetrics(managerSessionDir)
      agentMetrics['manager'] = managerMetrics
    } catch (error) {
      console.error('Error collecting manager metrics:', error)
      agentMetrics['manager'] = null
    }

    // Get worker metrics
    try {
      const registry = await readJsonFile<WorkerRegistry>(getWorkersRegistryPath())
      const dockerClient = getDockerClient()
      const containers = await dockerClient.listContainers({ all: true })
      const runningWorkerNames = new Set(
        containers
          .filter((c) => c.state === 'running' && c.name.startsWith('hiclaw-worker-'))
          .map((c) => c.name.replace('hiclaw-worker-', ''))
      )

      for (const worker of Object.values(registry.workers)) {
        if (runningWorkerNames.has(worker.name)) {
          const workerContainerName = `hiclaw-worker-${worker.name}`
          const workerSessionDir = `/root/hiclaw-fs/agents/${worker.name}/.openclaw/agents/main/sessions`
          const workerMetrics = await this.getWorkerMetrics(workerContainerName, workerSessionDir)
          agentMetrics[worker.name] = workerMetrics
        } else {
          agentMetrics[worker.name] = null
        }
      }
    } catch (error) {
      console.error('Error collecting worker metrics:', error)
    }

    // Aggregate metrics
    const { byAgent, totals } = this.aggregateMetrics(agentMetrics)

    return { byAgent, totals }
  }

  /**
   * Collect resources data (reused from resources.ts)
   */
  private async collectResources(): Promise<ContainerResource[]> {
    try {
      const dockerClient = getDockerClient()
      const allContainers = await dockerClient.listContainers({ all: true })

      // Filter for hiclaw- prefixed containers
      const hiclawContainers = allContainers.filter((c) => c.name.startsWith('hiclaw-'))

      // Get stats for each container
      const containers: ContainerResource[] = await Promise.all(
        hiclawContainers.map(async (container) => {
          const containerState = container.state.toLowerCase()
          let stats = null

          if (containerState === 'running') {
            try {
              stats = await dockerClient.getContainerStats(container.id)
            } catch {
              stats = null
            }
          }

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

      return containers
    } catch (error) {
      // Return empty array on error
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('no such file') ||
        errorMessage.includes('connect')
      ) {
        return []
      }
      console.error('Error collecting resources:', errorMessage)
      return []
    }
  }

  /**
   * Get metrics for manager container (from local filesystem)
   */
  private async getManagerMetrics(sessionDir: string): Promise<AgentMetrics | null> {
    try {
      const fs = await import('fs/promises')
      const path = await import('path')

      // Read directory to find latest session file
      const files = await fs.readdir(sessionDir)
      const jsonlFiles = files.filter((f) => f.endsWith('.jsonl')).sort().reverse()

      if (jsonlFiles.length === 0) {
        return null
      }

      const latestSession = path.join(sessionDir, jsonlFiles[0])
      const content = await fs.readFile(latestSession, 'utf-8')
      const lines = content.split('\n').slice(-1000).join('\n')

      if (!content) {
        return null
      }

      return this.parseSessionMetrics(lines)
    } catch {
      return null
    }
  }

  /**
   * Get metrics for worker container (from container via docker exec)
   */
  private async getWorkerMetrics(containerName: string, sessionDir: string): Promise<AgentMetrics | null> {
    try {
      const { dockerExec } = await import('./docker-client.js')

      // Get latest session file
      const lsOutput = await dockerExec(containerName, [
        'sh', '-c',
        `ls -t '${sessionDir}'/*.jsonl 2>/dev/null | head -1`
      ])

      const latestSession = lsOutput.trim()
      if (!latestSession) {
        return null
      }

      // Read tail of session file
      const tailOutput = await dockerExec(containerName, [
        'sh', '-c',
        `tail -n 1000 '${latestSession}' 2>/dev/null`
      ])

      if (!tailOutput) {
        return null
      }

      return this.parseSessionMetrics(tailOutput)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (
        errorMessage.includes('ENOENT') ||
        errorMessage.includes('not found') ||
        errorMessage.includes('No such container') ||
        errorMessage.includes('not running')
      ) {
        return null
      }
      console.error(`Error getting worker metrics for ${containerName}:`, errorMessage)
      return null
    }
  }

  /**
   * Parse session metrics from JSONL content
   */
  private parseSessionMetrics(content: string): AgentMetrics | null {
    const lines = content.split('\n').filter((line) => line.trim())
    const metrics: AgentMetrics = {
      llmCalls: 0,
      tokens: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
      timing: {
        start: '',
        end: '',
      },
    }

    let earliestStart = ''
    let latestEnd = ''

    for (const line of lines) {
      try {
        const entry = JSON.parse(line)

        // Count LLM calls (tool_calls entries)
        if (entry.tool_calls) {
          metrics.llmCalls++
        }

        // Sum token usage
        if (entry.usage) {
          metrics.tokens.input += entry.usage.prompt_tokens || 0
          metrics.tokens.output += entry.usage.completion_tokens || 0
          metrics.tokens.cacheRead += entry.usage.prompt_cache_hit_tokens || 0
          metrics.tokens.cacheWrite += entry.usage.prompt_cache_miss_tokens || 0
        }

        // Track timing
        if (entry.timestamp) {
          if (!earliestStart || entry.timestamp < earliestStart) {
            earliestStart = entry.timestamp
          }
          if (!latestEnd || entry.timestamp > latestEnd) {
            latestEnd = entry.timestamp
          }
        }
      } catch {
        // Skip invalid JSON lines
      }
    }

    // Calculate total tokens
    metrics.tokens.total = metrics.tokens.input + metrics.tokens.output

    // Set timing
    metrics.timing.start = earliestStart
    metrics.timing.end = latestEnd

    // Return null if no metrics collected
    if (metrics.llmCalls === 0 && metrics.tokens.total === 0) {
      return null
    }

    return metrics
  }

  /**
   * Aggregate metrics from multiple agents
   */
  private aggregateMetrics(agentMetrics: Record<string, AgentMetrics | null>): {
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

        // Track timing
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
}
