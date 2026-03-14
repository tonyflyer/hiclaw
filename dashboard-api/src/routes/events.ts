import { Router } from 'express'
import { StateCollector } from '../lib/state-collector.js'

const router = Router()

// SSE heartbeat interval in milliseconds (30 seconds)
const HEARTBEAT_INTERVAL = 30000

// State update interval in milliseconds (5 seconds)
const STATE_UPDATE_INTERVAL = 5000

// GET /api/events - Get event stream (SSE)
router.get('/', async (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders()

  // Create state collector
  const collector = new StateCollector()

  // Send initial state immediately
  try {
    const initialState = await collector.collect()
    res.write(`event: state_update\ndata: ${JSON.stringify(initialState)}\n\n`)
  } catch (error) {
    console.error('Error sending initial state:', error)
    res.write(`event: error\ndata: ${JSON.stringify({ code: 'INITIAL_STATE_ERROR', message: 'Failed to collect initial state' })}\n\n`)
  }

  // Send heartbeat every 30 seconds
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`)
    } catch {
      // Client disconnected, cleanup will happen
    }
  }, HEARTBEAT_INTERVAL)

  // Send state updates every 5 seconds
  const stateInterval = setInterval(async () => {
    try {
      const state = await collector.collect()
      
      // Only send if state has changed
      if (collector.hasChanged()) {
        res.write(`event: state_update\ndata: ${JSON.stringify(state)}\n\n`)
      }
    } catch (error) {
      console.error('Error in state update interval:', error)
      // Don't send error to avoid flooding - just log it
    }
  }, STATE_UPDATE_INTERVAL)

  // Cleanup on client disconnect
  req.on('close', () => {
    clearInterval(heartbeatInterval)
    clearInterval(stateInterval)
    console.log('SSE client disconnected')
  })
})

export default router
