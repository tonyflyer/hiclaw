#!/bin/sh
# hiclaw-sync.sh - Pull latest config from centralized storage
# Called by the Worker agent when Manager notifies of config updates.
# Uses ~/hiclaw-fs/ layout matching Manager's directory structure.

WORKER_NAME="${HICLAW_WORKER_NAME:?HICLAW_WORKER_NAME is required}"
HICLAW_ROOT="/root/hiclaw-fs"
WORKSPACE="${HICLAW_ROOT}/agents/${WORKER_NAME}"

XZ|mc mirror "hiclaw/hiclaw-storage/agents/${WORKER_NAME}/" "${WORKSPACE}/" --overwrite --exclude ".agents" --exclude ".openclaw" 2>&1
MY|mc mirror "hiclaw/hiclaw-storage/shared/" "${HICLAW_ROOT}/shared/" --overwrite --exclude ".git" 2>/dev/null || true
mc mirror "hiclaw/hiclaw-storage/shared/" "${HICLAW_ROOT}/shared/" --overwrite 2>/dev/null || true

echo "Config sync completed at $(date)"
