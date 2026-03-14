// Metrics Type Definitions
// Based on session JSONL format from agent-metrics.sh

/**
 * Token usage breakdown
 */
export interface TokenUsage {
  /** Number of input tokens */
  input: number;
  /** Number of output tokens */
  output: number;
  /** Number of tokens read from cache */
  cacheRead: number;
  /** Number of tokens written to cache */
  cacheWrite: number;
  /** Total tokens (input + output) */
  total: number;
}

/**
 * Timing information for a session
 */
export interface Timing {
  /** Session start timestamp (ISO-8601) */
  start: string;
  /** Session end timestamp (ISO-8601) */
  end: string;
}

/**
 * Agent session metrics
 */
export interface AgentMetrics {
  /** Number of LLM calls made in the session */
  llmCalls: number;
  /** Token usage breakdown */
  tokens: TokenUsage;
  /** Session timing information */
  timing: Timing;
}

/**
 * Metrics for a specific agent
 */
export interface AgentSessionMetrics {
  /** Agent name */
  agentName: string;
  /** Metrics for this session */
  metrics: AgentMetrics;
}

/**
 * Aggregated metrics across multiple agents/sessions
 */
export interface AggregatedMetrics {
  /** Total LLM calls across all agents */
  totalLlmCalls: number;
  /** Aggregated token usage */
  totalTokens: TokenUsage;
  /** Overall timing (earliest start to latest end) */
  overallTiming: Timing;
  /** Per-agent breakdown */
  byAgent: Record<string, AgentMetrics>;
}
