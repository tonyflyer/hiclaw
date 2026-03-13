# Plan: Add --browser flag for Worker creation

## Objective
Implement optional Browser tool support for Workers via `--browser` flag.

## Files to Modify

### 1. create-worker.sh
- Add `ENABLE_BROWSER=false` variable (line ~31)
- Add `--browser` flag parsing in case statement (after `--console-port`)
- Update usage message

### 2. generate-worker-config.sh  
- Accept 5th parameter for browser enabled
- Export `WORKER_BROWSER_ENABLED` env var

### 3. worker-openclaw.json.tmpl
- Add browser config block with env var substitution:
```json
"browser": {
  "enabled": ${WORKER_BROWSER_ENABLED:-false},
  "headless": false,
  "ssrfPolicy": {
    "dangerouslyAllowPrivateNetwork": true
  },
  "defaultProfile": "openclaw"
},
```

### 4. openclaw-base/Dockerfile
- Add `chromium-browser` to apt-get install line

### 5. worker-management/SKILL.md
- Document `--browser` flag usage

### 6. changelog/current.md
- Add entry: `feat(worker): add --browser flag for optional Browser tool support`

### 7. AGENTS.md
- Add Browser tool documentation

## Verification
- Worker without --browser: no browser tool
- Worker with --browser: browser tool available
