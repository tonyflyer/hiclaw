import styles from './Spinner.module.css'

export interface SpinnerProps {
  /** Size variant: sm, md, lg */
  size?: 'sm' | 'md' | 'lg'
  /** Optional label text for accessibility */
  label?: string
  /** Additional CSS classes */
  className?: string
}

/**
 * Loading spinner indicator.
 * Uses CSS-only animation for optimal performance.
 */
export function Spinner({
  size = 'md',
  label = 'Loading',
  className = '',
}: SpinnerProps) {
  return (
    <div 
      className={`${styles.spinner} ${styles[size]} ${className}`}
      role="status"
      aria-label={label}
    >
      <div className={styles.ring}>
        <div className={styles.track} />
        <div className={styles.head} />
      </div>
      {label && <span className={styles.label}>{label}</span>}
    </div>
  )
}
