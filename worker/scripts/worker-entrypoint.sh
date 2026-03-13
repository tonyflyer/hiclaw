#!/bin/bash
# worker-entrypoint.sh - Worker Agent startup
# Pulls config from centralized file system, starts file sync, launches OpenClaw.
#
# HOME is set to the Worker workspace so all agent-generated files are synced to MinIO:
#   ~/ = /root/hiclaw-fs/agents/<WORKER_NAME>/  (SOUL.md, openclaw.json, memory/)
#   /root/hiclaw-fs/shared/                     = Shared tasks, knowledge, collaboration data

set -e

# Clear proxy environment variables that Docker Desktop may inject (e.g., Parallels proxy)
# These interfere with apt-get, curl, and other network operations inside the container
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy no_proxy NO_PROXY 2>/dev/null || true
export HTTP_PROXY= HTTPS_PROXY= http_proxy= https_proxy=


WORKER_NAME="${HICLAW_WORKER_NAME:?HICLAW_WORKER_NAME is required}"
FS_ENDPOINT="${HICLAW_FS_ENDPOINT:?HICLAW_FS_ENDPOINT is required}"
FS_ACCESS_KEY="${HICLAW_FS_ACCESS_KEY:?HICLAW_FS_ACCESS_KEY is required}"
FS_SECRET_KEY="${HICLAW_FS_SECRET_KEY:?HICLAW_FS_SECRET_KEY is required}"

log() {
    echo "[hiclaw-worker $(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# ============================================================
# Step 0: Set timezone from TZ env var
# ============================================================
if [ -n "${TZ}" ] && [ -f "/usr/share/zoneinfo/${TZ}" ]; then
    ln -sf "/usr/share/zoneinfo/${TZ}" /etc/localtime
    echo "${TZ}" > /etc/timezone
    log "Timezone set to ${TZ}"
fi

# Use absolute path because HOME is set to the workspace directory via docker run
HICLAW_ROOT="/root/hiclaw-fs"
WORKSPACE="${HICLAW_ROOT}/agents/${WORKER_NAME}"

# ============================================================
# Step 1: Configure mc alias for centralized file system
# ============================================================
log "Configuring mc alias..."
mc alias set hiclaw "${FS_ENDPOINT}" "${FS_ACCESS_KEY}" "${FS_SECRET_KEY}"

# ============================================================
# Step 2: Pull Worker config and shared data from centralized storage
# ============================================================
mkdir -p "${WORKSPACE}" "${HICLAW_ROOT}/shared"

log "Pulling Worker config from centralized storage..."
mc mirror "hiclaw/hiclaw-storage/agents/${WORKER_NAME}/" "${WORKSPACE}/" --overwrite
mc mirror "hiclaw/hiclaw-storage/shared/" "${HICLAW_ROOT}/shared/" --overwrite 2>/dev/null || true

# Verify essential files exist, retry if sync is still in progress
RETRY=0
while [ ! -f "${WORKSPACE}/openclaw.json" ] || [ ! -f "${WORKSPACE}/SOUL.md" ] \
      || [ ! -f "${WORKSPACE}/AGENTS.md" ]; do
    RETRY=$((RETRY + 1))
    if [ "${RETRY}" -gt 6 ]; then
        log "ERROR: openclaw.json, SOUL.md or AGENTS.md not found after retries. Manager may not have created this Worker's config yet."
        exit 1
    fi
    log "Waiting for config files to appear in MinIO (attempt ${RETRY}/6)..."
    sleep 5
    mc mirror "hiclaw/hiclaw-storage/agents/${WORKER_NAME}/" "${WORKSPACE}/" --overwrite 2>/dev/null || true
done

# HOME is already set to WORKSPACE via docker run -e HOME=...
# Symlink to default OpenClaw config path so CLI commands find the config
mkdir -p "${HOME}/.openclaw"
ln -sf "${WORKSPACE}/openclaw.json" "${HOME}/.openclaw/openclaw.json"

# Create symlink for skills CLI: ~/.agents/skills -> ~/skills
# This makes `skills add -g` install skills directly into ~/skills/ (same as file-sync)
# Skills in ~/skills/ will be synced to MinIO and persist across container restarts
mkdir -p "${HOME}/skills"
mkdir -p "${HOME}/.agents"
ln -sf "${HOME}/skills" "${HOME}/.agents/skills"

# Guard: remove circular skills/skills symlink if it points to itself (ELOOP prevention)
# This can happen when mc mirror creates a symlink that points back to the parent skills/ directory,
# causing OpenClaw's skills watcher to fail with "too many symbolic links" (ELOOP)
if [ -L "${HOME}/skills/skills" ]; then
    LINK_TARGET=$(readlink "${HOME}/skills/skills" 2>/dev/null || true)
    if [ "${LINK_TARGET}" = "${HOME}/skills" ] || [ "${LINK_TARGET}" = "." ]; then
        rm -f "${HOME}/skills/skills"
        log "Removed circular symlink: skills/skills -> ${LINK_TARGET}"
    fi
fi
log "Worker config pulled successfully"

# Restore skills from MinIO if skills directory is empty but skills-lock.json exists
if [ -f "${WORKSPACE}/skills-lock.json" ] && [ -z "$(ls -A ${WORKSPACE}/skills 2>/dev/null | grep -v file-sync)" ]; then
    log "Found skills-lock.json but skills directory is empty, restoring skills..."
    fi

# Create exec-approvals.json for container mode (no systemd, exec needs gateway mode)
# This allows exec tool to work in Docker containers without systemctl
mkdir -p "${HOME}/.openclaw"
if [ ! -f "${HOME}/.openclaw/exec-approvals.json" ]; then
    cat > "${HOME}/.openclaw/exec-approvals.json" << 'EOF'
{
  "security": "full",
  "ask": "off",
  "autoAllowSkills": true
}
EOF
    log "Created exec-approvals.json for container mode"
fi

log "HOME set to ${HOME} (workspace files will be synced to MinIO)"
# ============================================================
# Step 3: Start file sync
# ============================================================

# Local -> Remote: change-triggered sync (avoids mc mirror --watch TOCTOU crash bug)
# Note: mc mirror --watch has a bug where it crashes when source files are deleted
# during atomic operations (e.g., npm install, skills add). This approach:
# - Uses find to detect recent file changes (lightweight, local filesystem only)
# - Only runs mc mirror when changes are detected (avoids unnecessary network IO)
# - mc mirror itself only transfers changed files (incremental)
(
    while true; do
        # Check for files modified in the last 10 seconds in workspace
        CHANGED=$(find "${WORKSPACE}/" -type f -newermt "10 seconds ago" 2>/dev/null | head -1)
        if [ -n "${CHANGED}" ]; then
            if ! mc mirror "${WORKSPACE}/" "hiclaw/hiclaw-storage/agents/${WORKER_NAME}/" --overwrite \
                --exclude "openclaw.json" --exclude "AGENTS.md" --exclude "SOUL.md" \
                --exclude "mcporter-servers.json" --exclude ".agents/**" \
                --exclude ".openclaw/**" --exclude ".cache/**" --exclude ".npm/**" \
                --exclude ".local/**" --exclude ".mc/**" 2>&1; then
                log "WARNING: Local->Remote workspace sync failed"
            fi
        fi

        # Check for files modified in the last 10 seconds in shared directory
        SHARED_CHANGED=$(find "${HICLAW_ROOT}/shared/" -type f -newermt "10 seconds ago" 2>/dev/null | head -1)
        if [ -n "${SHARED_CHANGED}" ]; then
            if ! mc mirror "${HICLAW_ROOT}/shared/" "hiclaw/hiclaw-storage/shared/" --overwrite 2>&1; then
                log "WARNING: Local->Remote shared sync failed"
            fi
        fi

        sleep 5
    done
) &
log "Local->Remote change-triggered sync started (PID: $!)"

# Remote -> Local: periodic pull (configs from Manager + shared data)
# On-demand pull via file-sync skill when Manager notifies
(
    while true; do
        sleep 300
        mc mirror "hiclaw/hiclaw-storage/agents/${WORKER_NAME}/" "${WORKSPACE}/" --overwrite --newer-than "5m" 2>/dev/null || true
        mc mirror "hiclaw/hiclaw-storage/shared/" "${HICLAW_ROOT}/shared/" --overwrite --newer-than "5m" 2>/dev/null || true
    done
) &
log "Remote->Local periodic sync started (every 5m, PID: $!)"

# ============================================================
# Step 4: Configure mcporter (MCP tool CLI)
# ============================================================
if [ -f "${WORKSPACE}/mcporter-servers.json" ]; then
    log "Configuring mcporter with MCP Server endpoints..."
    export MCPORTER_CONFIG="${WORKSPACE}/mcporter-servers.json"
fi

# ============================================================
# Step 4b: Install Playwright Chromium if Browser tool is enabled
# ============================================================
if [ "${ENABLE_BROWSER}" = "true" ]; then
    PLAYWRIGHT_BIN="/opt/openclaw/node_modules/.bin/playwright-core"
    CHROMIUM_MARKER="${HOME}/.cache/ms-playwright/.chromium-installed"

    # Check if Chromium binary actually exists (marker may be synced from MinIO without the binary)
    CHROMIUM_BIN_EXISTING=$(find "${HOME}/.cache/ms-playwright/" -name "chrome" -path "*/chrome-linux/*" 2>/dev/null | head -1)
    if [ -f "${CHROMIUM_MARKER}" ] && [ -z "${CHROMIUM_BIN_EXISTING}" ]; then
        log "Chromium marker exists but binary not found — removing stale marker for reinstall"
        rm -f "${CHROMIUM_MARKER}"
    fi

    if [ ! -f "${CHROMIUM_MARKER}" ] && [ -f "${PLAYWRIGHT_BIN}" ]; then
        log "Browser tool enabled — installing Playwright Chromium (first-time, may take a few minutes)..."
        mkdir -p "$(dirname "${CHROMIUM_MARKER}")"
        # Use a temp file to capture exit code (pipe to tail swallows it)
        INSTALL_LOG=$(mktemp)
        if "${PLAYWRIGHT_BIN}" install --with-deps chromium > "${INSTALL_LOG}" 2>&1; then
            touch "${CHROMIUM_MARKER}"
            tail -5 "${INSTALL_LOG}"
            log "Playwright Chromium installed successfully"
        else
            tail -10 "${INSTALL_LOG}"
            log "WARNING: Playwright Chromium install failed — browser tool may not work"
        fi
        rm -f "${INSTALL_LOG}"
    else
        if [ -f "${CHROMIUM_MARKER}" ]; then
            log "Browser tool enabled — Playwright Chromium already installed"
        fi
    fi

    # Create /usr/bin/chromium symlink so OpenClaw can find the browser
    # OpenClaw searches a fixed list of paths (/usr/bin/chromium, /usr/bin/google-chrome, etc.)
    # Playwright installs Chromium to ~/.cache/ms-playwright/ which is not in that list
    CHROMIUM_BIN=$(find "${HOME}/.cache/ms-playwright/" -name "chrome" -path "*/chrome-linux/*" 2>/dev/null | head -1)
    if [ -n "${CHROMIUM_BIN}" ] && [ ! -e "/usr/bin/chromium" ]; then
        ln -sf "${CHROMIUM_BIN}" /usr/bin/chromium
        log "Created /usr/bin/chromium symlink -> ${CHROMIUM_BIN}"
    elif [ -e "/usr/bin/chromium" ]; then
        log "Browser tool: /usr/bin/chromium already exists"
    elif [ -z "${CHROMIUM_BIN}" ]; then
        log "WARNING: Chromium binary not found — /usr/bin/chromium symlink not created"
    fi
fi

# ============================================================
# Step 5: Launch OpenClaw Worker Agent
# ============================================================
log "Starting Worker Agent: ${WORKER_NAME}"
export OPENCLAW_CONFIG_PATH="${WORKSPACE}/openclaw.json"
cd "${WORKSPACE}"
exec openclaw gateway run --verbose --force
