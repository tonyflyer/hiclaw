import { Badge } from '../ui/Badge'
import type { Agent, ContainerStatus } from '../../types/agent'
import styles from './AgentCard.module.css'

export interface AgentCardProps {
  agent: Agent
}

/**
 * Maps container status to Badge variant
 */
function getStatusVariant(status: ContainerStatus): 'online' | 'offline' | 'default' {
  switch (status) {
    case 'running':
      return 'online'
    case 'stopped':
    case 'not_found':
      return 'offline'
    case 'unknown':
    default:
      return 'default'
  }
}

/**
 * Maps container status to display label
 */
function getStatusLabel(status: ContainerStatus): string {
  switch (status) {
    case 'running':
      return 'running'
    case 'stopped':
      return 'stopped'
    case 'not_found':
      return 'not found'
    case 'unknown':
    default:
      return 'unknown'
  }
}

/**
 * Agent status card component for displaying worker information.
 * Shows agent name, role, container status, Matrix room ID, skills, and runtime.
 */
export function AgentCard({ agent }: AgentCardProps) {
  const statusVariant = getStatusVariant(agent.containerStatus)
  const statusLabel = getStatusLabel(agent.containerStatus)

  return (
    <div className={styles.card} data-testid="agent-card">
      <div className={styles.header}>
        <div className={styles.agentInfo}>
          <h3 className={styles.name}>{agent.name}</h3>
          <p className={styles.role}>{agent.role}</p>
        </div>
        <Badge variant={statusVariant} dot>
          {statusLabel}
        </Badge>
      </div>

      <div className={styles.details}>
        <div className={styles.detailRow}>
          <span className={styles.label}>Room:</span>
          <span className={styles.value}>{agent.roomId}</span>
        </div>
      </div>

      {agent.skills.length > 0 && (
        <div className={styles.skills}>
          {agent.skills.map((skill) => (
            <span key={skill} className={styles.skill}>
              {skill}
            </span>
          ))}
        </div>
      )}

      <div className={styles.footer}>
        <div className={styles.runtime}>
          <span className={styles.runtimeLabel}>Runtime:</span>
          <span className={styles.runtimeValue}>{agent.runtime}</span>
        </div>
      </div>
    </div>
  )
}
