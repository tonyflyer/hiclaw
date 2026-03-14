// Task Type Definitions
// Based on state.json structure from task-management SKILL.md

/**
 * Task type - finite or infinite/recurring
 */
export type TaskType = 'finite' | 'infinite';

/**
 * Task status
 */
export type TaskStatus = 'assigned' | 'active' | 'completed';

/**
 * Represents a task assigned to a Worker
 */
export interface Task {
  /** Unique task identifier (e.g., task-YYYYMMDD-HHMMSS) */
  taskId: string;
  /** Type of task: finite or infinite/recurring */
  type: TaskType;
  /** Worker name this task is assigned to */
  assignedTo: string;
  /** Matrix room ID where task communication happens */
  roomId: string;
  /** Current status of the task */
  status: TaskStatus;
  /** ISO-8601 timestamp when task was assigned */
  assignedAt: string;
  /** ISO-8601 timestamp when task was completed (null if not completed) */
  completedAt: string | null;
  /** Cron schedule for infinite/recurring tasks (e.g., "0 9 * * *") */
  schedule?: string;
  /** Timezone for cron schedule (e.g., "Asia/Shanghai") */
  timezone?: string;
  /** Last execution timestamp for infinite tasks */
  lastExecutedAt?: string | null;
  /** Next scheduled execution timestamp for infinite tasks */
  nextScheduledAt?: string;
}

/**
 * Task meta information stored in task directory (meta.json)
 */
export interface TaskMeta {
  taskId: string;
  type: TaskType;
  assignedTo: string;
  roomId: string;
  status: TaskStatus;
  assignedAt: string;
  completedAt: string | null;
  schedule?: string;
  timezone?: string;
  lastExecutedAt?: string | null;
  nextScheduledAt?: string;
}

/**
 * State file structure (from state.json)
 */
export interface TaskState {
  activeTasks: Task[];
  updatedAt: string;
}
