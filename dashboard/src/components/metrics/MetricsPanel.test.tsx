import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricsPanel } from './MetricsPanel'
import type { AgentSessionMetrics, AggregatedMetrics } from '../../types/metrics'

// Mock data for testing
const mockAgentMetrics: AgentSessionMetrics[] = [
  {
    agentName: 'alice',
    metrics: {
      llmCalls: 15,
      tokens: {
        input: 5000,
        output: 3000,
        cacheRead: 1000,
        cacheWrite: 500,
        total: 8500,
      },
      timing: {
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T12:00:00Z',
      },
    },
  },
  {
    agentName: 'manager',
    metrics: {
      llmCalls: 25,
      tokens: {
        input: 8000,
        output: 5000,
        cacheRead: 2000,
        cacheWrite: 1000,
        total: 16000,
      },
      timing: {
        start: '2024-01-01T09:00:00Z',
        end: '2024-01-01T13:00:00Z',
      },
    },
  },
]

const mockAggregatedMetrics: AggregatedMetrics = {
  totalLlmCalls: 40,
  totalTokens: {
    input: 13000,
    output: 8000,
    cacheRead: 3000,
    cacheWrite: 1500,
    total: 24500,
  },
  overallTiming: {
    start: '2024-01-01T09:00:00Z',
    end: '2024-01-01T13:00:00Z',
  },
  byAgent: {
    alice: mockAgentMetrics[0].metrics,
    manager: mockAgentMetrics[1].metrics,
  },
}

describe('MetricsPanel', () => {
  it('renders total LLM calls', () => {
    render(<MetricsPanel metrics={mockAggregatedMetrics} agents={mockAgentMetrics} />)
    
    expect(screen.getByTestId('metrics-llm-calls')).toBeInTheDocument()
    expect(screen.getByTestId('metrics-llm-calls')).toHaveTextContent('40')
  })

  it('renders total tokens', () => {
    render(<MetricsPanel metrics={mockAggregatedMetrics} agents={mockAgentMetrics} />)
    
    expect(screen.getByTestId('metrics-total-tokens')).toBeInTheDocument()
    // Total = 13000 + 8000 = 21000
    expect(screen.getByTestId('metrics-total-tokens')).toHaveTextContent(/21,000/)
  })

  it('renders input/output token breakdown', () => {
    render(<MetricsPanel metrics={mockAggregatedMetrics} agents={mockAgentMetrics} />)
    
    expect(screen.getByTestId('metrics-input-tokens')).toHaveTextContent(/13,000/)
    expect(screen.getByTestId('metrics-output-tokens')).toHaveTextContent(/8,000/)
  })

  it('calculates and displays cache hit rate', () => {
    render(<MetricsPanel metrics={mockAggregatedMetrics} agents={mockAgentMetrics} />)
    
    // Cache hit rate = cacheRead / (cacheRead + cacheWrite) * 100
    // = 3000 / (3000 + 1500) * 100 = 66.67%
    expect(screen.getByTestId('metrics-cache-rate')).toBeInTheDocument()
    expect(screen.getByTestId('metrics-cache-rate')).toHaveTextContent(/66\.67/)
  })

  it('renders per-agent breakdown cards', () => {
    render(<MetricsPanel metrics={mockAggregatedMetrics} agents={mockAgentMetrics} />)
    
    // Check agent cards are rendered
    expect(screen.getByTestId('metrics-agent-alice')).toBeInTheDocument()
    expect(screen.getByTestId('metrics-agent-manager')).toBeInTheDocument()
    
    // Check agent-specific metrics
    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getByText('manager')).toBeInTheDocument()
  })

  it('renders token distribution bars', () => {
    render(<MetricsPanel metrics={mockAggregatedMetrics} agents={mockAgentMetrics} />)
    
    // Check that CSS bars are rendered
    const tokenBars = screen.getAllByTestId(/^metrics-bar-/)
    expect(tokenBars.length).toBeGreaterThan(0)
  })

  it('renders empty state when no metrics provided', () => {
    const emptyMetrics: AggregatedMetrics = {
      totalLlmCalls: 0,
      totalTokens: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        total: 0,
      },
      overallTiming: {
        start: '',
        end: '',
      },
      byAgent: {},
    }
    
    render(<MetricsPanel metrics={emptyMetrics} agents={[]} />)
    
    expect(screen.getByTestId('metrics-empty')).toBeInTheDocument()
  })

  it('handles zero cache tokens correctly', () => {
    const zeroCacheMetrics: AggregatedMetrics = {
      totalLlmCalls: 10,
      totalTokens: {
        input: 1000,
        output: 500,
        cacheRead: 0,
        cacheWrite: 0,
        total: 1500,
      },
      overallTiming: {
        start: '2024-01-01T10:00:00Z',
        end: '2024-01-01T12:00:00Z',
      },
      byAgent: {},
    }
    
    render(<MetricsPanel metrics={zeroCacheMetrics} agents={[]} />)
    
    // With 0 cache, hit rate should show 0%
    expect(screen.getByTestId('metrics-cache-rate')).toHaveTextContent(/0/)
  })
})
