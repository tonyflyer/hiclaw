import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskRow } from './TaskRow'
import type { Task } from '@/types/task'

describe('TaskRow', () => {
  const mockFiniteTask: Task = {
    taskId: 'task-20240313-100000',
    type: 'finite',
    assignedTo: 'alice',
    roomId: '!abc123:matrix.local',
    status: 'assigned',
    assignedAt: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
    completedAt: null,
  }

  const mockInfiniteTask: Task = {
    taskId: 'task-20240313-100001',
    type: 'infinite',
    assignedTo: 'bob',
    roomId: '!def456:matrix.local',
    status: 'active',
    assignedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
    completedAt: null,
    schedule: '0 9 * * *',
    timezone: 'Asia/Shanghai',
    lastExecutedAt: new Date(Date.now() - 3600000).toISOString(),
    nextScheduledAt: new Date(Date.now() + 82800000).toISOString(),
  }

  const mockCompletedTask: Task = {
    taskId: 'task-20240313-100002',
    type: 'finite',
    assignedTo: 'charlie',
    roomId: '!ghi789:matrix.local',
    status: 'completed',
    assignedAt: new Date(Date.now() - 172800000).toISOString(), // 2 days ago
    completedAt: new Date(Date.now() - 86400000).toISOString(), // 1 day ago
  }

  it('renders task ID', () => {
    render(<TaskRow task={mockFiniteTask} />)
    expect(screen.getByText('task-20240313-100000')).toBeDefined()
  })

  it('renders finite type badge', () => {
    render(<TaskRow task={mockFiniteTask} />)
    expect(screen.getByText('finite')).toBeDefined()
  })

  it('renders infinite type badge', () => {
    render(<TaskRow task={mockInfiniteTask} />)
    expect(screen.getByText('infinite')).toBeDefined()
  })

  it('renders assigned worker name', () => {
    render(<TaskRow task={mockFiniteTask} />)
    expect(screen.getByText('alice')).toBeDefined()
  })

  it('renders assigned status badge', () => {
    render(<TaskRow task={mockFiniteTask} />)
    expect(screen.getByText('assigned')).toBeDefined()
  })

  it('renders active status badge', () => {
    render(<TaskRow task={mockInfiniteTask} />)
    expect(screen.getByText('active')).toBeDefined()
  })

  it('renders completed status badge', () => {
    render(<TaskRow task={mockCompletedTask} />)
    expect(screen.getByText('completed')).toBeDefined()
  })

  it('renders assigned time', () => {
    render(<TaskRow task={mockFiniteTask} />)
    expect(screen.getByText(/ago/)).toBeDefined()
  })

  it('renders schedule info for infinite tasks', () => {
    render(<TaskRow task={mockInfiniteTask} />)
    expect(screen.getByText('0 9 * * *')).toBeDefined()
  })

  it('renders last executed time for infinite tasks', () => {
    render(<TaskRow task={mockInfiniteTask} />)
    const lastExecuted = screen.getByTitle('Last executed')
    expect(lastExecuted).toBeDefined()
    expect(lastExecuted.textContent).toContain('hour ago')
  })

  it('renders next scheduled time for infinite tasks', () => {
    render(<TaskRow task={mockInfiniteTask} />)
    const nextScheduled = screen.getByTitle('Next scheduled')
    expect(nextScheduled).toBeDefined()
    expect(nextScheduled.textContent).toContain('in')
  })

  it('has correct data-testid attribute', () => {
    render(<TaskRow task={mockFiniteTask} />)
    expect(screen.getByTestId('task-row')).toBeDefined()
  })

  it('shows completion time for completed tasks', () => {
    render(<TaskRow task={mockCompletedTask} />)
    expect(screen.getByText(/ago/)).toBeDefined()
  })
})
