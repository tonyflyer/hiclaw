import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AgentCard } from './AgentCard'
import type { Agent } from '../../types/agent'

// Mock agent data for testing
const mockAgent: Agent = {
  name: 'alice',
  matrixId: '@alice:matrix-local.hiclaw.io:18080',
  roomId: '!abc123:matrix-local.hiclaw.io:18080',
  role: 'frontend-dev',
  skills: ['react', 'typescript'],
  runtime: 'openclaw',
  containerStatus: 'running',
}

const mockAgentStopped: Agent = {
  name: 'bob',
  matrixId: '@bob:matrix-local.hiclaw.io:18080',
  roomId: '!def456:matrix-local.hiclaw.io:18080',
  role: 'backend-dev',
  skills: ['python', 'fastapi'],
  runtime: 'copaw',
  containerStatus: 'stopped',
}

const mockAgentUnknown: Agent = {
  name: 'charlie',
  matrixId: '@charlie:matrix-local.hiclaw.io:18080',
  roomId: '!ghi789:matrix-local.hiclaw.io:18080',
  role: 'data-engineer',
  skills: ['sql', 'pandas'],
  runtime: 'openclaw',
  containerStatus: 'unknown',
}

describe('AgentCard', () => {
  it('renders agent name', () => {
    render(<AgentCard agent={mockAgent} />)
    expect(screen.getByText('alice')).toBeInTheDocument()
  })

  it('renders agent role', () => {
    render(<AgentCard agent={mockAgent} />)
    expect(screen.getByText('frontend-dev')).toBeInTheDocument()
  })

  it('renders Matrix room ID', () => {
    render(<AgentCard agent={mockAgent} />)
    expect(screen.getByText('!abc123:matrix-local.hiclaw.io:18080')).toBeInTheDocument()
  })

  it('renders running status badge', () => {
    render(<AgentCard agent={mockAgent} />)
    expect(screen.getByText('running')).toBeInTheDocument()
  })

  it('renders stopped status badge', () => {
    render(<AgentCard agent={mockAgentStopped} />)
    expect(screen.getByText('stopped')).toBeInTheDocument()
  })

  it('renders unknown status badge', () => {
    render(<AgentCard agent={mockAgentUnknown} />)
    expect(screen.getByText('unknown')).toBeInTheDocument()
  })

  it('uses online badge variant for running status', () => {
    const { container } = render(<AgentCard agent={mockAgent} />)
    const badge = container.querySelector('[class*="online"]')
    expect(badge).toBeInTheDocument()
  })

  it('uses offline badge variant for stopped status', () => {
    const { container } = render(<AgentCard agent={mockAgentStopped} />)
    const badge = container.querySelector('[class*="offline"]')
    expect(badge).toBeInTheDocument()
  })

  it('uses default badge variant for unknown status', () => {
    const { container } = render(<AgentCard agent={mockAgentUnknown} />)
    const badge = container.querySelector('[class*="default"]')
    expect(badge).toBeInTheDocument()
  })

  it('renders skills as tags', () => {
    render(<AgentCard agent={mockAgent} />)
    expect(screen.getByText('react')).toBeInTheDocument()
    expect(screen.getByText('typescript')).toBeInTheDocument()
  })

  it('renders runtime badge', () => {
    render(<AgentCard agent={mockAgent} />)
    expect(screen.getByText('openclaw')).toBeInTheDocument()
  })

  it('has data-testid attribute', () => {
    const { container } = render(<AgentCard agent={mockAgent} />)
    expect(container.querySelector('[data-testid="agent-card"]')).toBeInTheDocument()
  })
})
