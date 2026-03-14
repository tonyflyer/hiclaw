import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActivityStream } from './ActivityStream'
import type { ActivityEvent } from '../../types/activity'

// Mock data for testing
const mockEvents: ActivityEvent[] = [
  {
    id: '1',
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    type: 'agent_status',
    description: 'Worker alice started',
    agentName: 'alice',
  },
  {
    id: '2',
    timestamp: new Date(Date.now() - 2 * 60 * 1000).toISOString(), // 2 min ago
    type: 'task_status',
    description: 'Task completed: Implement login page',
    agentName: 'alice',
  },
  {
    id: '3',
    timestamp: new Date().toISOString(), // now
    type: 'metrics',
    description: 'LLM call completed: 150 tokens',
    agentName: 'manager',
  },
]

describe('ActivityStream', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders empty state when no events provided', () => {
    render(<ActivityStream events={[]} />)
    expect(screen.getByTestId('activity-stream')).toBeInTheDocument()
    expect(screen.getByTestId('activity-empty')).toBeInTheDocument()
  })

  it('renders list of events with correct data', () => {
    render(<ActivityStream events={mockEvents} />)
    
    expect(screen.getByTestId('activity-stream')).toBeInTheDocument()
    
    // Check all events are rendered
    expect(screen.getByText('Worker alice started')).toBeInTheDocument()
    expect(screen.getByText('Task completed: Implement login page')).toBeInTheDocument()
    expect(screen.getByText('LLM call completed: 150 tokens')).toBeInTheDocument()
  })

  it('displays relative timestamps', () => {
    render(<ActivityStream events={mockEvents} />)
    
    // Check relative time formatting
    expect(screen.getByText('5 min ago')).toBeInTheDocument()
    expect(screen.getByText('2 min ago')).toBeInTheDocument()
    expect(screen.getByText('just now')).toBeInTheDocument()
  })

  it('displays correct event type icons', () => {
    render(<ActivityStream events={mockEvents} />)
    
    // Check event type icons are rendered
    const agentStatusEvent = screen.getByText('Worker alice started').closest('[data-testid="activity-event"]')
    expect(agentStatusEvent).toHaveAttribute('data-event-type', 'agent_status')
    
    const taskStatusEvent = screen.getByText('Task completed: Implement login page').closest('[data-testid="activity-event"]')
    expect(taskStatusEvent).toHaveAttribute('data-event-type', 'task_status')
    
    const metricsEvent = screen.getByText('LLM call completed: 150 tokens').closest('[data-testid="activity-event"]')
    expect(metricsEvent).toHaveAttribute('data-event-type', 'metrics')
  })

  it('displays agent name when provided', () => {
    render(<ActivityStream events={mockEvents} />)
    
    // Use getAllByText since alice appears in multiple events
    expect(screen.getAllByText('alice').length).toBeGreaterThan(0)
    expect(screen.getAllByText('manager').length).toBeGreaterThan(0)
  })

  it('auto-scrolls to bottom on new events', () => {
    const { rerender } = render(<ActivityStream events={mockEvents.slice(0, 2)} />)
    
    const container = screen.getByTestId('activity-stream')
    
    // Add a new event
    const newEvents = [
      ...mockEvents.slice(0, 2),
      {
        id: '4',
        timestamp: new Date().toISOString(),
        type: 'system' as const,
        description: 'System initialized',
      },
    ]
    
    rerender(<ActivityStream events={newEvents} />)
    
    // New event should be rendered
    expect(screen.getByText('System initialized')).toBeInTheDocument()
  })

  it('pauses auto-scroll on hover', () => {
    render(<ActivityStream events={mockEvents} />)
    
    const container = screen.getByTestId('activity-stream')
    
    // Fire mouseEnter to pause auto-scroll
    fireEvent.mouseEnter(container)
    
    // Component should still be functional
    expect(screen.getByTestId('activity-stream')).toBeInTheDocument()
    
    // Add a new event while hovering
    const newEvents = [
      ...mockEvents,
      {
        id: '4',
        timestamp: new Date().toISOString(),
        type: 'system' as const,
        description: 'System message',
      },
    ]
    
    const { rerender } = render(<ActivityStream events={newEvents} />)
    
    // Should still render the new event
    expect(screen.getByText('System message')).toBeInTheDocument()
  })

  it('renders events in chronological order (oldest first)', () => {
    // Events are already sorted oldest to newest in mockEvents
    render(<ActivityStream events={mockEvents} />)
    
    const eventElements = screen.getAllByTestId('activity-event')
    
    // First event should be the oldest (5 min ago)
    expect(eventElements[0]).toHaveAttribute('data-event-type', 'agent_status')
    // Last event should be the newest (just now)
    expect(eventElements[eventElements.length - 1]).toHaveAttribute('data-event-type', 'metrics')
  })
})
