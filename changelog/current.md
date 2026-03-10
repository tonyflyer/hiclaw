# Changelog (Unreleased)

Record image-affecting changes to `manager/`, `worker/`, `openclaw-base/` here before the next release.

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
