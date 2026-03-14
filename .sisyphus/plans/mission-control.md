# Mission Control Dashboard — Agent 团队可视化

## TL;DR

> **Quick Summary**: 为 HiClaw Agent Teams 系统构建一个内置的 Mission Control Dashboard，提供实时 Agent 状态监控、任务列表、LLM 指标和容器资源概览。MVP 版本为只读观测面板，架构预留完整交互控制能力的扩展点。
> 
> **Deliverables**:
> - React + TypeScript 前端 SPA（构建产物嵌入 Manager 容器）
> - Node.js Express 后端 API（读取本地 JSON + Docker API + Session JSONL）
> - SSE 实时推送
> - Nginx 静态文件服务 + Higress 路由配置
> - supervisord 集成
> - 完整 TDD 测试套件
> 
> **Estimated Effort**: Large
> **Parallel Execution**: YES — 4 waves
> **Critical Path**: Task 1 → Task 3 → Task 7 → Task 10 → Task 13 → F1-F4

---

## Context

### Original Request
用户希望在 HiClaw 中集成类似"Mission Control"的 Agent 可视化方案，能够实时观测所有 Agent 的状态、任务进度和资源消耗。

### Interview Summary
**Key Discussions**:
- **功能范围**: MVP + 预留扩展。MVP 为只读观测面板，不含交互控制。
- **技术栈**: React + TypeScript 前端, Node.js Express 后端, SSE 实时推送
- **部署**: 嵌入 Manager 容器，复用 Nginx + supervisord 模式（与 Element Web 相同）
- **数据收集**: 服务端收集 — 后端直接读取 Manager 容器内的 JSON 文件 + Docker API，无需修改现有 Agent
- **测试**: TDD 方式

**Research Findings**:
- Manager 容器已有 Node.js 22 运行时、Nginx、supervisord
- Element Web 部署模式可直接复制：Nginx 静态文件 + supervisord program (priority 650)
- 现有数据源：`state.json`, `workers-registry.json`, `worker-lifecycle.json`, task `meta.json`, session JSONL
- Docker API socket 已挂载 (`/var/run/docker.sock`)，`container-api.sh` 已封装基础操作
- `tests/lib/agent-metrics.sh` 已实现 session JSONL 解析逻辑（可参考）

### Metis Review
**Identified Gaps** (addressed):
- **认证问题**: MVP 不含认证（与 Element Web 一致，依赖网络隔离）。架构预留 auth middleware 扩展点。
- **Worker session 文件访问**: Worker 在独立容器中，MVP 仅展示 Manager metrics + Docker stats，Worker LLM metrics 通过 Docker exec 获取（已有 `agent-metrics.sh` 先例）
- **并发文件读取**: JSON 文件可能被 Agent 写入时读取。使用 try-catch + 重试策略处理。
- **大 JSONL 文件**: 仅读取尾部 N 行获取近期 metrics，避免全文件扫描。
- **空状态处理**: Dashboard 在无 Worker/无任务时需显示友好的空状态 UI。
- **Docker API 不可用**: 容器未挂载 socket 时需 graceful fallback，不能崩溃。
- **历史数据范围**: MVP 仅展示当前状态 + 最近 24 小时，不做长期趋势。

---

## Work Objectives

### Core Objective
在 Manager 容器中构建一个嵌入式 Web Dashboard，实时展示 Agent 团队运行状态，使 HiClaw 用户无需查看日志即可了解整个系统的健康情况。

### Concrete Deliverables
- `dashboard/` — React + TypeScript 前端源码
- `dashboard-api/` — Node.js Express 后端源码
- `manager/scripts/init/start-dashboard.sh` — Dashboard 启动脚本
- `manager/supervisord.conf` — 添加 dashboard-api + dashboard-web programs
- `manager/Dockerfile` — 添加 Dashboard 构建阶段
- `manager/scripts/init/setup-higress.sh` — 添加 Dashboard 路由
- 完整的测试套件（后端 API 测试 + 集成测试）

### Definition of Done
- [ ] `curl http://console-local.hiclaw.io:18080` 返回 Dashboard HTML
- [ ] `/api/agents` 返回 Worker 列表和状态
- [ ] `/api/tasks` 返回活跃任务列表
- [ ] `/api/metrics` 返回 LLM 调用指标
- [ ] `/api/resources` 返回容器资源信息（或 graceful fallback）
- [ ] `/api/events` SSE 流推送实时更新
- [ ] `npm test` 全部通过
- [ ] Docker build 成功
- [ ] 无 Worker 时 Dashboard 显示友好空状态

### Must Have
- 只读观测面板（Agent 状态卡片、任务列表、活动流、LLM 指标）
- SSE 实时推送
- 容器资源监控（Docker stats）
- Graceful fallback（Docker API 不可用时降级）
- 空状态 UI（无 Worker / 无任务场景）
- Responsive 布局（桌面浏览器）
- 嵌入 Manager 容器部署

### Must NOT Have (Guardrails)
- ❌ 交互控制功能（暂停/恢复/停止 Agent）
- ❌ 成本分析 / 费用计算
- ❌ 历史回放 / 时间旅行
- ❌ 多团队 / 多租户支持
- ❌ Worker 创建/删除操作
- ❌ 修改任何现有 Agent 代码（OpenClaw 配置、Skills、HEARTBEAT.md 等）
- ❌ 写入 state.json / workers-registry.json / worker-lifecycle.json
- ❌ 独立的认证系统（MVP 依赖网络隔离）
- ❌ CSV/PDF 导出功能
- ❌ 告警 / 通知系统（Heartbeat 已有此功能）
- ❌ 移动端优化（MVP 仅桌面浏览器）

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** — ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO（新项目，需搭建）
- **Automated tests**: TDD
- **Framework**: Vitest（后端）+ Vitest + React Testing Library（前端）
- **If TDD**: 每个任务按 RED (failing test) → GREEN (minimal impl) → REFACTOR

### QA Policy
Every task MUST include agent-executed QA scenarios.
Evidence saved to `.sisyphus/evidence/task-{N}-{scenario-slug}.{ext}`.

- **Frontend/UI**: Use Playwright — Navigate, interact, assert DOM, screenshot
- **API/Backend**: Use Bash (curl) — Send requests, assert status + response fields
- **Build/Deploy**: Use Bash — Run build commands, verify output files exist

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — foundation + scaffolding):
├── Task 1: Project scaffolding + build tooling [quick]
├── Task 2: TypeScript type definitions (shared) [quick]
├── Task 3: Backend API skeleton + test setup [quick]
├── Task 4: Frontend React skeleton + test setup [visual-engineering]
└── Task 5: Design system tokens + base components [visual-engineering]

Wave 2 (After Wave 1 — core API endpoints + frontend pages):
├── Task 6: API — /api/agents endpoint (depends: 2, 3) [unspecified-high]
├── Task 7: API — /api/tasks endpoint (depends: 2, 3) [unspecified-high]
├── Task 8: API — /api/metrics endpoint (depends: 2, 3) [unspecified-high]
├── Task 9: API — /api/resources endpoint (depends: 2, 3) [unspecified-high]
├── Task 10: API — /api/events SSE endpoint (depends: 2, 3) [deep]
├── Task 11: Frontend — Agent Status Cards (depends: 4, 5) [visual-engineering]
├── Task 12: Frontend — Task List Panel (depends: 4, 5) [visual-engineering]
└── Task 13: Frontend — Activity Stream + Metrics (depends: 4, 5) [visual-engineering]

Wave 3 (After Wave 2 — integration + deployment):
├── Task 14: Frontend — Data hooks + SSE integration (depends: 10, 11, 12, 13) [deep]
├── Task 15: Dashboard startup script + supervisord config (depends: 3) [quick]
├── Task 16: Dockerfile build stage + Nginx config (depends: 4, 15) [quick]
├── Task 17: Higress route configuration (depends: 16) [quick]
└── Task 18: Changelog entry (depends: 16) [quick]

Wave 4 (After Wave 3 — verification):
├── Task 19: Integration test — full API + Docker (depends: 14, 17) [deep]
├── Task 20: E2E test — Playwright full flow (depends: 14, 17) [unspecified-high]

Wave FINAL (After ALL tasks — independent review, 4 parallel):
├── Task F1: Plan compliance audit (oracle)
├── Task F2: Code quality review (unspecified-high)
├── Task F3: Real manual QA (unspecified-high)
└── Task F4: Scope fidelity check (deep)

Critical Path: Task 1 → Task 3 → Task 10 → Task 14 → Task 17 → Task 19 → F1-F4
Parallel Speedup: ~65% faster than sequential
Max Concurrent: 8 (Wave 2)
```

### Dependency Matrix

| Task | Depends On | Blocks | Wave |
|------|-----------|--------|------|
| 1 | — | 2-5 | 1 |
| 2 | — | 6-10 | 1 |
| 3 | 1 | 6-10, 15 | 1 |
| 4 | 1 | 11-13, 16 | 1 |
| 5 | — | 11-13 | 1 |
| 6 | 2, 3 | 14 | 2 |
| 7 | 2, 3 | 14 | 2 |
| 8 | 2, 3 | 14 | 2 |
| 9 | 2, 3 | 14 | 2 |
| 10 | 2, 3 | 14 | 2 |
| 11 | 4, 5 | 14 | 2 |
| 12 | 4, 5 | 14 | 2 |
| 13 | 4, 5 | 14 | 2 |
| 14 | 10, 11, 12, 13 | 19, 20 | 3 |
| 15 | 3 | 16 | 3 |
| 16 | 4, 15 | 17 | 3 |
| 17 | 16 | 19, 20 | 3 |
| 18 | 16 | — | 3 |
| 19 | 14, 17 | F1-F4 | 4 |
| 20 | 14, 17 | F1-F4 | 4 |

### Agent Dispatch Summary

- **Wave 1**: 5 tasks — T1→`quick`, T2→`quick`, T3→`quick`, T4→`visual-engineering`, T5→`visual-engineering`
- **Wave 2**: 8 tasks — T6-T9→`unspecified-high`, T10→`deep`, T11-T13→`visual-engineering`
- **Wave 3**: 5 tasks — T14→`deep`, T15→`quick`, T16→`quick`, T17→`quick`, T18→`quick`
- **Wave 4**: 2 tasks — T19→`deep`, T20→`unspecified-high`
- **FINAL**: 4 tasks — F1→`oracle`, F2→`unspecified-high`, F3→`unspecified-high`, F4→`deep`

---

## TODOs

### Wave 1 — Foundation + Scaffolding

- [x] 1. Project Scaffolding + Build Tooling

  **What to do**:
  - Create `dashboard/` directory with Vite + React + TypeScript project (`npm create vite@latest`)
  - Create `dashboard-api/` directory with Express + TypeScript project
  - Configure `tsconfig.json` for both projects (strict mode, path aliases)
  - Set up Vitest for both projects with basic config
  - Add `.eslintrc` + `.prettierrc` matching project conventions
  - Create `dashboard-api/package.json` with scripts: `dev`, `build`, `test`, `lint`
  - Create `dashboard/package.json` with scripts: `dev`, `build`, `test`, `lint`
  - Verify: `npm install && npm run build && npm test` passes for both

  **Must NOT do**:
  - Don't install UI component libraries yet (Task 5)
  - Don't write any API routes or React components (later tasks)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Standard project scaffolding with well-known tools
  - **Skills**: [`vercel-react-best-practices`]
    - `vercel-react-best-practices`: React project setup best practices

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 2, 4, 5)
  - **Blocks**: Tasks 3, 4 (need project structure)
  - **Blocked By**: None

  **References**:
  - `manager/Dockerfile:46-50` — existing npm install pattern in Manager image
  - `manager/supervisord.conf:94-101` — Element Web as deployment reference
  - `tests/lib/agent-metrics.sh:1-30` — session JSONL format reference for backend

  **Acceptance Criteria**:
  - [ ] `cd dashboard && npm install && npm run build` exits 0
  - [ ] `cd dashboard-api && npm install && npm run build` exits 0
  - [ ] `cd dashboard && npm test -- --run` exits 0 (placeholder test)
  - [ ] `cd dashboard-api && npm test -- --run` exits 0 (placeholder test)

  **QA Scenarios:**
  ```
  Scenario: Build tooling works for both projects
    Tool: Bash
    Preconditions: Fresh checkout, no node_modules
    Steps:
      1. cd dashboard && npm install && npm run build
      2. ls dist/index.html
      3. cd ../dashboard-api && npm install && npm run build
      4. ls dist/index.js
    Expected Result: All commands exit 0, dist files exist
    Failure Indicators: Non-zero exit code, missing dist/ directory
    Evidence: .sisyphus/evidence/task-1-build-tooling.txt
  ```

  **Commit**: YES (group with Wave 1)
  - Message: `feat(dashboard): scaffold frontend and backend projects with build tooling`
  - Files: `dashboard/`, `dashboard-api/`
  - Pre-commit: `cd dashboard && npm test -- --run && cd ../dashboard-api && npm test -- --run`

---

- [x] 2. Shared TypeScript Type Definitions

  **What to do**:
  - Create `dashboard-api/src/types/` directory
  - Define shared types based on existing JSON file structures:
    - `Agent` type (from `workers-registry.json`): name, matrixId, roomId, role, skills, runtime, containerStatus
    - `Task` type (from `state.json` + `meta.json`): taskId, type (finite/infinite), assignedTo, roomId, status, assignedAt, completedAt, schedule?
    - `Metrics` type (from session JSONL): llmCalls, tokens (input/output/cacheRead/cacheWrite/total), timing
    - `ContainerResource` type (from Docker stats API): containerId, name, cpuPercent, memoryUsage, memoryLimit, networkRx, networkTx
    - `SSEEvent` type: eventType (agent_update/task_update/metrics_update/resource_update), data, timestamp
    - `DashboardState` type: agents, tasks, metrics, resources, lastUpdated
  - Create `dashboard/src/types/` and either symlink or copy the types
  - Write tests that validate types compile correctly

  **Must NOT do**:
  - Don't hardcode any actual data values
  - Don't add API client logic (Task 14)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Pure type definitions, no complex logic
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1, 3, 4, 5)
  - **Blocks**: Tasks 6-10 (all API endpoints use these types)
  - **Blocked By**: None

  **References**:
  - `manager/agent/skills/task-management/SKILL.md:38-73` — state.json and meta.json structure
  - `manager/agent/skills/worker-management/scripts/lifecycle-worker.sh:51-60` — worker-lifecycle.json structure
  - `tests/lib/agent-metrics.sh:42-117` — session JSONL metrics structure (llm_calls, tokens, timing)
  - `manager/scripts/lib/container-api.sh:64-74` — Docker API response format

  **Acceptance Criteria**:
  - [ ] `tsc --noEmit` passes for both projects
  - [ ] Types match documented JSON structures

  **QA Scenarios:**
  ```
  Scenario: Types compile and match JSON schemas
    Tool: Bash
    Preconditions: Task 1 complete
    Steps:
      1. cd dashboard-api && npx tsc --noEmit
      2. cd ../dashboard && npx tsc --noEmit
    Expected Result: Exit 0, no type errors
    Failure Indicators: TypeScript compilation errors
    Evidence: .sisyphus/evidence/task-2-type-check.txt
  ```

  **Commit**: YES (group with Wave 1)
  - Message: `feat(dashboard): define shared TypeScript types for agents, tasks, metrics`
  - Files: `dashboard-api/src/types/`, `dashboard/src/types/`
  - Pre-commit: `cd dashboard-api && npx tsc --noEmit`

---

- [x] 3. Backend API Skeleton + Test Setup

  **What to do**:
  - Create `dashboard-api/src/index.ts` — Express app with CORS, JSON parsing, error handler
  - Create route scaffolds: `routes/agents.ts`, `routes/tasks.ts`, `routes/metrics.ts`, `routes/resources.ts`, `routes/events.ts`
  - Each route returns `501 Not Implemented` placeholder
  - Create `dashboard-api/src/lib/file-reader.ts` — utility for safe JSON file reading with retry (handles concurrent writes)
  - Create `dashboard-api/src/lib/docker-client.ts` — wrapper for Docker API via unix socket
  - Configure Vitest with `dashboard-api/vitest.config.ts`
  - Write tests for file-reader (mock fs) and docker-client (mock fetch)
  - Set up health check endpoint: `GET /api/health` → `{"status": "ok"}`
  - **TDD**: Write tests FIRST for file-reader, docker-client, and health endpoint, then implement

  **Must NOT do**:
  - Don't implement actual data reading logic (Wave 2 tasks)
  - Don't connect to real Docker socket yet

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Boilerplate Express setup with established patterns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 1 (with Tasks 2, 4, 5)
  - **Blocks**: Tasks 6-10, 15
  - **Blocked By**: Task 1 (project structure needed)

  **References**:
  - `manager/scripts/lib/container-api.sh:29-61` — Docker socket API pattern (curl via unix socket)
  - `tests/lib/agent-metrics.sh:42-117` — JSONL parsing pattern to port to TypeScript
  - `manager/agent/skills/task-management/SKILL.md:105-135` — state.json structure

  **Acceptance Criteria**:
  - [ ] `npm test -- --run` passes with file-reader and docker-client tests
  - [ ] `curl http://localhost:8090/api/health` → `{"status": "ok"}`
  - [ ] All route placeholders return 501

  **QA Scenarios:**
  ```
  Scenario: API health check responds
    Tool: Bash
    Preconditions: API running on port 8090
    Steps:
      1. cd dashboard-api && npm run dev &
      2. sleep 2
      3. curl -s http://localhost:8090/api/health | jq -r '.status'
      4. kill %1
    Expected Result: Output is "ok"
    Failure Indicators: Connection refused, non-JSON response
    Evidence: .sisyphus/evidence/task-3-health-check.txt

  Scenario: Unimplemented routes return 501
    Tool: Bash
    Preconditions: API running
    Steps:
      1. curl -s -o /dev/null -w '%{http_code}' http://localhost:8090/api/agents
    Expected Result: HTTP 501
    Evidence: .sisyphus/evidence/task-3-501-routes.txt
  ```

  **Commit**: YES (group with Wave 1)
  - Message: `feat(dashboard-api): create Express skeleton with route stubs and utility libs`
  - Files: `dashboard-api/src/`
  - Pre-commit: `cd dashboard-api && npm test -- --run`

---

- [ ] 4. Frontend React Skeleton + Test Setup

  **What to do**:
  - Create `dashboard/src/App.tsx` — main app with React Router layout
  - Create page components: `pages/Dashboard.tsx` (main view)
  - Create layout: `components/Layout.tsx` with header ("HiClaw Mission Control"), sidebar placeholder, main content area
  - Configure React Router with single route `/` → Dashboard page
  - Configure Vitest + React Testing Library + jsdom
  - Write basic render tests: App renders, Layout renders, Router works
  - Set up Tailwind CSS (or CSS Modules) for styling foundation
  - Add `<title>HiClaw Mission Control</title>` to index.html
  - **TDD**: Write render tests FIRST, then implement components

  **Must NOT do**:
  - Don't build actual data-connected components (Wave 2)
  - Don't add API client / data fetching
  - Don't over-design the layout — keep it minimal skeleton

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Frontend UI scaffolding with React + CSS
  - **Skills**: [`vercel-react-best-practices`, `frontend-ui-ux`]
    - `vercel-react-best-practices`: React component patterns
    - `frontend-ui-ux`: UI layout best practices

  **Parallelization**:
  - **Can Run In Parallel**: YES (after Task 1)
  - **Parallel Group**: Wave 1 (with Tasks 2, 3, 5)
  - **Blocks**: Tasks 11-13, 16
  - **Blocked By**: Task 1 (project structure needed)

  **References**:
  - `manager/scripts/init/start-element-web.sh:31-51` — Nginx config pattern for SPA

  **Acceptance Criteria**:
  - [ ] `npm test -- --run` passes with render tests
  - [ ] `npm run build` produces `dist/index.html` containing "Mission Control"
  - [ ] Tailwind CSS configured and working

  **QA Scenarios:**
  ```
  Scenario: Frontend builds and contains expected content
    Tool: Bash
    Preconditions: Task 1 complete
    Steps:
      1. cd dashboard && npm run build
      2. grep -q "Mission Control" dist/index.html
    Expected Result: Exit 0, grep finds the text
    Failure Indicators: Build failure, text not found
    Evidence: .sisyphus/evidence/task-4-frontend-build.txt
  ```

  **Commit**: YES (group with Wave 1)
  - Message: `feat(dashboard): create React skeleton with layout, routing, and Tailwind`
  - Files: `dashboard/src/`
  - Pre-commit: `cd dashboard && npm test -- --run`

---

- [ ] 5. Design System Tokens + Base Components

  **What to do**:
  - Create `dashboard/src/styles/tokens.css` — CSS custom properties for colors, spacing, typography
  - Design tokens: Use a professional dark theme (suitable for monitoring dashboards)
    - Primary: Blue (#3B82F6), Success: Green (#10B981), Warning: Amber (#F59E0B), Error: Red (#EF4444)
    - Background: Slate-900 (#0F172A), Surface: Slate-800 (#1E293B), Border: Slate-700 (#334155)
  - Create reusable base components:
    - `components/ui/Card.tsx` — generic card container with header/body
    - `components/ui/Badge.tsx` — status badge (online/offline/idle/busy)
    - `components/ui/Spinner.tsx` — loading indicator
    - `components/ui/EmptyState.tsx` — placeholder for no-data scenarios
  - Write tests for each component (renders, accepts props, shows correct variants)
  - **TDD**: Write component tests FIRST, then implement

  **Must NOT do**:
  - Don't install heavy component libraries (MUI, Ant Design, etc.)
  - Don't build domain-specific components (Agent cards, Task list — Wave 2)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Design system and UI component creation
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Professional UI design patterns

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Tasks 1-4)
  - **Blocks**: Tasks 11-13 (use design tokens + base components)
  - **Blocked By**: None

  **References**:
  - No codebase references needed — greenfield design system

  **Acceptance Criteria**:
  - [ ] CSS tokens defined and importable
  - [ ] All 4 base components render correctly in tests
  - [ ] Badge shows correct variants: online (green), offline (red), idle (amber), busy (blue)
  - [ ] EmptyState shows custom message and optional icon

  **QA Scenarios:**
  ```
  Scenario: Design tokens and components render
    Tool: Bash
    Preconditions: Task 1, 4 complete
    Steps:
      1. cd dashboard && npm test -- --run
      2. Verify Card, Badge, Spinner, EmptyState tests pass
    Expected Result: All component tests pass
    Evidence: .sisyphus/evidence/task-5-design-system.txt
  ```

  **Commit**: YES (group with Wave 1)
  - Message: `feat(dashboard): add dark theme design tokens and base UI components`
  - Files: `dashboard/src/styles/`, `dashboard/src/components/ui/`
  - Pre-commit: `cd dashboard && npm test -- --run`

---

### Wave 2 — Core API Endpoints + Frontend Pages

- [x] 6. API — `/api/agents` Endpoint

  **What to do**:
  - **RED**: Write tests for GET `/api/agents` — returns worker list from `workers-registry.json`, merged with container status from `worker-lifecycle.json`
  - **GREEN**: Implement `routes/agents.ts`:
    - Read `~/workers-registry.json` via `file-reader.ts`
    - Read `~/worker-lifecycle.json` via `file-reader.ts`
    - Merge: each agent gets `containerStatus` from lifecycle data
    - Return `{ agents: Agent[], timestamp: string }`
  - **REFACTOR**: Extract common file paths to config module `lib/config.ts`
  - Handle edge cases: file not found → empty array, malformed JSON → error response

  **Must NOT do**:
  - Don't write to any JSON files
  - Don't implement Worker creation/deletion

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Backend logic with file I/O and data merging
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 7-13)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `manager/agent/skills/task-management/SKILL.md:12` — `workers-registry.json` usage
  - `manager/agent/skills/worker-management/scripts/lifecycle-worker.sh:17-60` — `worker-lifecycle.json` structure (version, idle_timeout_minutes, workers map)
  - `manager/agent/skills/worker-management/scripts/create-worker.sh` — how workers-registry.json is populated

  **Acceptance Criteria**:
  - [ ] Tests pass: `npm test -- --run routes/agents`
  - [ ] `curl /api/agents` returns JSON with `agents` array
  - [ ] Missing file → `{ agents: [] }`
  - [ ] Malformed JSON → HTTP 500 with error message

  **QA Scenarios:**
  ```
  Scenario: Agents endpoint returns worker list
    Tool: Bash (curl)
    Preconditions: API running, workers-registry.json exists with at least one worker
    Steps:
      1. curl -s http://localhost:8090/api/agents | jq '.agents | length'
      2. curl -s http://localhost:8090/api/agents | jq '.agents[0].name'
    Expected Result: Length >= 1, name is a non-empty string
    Evidence: .sisyphus/evidence/task-6-agents-endpoint.txt

  Scenario: Agents endpoint handles missing file gracefully
    Tool: Bash (curl)
    Preconditions: API running, workers-registry.json does NOT exist
    Steps:
      1. curl -s http://localhost:8090/api/agents | jq '.agents | length'
    Expected Result: Length == 0 (empty array, not error)
    Evidence: .sisyphus/evidence/task-6-agents-empty.txt
  ```

  **Commit**: YES (group with Wave 2 API)
  - Message: `feat(dashboard-api): implement /api/agents endpoint with worker registry + lifecycle merge`
  - Files: `dashboard-api/src/routes/agents.ts`, `dashboard-api/src/__tests__/`
  - Pre-commit: `cd dashboard-api && npm test -- --run`

---

- [x] 7. API — `/api/tasks` Endpoint

  **What to do**:
  - **RED**: Write tests for GET `/api/tasks` — returns active tasks from `state.json`, enriched with task meta from `shared/tasks/*/meta.json`
  - **GREEN**: Implement `routes/tasks.ts`:
    - Read `~/state.json` for `active_tasks` array
    - For each task, optionally read `~/hiclaw-fs/shared/tasks/{id}/meta.json` for enrichment
    - Return `{ tasks: Task[], timestamp: string }`
  - Handle edge cases: state.json missing → empty, task meta missing → use state.json data only

  **Must NOT do**:
  - Don't modify state.json or meta.json
  - Don't implement task assignment/completion

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Backend file reading with directory scanning
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 8-13)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `manager/agent/skills/task-management/SKILL.md:105-147` — state.json structure (`active_tasks` array with task_id, type, assigned_to, room_id)
  - `manager/agent/skills/task-management/SKILL.md:38-73` — task directory layout and meta.json structure

  **Acceptance Criteria**:
  - [ ] Tests pass: `npm test -- --run routes/tasks`
  - [ ] `curl /api/tasks` returns JSON with `tasks` array
  - [ ] state.json missing → `{ tasks: [] }`

  **QA Scenarios:**
  ```
  Scenario: Tasks endpoint returns active tasks
    Tool: Bash (curl)
    Preconditions: API running, state.json exists with active_tasks
    Steps:
      1. curl -s http://localhost:8090/api/tasks | jq '.tasks | length'
    Expected Result: Length matches active_tasks count in state.json
    Evidence: .sisyphus/evidence/task-7-tasks-endpoint.txt
  ```

  **Commit**: YES (group with Wave 2 API)
  - Message: `feat(dashboard-api): implement /api/tasks endpoint with state + meta enrichment`
  - Files: `dashboard-api/src/routes/tasks.ts`, tests
  - Pre-commit: `cd dashboard-api && npm test -- --run`

---

- [x] 8. API — `/api/metrics` Endpoint

  **What to do**:
  - **RED**: Write tests for GET `/api/metrics` — returns LLM call metrics from OpenClaw session JSONL files
  - **GREEN**: Implement `routes/metrics.ts`:
    - Port parsing logic from `tests/lib/agent-metrics.sh:parse_session_metrics_inline` to TypeScript
    - Read Manager session JSONL from `~/.openclaw/agents/main/sessions/` (latest file, tail N lines)
    - For each Worker: use Docker exec to read their session files (or skip if unavailable)
    - Aggregate: per-agent `llmCalls`, `tokens`, `timing`
    - Return `{ metrics: { agents: Record<string, Metrics>, totals: Metrics }, timestamp: string }`
  - Handle: JSONL file missing → zero metrics, Worker container not running → skip
  - **Optimization**: Only read last 1000 lines of JSONL for recent metrics

  **Must NOT do**:
  - Don't modify session files
  - Don't implement cost calculation

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: JSONL parsing logic, Docker exec integration
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6, 7, 9-13)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `tests/lib/agent-metrics.sh:42-117` — **CRITICAL**: JSONL parsing logic to port. Reads `.message.role`, `.message.usage` fields. Accumulates input/output/cacheRead/cacheWrite tokens.
  - `tests/lib/agent-metrics.sh:143-148` — session file location pattern: `~/.openclaw/agents/main/sessions/*.jsonl`
  - `tests/lib/agent-metrics.sh:155-196` — Worker session file location: `/root/hiclaw-fs/agents/{worker}/.openclaw/agents/main/sessions/`

  **Acceptance Criteria**:
  - [ ] Tests pass with mock JSONL data
  - [ ] `curl /api/metrics` returns JSON with `metrics.totals.llmCalls`
  - [ ] No session files → zero metrics (not error)

  **QA Scenarios:**
  ```
  Scenario: Metrics endpoint parses session data
    Tool: Bash (curl)
    Preconditions: API running, session JSONL exists
    Steps:
      1. curl -s http://localhost:8090/api/metrics | jq '.metrics.totals.llmCalls'
    Expected Result: A non-negative integer
    Evidence: .sisyphus/evidence/task-8-metrics-endpoint.txt
  ```

  **Commit**: YES (group with Wave 2 API)
  - Message: `feat(dashboard-api): implement /api/metrics endpoint with JSONL parsing`
  - Files: `dashboard-api/src/routes/metrics.ts`, `dashboard-api/src/lib/jsonl-parser.ts`, tests
  - Pre-commit: `cd dashboard-api && npm test -- --run`

---

- [x] 9. API — `/api/resources` Endpoint

  **What to do**:
  - **RED**: Write tests for GET `/api/resources` — returns container CPU/memory stats via Docker API
  - **GREEN**: Implement `routes/resources.ts`:
    - Use `docker-client.ts` to call `GET /containers/json?filters={"name":["hiclaw-"]}` for container list
    - For each container: call `GET /containers/{id}/stats?stream=false` for CPU/memory
    - Parse Docker stats JSON to extract CPU %, memory usage/limit, network I/O
    - Return `{ containers: ContainerResource[], timestamp: string }`
  - Handle: Docker socket unavailable → `{ containers: [], available: false, message: "Docker API not available" }`

  **Must NOT do**:
  - Don't start/stop/remove containers
  - Don't modify Docker state

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: Docker API integration with stats parsing
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6-8, 10-13)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `manager/scripts/lib/container-api.sh:19-74` — Docker socket API pattern (CONTAINER_SOCKET, _api function, container_api_available check)
  - `manager/scripts/lib/container-api.sh:76-79` — container_get_manager_ip helper
  - Docker Engine API: `GET /containers/{id}/stats?stream=false` returns one-shot stats JSON

  **Acceptance Criteria**:
  - [ ] Tests pass with mocked Docker API responses
  - [ ] `curl /api/resources` returns JSON with `containers` array
  - [ ] Docker socket missing → `{ containers: [], available: false }`

  **QA Scenarios:**
  ```
  Scenario: Resources endpoint with Docker available
    Tool: Bash (curl)
    Preconditions: API running inside Manager container with Docker socket
    Steps:
      1. curl -s http://localhost:8090/api/resources | jq '.containers | length'
    Expected Result: Length >= 1 (at least Manager container)
    Evidence: .sisyphus/evidence/task-9-resources-endpoint.txt

  Scenario: Resources endpoint without Docker
    Tool: Bash (curl)
    Preconditions: API running without Docker socket
    Steps:
      1. curl -s http://localhost:8090/api/resources | jq '.available'
    Expected Result: false
    Evidence: .sisyphus/evidence/task-9-resources-fallback.txt
  ```

  **Commit**: YES (group with Wave 2 API)
  - Message: `feat(dashboard-api): implement /api/resources endpoint with Docker stats`
  - Files: `dashboard-api/src/routes/resources.ts`, tests
  - Pre-commit: `cd dashboard-api && npm test -- --run`

---

- [x] 10. API — `/api/events` SSE Endpoint

  **What to do**:
  - **RED**: Write tests for GET `/api/events` — SSE stream that pushes periodic state updates
  - **GREEN**: Implement `routes/events.ts`:
    - Set SSE headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
    - Create `lib/state-collector.ts` — periodic data aggregator:
      - Every 5 seconds: read all data sources (agents, tasks, metrics, resources)
      - Compare with previous state, emit SSE events on change
      - Event types: `agent_update`, `task_update`, `metrics_update`, `resource_update`, `heartbeat`
    - Send `heartbeat` event every 30s (keep connection alive)
    - Handle client disconnect gracefully (clean up interval)
  - **REFACTOR**: Extract data source reading into shared service (reused by REST endpoints + SSE)

  **Must NOT do**:
  - Don't implement WebSocket
  - Don't add authentication to the stream

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: SSE protocol implementation, periodic state management, change detection
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6-9, 11-13)
  - **Blocks**: Task 14 (SSE integration in frontend)
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `manager/agent/skills/task-management/SKILL.md:105-147` — state.json as primary data source
  - MDN Web Docs: Server-Sent Events protocol format (`event:`, `data:`, `id:`, `retry:`)

  **Acceptance Criteria**:
  - [ ] Tests pass for SSE event formatting and state collector
  - [ ] `curl -sN /api/events` receives `event: heartbeat` within 30s
  - [ ] Client disconnect doesn't leave orphaned intervals

  **QA Scenarios:**
  ```
  Scenario: SSE stream sends heartbeat
    Tool: Bash (curl)
    Preconditions: API running
    Steps:
      1. timeout 35 curl -sN http://localhost:8090/api/events > /tmp/sse-output.txt 2>&1 || true
      2. grep -c 'event: heartbeat' /tmp/sse-output.txt
    Expected Result: Count >= 1
    Evidence: .sisyphus/evidence/task-10-sse-heartbeat.txt
  ```

  **Commit**: YES (group with Wave 2 API)
  - Message: `feat(dashboard-api): implement /api/events SSE endpoint with state collector`
  - Files: `dashboard-api/src/routes/events.ts`, `dashboard-api/src/lib/state-collector.ts`, tests
  - Pre-commit: `cd dashboard-api && npm test -- --run`

---

- [x] 11. Frontend — Agent Status Cards

  **What to do**:
  - **RED**: Write tests for AgentCard and AgentGrid components
  - **GREEN**: Implement `components/agents/AgentCard.tsx`:
    - Display: agent name, role, container status badge (online/offline/idle), Matrix room ID
    - Show last activity timestamp
    - Use Badge component from Task 5 for status indicator
    - Color-coded: running=green, stopped=red, idle=amber
  - Implement `components/agents/AgentGrid.tsx`:
    - Grid layout of AgentCards
    - Empty state: use EmptyState component ("No workers registered yet")
  - Use mock data for now (no API connection)

  **Must NOT do**:
  - Don't add API data fetching (Task 14)
  - Don't add interactive controls (pause/resume buttons)

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI component design with visual states
  - **Skills**: [`frontend-ui-ux`]
    - `frontend-ui-ux`: Agent card visual design

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6-10, 12, 13)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 4, 5

  **References**:
  - Task 2 type definitions — Agent type shape
  - Task 5 base components — Card, Badge, EmptyState

  **Acceptance Criteria**:
  - [ ] AgentCard renders with all fields
  - [ ] AgentGrid shows empty state when no agents
  - [ ] Status badges show correct colors

  **QA Scenarios:**
  ```
  Scenario: Agent cards render with mock data
    Tool: Bash
    Preconditions: Tasks 4, 5 complete
    Steps:
      1. cd dashboard && npm test -- --run agents
    Expected Result: All agent component tests pass
    Evidence: .sisyphus/evidence/task-11-agent-cards.txt
  ```

  **Commit**: YES (group with Wave 2 UI)
  - Message: `feat(dashboard): implement Agent Status Cards with grid layout`
  - Files: `dashboard/src/components/agents/`
  - Pre-commit: `cd dashboard && npm test -- --run`

---

- [x] 12. Frontend — Task List Panel

  **What to do**:
  - **RED**: Write tests for TaskRow and TaskList components
  - **GREEN**: Implement `components/tasks/TaskRow.tsx`:
    - Display: task ID, type badge (finite/infinite), assigned worker, status, assigned time
    - Finite tasks: show completion progress indicator
    - Infinite tasks: show schedule and last executed time
  - Implement `components/tasks/TaskList.tsx`:
    - Sortable/filterable table of tasks
    - Empty state: "No active tasks"
  - Use mock data for now

  **Must NOT do**:
  - Don't add task creation/assignment UI
  - Don't add API connection

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Table/list UI with filtering
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6-11, 13)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 4, 5

  **References**:
  - Task 2 type definitions — Task type shape

  **Acceptance Criteria**:
  - [ ] TaskRow renders finite and infinite task types correctly
  - [ ] TaskList shows empty state when no tasks
  - [ ] Tests pass

  **QA Scenarios:**
  ```
  Scenario: Task list renders with mock data
    Tool: Bash
    Steps:
      1. cd dashboard && npm test -- --run tasks
    Expected Result: All task component tests pass
    Evidence: .sisyphus/evidence/task-12-task-list.txt
  ```

  **Commit**: YES (group with Wave 2 UI)
  - Message: `feat(dashboard): implement Task List Panel with filtering`
  - Files: `dashboard/src/components/tasks/`
  - Pre-commit: `cd dashboard && npm test -- --run`

---

- [x] 13. Frontend — Activity Stream + Metrics Panel

  **What to do**:
  - **RED**: Write tests for ActivityStream and MetricsPanel components
  - **GREEN**: Implement `components/activity/ActivityStream.tsx`:
    - Real-time scrolling feed of recent events
    - Each event: timestamp, type icon, description, agent name
    - Auto-scroll to latest, with pause-on-hover
  - Implement `components/metrics/MetricsPanel.tsx`:
    - Display: total LLM calls, input/output tokens, cache hit rate
    - Per-agent breakdown in mini cards
    - Simple bar chart for token distribution (no charting library — CSS bars)
  - Implement `components/resources/ResourcePanel.tsx`:
    - Container list with CPU/memory bars
    - Graceful fallback: "Resource monitoring unavailable" when Docker API not available
  - Use mock data for now

  **Must NOT do**:
  - Don't install charting libraries (use CSS-based visualization)
  - Don't add cost calculation
  - Don't connect to API yet

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Data visualization components with CSS
  - **Skills**: [`frontend-ui-ux`]

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Tasks 6-12)
  - **Blocks**: Task 14
  - **Blocked By**: Tasks 4, 5

  **References**:
  - Task 2 type definitions — Metrics, ContainerResource, SSEEvent types

  **Acceptance Criteria**:
  - [ ] ActivityStream renders events in chronological order
  - [ ] MetricsPanel shows LLM call totals and per-agent breakdown
  - [ ] ResourcePanel shows graceful fallback when no data
  - [ ] All tests pass

  **QA Scenarios:**
  ```
  Scenario: Activity stream and metrics render
    Tool: Bash
    Steps:
      1. cd dashboard && npm test -- --run activity metrics resources
    Expected Result: All component tests pass
    Evidence: .sisyphus/evidence/task-13-activity-metrics.txt
  ```

  **Commit**: YES (group with Wave 2 UI)
  - Message: `feat(dashboard): implement Activity Stream, Metrics Panel, and Resource Panel`
  - Files: `dashboard/src/components/activity/`, `dashboard/src/components/metrics/`, `dashboard/src/components/resources/`
  - Pre-commit: `cd dashboard && npm test -- --run`

---

### Wave 3 — Integration + Deployment

- [ ] 14. Frontend — Data Hooks + SSE Integration

  **What to do**:
  - Create `dashboard/src/hooks/useAgents.ts` — fetch from `/api/agents`, auto-refresh via SSE
  - Create `dashboard/src/hooks/useTasks.ts` — fetch from `/api/tasks`, auto-refresh via SSE
  - Create `dashboard/src/hooks/useMetrics.ts` — fetch from `/api/metrics`, auto-refresh via SSE
  - Create `dashboard/src/hooks/useResources.ts` — fetch from `/api/resources`, auto-refresh via SSE
  - Create `dashboard/src/hooks/useSSE.ts` — SSE connection manager with auto-reconnect
  - Wire hooks into page components: `pages/Dashboard.tsx` uses all hooks to populate:
    - AgentGrid with real agent data
    - TaskList with real task data
    - ActivityStream with SSE events
    - MetricsPanel with real metrics
    - ResourcePanel with real container stats
  - Add connection status indicator (connected/reconnecting/disconnected)
  - Add loading states and error boundaries
  - **TDD**: Write hook tests with MSW (Mock Service Worker) before integration

  **Must NOT do**:
  - Don't add write operations (POST/PUT/DELETE)
  - Don't add authentication headers

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex state management with SSE, multiple data sources, error handling
  - **Skills**: [`vercel-react-best-practices`]
    - `vercel-react-best-practices`: React hooks patterns, data fetching best practices

  **Parallelization**:
  - **Can Run In Parallel**: NO (integrates all Wave 2 outputs)
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 19, 20
  - **Blocked By**: Tasks 10, 11, 12, 13

  **References**:
  - Tasks 6-10 — API endpoint contracts (response shapes)
  - Tasks 11-13 — Component prop interfaces
  - MDN: EventSource API for SSE client

  **Acceptance Criteria**:
  - [ ] Hook tests pass with mocked API
  - [ ] Dashboard page renders with all panels populated
  - [ ] SSE reconnects after connection drop
  - [ ] Loading states shown during initial fetch

  **QA Scenarios:**
  ```
  Scenario: Dashboard loads with live data
    Tool: Playwright
    Preconditions: Full API running with real data
    Steps:
      1. Navigate to http://localhost:5173 (dev mode)
      2. Wait for loading spinners to disappear (timeout: 10s)
      3. Assert: at least one agent card visible (selector: [data-testid="agent-card"])
      4. Assert: task list section visible (selector: [data-testid="task-list"])
      5. Assert: metrics panel shows numbers (selector: [data-testid="metrics-panel"])
    Expected Result: All panels populated with data, no error states
    Failure Indicators: Persistent loading spinners, error boundaries triggered
    Evidence: .sisyphus/evidence/task-14-dashboard-live.png

  Scenario: Dashboard handles API unavailable
    Tool: Playwright
    Preconditions: API not running
    Steps:
      1. Navigate to dashboard
      2. Wait 5s
      3. Assert: connection status shows "disconnected" or error state
    Expected Result: Graceful error UI, not crash
    Evidence: .sisyphus/evidence/task-14-dashboard-error.png
  ```

  **Commit**: YES (group with Wave 3)
  - Message: `feat(dashboard): wire data hooks with SSE integration and error handling`
  - Files: `dashboard/src/hooks/`, `dashboard/src/pages/Dashboard.tsx`
  - Pre-commit: `cd dashboard && npm test -- --run`

---

- [ ] 15. Dashboard Startup Script + Supervisord Config

  **What to do**:
  - Create `manager/scripts/init/start-dashboard-api.sh`:
    - Wait for MinIO and manager-agent to be ready (reuse `waitForService` from `base.sh`)
    - Set environment variables: `MANAGER_WORKSPACE`, `DOCKER_SOCKET`, `PORT=8090`
    - Start Express API: `node /opt/hiclaw/dashboard-api/dist/index.js`
  - Create `manager/scripts/init/start-dashboard-web.sh`:
    - Generate Nginx config for Dashboard static files on port 8089
    - Serve from `/opt/hiclaw/dashboard/`
    - SPA fallback: `try_files $uri $uri/ /index.html`
    - Start Nginx instance (separate from Element Web's Nginx)
  - Add to `manager/supervisord.conf`:
    - `[program:dashboard-api]` priority=660 (after Element Web)
    - `[program:dashboard-web]` priority=665

  **Must NOT do**:
  - Don't modify Element Web's Nginx config
  - Don't change existing supervisord program priorities

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Shell script + config following established patterns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 14, 16, 17, 18)
  - **Blocks**: Task 16
  - **Blocked By**: Task 3 (API must exist to start)

  **References**:
  - `manager/scripts/init/start-element-web.sh` — **CRITICAL**: exact pattern to follow for Nginx config generation + SPA serving
  - `manager/supervisord.conf:94-101` — Element Web program block (priority 650, autorestart, log paths)
  - `manager/scripts/lib/base.sh` — `waitForService` helper function
  - `manager/scripts/init/start-manager-agent.sh` — environment variable setup pattern

  **Acceptance Criteria**:
  - [ ] `start-dashboard-api.sh` starts Express on port 8090
  - [ ] `start-dashboard-web.sh` starts Nginx on port 8089
  - [ ] supervisord programs have correct priority (660, 665)

  **QA Scenarios:**
  ```
  Scenario: Dashboard services start via supervisord
    Tool: Bash
    Preconditions: Manager container running
    Steps:
      1. supervisorctl status dashboard-api
      2. supervisorctl status dashboard-web
      3. curl -s http://localhost:8090/api/health | jq -r '.status'
      4. curl -s http://localhost:8089/ | grep -q 'Mission Control'
    Expected Result: Both RUNNING, health=ok, HTML contains title
    Evidence: .sisyphus/evidence/task-15-supervisord.txt
  ```

  **Commit**: YES (group with Wave 3)
  - Message: `feat(manager): add dashboard startup scripts and supervisord config`
  - Files: `manager/scripts/init/start-dashboard-*.sh`, `manager/supervisord.conf`
  - Pre-commit: N/A (shell scripts)

---

- [ ] 16. Dockerfile Build Stage + Nginx Config

  **What to do**:
  - Add build stages to `manager/Dockerfile`:
    - Stage: `dashboard-build` — `FROM node:22-alpine`, copy `dashboard/`, run `npm ci && npm run build`
    - Stage: `dashboard-api-build` — `FROM node:22-alpine`, copy `dashboard-api/`, run `npm ci && npm run build`
    - In final image: `COPY --from=dashboard-build /app/dist /opt/hiclaw/dashboard/`
    - In final image: `COPY --from=dashboard-api-build /app /opt/hiclaw/dashboard-api/`
  - Add port 8089 to EXPOSE list
  - Copy startup scripts
  - Verify `docker build` succeeds

  **Must NOT do**:
  - Don't change existing build stages
  - Don't modify Element Web stage

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Dockerfile modification following existing patterns
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with Tasks 14, 15, 17, 18)
  - **Blocks**: Task 17
  - **Blocked By**: Tasks 4 (frontend build), 15 (startup scripts)

  **References**:
  - `manager/Dockerfile:15-26` — existing multi-stage build pattern (tuwunel, minio, mc, element-web)
  - `manager/Dockerfile:45-46` — COPY --from pattern for final image
  - `manager/Dockerfile:77-81` — EXPOSE and VOLUME declarations

  **Acceptance Criteria**:
  - [ ] `docker build -t hiclaw/manager-agent:test -f manager/Dockerfile .` exits 0
  - [ ] Built image contains `/opt/hiclaw/dashboard/index.html`
  - [ ] Built image contains `/opt/hiclaw/dashboard-api/dist/index.js`

  **QA Scenarios:**
  ```
  Scenario: Docker build succeeds with dashboard
    Tool: Bash
    Steps:
      1. docker build -t hiclaw/manager-agent:test -f manager/Dockerfile .
      2. docker run --rm hiclaw/manager-agent:test ls /opt/hiclaw/dashboard/index.html
      3. docker run --rm hiclaw/manager-agent:test ls /opt/hiclaw/dashboard-api/dist/index.js
    Expected Result: Build exits 0, both files exist
    Evidence: .sisyphus/evidence/task-16-docker-build.txt
  ```

  **Commit**: YES (group with Wave 3)
  - Message: `feat(manager): add dashboard build stages to Dockerfile`
  - Files: `manager/Dockerfile`
  - Pre-commit: `docker build -t hiclaw/manager-agent:test -f manager/Dockerfile .`

---

- [ ] 17. Higress Route Configuration

  **What to do**:
  - Add Dashboard route to `manager/scripts/init/setup-higress.sh`:
    - Domain: `console-local.hiclaw.io` (or `${HICLAW_DASHBOARD_DOMAIN}`)
    - Backend: Dashboard web on port 8089 (static files) + Dashboard API on port 8090
    - Route pattern: `/api/*` → port 8090, `/*` → port 8089
  - Add to the NON-IDEMPOTENT marker-protected block (created once on first boot)
  - Make Dashboard domain configurable via `HICLAW_DASHBOARD_DOMAIN` env var

  **Must NOT do**:
  - Don't modify existing routes (Matrix, Element Web, AI Gateway, FS)
  - Don't add new Higress consumers (dashboard is unauthenticated in MVP)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Adding a route following exact existing pattern
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: Tasks 19, 20
  - **Blocked By**: Task 16

  **References**:
  - `manager/scripts/init/setup-higress.sh:1-72` — **CRITICAL**: Higress Console API helper (`higress_api` function), route creation pattern
  - `manager/scripts/init/setup-higress.sh:16-19` — domain variable pattern (`HICLAW_*_DOMAIN`)
  - `docs/architecture.md:58-68` — existing route configuration list

  **Acceptance Criteria**:
  - [ ] Route created for `console-local.hiclaw.io`
  - [ ] `/api/*` proxied to port 8090
  - [ ] `/*` proxied to port 8089
  - [ ] `curl http://console-local.hiclaw.io:18080` returns Dashboard HTML

  **QA Scenarios:**
  ```
  Scenario: Dashboard accessible via Higress route
    Tool: Bash (curl)
    Preconditions: Full Manager container running
    Steps:
      1. curl -s http://console-local.hiclaw.io:18080 | grep -q 'Mission Control'
      2. curl -s http://console-local.hiclaw.io:18080/api/health | jq -r '.status'
    Expected Result: HTML found, health=ok
    Evidence: .sisyphus/evidence/task-17-higress-route.txt
  ```

  **Commit**: YES (group with Wave 3)
  - Message: `feat(manager): add Higress route for Mission Control dashboard`
  - Files: `manager/scripts/init/setup-higress.sh`
  - Pre-commit: N/A

---

- [ ] 18. Changelog Entry

  **What to do**:
  - Add entry to `changelog/current.md`:
    - `feat(manager): add Mission Control Dashboard for agent team visualization`
  - Follow existing changelog format

  **Must NOT do**:
  - Don't modify past changelog files (v1.0.x.md)

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: Single file addition
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: None
  - **Blocked By**: Task 16 (need to know what changed)

  **References**:
  - `changelog/current.md` — existing format
  - `AGENTS.md` — changelog policy

  **Acceptance Criteria**:
  - [ ] `changelog/current.md` contains dashboard entry

  **QA Scenarios:**
  ```
  Scenario: Changelog updated
    Tool: Bash
    Steps:
      1. grep -q 'Mission Control' changelog/current.md
    Expected Result: Found
    Evidence: .sisyphus/evidence/task-18-changelog.txt
  ```

  **Commit**: YES (group with Wave 3)
  - Message: `docs(changelog): add Mission Control Dashboard entry`
  - Files: `changelog/current.md`

---

### Wave 4 — Testing + Verification

- [ ] 19. Integration Test — Full API + Docker

  **What to do**:
  - Create `dashboard-api/src/__tests__/integration/` directory
  - Write integration tests that run against the real API (not mocks):
    - Start API server, hit all endpoints, verify response shapes
    - Test with real `state.json` and `workers-registry.json` fixtures
    - Test Docker API integration (if socket available, otherwise verify fallback)
    - Test SSE endpoint: connect, receive heartbeat, disconnect
  - Create test fixtures: sample JSON files matching real data structures

  **Must NOT do**:
  - Don't modify production data files

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: Complex integration testing with real I/O
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 20)
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 14, 17

  **References**:
  - Tasks 6-10 — API endpoint response contracts
  - `tests/lib/agent-metrics.sh` — test fixture creation pattern

  **Acceptance Criteria**:
  - [ ] All integration tests pass
  - [ ] Tests cover all 6 API endpoints (/health, /agents, /tasks, /metrics, /resources, /events)

  **QA Scenarios:**
  ```
  Scenario: Full API integration test suite
    Tool: Bash
    Steps:
      1. cd dashboard-api && npm run test:integration
    Expected Result: All integration tests pass
    Evidence: .sisyphus/evidence/task-19-integration.txt
  ```

  **Commit**: YES (group with Wave 4)
  - Message: `test(dashboard-api): add integration tests for all API endpoints`
  - Files: `dashboard-api/src/__tests__/integration/`
  - Pre-commit: `cd dashboard-api && npm test -- --run`

---

- [ ] 20. E2E Test — Playwright Full Flow

  **What to do**:
  - Create `dashboard/e2e/` directory with Playwright config
  - Write E2E tests:
    - Dashboard page loads with title "HiClaw Mission Control"
    - Agent cards section visible
    - Task list section visible
    - Metrics panel shows numbers
    - Empty state: when no workers, shows empty state message
    - Connection indicator visible
  - Capture screenshots as evidence

  **Must NOT do**:
  - Don't test interactive controls (not in MVP)

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: E2E testing with Playwright
  - **Skills**: [`playwright`]
    - `playwright`: Browser automation for E2E tests

  **Parallelization**:
  - **Can Run In Parallel**: YES (with Task 19)
  - **Parallel Group**: Wave 4
  - **Blocks**: F1-F4
  - **Blocked By**: Tasks 14, 17

  **References**:
  - Task 14 — data-testid selectors used in components

  **Acceptance Criteria**:
  - [ ] Playwright tests pass
  - [ ] Screenshots captured for all key views

  **QA Scenarios:**
  ```
  Scenario: E2E dashboard flow
    Tool: Playwright
    Preconditions: Full stack running (API + frontend + Higress)
    Steps:
      1. Navigate to http://console-local.hiclaw.io:18080
      2. Wait for [data-testid="dashboard-loaded"] (timeout: 15s)
      3. Screenshot full page
      4. Assert: page title contains "Mission Control"
      5. Assert: [data-testid="agent-grid"] is visible
      6. Assert: [data-testid="task-list"] is visible
      7. Assert: [data-testid="metrics-panel"] is visible
    Expected Result: All assertions pass, screenshots captured
    Evidence: .sisyphus/evidence/task-20-e2e-dashboard.png
  ```

  **Commit**: YES (group with Wave 4)
  - Message: `test(dashboard): add Playwright E2E tests`
  - Files: `dashboard/e2e/`
  - Pre-commit: N/A (E2E runs separately)

---
## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Rejection → fix → re-run.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in `.sisyphus/evidence/`. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `npm test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, `console.log` in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` + `playwright` skill
  Start from clean state. Open Dashboard in browser via Playwright. Verify: Agent status cards visible, task list populated, activity stream updates, LLM metrics displayed, container resources shown (or graceful fallback). Test empty state (no workers). Capture screenshots.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

| Group | Message | Files |
|-------|---------|-------|
| Wave 1 | `feat(dashboard): scaffold project with types, API skeleton, React skeleton` | `dashboard/`, `dashboard-api/`, shared types |
| Wave 2 API | `feat(dashboard-api): implement agents, tasks, metrics, resources, events endpoints` | `dashboard-api/src/routes/`, tests |
| Wave 2 UI | `feat(dashboard): implement agent cards, task list, activity stream UI` | `dashboard/src/components/`, tests |
| Wave 3 | `feat(manager): integrate dashboard with container deployment` | `manager/Dockerfile`, `supervisord.conf`, `setup-higress.sh`, startup script |
| Wave 4 | `test(dashboard): add integration and E2E tests` | test files |

---

## Success Criteria

### Verification Commands
```bash
# Build succeeds
cd dashboard && npm run build         # Expected: dist/ directory with index.html
cd dashboard-api && npm run build     # Expected: dist/ directory

# Tests pass
cd dashboard-api && npm test          # Expected: all tests pass
cd dashboard && npm test              # Expected: all tests pass

# API returns valid JSON
curl -s http://localhost:8090/api/agents | jq .     # Expected: JSON with workers array
curl -s http://localhost:8090/api/tasks | jq .      # Expected: JSON with active_tasks
curl -s http://localhost:8090/api/metrics | jq .    # Expected: JSON with llm_calls
curl -s http://localhost:8090/api/resources | jq .  # Expected: JSON with containers

# SSE stream connects
curl -sN http://localhost:8090/api/events | timeout 5 head -3  # Expected: event: lines

# Dashboard HTML loads via Higress
curl -s http://console-local.hiclaw.io:18080 | grep -q "Mission Control"

# Docker build succeeds
docker build -t hiclaw/manager-agent:test .  # Expected: exit 0
```

### Final Checklist
- [ ] All "Must Have" present
- [ ] All "Must NOT Have" absent
- [ ] All tests pass
- [ ] Docker build succeeds
- [ ] Dashboard accessible via browser
- [ ] Empty state handled gracefully
- [ ] Docker API unavailable handled gracefully
