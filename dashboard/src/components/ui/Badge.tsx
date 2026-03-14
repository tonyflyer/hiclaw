import styles from './Badge.module.css'

export type BadgeVariant = 'online' | 'offline' | 'idle' | 'busy' | 'success' | 'warning' | 'error' | 'default'

export interface BadgeProps {
  /** Badge label text */
  children: React.ReactNode
  /** Visual variant */
  variant?: BadgeVariant
  /** Additional CSS classes */
  className?: string
  /** Whether to show a subtle dot indicator */
  dot?: boolean
}

/**
 * Status badge component for displaying agent/container states.
 * Variants: online (green), offline (red), idle (amber), busy (blue)
 */
export function Badge({
  children,
  variant = 'default',
  className = '',
  dot = false,
}: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[variant]} ${className}`}>
      {dot && <span className={styles.dot} />}
      {children}
    </span>
  )
}
