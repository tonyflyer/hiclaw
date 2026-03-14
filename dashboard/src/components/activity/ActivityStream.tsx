import { useRef, useEffect, useState, useCallback } from 'react'
import type { ActivityEvent, ActivityEventType } from '../../types/activity'
import styles from './ActivityStream.module.css'

export interface ActivityStreamProps {
  /** List of activity events to display */
  events: ActivityEvent[]
}

// Event type to icon mapping
const eventTypeIcons: Record<ActivityEventType, string> = {
  agent_status: '👤',
  task_status: '✅',
  metrics: '📊',
  system: '⚙️',
}

// Format timestamp to relative time
function formatRelativeTime(timestamp: string): string {
  const now = new Date()
  const eventTime = new Date(timestamp)
  const diffMs = now.getTime() - eventTime.getTime()
  const diffSeconds = Math.floor(diffMs / 1000)
  const diffMinutes = Math.floor(diffSeconds / 60)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSeconds < 60) {
    return 'just now'
  } else if (diffMinutes < 60) {
    return `${diffMinutes} min ago`
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  } else {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  }
}

/**
 * Real-time scrolling feed of recent activity events.
 * Auto-scrolls to latest events with pause-on-hover.
 */
export function ActivityStream({ events }: ActivityStreamProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isPaused, setIsPaused] = useState(false)
  const prevEventsLengthRef = useRef(events.length)

  // Auto-scroll to bottom when new events arrive
  useEffect(() => {
    if (!isPaused && events.length > prevEventsLengthRef.current && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight
    }
    prevEventsLengthRef.current = events.length
  }, [events.length, isPaused])

  const handleMouseEnter = useCallback(() => {
    setIsPaused(true)
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsPaused(false)
  }, [])

  // Sort events: oldest first (chronological order)
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  if (events.length === 0) {
    return (
      <div className={styles.container} data-testid="activity-stream">
        <div className={styles.emptyState} data-testid="activity-empty">
          <span className={styles.emptyIcon}>📭</span>
          <p className={styles.emptyText}>No activity yet</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={styles.container}
      data-testid="activity-stream"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className={styles.eventList} ref={containerRef}>
        {sortedEvents.map((event) => (
          <div
            key={event.id}
            className={styles.event}
            data-testid="activity-event"
            data-event-type={event.type}
          >
            <div className={`${styles.iconWrapper} ${styles[`icon${capitalize(event.type)}`]}`}>
              {eventTypeIcons[event.type]}
            </div>
            <div className={styles.content}>
              <p className={styles.description}>{event.description}</p>
              <div className={styles.meta}>
                <span className={styles.timestamp} data-testid="activity-timestamp">
                  {formatRelativeTime(event.timestamp)}
                </span>
                {event.agentName && (
                  <span className={styles.agentName} data-testid="activity-agent">
                    {event.agentName}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Helper to capitalize first letter
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}
