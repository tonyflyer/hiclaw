// SSE (Server-Sent Events) Type Definitions (Frontend)
// Mirrors dashboard-api/src/types/sse.ts

/**
 * SSE event types for dashboard updates
 */
export type SSEEventType = 
  | 'agent-update'
  | 'task-update'
  | 'metrics-update'
  | 'resource-update'
  | 'state-update'
  | 'error'
  | 'heartbeat';

/**
 * Server-Sent Event structure
 */
export interface SSEEvent {
  /** Event type */
  eventType: SSEEventType;
  /** Event data payload */
  data: unknown;
  /** ISO-8601 timestamp when event was generated */
  timestamp: string;
}

/**
 * SSE event for agent updates
 */
export interface AgentSSEEvent extends SSEEvent {
  eventType: 'agent-update';
  data: {
    action: 'created' | 'updated' | 'deleted';
    agent: import('./agent.js').Agent;
  };
}

/**
 * SSE event for task updates
 */
export interface TaskSSEEvent extends SSEEvent {
  eventType: 'task-update';
  data: {
    action: 'assigned' | 'completed' | 'failed' | 'updated';
    task: import('./task.js').Task;
  };
}

/**
 * SSE event for metrics updates
 */
export interface MetricsSSEEvent extends SSEEvent {
  eventType: 'metrics-update';
  data: {
    agentName: string;
    metrics: import('./metrics.js').AgentMetrics;
  };
}

/**
 * SSE event for resource updates
 */
export interface ResourceSSEEvent extends SSEEvent {
  eventType: 'resource-update';
  data: {
    resources: import('./container.js').ContainerResource[];
  };
}

/**
 * SSE event for error notifications
 */
export interface ErrorSSEEvent extends SSEEvent {
  eventType: 'error';
  data: {
    code: string;
    message: string;
    details?: unknown;
  };
}
