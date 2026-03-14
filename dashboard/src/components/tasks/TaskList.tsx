import { useState, useMemo } from 'react'
import { TaskRow } from './TaskRow'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Task } from '@/types/task'
import styles from './TaskList.module.css'

export type SortField = 'taskId' | 'type' | 'assignedTo' | 'status' | 'assignedAt'
export type SortDirection = 'asc' | 'desc'
export type StatusFilter = 'all' | Task['status']

export interface TaskListProps {
  tasks: Task[]
  className?: string
  emptyMessage?: string
}

/**
 * Sortable and filterable task list table.
 * Displays tasks with headers for Task ID, Type, Worker, Status, and Time.
 * Shows empty state when no tasks are available.
 */
export function TaskList({
  tasks,
  className = '',
  emptyMessage = 'No active tasks',
}: TaskListProps) {
  const [sortField, setSortField] = useState<SortField>('assignedAt')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const sortedAndFilteredTasks = useMemo(() => {
    let filtered = tasks

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter((task) => task.status === statusFilter)
    }

    // Sort
    return [...filtered].sort((a, b) => {
      let comparison = 0

      switch (sortField) {
        case 'taskId':
          comparison = a.taskId.localeCompare(b.taskId)
          break
        case 'type':
          comparison = a.type.localeCompare(b.type)
          break
        case 'assignedTo':
          comparison = a.assignedTo.localeCompare(b.assignedTo)
          break
        case 'status':
          comparison = a.status.localeCompare(b.status)
          break
        case 'assignedAt':
          comparison = new Date(a.assignedAt).getTime() - new Date(b.assignedAt).getTime()
          break
      }

      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [tasks, sortField, sortDirection, statusFilter])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortIndicator = (field: SortField) => {
    if (sortField !== field) return null
    return sortDirection === 'asc' ? ' ↑' : ' ↓'
  }

  if (tasks.length === 0) {
    return (
      <div className={`${styles.container} ${className}`} data-testid="task-list">
        <EmptyState message={emptyMessage} />
      </div>
    )
  }

  return (
    <div className={`${styles.container} ${className}`} data-testid="task-list">
      {/* Filter controls */}
      <div className={styles.filterBar}>
        <label className={styles.filterLabel}>
          Filter:
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className={styles.filterSelect}
          >
            <option value="all">All</option>
            <option value="assigned">Assigned</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
          </select>
        </label>
      </div>

      {/* Table header */}
      <div className={styles.header}>
        <button
          className={styles.headerCell}
          onClick={() => handleSort('taskId')}
          type="button"
        >
          Task ID{getSortIndicator('taskId')}
        </button>
        <button
          className={styles.headerCell}
          onClick={() => handleSort('type')}
          type="button"
        >
          Type{getSortIndicator('type')}
        </button>
        <button
          className={styles.headerCell}
          onClick={() => handleSort('assignedTo')}
          type="button"
        >
          Worker{getSortIndicator('assignedTo')}
        </button>
        <button
          className={styles.headerCell}
          onClick={() => handleSort('status')}
          type="button"
        >
          Status{getSortIndicator('status')}
        </button>
        <button
          className={styles.headerCell}
          onClick={() => handleSort('assignedAt')}
          type="button"
        >
          Time{getSortIndicator('assignedAt')}
        </button>
      </div>

      {/* Task rows */}
      <div className={styles.body}>
        {sortedAndFilteredTasks.map((task) => (
          <TaskRow key={task.taskId} task={task} />
        ))}
      </div>

      {sortedAndFilteredTasks.length === 0 && tasks.length > 0 && (
        <EmptyState
          message="No matching tasks"
          description="Try adjusting your filter criteria"
        />
      )}
    </div>
  )
}
