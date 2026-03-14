import type { ReactNode } from 'react'
import { Badge, type BadgeVariant } from '@/components/ui/Badge'
import type { Task } from '@/types/task'
import styles from './TaskRow.module.css'

/**
 * Format a date as relative time (e.g., "2 hours ago", "in 3 hours")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()

  const isFuture = diffMs < 0
  const absDiffMs = Math.abs(diffMs)
  const absSec = Math.floor(absDiffMs / 1000)
  const absMin = Math.floor(absSec / 60)
  const absHour = Math.floor(absMin / 60)
  const absDay = Math.floor(absHour / 24)

  if (isFuture) {
    if (absDay > 0) return `in ${absDay} day${absDay > 1 ? 's' : ''}`
    if (absHour > 0) return `in ${absHour} hour${absHour > 1 ? 's' : ''}`
    if (absMin > 0) return `in ${absMin} min${absMin > 1 ? 's' : ''}`
    return 'just now'
  }

  if (absDay > 0) return `${absDay} day${absDay > 1 ? 's' : ''} ago`
  if (absHour > 0) return `${absHour} hour${absHour > 1 ? 's' : ''} ago`
  if (absMin > 0) return `${absMin} min${absMin > 1 ? 's' : ''} ago`
  return 'just now'
}

/**
 * Get badge variant for task type
 */
function getTypeVariant(type: Task['type']): BadgeVariant {
  return type === 'finite' ? 'default' : 'idle'
}

/**
 * Get badge variant for task status
 */
function getStatusVariant(status: Task['status']): BadgeVariant {
  switch (status) {
    case 'assigned':
      return 'warning'
    case 'active':
      return 'busy'
    case 'completed':
      return 'success'
    default:
      return 'default'
  }
}

export interface TaskRowProps {
  task: Task
}

/**
 * Single task row displaying task information.
 * Shows: task ID, type badge, assigned worker, status, assigned time
 * Finite tasks: show completion time
 * Infinite tasks: show schedule and last executed time
 */
export function TaskRow({ task }: TaskRowProps): ReactNode {
  return (
    <div className={styles.row} data-testid="task-row">
      <div className={styles.taskId}>
        <span className={styles.idText}>{task.taskId}</span>
      </div>

      <div className={styles.type}>
        <Badge variant={getTypeVariant(task.type)}>{task.type}</Badge>
      </div>

      <div className={styles.worker}>
        <span className={styles.workerName}>{task.assignedTo}</span>
      </div>

      <div className={styles.status}>
        <Badge variant={getStatusVariant(task.status)}>{task.status}</Badge>
      </div>

      <div className={styles.time}>
        {task.status === 'completed' && task.completedAt ? (
          <span className={styles.completedTime} title="Completed">
            {formatRelativeTime(task.completedAt)}
          </span>
        ) : (
          <span className={styles.assignedTime} title="Assigned">
            {formatRelativeTime(task.assignedAt)}
          </span>
        )}
      </div>

      {task.type === 'infinite' && (
        <div className={styles.schedule}>
          {task.schedule && (
            <span className={styles.cron} title="Schedule">
              {task.schedule}
            </span>
          )}
          {task.lastExecutedAt && (
            <span className={styles.lastExecuted} title="Last executed">
              Last: {formatRelativeTime(task.lastExecutedAt)}
            </span>
          )}
          {task.nextScheduledAt && (
            <span className={styles.nextScheduled} title="Next scheduled">
              Next: {formatRelativeTime(task.nextScheduledAt)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
