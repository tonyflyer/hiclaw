# Mission Control Dashboard - Learnings

## Task 1: Project Scaffolding + Build Tooling

### What worked:
- Used `npm create vite@latest dashboard -- --template react-ts` for React + TypeScript frontend
- Created Express + TypeScript backend manually
- Both projects have TypeScript strict mode enabled
- Path aliases configured (`@/*` -> `src/*`)
- Vitest configured with jsdom for frontend, node for backend
- ESLint + Prettier configured

### Configuration details:
- **Frontend (dashboard/)**: 
  - Vite 8.0.0 + React 19.2.4 + TypeScript 5.9.3
  - Vitest 3.2.4 with jsdom environment
  - Path alias: `@` -> `src`
  
- **Backend (dashboard-api/)**:
  - Express 4.21.0 + TypeScript 5.9.3
  - Vitest 3.2.4 with node environment
  - tsx for dev hot reload
  - Path alias: `@` -> `src`

### Scripts available:
- `npm run dev` - Start dev server
- `npm run build` - Build for production
- `npm run test` - Run tests (watch mode)
- `npm run test:run` - Run tests once
- `npm run lint` - Run ESLint
- `npm run lint:fix` - Auto-fix ESLint issues
- `npm run format` - Format with Prettier

### Notes:
- Vite config uses `@` alias via `resolve.alias`
- tsconfig uses `paths` for TypeScript compiler
- Vitest config must NOT include @vitejs/plugin-react (causes version conflicts) - React is handled by Vite


## Task 6: API - `/api/agents` Endpoint

### What worked:
- Created `config.ts` with path utilities using `resolveDataPath()` from file-reader
- Implemented GET `/api/agents` that reads from workers-registry.json and worker-lifecycle.json
- Merged agent data with containerStatus from lifecycle file
- Handled edge cases: file not found (return empty array), malformed JSON (return 500)
- Used TDD - wrote tests first in agents.test.ts

### Key implementation details:
- `getWorkersRegistryPath()` -> `~/workers-registry.json`
- `getWorkerLifecyclePath()` -> `~/worker-lifecycle.json`
- Uses existing `readJsonFile<T>()` with retry logic
- Error handling differentiates between "file not found" (ENOENT) and other errors
- Maps lifecycle containerStatus values to Agent containerStatus types

### Testing:
- Used supertest for HTTP endpoint testing
- 6 test cases covering all edge cases
- All tests pass: `npm test -- --run`

### Build verification:
- `npm run build` passes

## Task 9: API - `/api/resources` Endpoint

### What worked:
- Used existing `docker-client.ts` methods (`listContainers()`, `getContainerStats()`)
- Implemented Docker API unavailability fallback with `available: false`
- Filtered containers by `hiclaw-` prefix
- Only fetch stats for running containers (null for stopped)
- Used TDD - wrote tests first in resources.test.ts

### Key implementation details:
- `getDockerClient()` returns singleton Docker client instance
- Uses socket path `/var/run/docker.sock` (or `DOCKER_SOCKET` env var)
- Error handling: ENOENT/no such file/connect → graceful fallback
- Maps container states: running/paused/restarting/exited → ContainerResourceStatus
- Stats return zeros when unavailable (not errors)

### Testing:
- 7 test cases covering all edge cases
- All tests pass: 47 total tests now pass

### API Response Format
```json
{
  "containers": [
    {
      "containerId": "abc123",
      "name": "hiclaw-manager",
      "cpuPercent": 10.5,
      "memoryUsage": 1024000,
      "memoryLimit": 2048000,
      "networkRx": 500,
      "networkTx": 300,
      "containerStatus": "running",
      "idleSince": null,
      "autoStoppedAt": null,
      "lastStartedAt": null
    }
  ],
  "available": true,
  "timestamp": "2026-03-13T12:00:00Z"
}
```

### Docker unavailable fallback:
```json
{
  "containers": [],
  "available": false,
  "message": "Docker API not available",
  "timestamp": "2026-03-13T12:00:00Z"
}
```
