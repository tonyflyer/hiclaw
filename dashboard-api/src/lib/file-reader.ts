import fs from 'fs/promises'
import path from 'path'

export interface FileReaderOptions {
  retries?: number
  retryDelay?: number
  encoding?: BufferEncoding
}

const DEFAULT_OPTIONS: Required<FileReaderOptions> = {
  retries: 3,
  retryDelay: 100,
  encoding: 'utf-8',
}

/**
 * Safely read a JSON file with retry logic
 * @param filePath - Path to the JSON file
 * @param options - Read options
 * @returns Parsed JSON content
 */
export async function readJsonFile<T = unknown>(
  filePath: string,
  options: FileReaderOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= opts.retries; attempt++) {
    try {
      const content = await fs.readFile(filePath, opts.encoding)
      return JSON.parse(content) as T
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < opts.retries) {
        await new Promise((resolve) => setTimeout(resolve, opts.retryDelay))
      }
    }
  }

  throw new Error(`Failed to read ${filePath} after ${opts.retries} attempts: ${lastError?.message}`)
}

/**
 * Safely read a text file with retry logic
 * @param filePath - Path to the file
 * @param options - Read options
 * @returns File content as string
 */
export async function readTextFile(
  filePath: string,
  options: FileReaderOptions = {}
): Promise<string> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= opts.retries; attempt++) {
    try {
      return await fs.readFile(filePath, opts.encoding)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))
      
      if (attempt < opts.retries) {
        await new Promise((resolve) => setTimeout(resolve, opts.retryDelay))
      }
    }
  }

  throw new Error(`Failed to read ${filePath} after ${opts.retries} attempts: ${lastError?.message}`)
}

/**
 * Check if a file exists
 * @param filePath - Path to check
 * @returns True if file exists
 */
export async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

/**
 * Resolve path relative to data directory
 * @param relativePath - Relative path
 * @returns Absolute path
 */
export function resolveDataPath(relativePath: string): string {
  const dataDir = process.env.HICLAW_DATA_DIR || '/root/hiclaw-manager'
  return path.join(dataDir, relativePath)
}

/**
 * Read directory contents
 * @param dirPath - Path to directory
 * @returns Array of file names
 */
export async function readDir(dirPath: string): Promise<string[]> {
  try {
    return await fs.readdir(dirPath)
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
      return []
    }
    throw error
  }
}

/**
 * Read a file's content as string
 * @param filePath - Path to the file
 * @returns File content as string
 */
export async function readFileContent(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
      return ''
    }
    throw error
  }
}
