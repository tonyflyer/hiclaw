import type { ReactNode } from 'react'
import styles from './Card.module.css'

export interface CardProps {
  /** Card title displayed in header */
  title?: string
  /** Optional subtitle below title */
  subtitle?: string
  /** Card body content */
  children?: ReactNode
  /** Additional CSS classes */
  className?: string
  /** Optional footer content */
  footer?: ReactNode
  /** Whether card is in loading state */
  loading?: boolean
}

/**
 * Generic card container with header and body sections.
 * Designed for dark monitoring dashboard theme.
 */
export function Card({
  title,
  subtitle,
  children,
  className = '',
  footer,
  loading = false,
}: CardProps) {
  return (
    <div className={`${styles.card} ${className}`}>
      {(title || subtitle) && (
        <div className={styles.header}>
          {title && <h3 className={styles.title}>{title}</h3>}
          {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
        </div>
      )}
      
      <div className={styles.body}>
        {loading ? (
          <div className={styles.skeleton}>
            <div className={styles.skeletonLine} style={{ width: '60%' }} />
            <div className={styles.skeletonLine} style={{ width: '80%' }} />
            <div className={styles.skeletonLine} style={{ width: '45%' }} />
          </div>
        ) : (
          children
        )}
      </div>

      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  )
}
