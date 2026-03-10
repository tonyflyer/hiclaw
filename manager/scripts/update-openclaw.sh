#!/bin/bash
# update-openclaw.sh - Update OpenClaw runtime in workspace (persistent update)
# Usage: ./update-openclaw.sh [--tag <version>] [--restart]
#
# This script downloads and builds a new OpenClaw version to the persistent
# workspace directory, making updates survive container restarts.

set -e

# Ensure pnpm is on PATH (might not be in container default PATH)
export PATH="/usr/local/bin:${PATH}"

# Configuration
WORKSPACE_OC="/root/manager-workspace/openclaw-runtime"
TMP_DIR="/root/manager-workspace/openclaw-update-tmp"
IMAGE_OC="/opt/openclaw"
LOG_PREFIX="[update-openclaw]"

# Parse arguments
TARGET_TAG=""
RESTART_AFTER=false

while [[ $# -gt 0 ]]; do
    case "$1" in
        --tag)
            TARGET_TAG="$2"
            shift 2
            ;;
        --restart)
            RESTART_AFTER=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--tag <version>] [--restart]"
            echo ""
            echo "Options:"
            echo "  --tag <version>  Install specific version (default: latest stable)"
            echo "  --restart        Restart manager-agent after update"
            echo ""
            echo "Examples:"
            echo "  $0                           # Install latest version"
            echo "  $0 --tag v2026.3.8          # Install specific version"
            echo "  $0 --tag v2026.3.8 --restart"
            exit 0
            ;;
        *)
            echo "${LOG_PREFIX} Unknown option: $1"
            exit 1
            ;;
    esac
done

# Cleanup function
cleanup() {
    if [[ -d "${TMP_DIR}" ]]; then
        echo "${LOG_PREFIX} Cleaning up temporary directory..."
        rm -rf "${TMP_DIR}"
    fi
}

# Set up trap for cleanup on error
trap cleanup ERR

# Determine npm registry
NPM_REGISTRY="https://registry.npmjs.org/"
if [[ -f "/opt/openclaw-base-npmrc" ]]; then
    NPM_REGISTRY=$(cat /opt/openclaw-base-npmrc 2>/dev/null | grep -E "^registry=" | cut -d= -f2 || echo "https://registry.npmjs.org/")
    [[ -z "${NPM_REGISTRY}" ]] && NPM_REGISTRY="https://registry.npmjs.org/"
fi

# Show current versions
echo "${LOG_PREFIX} Checking current OpenClaw versions..."

# Image version
if [[ -f "${IMAGE_OC}/package.json" ]]; then
    IMAGE_VERSION=$(node -e "console.log(require('${IMAGE_OC}/package.json').version)" 2>/dev/null || echo "unknown")
else
    IMAGE_VERSION="not-installed"
fi
echo "  Image version:   v${IMAGE_VERSION}"

# Workspace version
if [[ -f "${WORKSPACE_OC}/package.json" ]]; then
    WORKSPACE_VERSION=$(node -e "console.log(require('${WORKSPACE_OC}/package.json').version)" 2>/dev/null || echo "unknown")
    echo "  Workspace version: v${WORKSPACE_VERSION} (persists across restarts)"
else
    WORKSPACE_VERSION="none"
    echo "  Workspace version: none (not installed)"
fi

# Determine version to install
if [[ -z "${TARGET_TAG}" ]]; then
    echo "${LOG_PREFIX} Fetching latest stable version from GitHub..."
    TARGET_TAG=$(curl -sf "https://api.github.com/repos/openclaw/openclaw/releases/latest" | jq -r '.tag_name' 2>/dev/null || echo "")
    if [[ -z "${TARGET_TAG}" ]]; then
        echo "${LOG_PREFIX} ERROR: Could not determine latest version. Use --tag to specify manually."
        exit 1
    fi
    echo "  Latest version: ${TARGET_TAG}"
else
    echo "${LOG_PREFIX} Using specified version: ${TARGET_TAG}"
fi

# Check if already at target version
if [[ -f "${WORKSPACE_OC}/package.json" ]]; then
    CURRENT_WS_VERSION=$(node -e "console.log(require('${WORKSPACE_OC}/package.json').version)" 2>/dev/null || echo "")
    if [[ "${CURRENT_WS_VERSION}" == "${TARGET_TAG}" ]] || [[ "${CURRENT_WS_VERSION}" == "${TARGET_TAG#v}" ]]; then
        echo "${LOG_PREFIX} Workspace already at v${CURRENT_WS_VERSION}, nothing to do."
        trap - ERR
        exit 0
    fi
fi

# Create workspace directory if needed
mkdir -p /root/manager-workspace

# Clone OpenClaw to temporary directory
echo "${LOG_PREFIX} Cloning OpenClaw ${TARGET_TAG}..."
if [[ -d "${TMP_DIR}" ]]; then
    rm -rf "${TMP_DIR}"
fi

git clone --depth 1 --branch "${TARGET_TAG}" \
    "https://github.com/openclaw/openclaw.git" "${TMP_DIR}" \
    || {
        echo "${LOG_PREFIX} ERROR: Failed to clone OpenClaw. Tag '${TARGET_TAG}' may not exist."
        exit 1
    }

# Verify clone
if [[ ! -f "${TMP_DIR}/package.json" ]]; then
    echo "${LOG_PREFIX} ERROR: Clone failed - package.json not found"
    exit 1
fi

# Configure pnpm registry
echo "${LOG_PREFIX} Configuring pnpm registry..."
pnpm config set registry "${NPM_REGISTRY}"

# Install dependencies
echo "${LOG_PREFIX} Installing dependencies (pnpm install)..."
cd "${TMP_DIR}"
pnpm install || {
    echo "${LOG_PREFIX} ERROR: pnpm install failed"
    exit 1
}

# Build
echo "${LOG_PREFIX} Building OpenClaw (pnpm build)..."
pnpm build || {
    echo "${LOG_PREFIX} ERROR: pnpm build failed"
    exit 1
}

# Verify binary exists
if [[ ! -f "${TMP_DIR}/openclaw.mjs" ]] && [[ ! -f "${TMP_DIR}/packages/clawdbot/node_modules/.bin/openclaw" ]]; then
    echo "${LOG_PREFIX} ERROR: Build verification failed - openclaw binary not found"
    exit 1
fi

# Atomic swap
echo "${LOG_PREFIX} Installing to workspace..."
if [[ -d "${WORKSPACE_OC}" ]]; then
    rm -rf "${WORKSPACE_OC}"
fi
mv "${TMP_DIR}" "${WORKSPACE_OC}"

# Clear trap on success
trap - ERR

# Get new version
NEW_VERSION=$(node -e "console.log(require('${WORKSPACE_OC}/package.json').version)" 2>/dev/null || echo "${TARGET_TAG}")

echo ""
echo "=========================================="
echo "  OpenClaw updated successfully!"
echo "  New version: v${NEW_VERSION}"
echo "=========================================="
echo ""
echo "The new version is installed at: ${WORKSPACE_OC}"
echo "It will be used automatically on next container restart."
echo ""

# Restart if requested
if [[ "${RESTART_AFTER}" == "true" ]]; then
    echo "${LOG_PREFIX} Restarting manager-agent..."
    supervisorctl restart manager-agent 2>/dev/null || {
        echo "${LOG_PREFIX} WARNING: Could not restart via supervisorctl (may not be running)"
    }
    echo "Manager agent restart initiated."
else
    echo "To apply immediately, run:"
    echo "  supervisorctl restart manager-agent"
fi
