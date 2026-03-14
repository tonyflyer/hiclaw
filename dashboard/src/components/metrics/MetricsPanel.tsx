import type { AgentSessionMetrics, AggregatedMetrics } from '../../types/metrics'
import styles from './MetricsPanel.module.css'

export interface MetricsPanelProps {
  /** Aggregated metrics data */
  metrics: AggregatedMetrics
  /** Per-agent metrics breakdown */
  agents: AgentSessionMetrics[]
}

// Format number with thousand separators
function formatNumber(num: number): string {
  return num.toLocaleString()
}

// Calculate cache hit rate percentage
function calculateCacheHitRate(cacheRead: number, cacheWrite: number): number {
  const total = cacheRead + cacheWrite
  if (total === 0) return 0
  return (cacheRead / total) * 100
}

/**
 * Metrics display panel showing LLM usage statistics.
 * Displays totals, per-agent breakdown, and CSS-based token distribution bars.
 */
export function MetricsPanel({ metrics, agents }: MetricsPanelProps) {
  const { totalLlmCalls, totalTokens } = metrics
  
  // Calculate cache hit rate
  const cacheHitRate = calculateCacheHitRate(totalTokens.cacheRead, totalTokens.cacheWrite)
  
  // Calculate max for bar chart scaling
  const maxTokens = Math.max(totalTokens.input, totalTokens.output, totalTokens.total)
  
  // Calculate bar widths as percentages
  const inputBarWidth = maxTokens > 0 ? (totalTokens.input / maxTokens) * 100 : 0
  const outputBarWidth = maxTokens > 0 ? (totalTokens.output / maxTokens) * 100 : 0
  const cacheBarWidth = maxTokens > 0 ? ((totalTokens.cacheRead + totalTokens.cacheWrite) / maxTokens) * 100 : 0

  if (totalLlmCalls === 0) {
    return (
      <div className={styles.container} data-testid="metrics-panel">
        <div className={styles.emptyState} data-testid="metrics-empty">
          <span className={styles.emptyIcon}>📊</span>
          <p className={styles.emptyText}>No metrics available yet</p>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.container} data-testid="metrics-panel">
      {/* Summary cards */}
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total LLM Calls</span>
          <span className={styles.summaryValue} data-testid="metrics-llm-calls">
            {formatNumber(totalLlmCalls)}
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Total Tokens</span>
          <span className={styles.summaryValue} data-testid="metrics-total-tokens">
            {formatNumber(totalTokens.input + totalTokens.output)}
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Cache Hit Rate</span>
          <span className={styles.summaryValue} data-testid="metrics-cache-rate">
            {cacheHitRate.toFixed(2)}%
          </span>
        </div>
        <div className={styles.summaryCard}>
          <span className={styles.summaryLabel}>Session Time</span>
          <span className={styles.summaryValue} data-testid="metrics-session-time">
            {formatSessionTime(metrics.overallTiming.start, metrics.overallTiming.end)}
          </span>
        </div>
      </div>

      {/* Token distribution bars */}
      <div className={styles.tokenSection}>
        <h3 className={styles.sectionTitle}>Token Distribution</h3>
        <div className={styles.tokenBars}>
          <div className={styles.tokenBarRow}>
            <span className={styles.tokenBarLabel}>Input</span>
            <div className={styles.tokenBarContainer}>
              <div
                className={`${styles.tokenBar} ${styles.tokenBarInput}`}
                style={{ width: `${inputBarWidth}%` }}
                data-testid="metrics-bar-input"
              />
            </div>
            <span className={styles.tokenBarValue} data-testid="metrics-input-tokens">
              {formatNumber(totalTokens.input)}
            </span>
          </div>
          <div className={styles.tokenBarRow}>
            <span className={styles.tokenBarLabel}>Output</span>
            <div className={styles.tokenBarContainer}>
              <div
                className={`${styles.tokenBar} ${styles.tokenBarOutput}`}
                style={{ width: `${outputBarWidth}%` }}
                data-testid="metrics-bar-output"
              />
            </div>
            <span className={styles.tokenBarValue} data-testid="metrics-output-tokens">
              {formatNumber(totalTokens.output)}
            </span>
          </div>
          <div className={styles.tokenBarRow}>
            <span className={styles.tokenBarLabel}>Cache</span>
            <div className={styles.tokenBarContainer}>
              <div
                className={`${styles.tokenBar} ${styles.tokenBarCache}`}
                style={{ width: `${cacheBarWidth}%` }}
                data-testid="metrics-bar-cache"
              />
            </div>
            <span className={styles.tokenBarValue} data-testid="metrics-cache-tokens">
              {formatNumber(totalTokens.cacheRead + totalTokens.cacheWrite)}
            </span>
          </div>
        </div>
      </div>

      {/* Per-agent breakdown */}
      {agents.length > 0 && (
        <div className={styles.agentsSection}>
          <h3 className={styles.sectionTitle}>Per-Agent Breakdown</h3>
          <div className={styles.agentsGrid}>
            {agents.map((agent) => (
              <div
                key={agent.agentName}
                className={styles.agentCard}
                data-testid={`metrics-agent-${agent.agentName}`}
              >
                <div className={styles.agentHeader}>
                  <span className={styles.agentName}>{agent.agentName}</span>
                  <span className={styles.agentCalls}>
                    {agent.metrics.llmCalls} calls
                  </span>
                </div>
                <div className={styles.agentMetrics}>
                  <div className={styles.agentMetric}>
                    <span className={styles.agentMetricValue}>
                      {formatNumber(agent.metrics.tokens.total)}
                    </span>
                    <span className={styles.agentMetricLabel}>tokens</span>
                  </div>
                  <div className={styles.agentMetric}>
                    <span className={styles.agentMetricValue}>
                      {formatNumber(agent.metrics.tokens.input)}
                    </span>
                    <span className={styles.agentMetricLabel}>input</span>
                  </div>
                  <div className={styles.agentMetric}>
                    <span className={styles.agentMetricValue}>
                      {formatNumber(agent.metrics.tokens.output)}
                    </span>
                    <span className={styles.agentMetricLabel}>output</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Format session time duration
function formatSessionTime(start: string, end: string): string {
  if (!start || !end) return '-'
  
  try {
    const startDate = new Date(start)
    const endDate = new Date(end)
    const diffMs = endDate.getTime() - startDate.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`
    }
    return `${diffMinutes}m`
  } catch {
    return '-'
  }
}
