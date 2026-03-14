import { Router } from 'express'
import { readJsonFile } from '../lib/file-reader.js'
import { getStatePath, getTaskMetaPath } from '../lib/config.js'
import type { Task, TaskMeta, TaskState } from '../types/task.js'

const router = Router()

// GET /api/tasks - List all tasks
router.get('/', async (_req, res) => {
  try {
    const statePath = getStatePath()

    let state: TaskState

    try {
      state = await readJsonFile<TaskState>(statePath)
    } catch (error) {
      // State file not found - return empty array
      const errorMessage = error instanceof Error ? error.message : ''
      if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
        return res.json({ tasks: [], timestamp: new Date().toISOString() })
      }
      // Other errors (like malformed JSON) should be thrown to outer catch
      throw error
    }

    // Get active tasks from state
    const activeTasks = state.activeTasks || []

    // Enrich each task with meta information if available
    const enrichedTasks: Task[] = await Promise.all(
      activeTasks.map(async (task) => {
        try {
          const metaPath = getTaskMetaPath(task.taskId)
          const meta = await readJsonFile<TaskMeta>(metaPath)
          // Merge meta with task (meta takes precedence for additional fields)
          return { ...task, ...meta } as Task
        } catch (error) {
          // Meta file not found - use task data only
          const errorMessage = error instanceof Error ? error.message : ''
          if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
            return task
          }
          // Other errors - still return task without enrichment
          return task
        }
      })
    )

    res.json({
      tasks: enrichedTasks,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    res.status(500).json({
      error: 'Failed to fetch tasks',
      message,
    })
  }
})

// GET /api/tasks/:id - Get task details
router.get('/:id', (_req, res) => {
  res.status(501).json({ error: 'Not implemented', message: 'Task details coming in Wave 2' })
})

// POST /api/tasks - Create task (future)
router.post('/', (_req, res) => {
  res.status(501).json({ error: 'Not implemented', message: 'Task creation coming in Wave 2' })
})

// DELETE /api/tasks/:id - Cancel/delete task (future)
router.delete('/:id', (_req, res) => {
  res.status(501).json({ error: 'Not implemented', message: 'Task cancellation coming in Wave 2' })
})

export default router
