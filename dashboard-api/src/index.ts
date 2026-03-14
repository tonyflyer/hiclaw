import express, { type Request, type Response, type NextFunction } from 'express'
import cors from 'cors'

// Import routes
import agentsRouter from './routes/agents.js'
import tasksRouter from './routes/tasks.js'
import metricsRouter from './routes/metrics.js'
import resourcesRouter from './routes/resources.js'
import eventsRouter from './routes/events.js'

const app = express()
const port = process.env.PORT || 8090

// Middleware
app.use(cors())
app.use(express.json())

// Health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' })
})

// API routes
app.use('/api/agents', agentsRouter)
app.use('/api/tasks', tasksRouter)
app.use('/api/metrics', metricsRouter)
app.use('/api/resources', resourcesRouter)
app.use('/api/events', eventsRouter)

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Not found', message: 'API endpoint not found' })
})

// Error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: 'Internal server error', message: err.message })
})

// Start server
app.listen(port, () => {
  console.log(`Dashboard API running on port ${port}`)
})

export default app
