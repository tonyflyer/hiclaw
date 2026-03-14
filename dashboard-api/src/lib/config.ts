// Configuration file for dashboard API
// Provides path utilities for reading worker registry and lifecycle data

import { resolveDataPath } from './file-reader.js'

/**
 * Get the path to workers-registry.json
 * This file contains the list of registered workers
 */
export function getWorkersRegistryPath(): string {
  return resolveDataPath('workers-registry.json')
}

/**
 * Get the path to worker-lifecycle.json
 * This file contains container lifecycle status for workers
 */
export function getWorkerLifecyclePath(): string {
  return resolveDataPath('worker-lifecycle.json')
}

/**
 * Get the path to state.json
 * This file contains active tasks and system state
 */
export function getStatePath(): string {
  return resolveDataPath('state.json')
}

/**
 * Get the path to a task's meta.json file
 * @param taskId - The task identifier
 * @returns Path to the task's meta.json file
 */
export function getTaskMetaPath(taskId: string): string {
  return resolveDataPath(`shared/tasks/${taskId}/meta.json`)
}

/**
 * Get the directory path for Manager session files
 * Manager sessions are stored in the mounted workspace directory
 */
export function getManagerSessionDir(): string {
  return resolveDataPath('.openclaw/agents/main/sessions')
}
