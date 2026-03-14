// Agent Type Definitions (Frontend)
// Mirrors dashboard-api/src/types/agent.ts

/** Container status values */
export type ContainerStatus = 'running' | 'stopped' | 'not_found' | 'unknown';

/**
 * Represents a Worker agent registered in the system
 */
export interface Agent {
  /** Unique name identifier for the agent */
  name: string;
  /** Full Matrix user ID (e.g., @alice:matrix-local.hiclaw.io:18080) */
  matrixId: string;
  /** Matrix room ID for communication (e.g., !xxx:matrix-domain) */
  roomId: string;
  /** Role/purpose of the agent (e.g., frontend-dev, backend-dev) */
  role: string;
  /** List of skills enabled for this agent */
  skills: string[];
  /** Runtime type (openclaw, copaw) */
  runtime: 'openclaw' | 'copaw';
  /** Current container status */
  containerStatus: ContainerStatus;
}

/**
 * Worker registry structure
 */
export interface WorkerRegistry {
  version: number;
  updatedAt: string;
  workers: Record<string, Agent>;
}
