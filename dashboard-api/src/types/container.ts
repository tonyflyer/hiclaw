// Container Resource Type Definitions
// Based on worker-lifecycle.json structure from lifecycle-worker.sh

/**
 * Container resource usage metrics
 */
export interface ContainerResource {
  /** Docker container ID */
  containerId: string;
  /** Container name */
  name: string;
  /** CPU usage percentage */
  cpuPercent: number;
  /** Current memory usage in bytes */
  memoryUsage: number;
  /** Memory limit in bytes */
  memoryLimit: number;
  /** Network bytes received */
  networkRx: number;
  /** Network bytes transmitted */
  networkTx: number;
  /** Current container status */
  containerStatus: ContainerResourceStatus;
  /** Timestamp when container became idle (null if running) */
  idleSince: string | null;
  /** Timestamp when container was auto-stopped (null if not auto-stopped) */
  autoStoppedAt: string | null;
  /** Timestamp when container was last started */
  lastStartedAt: string | null;
}

/**
 * Container status values for resources
 */
export type ContainerResourceStatus = 'running' | 'stopped' | 'paused' | 'restarting' | 'exited';

/**
 * Worker lifecycle configuration
 */
export interface WorkerLifecycle {
  version: number;
  /** Idle timeout in minutes before auto-stop */
  idleTimeoutMinutes: number;
  updatedAt: string;
  workers: Record<string, WorkerLifecycleEntry>;
}

/**
 * Individual worker lifecycle entry
 */
export interface WorkerLifecycleEntry {
  containerStatus: string;
  idleSince: string | null;
  autoStoppedAt: string | null;
  lastStartedAt: string | null;
}

/**
 * Container stats response from Docker API
 */
export interface ContainerStats {
  containerId: string;
  name: string;
  cpuPercent: number;
  memoryUsage: number;
  memoryLimit: number;
  networkRx: number;
  networkTx: number;
  timestamp: string;
}
