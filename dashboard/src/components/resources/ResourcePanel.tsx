import type { ContainerResource, ContainerResourceStatus } from '../../types/container'
import styles from './ResourcePanel.module.css'

export interface ResourcePanelProps {
  /** List of container resources to display */
  containers: ContainerResource[]
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(0))} ${units[i]}`
}

// Get status badge class
function getStatusClass(status: ContainerResourceStatus): string {
  switch (status) {
    case 'running':
      return styles.statusRunning
    case 'stopped':
      return styles.statusStopped
    case 'paused':
      return styles.statusPaused
    case 'restarting':
      return styles.statusRestarting
    default:
      return styles.statusStopped
  }
}

/**
 * Resource monitoring panel displaying container CPU/memory usage.
 * Shows horizontal progress bars for resource consumption.
 */
export function ResourcePanel({ containers }: ResourcePanelProps) {
  if (containers.length === 0) {
    return (
      <div className={styles.container} data-testid="resource-panel">
        <div className={styles.emptyState} data-testid="resource-empty">
          <span className={styles.emptyIcon}>🖥️</span>
          <p className={styles.emptyText}>Resource monitoring unavailable</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container} data-testid="resource-panel">
      <div className={styles.containerList}>
        {containers.map((container) => {
          // Calculate memory percentage
          const memoryPercent = container.memoryLimit > 0
            ? (container.memoryUsage / container.memoryLimit) * 100
            : 0
          
          // Clamp CPU percentage to 0-100
          const cpuPercent = Math.min(100, Math.max(0, container.cpuPercent))
          
          return (
            <div
              key={container.containerId}
              className={styles.containerCard}
              data-testid={`resource-container-${container.containerId}`}
            >
              <div className={styles.containerHeader}>
                <div className={styles.containerInfo}>
                  <span className={styles.containerName}>{container.name}</span>
                </div>
                <span className={`${styles.statusBadge} ${getStatusClass(container.containerStatus)}`}>
                  {container.containerStatus}
                </span>
              </div>
              
              <div className={styles.resourceBars}>
                {/* CPU bar */}
                <div className={styles.resourceRow}>
                  <span className={styles.resourceLabel}>CPU</span>
                  <div className={styles.resourceBarContainer}>
                    <div
                      className={`${styles.resourceBar} ${styles.resourceBarCpu}`}
                      style={{ width: `${cpuPercent}%` }}
                      data-testid={`resource-cpu-${container.name}`}
                    />
                  </div>
                  <span className={styles.resourceValue}>
                    {cpuPercent.toFixed(1)}%
                  </span>
                </div>
                
                {/* Memory bar */}
                <div className={styles.resourceRow}>
                  <span className={styles.resourceLabel}>Memory</span>
                  <div className={styles.resourceBarContainer}>
                    <div
                      className={`${styles.resourceBar} ${styles.resourceBarMemory}`}
                      style={{ width: `${memoryPercent}%` }}
                      data-testid={`resource-memory-${container.name}`}
                    />
                  </div>
                  <span className={styles.resourceValue}>
                    {formatBytes(container.memoryUsage)} / {formatBytes(container.memoryLimit)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
