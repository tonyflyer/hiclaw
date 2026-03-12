# HiClaw Codebase Guide for AI Agents

This file provides essential information for agentic coding tools operating in this repository.

## Build / Test Commands

```bash
# Build all images (Manager + Worker)
make build

# Build specific image
make build-manager    # Manager container
make build-worker     # Worker container

# Run integration tests (requires HICLAW_LLM_API_KEY)
HICLAW_LLM_API_KEY=sk-xxx make test

# Run tests without rebuilding images
make test SKIP_BUILD=1

# Run a single test case
make test TEST_FILTER="01"    # Run test-01 only
make test TEST_FILTER="02 03" # Run test-02 and test-03

# Quick smoke test (test-01 only)
make test-quick

# Run tests against existing Manager installation
make test SKIP_INSTALL=1

# Clean local images
make clean

# See all available targets
make help
```

## Rebuild and Redeploy

**CRITICAL**: When rebuilding images and redeploying the Manager container, always preserve the existing `.env` file to retain configuration:

```bash
# 1. Backup .env before rebuild
cp ~/hiclaw-manager/.env ~/hiclaw-manager/.env.backup

# 2. Rebuild images
make build

# 3. Stop and remove old container
docker stop hiclaw-manager && docker rm hiclaw-manager

# 4. Restore .env (if reinstall script overwrites it)
cp ~/hiclaw-manager/.env.backup ~/hiclaw-manager/.env

# 5. Redeploy - either:
# Option A: Re-run installer (will use existing .env)
bash <(curl -sSL https://higress.ai/hiclaw/install.sh) manager

# Option B: Manual docker run with env file
docker run -d --name hiclaw-manager \
  --env-file ~/hiclaw-manager/.env \
  ...other args...
```

The `.env` file contains all sensitive configuration (API keys, passwords, tokens). Losing it requires re-configuring the entire system.

## Code Style Guidelines

### Shell Scripts (Bash)

- **Header**: All shell scripts start with `#!/bin/bash`
- **Error handling**: Use `set -e` at the top of scripts that should exit on error
  - Exception: Test scripts (in `tests/`) do NOT use `set -e` because they use assertions for results
- **Variable quoting**: Always quote variables: `"${var}"`, not `$var`
- **Local variables**: Use `local` for function-scoped variables
- **Comments**: Use `#` for comments; document function purpose with a brief header
- **Functions**: Define functions before calling them; use lowercase names with underscores
- **Conditionals**: Prefer `[[ ]]` over `[ ]` for string comparisons
- **Command substitution**: Use `$(...)` instead of backticks
- **Shellcheck**: Use `# shellcheck disable=SCXXXX` directives when needed (see existing patterns)

### Example Function Pattern

```bash
#!/bin/bash
set -e

my_function() {
    local name="$1"
    local timeout="${2:-30}"
    
    if [[ "${name}" == "test" ]]; then
        echo "Running test mode"
    fi
}
```

### To modify the Worker container (OpenClaw)
- [worker/Dockerfile](worker/Dockerfile) -- build definition (Node.js 22 from build stage)
- [worker/scripts/worker-entrypoint.sh](worker/scripts/worker-entrypoint.sh) -- startup logic

### To modify the Worker container (CoPaw)
- [copaw/Dockerfile](copaw/Dockerfile) -- build definition (Python 3.11)
- [copaw/scripts/copaw-worker-entrypoint.sh](copaw/scripts/copaw-worker-entrypoint.sh) -- startup logic
- [copaw/src/copaw_worker/](copaw/src/copaw_worker/) -- CoPaw worker Python package

### To manage Worker containers via socket
- [manager/scripts/lib/container-api.sh](manager/scripts/lib/container-api.sh) -- Docker/Podman REST API helpers for direct Worker creation

### Directory Conventions

| Directory | Purpose | Key Files |
|-----------|---------|----------|
| `manager/` | Manager Agent container | `Dockerfile`, `supervisord.conf`, `scripts/init/` |
| `worker/` | Worker Agent container | `Dockerfile`, `scripts/worker-entrypoint.sh` |
| `openclaw-base/` | Base image for OpenClaw runtime | `Dockerfile` |
| `tests/` | Integration test suite | `run-all-tests.sh`, `test-*.sh`, `lib/` |
| `install/` | Installation scripts | `hiclaw-install.sh` |
| `scripts/` | Utility scripts | `replay-task.sh` |
| `changelog/` | Version history | `current.md` (track image-affecting changes) |

### Test Framework Conventions

Tests are in `tests/` and use helper libraries in `tests/lib/`:

- `test-helpers.sh`: Assertions (`log_pass`, `log_fail`, `assert_eq`, `assert_contains`), lifecycle (`test_setup`, `test_teardown`)
- `matrix-client.sh`: Matrix API wrapper
- `higress-client.sh`: Higress Console API wrapper
- `minio-client.sh`: MinIO verification helpers

Each test file:
1. Sources helper libraries
2. Calls `test_setup "test-name"`
3. Uses assertions (not exit codes) for pass/fail
4. Calls `test_teardown "test-name"` and `test_summary`

### Dockerfile Conventions

- Multi-stage builds for image size optimization
- Use `ARG` for build-time variables
- Combine related `RUN` commands to reduce layers
- Label images with version and metadata

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| AI Gateway | Higress (all-in-one) | LLM proxy, MCP Server hosting, consumer auth, route management |
| Matrix Server | Tuwunel (conduwuit fork) | IM communication between Agents and Human |
| Matrix Client | Element Web | Browser-based IM interface |
| File System | MinIO + mc mirror | Centralized HTTP file storage with local sync |
| Agent Framework | OpenClaw (fork) | Agent runtime with Matrix plugin, skills, heartbeat |
| Agent Framework | CoPaw (Python) | Alternative Python-based agent runtime for Workers |
| MCP CLI | mcporter | Worker calls MCP Server tools via CLI |

## Changelog Policy

Any change that affects the content of a built image — i.e. modifications under `manager/`, `worker/`, `copaw/`, or `openclaw-base/` — **must** be recorded in [`changelog/current.md`](changelog/current.md) before committing.

Format:
```
- feat(manager): description of change ([commit_hash](link))
- fix(worker): description of fix ([commit_hash](link))
```

## Architecture Overview

HiClaw is an Agent Teams system using Matrix protocol for multi-Agent collaboration:

```
┌─────────────────────────────────────────────┐
│         hiclaw-manager-agent                │
│  Higress │ Tuwunel │ MinIO │ Element Web    │
│  Manager Agent (OpenClaw)                   │
└──────────────────┬──────────────────────────┘
                   │ Matrix + HTTP Files
┌──────────────────┴──────┐  ┌────────────────┐
│  hiclaw-worker-agent    │  │  hiclaw-worker │
│  Worker Alice (OpenClaw)│  │  Worker Bob    │
└─────────────────────────┘  └────────────────┘
```

| Component | Technology | Purpose |
|-----------|-----------|----------|
| AI Gateway | Higress (all-in-one) | LLM proxy, MCP Server, auth |
| Matrix Server | Tuwunel | Agent + Human communication |
| Matrix Client | Element Web | Browser IM interface |
| File System | MinIO + mc mirror | Centralized storage |
| Agent Framework | OpenClaw | Runtime with skills, heartbeat |
| MCP CLI | mcporter | Worker MCP tool calls |

## Key Entry Points

### To understand the system
- `docs/architecture.md` - System overview
- `design/design.md` - Full product design (Chinese)
- `design/poc-design.md` - Implementation specs

### To modify Agent behavior
- `manager/agent/SOUL.md` - Manager personality
- `manager/agent/HEARTBEAT.md` - Periodic checks
- `manager/agent/skills/` - Manager skills (SKILL.md files)
- `manager/agent/worker-skills/` - Skills pushed to Workers

### To modify container initialization
- `manager/scripts/init/` - Startup scripts
- `manager/scripts/lib/base.sh` - Shared utilities
- `manager/scripts/lib/container-api.sh` - Docker/Podman API helpers

## Environment Variables

Key `HICLAW_*` environment variables are defined in:
- `manager/scripts/init/start-manager-agent.sh` - Full list

## CI/CD

GitHub Actions workflows in `.github/workflows/`:
- `build.yml` - Build images on PR
- `build-base.yml` - Build OpenClaw base image
- `test-integration.yml` - Run integration tests
- `release.yml` - Release and push images

## Key Design Patterns

1. **Matrix Rooms for all communication**: Human + Manager + Workers in same room
2. **Stateless Workers**: All state in MinIO; Workers can be destroyed/recreated
3. **Unified credentials**: Workers use consumer token; real keys stay in Higress
4. **Skills as documentation**: Each SKILL.md is self-contained API/tool reference

## Verified Technical Details

- Tuwunel uses `CONDUWUIT_` env prefix (not `TUWUNEL_`)
- Higress Console uses Session Cookie auth (not Basic Auth)
- MCP Server created via `PUT` (not `POST`)
- Auth plugin takes ~40s to activate after first configuration
- OpenClaw Skills auto-load from `workspace/skills/<name>/SKILL.md`

## Troubleshooting / Known Issues

### Docker Desktop DNS Resolution Issue (Mac)

**Problem**: Inside the Manager container, `docker.for.mac.localhost` resolves to `127.0.0.1` (loopback) instead of the host's actual IP (`192.168.65.254`). This causes the Higress AI Gateway to fail connecting to local LLM endpoints (e.g., LM Studio on port 11435).

**Symptom**: `HTTP 503: upstream connect error or disconnect/reset before headers`

**Root Cause**: Docker Desktop's DNS resolution for `docker.for.mac.localhost` works from the Mac host but fails inside containers due to how Envoy (in Higress) resolves hostnames.

**Solution**: The `setup-higress.sh` script has been patched to:
1. Resolve `docker.for.mac.localhost` to its actual IPv4 address using Python
2. Use `static` service type instead of `dns` type
3. Include `/v1` suffix in `openaiCustomUrl`

Patched logic in `manager/scripts/init/setup-higress.sh` (lines 165-191):
```bash
# Resolve hostname to IPv4 for Docker Desktop compatibility
OC_RESOLVED_IP=$(python3 -c "import socket; addrs=socket.getaddrinfo('${OC_DOMAIN}', None, socket.AF_INET); print(addrs[0][4][0]) if addrs else print('${OC_DOMAIN}')" 2>/dev/null || echo "${OC_DOMAIN}")
if [ "${OC_RESOLVED_IP}" != "${OC_DOMAIN}" ] && echo "${OC_RESOLVED_IP}" | grep -qE "^[0-9]+\\.[0-9]+\\.[0-9]+\\.[0-9]+$"; then
    OC_SVC_TYPE="static"
    OC_SVC_DOMAIN="${OC_RESOLVED_IP}:${OC_PORT}"
    OC_SVC_NAME="openai-compat.static"
else
    OC_SVC_TYPE="dns"
    ...
fi
```

### Wasm Plugin OCI Format Compatibility

**Problem**: Higress Wasm plugins (`ai-proxy:2.0.0`, `ai-statistics:2.0.0`) use a new 4-layer OCI format, but the Wasm loader (Istio 1.19) only supports 2-layer format.

**Solution**: Manually download the `.wasm` binary and inject it into the container:
```bash
# Download wasm binary
crane pull ghcr.io/higress/plugins/ai-proxy:2.0.0 /tmp/ai-proxy.tar
tar -xf /tmp/ai-proxy.tar -C /tmp
# The actual .wasm is in the plugin.tar.gz layer
crane blob <image>@<digest> > ai-proxy.wasm

# Copy to container and update WasmPlugin YAML
docker cp ai-proxy.wasm hiclaw-manager:/opt/hiclaw/wasm-plugins/
# Update YAML: url: "file:///opt/hiclaw/wasm-plugins/ai-proxy.wasm"
```

### HTTP Proxy Interference

**Problem**: If the host machine has an HTTP proxy configured (e.g., Parallels VM), container traffic to `aigw-local.hiclaw.io:8080` may be routed through the proxy, causing "Connection error."

**Solution**: Extend `no_proxy` in `manager/scripts/init/start-manager-agent.sh`:
```bash
export no_proxy="${no_proxy},hiclaw.io,localhost,127.0.0.1"
export NO_PROXY="${NO_PROXY},hiclaw.io,localhost,127.0.0.1"
```

### Matrix API Endpoint Format

**Problem**: Tuwunel (Conduwuit) Matrix server requires specific API format.

**Verified working format**:
- Use `/r0` API path: `/_matrix/client/r0/rooms/<room_id>/send/m.room.message/m.<txn_id>`
- Use `PUT` method (not POST)
- Host port mapping: Matrix on `18080`, not internal `6167`

### Local LM Studio Integration

For local LLM testing with LM Studio:
- URL format: `http://192.168.65.254:11435` (use actual IP, not `docker.for.mac.localhost`)
- Model name: `qwen2.5-7b-instruct-1m` (recommended for tool calling support)
- **Note**: `qwen/qwen3.5-35b-a3b` does NOT support proper tool calling via LM Studio. Use `qwen2.5-7b-instruct-1m` for reliable exec tool functionality.
- Must include `/v1` suffix in `openaiCustomUrl`

### OpenClaw Exec Tool Not Executing Commands

**Problem**: Manager Agent outputs command text in chat instead of actually executing commands. The `exec` tool is listed in OpenClaw's tool set but commands silently fail to execute.

**Symptom**: Manager responds with "Here's the command to run: `bash create-worker.sh ...`" instead of executing it via the `exec` tool.

**Root Cause** (three issues):
1. `tools.elevated.allowFrom.matrix` not configured — Matrix channel cannot trigger elevated exec. Check with `openclaw sandbox explain` which shows `allowedByConfig: false`.
2. `tools.exec.host` defaults to `sandbox` but sandbox mode is `off` — this combination "fails closed" (silently refuses execution). Must set `host: "gateway"`.
3. `exec-approvals.json` does not exist — without approval policies, all exec requests are denied by default.

**Solution**: Three configuration changes in `manager/configs/manager-openclaw.json.tmpl`:

```json
{
  "tools": {
    "elevated": {
      "enabled": true,
      "allowFrom": {
        "matrix": ["@admin:${MATRIX_SERVER_NAME}"]
      }
    },
    "exec": {
      "host": "gateway",
      "security": "full"
    }
  }
}
```

And create `exec-approvals.json` in the OpenClaw config directory:
```json
{
  "security": "full",
  "ask": "off",
  "autoAllowSkills": true
}
```

The `start-manager-agent.sh` script auto-creates this file at startup.

**Verification**: Send a message via Matrix asking the Manager to run `ls ~/`. Check OpenClaw logs for `tool start: tool=exec` → `tool end` entries.

### LLM Model Tool Calling Compatibility

**Problem**: Some local LLM models do not properly support function/tool calling via the OpenAI-compatible API, causing OpenClaw's `exec` tool to never be invoked.

**Symptom**: Manager responds with text descriptions of what commands to run, but never generates `tool_calls` in the API response. OpenClaw logs show no `tool start` entries.

**Root Cause**: Not all models support the `tools` parameter and `tool_choice` in the OpenAI chat completions API. MoE models like `qwen/qwen3.5-35b-a3b` via LM Studio may not generate proper `tool_calls` JSON.

**Verified working model**: `qwen2.5-7b-instruct-1m` — correctly generates `tool_calls` with `tool_choice: "auto"`.

**Verified non-working**: `qwen/qwen3.5-35b-a3b` — returns plain text when `tool_choice: "auto"`, hallucinated tool names when `tool_choice: "required"`.

**Note**: The `start-manager-agent.sh` script includes reasoning model detection logic. Non-reasoning models (like qwen2.5-*) have `thinking` disabled via `--reasoning-effort off` jq patch.

### Updating OpenClaw Without Rebuilding the Image

**Problem**: OpenClaw lives at `/opt/openclaw` inside the container (from the image). Rebuilding the image to update it takes time and requires a full redeploy.

**Solution**: A persistent update mechanism that stores the updated OpenClaw in the host-mounted workspace (`~/hiclaw-manager/openclaw-runtime/`), which survives container restarts.

**How it works**:
1. `update-openclaw.sh` clones the desired OpenClaw tag into `/root/manager-workspace/openclaw-runtime/`
2. On next startup, `start-manager-agent.sh` detects the workspace version and uses it instead of the image version
3. The workspace directory is host-mounted (`~/hiclaw-manager` → `/root/manager-workspace`), so updates persist across container restarts and even container recreation

**Usage**:
```bash
# Update to latest OpenClaw (auto-detects latest tag)
docker exec hiclaw-manager bash /root/manager-workspace/update-openclaw.sh

# Update to specific version and restart agent
docker exec hiclaw-manager bash /root/manager-workspace/update-openclaw.sh --tag v2026.3.8 --restart

# Check current version
docker exec hiclaw-manager openclaw --version
```

**Key files**:
- `manager/scripts/update-openclaw.sh` — update script (copied to workspace at startup)
- `manager/scripts/init/start-manager-agent.sh` — detects and uses workspace OpenClaw if present
- `manager/Dockerfile` — PATH includes workspace bin dir with priority over image bin dir

**Workspace path**: `/root/manager-workspace/openclaw-runtime/` (persisted via `~/hiclaw-manager` host mount)


### Auto-Created Admin↔Manager DM Room

**Behavior**: On first boot, `start-manager-agent.sh` automatically creates a Matrix DM room between the admin user and the Manager Agent. This means users can open Element Web immediately after install and start chatting with the Manager — no manual room creation needed.

**How it works**:
1. Admin logs in via Matrix API to get a token
2. Admin creates a DM room (`is_direct: true`, `preset: trusted_private_chat`) and invites `@manager:<domain>`
3. Manager joins the room using its own token
4. Room ID is written to `/data/manager-dm-room.json` (marker file)
5. On subsequent restarts, the marker file is detected and the block is skipped (idempotent)

**Marker file**: `/data/manager-dm-room.json`
```json
{"room_id": "!abc123:matrix-local.hiclaw.io:18080", "created_at": "2026-03-12T00:00:00Z"}
```

**If DM room creation fails** (e.g., admin account not yet registered): the script logs a WARNING and continues — this is non-fatal. The user can create the DM room manually in Element Web.
