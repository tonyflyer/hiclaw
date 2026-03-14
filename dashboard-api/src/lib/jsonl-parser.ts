// JSONL Parser for OpenClaw session files
// Parses session JSONL content to extract LLM call metrics

import type { AgentMetrics, TokenUsage, Timing } from '../types/metrics.js'

/**
 * Interface for parsed JSONL line (OpenClaw session format)
 */
interface SessionLine {
  type: string
  timestamp: string
  message?: {
    role: string
    usage?: {
      input?: number
      output?: number
      cacheRead?: number
      cacheWrite?: number
    }
    [key: string]: unknown
  }
  [key: string]: unknown
}

/**
 * Parse a single JSONL line and extract usage if it's an assistant message with token usage
 * @param line - Raw JSONL line
 * @returns Parsed usage data or null if not a valid assistant message with usage
 */
export function parseSessionLine(line: string): { usage: TokenUsage; timestamp: string } | null {
  // Skip empty lines
  if (!line.trim()) {
    return null
  }

  try {
    const parsed = JSON.parse(line) as SessionLine

    // Must be a message type
    if (parsed.type !== 'message') {
      return null
    }

    // Must be an assistant message
    if (parsed.message?.role !== 'assistant') {
      return null
    }

    // Must have usage data
    const usage = parsed.message?.usage
    if (!usage || typeof usage !== 'object') {
      return null
    }

    // Extract token counts (default to 0 if not present)
    const input = usage.input ?? 0
    const output = usage.output ?? 0
    const cacheRead = usage.cacheRead ?? 0
    const cacheWrite = usage.cacheWrite ?? 0

    return {
      usage: {
        input,
        output,
        cacheRead,
        cacheWrite,
        total: input + output,
      },
      timestamp: parsed.timestamp || '',
    }
  } catch {
    // Invalid JSON - skip this line
    return null
  }
}

/**
 * Parse JSONL content and extract aggregated metrics
 * @param jsonlContent - Raw JSONL content string
 * @returns AgentMetrics with aggregated LLM call data
 */
export function parseSessionMetrics(jsonlContent: string): AgentMetrics {
  let llmCalls = 0
  let totalInput = 0
  let totalOutput = 0
  let totalCacheRead = 0
  let totalCacheWrite = 0
  let startTimestamp = ''
  let endTimestamp = ''

  // Split by newlines and process each line
  const lines = jsonlContent.split('\n')

  for (const line of lines) {
    const result = parseSessionLine(line)

    if (result) {
      // Count this LLM call
      llmCalls++

      // Accumulate token counts
      totalInput += result.usage.input
      totalOutput += result.usage.output
      totalCacheRead += result.usage.cacheRead
      totalCacheWrite += result.usage.cacheWrite

      // Track timing - earliest start, latest end
      if (result.timestamp) {
        if (!startTimestamp || result.timestamp < startTimestamp) {
          startTimestamp = result.timestamp
        }
        if (!endTimestamp || result.timestamp > endTimestamp) {
          endTimestamp = result.timestamp
        }
      }
    }
  }

  const timing: Timing = {
    start: startTimestamp,
    end: endTimestamp,
  }

  return {
    llmCalls,
    tokens: {
      input: totalInput,
      output: totalOutput,
      cacheRead: totalCacheRead,
      cacheWrite: totalCacheWrite,
      total: totalInput + totalOutput,
    },
    timing,
  }
}

/**
 * Get the latest session file path from a directory listing
 * @param lsOutput - Output from `ls -t *.jsonl` command
 * @returns The first (most recent) file path or empty string
 */
export function getLatestSessionFile(lsOutput: string): string {
  const files = lsOutput.trim().split('\n').filter((f) => f.trim())
  return files[0] || ''
}

/**
 * Parse tail output (last N lines) of a JSONL file
 * Optimized for reading just the recent metrics
 * @param tailOutput - Output from `tail -n <lines>` command
 * @returns AgentMetrics with aggregated data
 */
export function parseSessionMetricsFromTail(tailOutput: string): AgentMetrics {
  return parseSessionMetrics(tailOutput)
}
