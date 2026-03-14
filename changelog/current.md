# Changelog (Unreleased)

Record image-affecting changes to `manager/`, `worker/`, `copaw/`, or `openclaw-base/` here before the next release.

---

- feat(manager): support Chinese/international worker names with auto-generated ASCII system IDs
- fix(manager): prevent worker creation using wrong script (lifecycle-worker.sh instead of create-worker.sh)
- fix(manager): add mandatory verification after worker creation to prevent false success reports
- fix(openclaw-base): upgrade to official OpenClaw v2026.3.1 from openclaw/openclaw repository
- fix: set container timezone from TZ env var in both Manager and Worker (install tzdata in base image, configure /etc/localtime and /etc/timezone at startup)
- feat(manager): add User-Agent header (HiClaw/<version>) to default AI route via headerControl, and send it in LLM connectivity tests ([3242d06](https://github.com/higress-group/hiclaw/commit/3242d0630d196c35b5df6fd6fbd7ac6e6b72c08a))
- feat(manager): configure OpenClaw exec tool for actual command execution (elevated permissions, gateway host, exec-approvals)
- feat(manager): add reasoning model detection and automatic thinking mode configuration in start-manager-agent.sh
- feat(manager): add persistent OpenClaw update mechanism — update-openclaw.sh script + workspace version detection in start-manager-agent.sh (updates survive container restarts via ~/hiclaw-manager mount)
- fix(openclaw-base): upgrade OpenClaw to v2026.3.8 (from v2026.3.1)
- fix(manager): dynamically resolve LLM host from HICLAW_OPENAI_BASE_URL for no_proxy bypass instead of hardcoded IPs in start-manager-agent.sh
- fix(manager): fix setup-higress.sh wasm yaml patch to use dynamic OC_DOMAIN:OC_PORT instead of hardcoded IP for ai-proxy plugin configuration
- fix(manager): generate distinct hooks.token for openclaw.json — required by OpenClaw v2026.3.8+; also migrate existing installs where hooks.token matched gateway auth token
- feat(manager): auto-create admin↔manager DM room on first boot so users can chat with Manager immediately after install (idempotent, marker file at /data/manager-dm-room.json)
- feat(worker): add --browser flag to create-worker.sh for optional Browser tool support (web scraping capability)
- fix(worker): fix create-worker.sh malformed JSON in Step 2 room creation (duplicate preset/bracket lines) that silently prevented room creation
- fix(worker): create-worker.sh now auto-joins admin and worker into the created room after creation so the room is immediately visible in Element Web
- fix(worker): guard against circular skills/skills symlink (ELOOP prevention) in worker-entrypoint.sh
- fix(worker): add reasoning model detection to generate-worker-config.sh — non-reasoning models (e.g. qwen2.5-*) now correctly get reasoning=false instead of hardcoded true
- fix(manager): inject CSS fix for Element Web @mention autocomplete visibility — override contain:strict on .mx_RoomView_wrapper via nginx sub_filter
- feat(manager): bundle Higress Wasm plugins (ai-proxy, ai-statistics) into image via Dockerfile COPY — eliminates manual docker cp injection and OCI download failures
- fix(manager): clear HTTP_PROXY/HTTPS_PROXY environment variables for all Higress programs in supervisord.conf — prevents Docker Desktop (Parallels) proxy from interfering with Envoy upstream LLM connections
- feat(manager): add --soul parameter to create-worker.sh for deploying custom SOUL.md to Workers during creation
- fix(worker): add browser.executablePath config for Playwright Chromium; add tools.exec.host=gateway to avoid systemctl; create exec-approvals.json at startup
- fix(worker): create /usr/bin/chromium symlink to Playwright Chromium in worker-entrypoint.sh — fixes OpenClaw "No supported browser found" error
- fix(worker): use /usr/bin/chromium as browser.executablePath in generate-worker-config.sh instead of HOME-relative path that resolves incorrectly on Manager
- fix(worker): add shared directory (/root/hiclaw-fs/shared/) change detection to Local->Remote file sync in worker-entrypoint.sh
- fix(worker): remove duplicate exec-approvals.json code block and duplicate log line in worker-entrypoint.sh
- fix(worker): clear HTTP_PROXY/HTTPS_PROXY environment variables at entrypoint startup — prevents Docker Desktop proxy from interfering with apt-get during Playwright Chromium installation
- fix(worker): detect stale Chromium marker file (synced from MinIO without binary) and remove it to trigger reinstall
- fix(worker): fix Playwright install exit code detection — pipe to tail swallowed non-zero exit codes; now uses temp file for proper error propagation
- fix(worker): add exec security=full and ask=off to worker-openclaw.json.tmpl to prevent approval timeout
#ZT|- fix(worker): background-patch exec-approvals.json after OpenClaw startup to ensure security=full defaults
#VR|#TH|- feat(install): expose MinIO API (19000) and Console (19001) ports by default — enables direct file system access from host
#RH|#XM|- fix(worker): add --exclude ".agents" and --exclude ".openclaw" to mc mirror commands — prevents circular symlink (ELOOP) when syncing skills directory
#XK|- fix(manager): add space before !important in Element Web CSS override — fixes @mention autocomplete popup visibility
