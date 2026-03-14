import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TaskList } from './TaskList'
import type { Task } from '@/types/task'

describe('TaskList', () => {
  const mockTasks: Task[] = [
    {
      taskId: 'task-20240313-100000',
      type: 'finite',
      assignedTo: 'alice',
      roomId: '!abc123:matrix.local',
      status: 'assigned',
      assignedAt: new Date(Date.now() - 3600000).toISOString(),
      completedAt: null,
    },
    {
      taskId: 'task-20240313-100001',
      type: 'infinite',
      assignedTo: 'bob',
      roomId: '!def456:matrix.local',
      status: 'active',
      assignedAt: new Date(Date.now() - 86400000).toISOString(),
      completedAt: null,
      schedule: '0 9 * * *',
      timezone: 'Asia/Shanghai',
      lastExecutedAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      taskId: 'task-20240313-100002',
      type: 'finite',
      assignedTo: 'charlie',
      roomId: '!ghi789:matrix.local',
      status: 'completed',
      assignedAt: new Date(Date.now() - 172800000).toISOString(),
      completedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ]

  it('renders task list with data-testid', () => {
    render(<TaskList tasks={mockTasks} />)
    expect(screen.getByTestId('task-list')).toBeDefined()
  })

  it('renders all tasks', () => {
    render(<TaskList tasks={mockTasks} />)
    expect(screen.getByText('task-20240313-100000')).toBeDefined()
    expect(screen.getByText('task-20240313-100001')).toBeDefined()
    expect(screen.getByText('task-20240313-100002')).toBeDefined()
  })

  it('renders empty state when no tasks', () => {
    render(<TaskList tasks={[]} />)
    expect(screen.getByTestId('task-list')).toBeDefined()
    expect(screen.getByText('No active tasks')).toBeDefined()
  })

  it('renders empty state with custom message when provided', () => {
    render(<TaskList tasks={[]} emptyMessage="No tasks found" />)
    expect(screen.getByText('No tasks found')).toBeDefined()
  })

  it('renders task rows for each task', () => {
    render(<TaskList tasks={mockTasks} />)
    // Should have 3 task rows (one for each task)
    const taskRows = screen.getAllByTestId('task-row')
    expect(taskRows).toHaveLength(3)
  })

  it('renders table headers', () => {
    render(<TaskList tasks={mockTasks} />)
    expect(screen.getByText('Task ID')).toBeDefined()
    expect(screen.getByText('Type')).toBeDefined()
    expect(screen.getByText('Worker')).toBeDefined()
    expect(screen.getByText('Status')).toBeDefined()
    // Time header includes sort indicator, so use regex
    expect(screen.getByText(/^Time/)).toBeDefined()
  })

  it('renders workers with correct names', () => {
    render(<TaskList tasks={mockTasks} />)
    expect(screen.getAllByText('alice')).toBeDefined()
    expect(screen.getAllByText('bob')).toBeDefined()
    expect(screen.getAllByText('charlie')).toBeDefined()
  })

  it('accepts optional className', () => {
    const { container } = render(<TaskList tasks={mockTasks} className="custom-class" />)
    expect(container.firstChild).toHaveClass('custom-class')
  })
})
