// Activity Event Type Definitions (Frontend)

/**
 * Activity event type categories
 */
export type ActivityEventType = 'agent_status' | 'task_status' | 'metrics' | 'system';

/**
 * Activity event for real-time feed display
 */
export interface ActivityEvent {
  /** Unique event identifier */
  id: string;
  /** ISO-8601 timestamp when event occurred */
  timestamp: string;
  /** Event type category */
  type: ActivityEventType;
  /** Human-readable event description */
  description: string;
  /** Optional agent name associated with event */
  agentName?: string;
}
