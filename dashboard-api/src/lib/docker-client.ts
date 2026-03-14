export interface DockerClientOptions {
  socketPath?: string
  baseUrl?: string
}

export interface ListContainersOptions {
  all?: boolean
  filter?: string
}

export interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  state: string
  created: number
  ports: Array<{ privatePort: number; publicPort?: number; type: string }>
}

/**
 * Docker API client wrapper
 * Provides typed interface for Docker operations
 */
export class DockerClient {
  private baseUrl: string

  constructor(options: DockerClientOptions = {}) {
    // Use socket by default, or HTTP base URL
    this.baseUrl = options.socketPath 
      ? `http://unix:${options.socketPath}:`
      : options.baseUrl || 'http://localhost:2375'
  }

  /**
   * List containers
   * @param options - List options
   * @returns Array of container info
   */
  async listContainers(options: ListContainersOptions = {}): Promise<DockerContainer[]> {
    const query = new URLSearchParams()
    if (options.all) query.set('all', 'true')
    if (options.filter) query.set('filter', options.filter)

    const url = `/containers/json?${query.toString()}`
    const response = await this.request<Array<{
      Id: string
      Names: string[]
      Image: string
      Status: string
      State: string
      Created: number
      Ports: Array<{ PrivatePort: number; PublicPort?: number; Type: string }>
    }>>(url)

    return response.map((c) => ({
      id: c.Id,
      name: c.Names[0]?.replace(/^\//, '') || '',
      image: c.Image,
      status: c.Status,
      state: c.State,
      created: c.Created,
      ports: c.Ports.map((p) => ({
        privatePort: p.PrivatePort,
        publicPort: p.PublicPort,
        type: p.Type,
      })),
    }))
  }

  /**
   * Get container info by name or ID
   * @param containerId - Container name or ID
   * @returns Container details
   */
  async getContainer(containerId: string): Promise<DockerContainer | null> {
    try {
      const containers = await this.listContainers({ all: true })
      return containers.find(
        (c) => c.id === containerId || c.name === containerId
      ) || null
    } catch {
      return null
    }
  }

  /**
   * Get container stats
   * @param containerId - Container ID
   * @returns Container stats
   */
  async getContainerStats(containerId: string): Promise<{
    cpuPercent: number
    memoryUsage: number
    memoryLimit: number
    networkRx: number
    networkTx: number
  } | null> {
    try {
      const response = await this.request<{
        cpu_stats: { cpu_usage: { total_usage: number } }
        precpu_stats: { cpu_usage: { total_usage: number } }
        memory_stats: { usage: number; limit: number }
        networks?: Record<string, { rx_bytes: number; tx_bytes: number }>
      }>(`/containers/${containerId}/stats?stream=false`)

      const cpuDelta = response.cpu_stats.cpu_usage.total_usage - response.precpu_stats.cpu_usage.total_usage
      const cpuPercent = cpuDelta > 0 ? (cpuDelta / 10000000) * 100 : 0

      let networkRx = 0
      let networkTx = 0
      if (response.networks) {
        for (const net of Object.values(response.networks)) {
          networkRx += net.rx_bytes
          networkTx += net.tx_bytes
        }
      }

      return {
        cpuPercent,
        memoryUsage: response.memory_stats.usage,
        memoryLimit: response.memory_stats.limit,
        networkRx,
        networkTx,
      }
    } catch {
      return null
    }
  }

  /**
   * Make HTTP request to Docker API
   */
  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${this.baseUrl}${path}`
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Docker API error: ${response.status} ${response.statusText}`)
    }

    return response.json() as Promise<T>
  }
}

// Default client instance
let defaultClient: DockerClient | null = null

/**
 * Get default Docker client instance
 */
export function getDockerClient(): DockerClient {
  if (!defaultClient) {
    const socketPath = process.env.DOCKER_SOCKET || '/var/run/docker.sock'
    defaultClient = new DockerClient({ socketPath })
  }
  return defaultClient
}

/**
 * Execute a command in a running container
 * @param containerId - Container name or ID
 * @param command - Command to execute (as array for proper escaping)
 * @returns Command output as string
 */
export async function dockerExec(containerId: string, command: string[]): Promise<string> {
  const socketPath = process.env.DOCKER_SOCKET || '/var/run/docker.sock'
  const baseUrl = `http://unix:${socketPath}:`

  try {
    // Create exec instance
    const createResponse = await fetch(`${baseUrl}/containers/${containerId}/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        AttachStdout: true,
        AttachStderr: true,
        Cmd: command,
        Tty: false,
      }),
    })

    if (!createResponse.ok) {
      const errorText = await createResponse.text()
      throw new Error(`Failed to create exec: ${createResponse.status} ${errorText}`)
    }

    const execData = await createResponse.json() as { Id: string }
    const execId = execData.Id

    // Start exec instance
    const startResponse = await fetch(`${baseUrl}/exec/${execId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        Detach: false,
        Tty: false,
      }),
    })

    if (!startResponse.ok) {
      const errorText = await startResponse.text()
      throw new Error(`Failed to start exec: ${startResponse.status} ${errorText}`)
    }

    // Read the response body as text
    const output = await startResponse.text()
    return output
  } catch (error) {
    // If container not found or not running, return empty string
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('not found') || errorMessage.includes('No such container')) {
      return ''
    }
    throw error
  }
}
