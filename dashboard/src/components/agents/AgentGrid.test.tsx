import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentGrid } from './AgentGrid'
import type { Agent } from '../../types/agent'

// Mock agents for testing
const mockAgents: Agent[] = [
  {
    name: 'alice',
    matrixId: '@alice:matrix-local.hiclaw.io:18080',
    roomId: '!abc123:matrix-local.hiclaw.io:18080',
    role: 'frontend-dev',
    skills: ['react', 'typescript'],
    runtime: 'openclaw',
    containerStatus: 'running',
  },
  {
    name: 'bob',
    matrixId: '@bob:matrix-local.hiclaw.io:18080',
    roomId: '!def456:matrix-local.hiclaw.io:18080',
    role: 'backend-dev',
    skills: ['python', 'fastapi'],
    runtime: 'copaw',
    containerStatus: 'running',
  },
]

describe('AgentGrid', () => {
  it('renders grid container with data-testid when agents are provided', () => {
    const { container } = render(<AgentGrid agents={mockAgents} />)
    expect(container.querySelector('[data-testid="agent-grid"]')).toBeInTheDocument()
  })

  it('renders agent cards when agents are provided', () => {
    render(<AgentGrid agents={mockAgents} />)
    expect(screen.getByText('alice')).toBeInTheDocument()
    expect(screen.getByText('bob')).toBeInTheDocument()
  })

  it('renders correct number of agent cards', () => {
    const { container } = render(<AgentGrid agents={mockAgents} />)
    const cards = container.querySelectorAll('[data-testid="agent-card"]')
    expect(cards).toHaveLength(2)
  })

  it('renders empty state when no agents', () => {
    render(<AgentGrid agents={[]} />)
    expect(screen.getByText('No workers registered yet')).toBeInTheDocument()
  })

  it('renders single agent correctly', () => {
    render(<AgentGrid agents={[mockAgents[0]]} />)
    expect(screen.getByText('alice')).toBeInTheDocument()
    const cards = document.querySelectorAll('[data-testid="agent-card"]')
    expect(cards).toHaveLength(1)
  })
})
