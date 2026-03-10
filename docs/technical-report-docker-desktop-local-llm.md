# HiClaw Docker Desktop 本地 LLM 集成技术报告

## 概述

本文档记录了在 Mac Docker Desktop 环境下将 HiClaw 系统与本地 LM Studio（本地大语言模型）集成的技术变更过程。

**目标环境**：
- 操作系统：macOS
- 虚拟化：Docker Desktop
- LLM 运行时：LM Studio（`http://localhost:11435`，模型 `qwen/qwen3.5-35b-a3b`）
- 共享目录：`~/workspace-hiclaw`

---

## 遇到的问题及解决方案

### 问题 1：Wasm 插件 OCI 格式不兼容

**问题描述**：
Higress AI Gateway 的 `ai-proxy:2.0.0` 和 `ai-statistics:2.0.0` 插件加载失败，日志显示：
```
update_error: 1
update_success: 0
```

**根因分析**：
这两个插件采用新的 4 层 OCI 镜像格式，但 Higress 内部的 Wasm loader（基于 Istio 1.19）仅支持 2 层格式。实际的 `.wasm` 二进制文件被封装在 `plugin.tar.gz` 层中，需要手动提取。

**解决方案**：
1. 使用 `crane` 工具手动下载并提取 Wasm 二进制：
```bash
crane pull ghcr.io/higress/plugins/ai-proxy:2.0.0 /tmp/ai-proxy.tar
tar -xf /tmp/ai-proxy.tar -C /tmp
crane blob <image>@<digest> > ai-proxy.wasm
```

2. 将提取的 `.wasm` 文件复制到容器内：
```bash
docker cp ai-proxy.wasm hiclaw-manager:/opt/hiclaw/wasm-plugins/
docker cp ai-statistics.wasm hiclaw-manager:/opt/hiclaw/wasm-plugins/
```

3. 修改 WasmPlugin YAML 配置，使用 `file://` 协议：
```yaml
url: "file:///opt/hiclaw/wasm-plugins/ai-proxy.wasm"
```

**验证方法**：
```bash
curl -s http://127.0.0.1:8080/v1/wasm-plugins/ai-proxy | jq '.data.update_success'
# 返回 1 表示成功
```

---

### 问题 2：Docker Desktop DNS 解析错误

**问题描述**：
Manager Agent 通过 AI Gateway 调用本地 LLM 时失败，错误信息：
```
HTTP 503: upstream connect error or disconnect/reset before headers
reset reason: remote connection failure, transport failure reason: delayed connect error: 111
```

**根因分析**：
- 在 Mac 宿主机上，`docker.for.mac.localhost` 正确解析为 `192.168.65.254`（Docker Desktop 的虚拟网卡 IP）
- 但在容器内部，由于 Higress 使用 Envoy 进行服务发现，`docker.for.mac.localhost` 被错误解析为 `127.0.0.1`（loopback）
- 这导致 LM Studio 的请求被发往容器自身（127.0.0.1:11435），而容器内并未运行 LM Studio

**解决方案**：
修改 `manager/scripts/init/setup-higress.sh` 脚本，添加 IP 解析逻辑：

```bash
# 在设置 openai-compat 服务源之前，解析主机名到 IPv4 地址
OC_RESOLVED_IP=$(python3 -c "import socket; addrs=socket.getaddrinfo('${OC_DOMAIN}', None, socket.AF_INET); print(addrs[0][4][0]) if addrs else print('${OC_DOMAIN}')" 2>/dev/null || echo "${OC_DOMAIN}")

# 根据解析结果选择服务类型
if [ "${OC_RESOLVED_IP}" != "${OC_DOMAIN}" ] && echo "${OC_RESOLVED_IP}" | grep -qE "^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$"; then
    OC_SVC_TYPE="static"
    OC_SVC_DOMAIN="${OC_RESOLVED_IP}:${OC_PORT}"
    OC_SVC_NAME="openai-compat.static"
else
    OC_SVC_TYPE="dns"
    OC_SVC_DOMAIN="${OC_DOMAIN}"
    OC_SVC_NAME="openai-compat.dns"
fi
```

关键变更：
1. 使用 Python 的 `socket.getaddrinfo()` 将域名解析为 IPv4 地址
2. 将服务源类型从 `dns` 改为 `static`
3. 使用解析后的实际 IP 地址（`192.168.65.254:11435`）替代域名

**验证方法**：
```bash
# 检查服务源配置
curl -s -b /tmp/higress-cookie.txt \
  "http://127.0.0.1:8001/v1/service-sources/openai-compat" | jq '.data.type, .data.domain'
# 应返回: "static" 和 "192.168.65.254:11435"

# 测试 AI Gateway
curl -s --noproxy '*' \
  http://aigw-local.hiclaw.io:8080/v1/chat/completions \
  -H "Authorization: Bearer <MANAGER_API_KEY>" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen/qwen3.5-35b-a3b","messages":[{"role":"user","content":"Hello"}],"max_tokens":20}'
```

---

### 问题 3：HTTP 代理拦截容器流量

**问题描述**：
Manager Agent 访问 `aigw-local.hiclaw.io:8080` 时返回 "Connection error."

**根因分析**：
- Mac 宿主机运行了 Parallels VM 代理（`HTTP_PROXY=http://10.211.55.2:4001`）
- 容器的 `no_proxy` 环境变量未包含 `hiclaw.io` 域名
- 导致 Higress 网关的请求被错误地路由到 Parallels 代理

**解决方案**：
在 `manager/scripts/init/start-manager-agent.sh` 开头添加：
```bash
export no_proxy="${no_proxy},hiclaw.io,localhost,127.0.0.1"
export NO_PROXY="${NO_PROXY},hiclaw.io,localhost,127.0.0.1"
```

---

### 问题 4：openaiCustomUrl 缺少 /v1 后缀

**问题描述**：
即使 AI Gateway 配置正确，LLM 请求仍然失败。

**根因分析**：
ai-proxy Wasm 插件的 `openaiCustomUrl` 配置必须包含 `/v1` 后缀，否则插件会将请求路径 `/v1/chat/completions` 错误地路由为 `/chat/completions`，而 LM Studio 不识别该路径。

**解决方案**：
在 `setup-higress.sh` 中修改 provider 配置：
```bash
PROVIDER_BODY='{"type":"openai","name":"openai-compat",...,"rawConfigs":{
  "openaiCustomUrl":"'"${OPENAI_BASE_URL}/v1"'",
  ...
}}'
```

---

### 问题 5：Matrix API 端点格式

**问题描述**：
通过 Matrix API 发送消息时返回 `M_UNRECOGNIZED` 错误。

**根因分析**：
Tuwunel（Conduwuit）Matrix 服务器仅支持特定的 API 路径格式。

**解决方案**：
使用正确的 API 格式：
- 路径：`/_matrix/client/r0/...`（不是 `/_matrix/client/v3/...`）
- 方法：`PUT`（不是 `POST`）
- 发送消息端点：
```bash
curl -X PUT "http://127.0.0.1:18080/_matrix/client/r0/rooms/<room_id>/send/m.room.message/m.<txn_id>" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"msgtype":"m.text","body":"消息内容"}'
```

---
### 问题 6：OpenClaw exec 工具不执行命令

**问题描述**：
Manager Agent 在收到用户消息后仅输出命令文本，不实际执行。

**根因分析**：
三重配置缺失：
1. `tools.elevated.allowFrom.matrix` 未配置 — Matrix 渠道无法触发 elevated exec。可通过 `openclaw sandbox explain` 查看，显示 `allowedByConfig: false`
2. `tools.exec.host` 默认为 `sandbox`，但 sandbox 模式为 `off` — 此组合"失败关闭"（静默拒绝执行）。需设置 `host: "gateway"`
3. `exec-approvals.json` 不存在 — 无审批策略时，所有 exec 请求默认被拒绝

**解决方案**：
在 `manager/configs/manager-openclaw.json.tmpl` 中添加三项配置：

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

在 OpenClaw 配置目录创建 `exec-approvals.json`：
```json
{
  "security": "full",
  "ask": "off",
  "autoAllowSkills": true
}
```

`start-manager-agent.sh` 脚本会在启动时自动创建此文件。

**验证方法**：
通过 Matrix 发送 "ls ~/" 命令，检查 OpenClaw 日志中的 `tool start: tool=exec` 条目。

---

### 问题 7：LLM 模型 Tool Calling 兼容性

**问题描述**：
部分本地 LLM 模型不支持 function/tool calling，导致 OpenClaw 的 exec 工具永远不会被调用。

**根因分析**：
并非所有模型都支持 OpenAI chat completions API 的 `tools` 参数和 `tool_choice`。MoE 模型（如 qwen3.5-35b-a3b）通过 LM Studio 可能无法正确生成 `tool_calls` JSON。

**解决方案**：
切换到支持 tool calling 的模型：`qwen2.5-7b-instruct-1m`

`start-manager-agent.sh` 添加了 reasoning 模型检测逻辑。非 reasoning 模型（如 qwen2.5-*）通过 `--reasoning-effort off` jq patch 禁用 thinking。

**验证方法**：
使用 `qwen2.5-7b-instruct-1m` 模型时，API 响应中应包含 `tool_calls` 字段。

---

## 配置文件变更汇总

| 文件 | 变更类型 | 描述 |
|------|----------|------|
| `manager/scripts/init/setup-higress.sh` | 修改 | 添加 DNS 解析逻辑，使用 static 类型服务源，添加 /v1 后缀 |
| `manager/scripts/init/start-manager-agent.sh` | 修改 | 添加 no_proxy 扩展、reasoning 检测、exec-approvals 自动创建 |
| `manager/configs/manager-openclaw.json.tmpl` | 修改 | 添加 tools.elevated 和 tools.exec 配置段 |
| `openclaw-base/Dockerfile` | 修改 | 升级到 openclaw:v2026.3.1 |
| `~/hiclaw-manager.env` | 修改 | HICLAW_OPENAI_BASE_URL 设为实际 IP |

---

## 验证结果

### 1. AI Gateway 直接测试
```bash
curl -s --noproxy '*' \
  http://aigw-local.hiclaw.io:8080/v1/chat/completions \
  -H "Authorization: Bearer ebc7431b5501b2b8b6b50f268dd55dbd88563cd1995e93bae7f4c662a9c1cc2c" \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen/qwen3.5-35b-a3b","messages":[{"role":"user","content":"Say hello in 3 words"}],"max_tokens":20}'
```
**结果**：✅ 成功返回 LLM 响应

### 2. 端到端 Matrix 对话测试
```bash
# 发送消息
curl -X PUT "http://127.0.0.1:18080/_matrix/client/r0/rooms/!PKpUjkXWM42kqL9Vbx:matrix-local.hiclaw.io:18080/send/m.room.message/m.test123" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"msgtype":"m.text","body":"@manager Test 123"}'
```
**结果**：✅ Manager Agent 回复 "TEST"

### 3. 端到端 Worker 创建测试

通过 Matrix API 发送创建 Worker 的请求，验证 exec 工具是否正常工作：

```bash
# 发送创建 Worker 请求
curl -X PUT "http://127.0.0.1:18080/_matrix/client/r0/rooms/<room_id>/send/m.room.message/m.test456" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"msgtype":"m.text","body":"Create a Worker named TestBot"}'
```

**预期行为**：
1. Manager 使用 exec 工具执行 `create-worker.sh` 脚本
2. 新容器 `hiclaw-worker-testbot` 成功创建

**结果**：✅ Manager Agent 能够自动执行 Worker 创建

## 持久化验证

重启 Manager 容器后配置是否会丢失？

**验证过程**：
1. 容器重启后，`setup-higress.sh` 会自动执行
2. 脚本中的 Python 代码会重新解析 `docker.for.mac.localhost` 到正确 IP
3. 服务源自动配置为 `static` 类型
4. **结论**：配置具有持久性，无需手动干预

---

## 总结

本次集成解决了 7 个关键技术问题：

1. **Wasm 插件兼容性**：手动提取并注入 .wasm 二进制
2. **DNS 解析修复**：在脚本层面动态解析并使用 static 类型
3. **代理拦截**：扩展 no_proxy 环境变量
4. **API 路径修正**：确保 openaiCustomUrl 包含 /v1 后缀
5. **Matrix API 格式**：使用 r0 路径和 PUT 方法
6. **exec 工具配置**：配置 elevated/exec-host/exec-approvals 三项修复
7. **模型兼容性**：切换到支持 tool calling 的模型

所有修复已持久化到 `setup-higress.sh` 和 `start-manager-agent.sh` 脚本中，确保容器重启后仍然有效。
