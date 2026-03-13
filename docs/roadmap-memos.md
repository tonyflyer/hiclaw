# HiClaw Roadmap: MemOS Integration & Multi-Team Architecture

## Overview

This document outlines the planned improvements for HiClaw v2.0, focusing on:
1. **MemOS Integration** — Adding long-term memory and semantic search for AI Agents
2. **Multi-Team Architecture** — Supporting multiple teams on a shared infrastructure

## v1.x: Current State (Single Team)

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│              hiclaw-manager-agent                       │
│  Higress │ Tuwunel │ MinIO │ Element Web │ Manager    │
└─────────────────────────┬───────────────────────────────┘
                          │
         ┌────────────────┴────────────────┐
         │         Worker Containers        │
         │   (stateless, MinIO sync)      │
         └─────────────────────────────────┘
```

### Current Limitations

| Limitation | Impact |
|------------|--------|
| No long-term memory | Each task starts fresh, no context retention |
| Manual knowledge sharing | `shared/` directory requires manual sync |
| Token-heavy context | Full Matrix history loaded per task |
| Single team only | No multi-tenant isolation |

---

## v2.0: MemOS Integration

### Goal

Add persistent, semantic memory for AI Agents with intelligent recall and cross-Agent knowledge sharing.

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│              Shared MemOS Infrastructure                 │
│  ┌─────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐ │
│  │ MemOS   │  │  Neo4j   │  │ Qdrant   │  │Redis │ │
│  │ API     │  │  Graph   │  │ Vector   │  │Queue │ │
│  │ :8001   │  │  :7687   │  │  :6333   │  │:6379 │ │
│  └────┬────┘  └──────────┘  └──────────┘  └───────┘ │
└────────┼────────────────────────────────────────────────┘
         │
         │ (Docker Network / K8s Service)
         │
┌────────┴────────────────────────────────────────────────┐
│              hiclaw-manager-agent                       │
│  + OpenClaw MemOS Plugin (lifecycle hooks)             │
└─────────────────────────┬───────────────────────────────┘
                          │
         ┌────────────────┴────────────────┐
         │         Worker Containers        │
         │   + MemOS Plugin (auto-recall) │
         └─────────────────────────────────┘
```

### MemOS Integration Options

| Mode | Description | Complexity | Cost |
|------|-------------|------------|------|
| **Cloud** | MemOS hosted service | Low (API key only) | Pay-per-use |
| **Local** | Self-hosted MemOS stack | Medium (Neo4j+Qdrant+Redis) | Hardware |

#### Recommended: Cloud First

- **72% token savings** — intelligent memory retrieval vs loading full history
- **Multi-Agent memory sharing** — same `user_id` = shared context
- **Zero infrastructure** — just add API key

#### Local Deployment (Future)

For teams requiring data privacy or large knowledge bases:

```yaml
# memos-stack.yml
services:
  memos-api:
    image: memtensor/memos:latest
    ports:
      - "8001:8001"
    environment:
      - NEO4J_URI=bolt://neo4j:7687
      - QDRANT_URL=http://qdrant:6333
      - REDIS_URL=redis://redis:6379
      
  neo4j:
    image: neo4j:5
    environment:
      - NEO4J_AUTH=neo4j/password
      
  qdrant:
    image: qdrant/qdrant:latest
    
  redis:
    image: redis:7-alpine
```

### Implementation Plan

#### Phase 1: Cloud Integration (v2.0)

- [ ] Add MemOS Cloud plugin to Worker image
- [ ] Configure Worker env vars for MemOS connection
- [ ] Update Worker openclaw.json template with plugin config
- [ ] Document setup process

#### Phase 2: Local MemOS (v2.1)

- [ ] Create MemOS docker-compose for shared infrastructure
- [ ] Add MemOS routing in Higress
- [ ] Design team-level API key distribution

### Expected Benefits

| Metric | Improvement |
|--------|-------------|
| Token usage | -72% (vs loading full history) |
| Context quality | Semantic search, not just recent messages |
| Knowledge reuse | Cross-Agent memory sharing |
| Task continuity | Agent remembers previous work |

---

## v2.x: Multi-Team Architecture

### Goal

Support multiple teams on a shared HiClaw infrastructure with proper isolation.

### Two Approaches

#### Approach A: Independent Instances (Recommended for v2.x)

```
┌──────────────────┐    ┌──────────────────┐
│   Team A         │    │   Team B         │
│   HiClaw Stack  │    │   HiClaw Stack  │
│   (dedicated)    │    │   (dedicated)    │
└──────────────────┘    └──────────────────┘
         │                       │
         └───────────┬───────────┘
                     │
          ┌──────────┴──────────┐
          │  Shared MemOS       │
          │  (different user_id)│
          └─────────────────────┘
```

**Pros**:
- Complete isolation at deployment level
- No code changes required
- Simple to operate

**Cons**:
- Higher resource usage per team
- Each team needs separate infra

#### Approach B: True Multi-Tenant (v3.0+)

```
┌─────────────────────────────────────────────────────────┐
│              Shared HiClaw Infrastructure               │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐              │
│  │   Team A        │  │   Team B        │              │
│  │  Consumer Group │  │  Consumer Group │              │
│  │  + API Key     │  │  + API Key     │              │
│  └────────┬────────┘  └────────┬────────┘              │
│           │                    │                        │
│           └──────────┬─────────┘                        │
│                      │                                  │
│           ┌──────────┴──────────┐                       │
│           │  Shared MemOS      │                       │
│           │  (user_id = team)  │                       │
│           └─────────────────────┘                       │
└─────────────────────────────────────────────────────────┘
```

**Pros**:
- Resource efficient
- Single control plane

**Cons**:
- Significant development effort
- Complex credential isolation
- Security critical

### Current Isolation Gaps

| Component | Current State | Gap |
|-----------|--------------|-----|
| **MinIO** | Admin credentials | Any Worker can access all data |
| **Higress** | Single consumer | No per-team API keys |
| **Matrix** | Single server | No room isolation |
| **MemOS** | N/A | Will use user_id isolation |

### Roadmap

| Phase | Focus | Timeline |
|-------|-------|----------|
| **v2.0** | MemOS Cloud integration | Q2 2026 |
| **v2.1** | MemOS Local shared infra | Q3 2026 |
| **v2.2** | Per-team API keys | Q3 2026 |
| **v3.0** | True multi-tenant | Q4 2026+ |

---

## Technical Details

### MemOS OpenClaw Plugin

The plugin works via OpenClaw lifecycle hooks:

```javascript
// Configuration in openclaw.json
{
  "plugins": {
    "entries": {
      "memos-cloud-openclaw-plugin": {
        "enabled": true,
        "config": {
          "baseUrl": "https://memos.memtensor.cn/api/openmem/v1",
          "apiKey": "${MEMOS_API_KEY}",
          "userId": "${HICLAW_TEAM_ID}",
          "multiAgentMode": true,
          "agentId": "${WORKER_NAME}"
        }
      }
    }
  }
}
```

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `MEMOS_ENABLED` | Enable MemOS integration | `1` |
| `MEMOS_BASE_URL` | MemOS API endpoint | `http://memos:8001` |
| `MEMOS_API_KEY` | Team's API key | `mpg-xxxx` |
| `MEMOS_USER_ID` | Team identifier | `team-alpha` |

### Memory Sharing Model

```
Team's Memory Space (user_id = team-alpha)
│
├── Agent: alice (agent_id = alice)
│   ├── Project A memories
│   └── Skills learned
│
├── Agent: bob (agent_id = bob)
│   ├── Project B memories
│   └── Code patterns
│
└── Shared Knowledge
    ├── Team conventions
    └── Shared documentation
```

---

## Migration Guide

### Upgrading to v2.0

1. **Get MemOS API Key** (Cloud) or **Deploy MemOS** (Local)
2. **Update Manager config** with MemOS env vars
3. **Workers auto-inherit** MemOS settings
4. **First run**: Agent starts with empty memory
5. **Subsequent runs**: Context auto-recalled

### Backward Compatibility

- MemOS integration is **opt-in**
- Existing deployments continue to work without changes
- No forced migration of existing data

---

## Appendix: Resource Estimates

### MemOS Local (Shared Infrastructure)

| Component | Memory | CPU | Scale |
|-----------|--------|-----|-------|
| MemOS API | 200MB | 0.5 core | 10+ teams |
| Neo4j | 1GB | 1 core | |
| Qdrant | 500MB | 1 core | |
| Redis | 100MB | 0.25 core | |
| **Total** | **~1.8GB** | **~2.75 core** | |

### Per Team (Additional)

| Component | Memory | CPU |
|-----------|--------|-----|
| Manager | 2GB | 1 core |
| Workers (avg) | 500MB x N | 0.5 core x N |

---

## References

- [MemOS GitHub](https://github.com/MemTensor/MemOS)
- [MemOS Cloud OpenClaw Plugin](https://github.com/MemTensor/MemOS-Cloud-OpenClaw-Plugin)
- [MemOS Documentation](https://memos-docs.openmem.net/)
- [MemOS Architecture](https://blog.lqhl.me/exploring-ai-memory-architectures-part-2-memoss-system-and-governance-framework)
