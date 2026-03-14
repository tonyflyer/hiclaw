import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readJsonFile, readTextFile, fileExists, resolveDataPath } from '../lib/file-reader.js'
import fs from 'fs/promises'
import path from 'path'
import os from 'os'

describe('file-reader', () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'file-reader-test-'))
    vi.restoreAllMocks()
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {})
  })

  describe('readJsonFile', () => {
    it('should read and parse a valid JSON file', async () => {
      const testFile = path.join(tempDir, 'test.json')
      await fs.writeFile(testFile, '{"name": "test", "value": 123}')

      const result = await readJsonFile<{ name: string; value: number }>(testFile)

      expect(result).toEqual({ name: 'test', value: 123 })
    })

    it('should retry on failure and succeed', async () => {
      const testFile = path.join(tempDir, 'retry.json')
      let attempts = 0

      // Mock fs.readFile to fail twice then succeed
      const originalReadFile = fs.readFile
      vi.spyOn(fs, 'readFile').mockImplementation(async (filePath, options) => {
        if (String(filePath).includes('retry.json')) {
          attempts++
          if (attempts < 3) {
            throw new Error('Temporary failure')
          }
        }
        return originalReadFile(filePath as Parameters<typeof fs.readFile>[0], options as Parameters<typeof fs.readFile>[1])
      })

      await fs.writeFile(testFile, '{"ok": true}')
      const result = await readJsonFile(testFile, { retries: 3, retryDelay: 10 })

      expect(result).toEqual({ ok: true })
      expect(attempts).toBe(3)
    })

    it('should throw after all retries exhausted', async () => {
      const testFile = path.join(tempDir, 'fail.json')

      vi.spyOn(fs, 'readFile').mockRejectedValue(new Error('File not found'))

      await expect(readJsonFile(testFile)).rejects.toThrow('Failed to read')
    })

    it('should handle invalid JSON', async () => {
      const testFile = path.join(tempDir, 'invalid.json')
      await fs.writeFile(testFile, 'not valid json')

      await expect(readJsonFile(testFile)).rejects.toThrow()
    })
  })

  describe('readTextFile', () => {
    it('should read a text file', async () => {
      const testFile = path.join(tempDir, 'text.txt')
      await fs.writeFile(testFile, 'Hello, World!')

      const result = await readTextFile(testFile)

      expect(result).toBe('Hello, World!')
    })

    it('should handle binary file with utf-8 encoding', async () => {
      const testFile = path.join(tempDir, 'binary.bin')
      // Write valid UTF-8 bytes
      await fs.writeFile(testFile, Buffer.from([0x48, 0x65, 0x6c, 0x6c, 0x6f]))

      const result = await readTextFile(testFile, { encoding: 'utf-8' })

      expect(result).toBe('Hello')
    })
  })

  describe('fileExists', () => {
    it('should return true for existing file', async () => {
      const testFile = path.join(tempDir, 'exists.txt')
      await fs.writeFile(testFile, 'content')

      const result = await fileExists(testFile)

      expect(result).toBe(true)
    })

    it('should return false for non-existing file', async () => {
      const result = await fileExists(path.join(tempDir, 'nonexistent.txt'))

      expect(result).toBe(false)
    })
  })

  describe('resolveDataPath', () => {
    it('should resolve relative path with default data dir', () => {
      delete process.env.HICLAW_DATA_DIR
      const result = resolveDataPath('data/test.json')

      expect(result).toBe('/root/hiclaw-manager/data/test.json')
    })

    it('should resolve relative path with custom data dir', () => {
      process.env.HICLAW_DATA_DIR = '/custom/path'
      const result = resolveDataPath('data/test.json')

      expect(result).toBe('/custom/path/data/test.json')

      delete process.env.HICLAW_DATA_DIR
    })
  })
})
