# FlowGuard AI — Security Architecture & Threat Model

## 1. Threat Model & Trust Boundaries

AI workflows operate at the boundary between nondeterministic natural-language reasoning and deterministic transactional systems. FlowGuard AI enforces strict security boundaries:

```
┌─────────────────────────────────────────────────────────────┐
│                    UNTRUSTED ZONE                           │
│  - User prompt text                                         │
│  - Unvalidated LLM generation                               │
│  - External third-party payloads                            │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ [Policy Compiler + Schema Validation]
┌─────────────────────────────────────────────────────────────┐
│                    ISOLATED COMPILER ZONE                   │
│  - Strongly-Typed Workflow IR                               │
│  - AST Structure & Dependency Graph                         │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼ [Deterministic Verification Engine]
┌─────────────────────────────────────────────────────────────┐
│                    VERIFIED TRUSTED ZONE                    │
│  - 10 Static Graph Checks (Cycles, Bypass, RBAC)            │
│  - Zero-Untrusted Gated Execution State Machine             │
│  - Immutable Audit Trail (SQLite)                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Key Security Guarantees

1. **Zero-Untrusted Execution Gate**:
   - Workflows evaluated as `BLOCKED` cannot enter runtime execution under any circumstance.
2. **Deterministic Mathematical Proof**:
   - Graph algorithms (Tarjan SCC, BFS, Dominator Trees) decide safety, eliminating LLM hallucination risk.
3. **No Hardcoded Secrets**:
   - Zero credentials in repository history; runtime relies strictly on user-supplied configuration or local zero-network offline modes.
4. **Idempotency & Replay Resistance**:
   - Unique execution tokens prevent double-spend or duplicate consequential side effects.
