## 2026-03-13 LLM Endpoint Upgrade Analysis

### New LLM Endpoint
- URL: `https://172.22.164.60:80/lmstudio/v1` (HTTPS on port 80, via nginx reverse proxy)
- API Key: `sk-test123`
- Best model: `qwen/qwen3-coder-30b` (clean tool calling, no thinking noise)
- Also viable: `qwen/qwen3-coder-next`, `openai/gpt-oss-20b`

### setup-higress.sh Bug: openaiCustomUrl
- Line 183 hardcodes `http://` — should use `${OC_PROTO}`
- URL path prefix (e.g., `/lmstudio`) gets dropped — only `/v1` appended
- Fix: extract path from `OC_URL_STRIP`, use `${OC_PROTO}://`

### generate-worker-config.sh: New Models
- Need to add `qwen/qwen3-coder-30b` and `qwen/qwen3-coder-next` to:
  - Context window cases (30B coder: CTX=200000, MAX=128000)
  - Input modality (text only, no vision)
  - Reasoning detection: qwen3-coder IS a reasoning model (qwen3* pattern matches)
  - IMPORTANT: model names with `/` (e.g., `qwen/qwen3-coder-30b`) need to work in case patterns

### Current .env (host: ~/hiclaw-manager/.env)
- HICLAW_LLM_PROVIDER=openai-compat
- HICLAW_DEFAULT_MODEL=qwen2.5-7b-instruct-1m
- HICLAW_LLM_API_KEY=dummy
- HICLAW_OPENAI_BASE_URL=http://host.docker.internal:11435

### Need to change .env to:
- HICLAW_DEFAULT_MODEL=qwen/qwen3-coder-30b
- HICLAW_LLM_API_KEY=sk-test123
- HICLAW_OPENAI_BASE_URL=https://172.22.164.60:80/lmstudio/v1

### no_proxy already handled
- start-manager-agent.sh extracts LLM host from HICLAW_OPENAI_BASE_URL
- Will automatically add `172.22.164.60` to no_proxy

### Potential HTTPS Issue
- `172.22.164.60:80` uses HTTPS (nginx reverse proxy, possibly self-signed cert)
- Higress/Envoy service source with `protocol: "https"` might reject self-signed cert
- Need to test and potentially configure TLS settings
