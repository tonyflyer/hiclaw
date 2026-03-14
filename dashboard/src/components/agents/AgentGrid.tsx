import { AgentCard } from './AgentCard'
import { EmptyState } from '../ui/EmptyState'
import type { Agent } from '../../types/agent'
import styles from './AgentGrid.module.css'

export interface AgentGridProps {
  agents: Agent[]
}

/**
 * Grid layout for displaying agent cards.
 * Shows empty state when no agents are available.
 */
export function AgentGrid({ agents }: AgentGridProps) {
  if (agents.length === 0) {
    return (
      <EmptyState
        message="No workers registered yet"
        description="Workers will appear here once the Manager creates them"
        className="agent-grid-empty"
      />
    )
  }

  return (
    <div className={styles.grid} data-testid="agent-grid">
      {agents.map((agent) => (
        <AgentCard key={agent.name} agent={agent} />
      ))}
    </div>
  )
}
