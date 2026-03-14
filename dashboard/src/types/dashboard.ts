// Dashboard State Type Definitions (Frontend)
// Mirrors dashboard-api/src/types/dashboard.ts

import type { Agent } from './agent.js';
import type { Task } from './task.js';
import type { AgentMetrics, AggregatedMetrics } from './metrics.js';
import type { ContainerResource } from './container.js';

/**
 * Complete dashboard state
 */
export interface DashboardState {
  /** List of all registered agents */
  agents: Agent[];
  /** List of all active tasks */
  tasks: Task[];
  /** Current metrics by agent name */
  metrics: Record<string, AgentMetrics>;
  /** Aggregated metrics across all agents */
  aggregatedMetrics: AggregatedMetrics;
  /** Container resource usage for all workers */
  resources: ContainerResource[];
  /** ISO-8601 timestamp of last state update */
  lastUpdated: string;
}

/**
 * Dashboard state summary (lightweight version for lists)
 */
export interface DashboardSummary {
  /** Total number of agents */
  totalAgents: number;
  /** Number of running agents */
  runningAgents: number;
  /** Total number of active tasks */
  activeTasks: number;
  /** Number of completed tasks */
  completedTasks: number;
  /** Last update timestamp */
  lastUpdated: string;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
