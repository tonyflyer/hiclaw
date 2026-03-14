import type { ReactNode } from 'react'
import styles from './EmptyState.module.css'

export interface EmptyStateProps {
  /** Icon or illustration to display */
  icon?: ReactNode
  /** Main message text */
  message: string
  /** Optional description */
  description?: string
  /** Optional action element (button, link) */
  action?: ReactNode
  /** Additional CSS classes */
  className?: string
}

/**
 * Empty state placeholder for no-data scenarios.
 * Useful when lists/tables have no content to display.
 */
export function EmptyState({
  icon,
  message,
  description,
  action,
  className = '',
}: EmptyStateProps) {
  return (
    <div className={`${styles.empty} ${className}`}>
      {icon && <div className={styles.icon}>{icon}</div>}
      <p className={styles.message}>{message}</p>
      {description && <p className={styles.description}>{description}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  )
}
