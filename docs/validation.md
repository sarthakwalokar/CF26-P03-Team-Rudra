# FlowGuard AI — Validation, Experiments & Benchmark Results

## 1. Automated Test Suite Results

All automated test suites were executed against the codebase.

```
============================= test session starts =============================
platform win32 -- Python 3.13.7, pytest-8.3.3, pluggy-1.6.0
rootdir: D:\FLOWGUARD AI
plugins: anyio-4.14.2, asyncio-0.24.0, cov-5.0.0
collected 8 items

backend/app/tests/test_attack.py::test_attack_approval_bypass PASSED     [ 12%]
backend/app/tests/test_attack.py::test_attack_unauthorized_actor PASSED  [ 25%]
backend/app/tests/test_attack.py::test_attack_suite_comprehensive PASSED [ 37%]
backend/app/tests/test_repair.py::test_auto_repair_generation PASSED     [ 50%]
backend/app/tests/test_verification.py::test_valid_workflow_verification PASSED [ 62%]
backend/app/tests/test_verification.py::test_unreachable_node_detection PASSED [ 75%]
backend/app/tests/test_verification.py::test_circular_dependency_detection PASSED [ 87%]
backend/app/tests/test_verification.py::test_missing_approval_bypass_detection PASSED [100%]

======================= 8 passed, 32 warnings in 0.77s ========================
```

---

## 2. Deterministic Verification Benchmarks

| Benchmark Scenario | Tested Topology | Expected Verdict | Observed Verdict | Safety Score | Key Metric / Result |
|---|---|:---:|:---:|:---:|---|
| **Procurement Baseline** | Start $\rightarrow$ Budget Check $\rightarrow$ Manager Approval $\rightarrow$ PO Creation $\rightarrow$ End | **SAFE** | **SAFE (PASSED)** | **99.25 / 100** | 10 / 10 static checks passed with 0 errors. |
| **Approval Bypass Exploit** | Start $\rightarrow$ PO Creation (Approval Skipped) | **BLOCKED** | **BLOCKED** | **34.50 / 100** | Detected bypass: `PO Creation executed without required Finance Approval`. |
| **Circular Dependency Cycle** | A $\rightarrow$ B $\rightarrow$ C $\rightarrow$ B | **BLOCKED** | **BLOCKED** | **36.25 / 100** | Tarjan SCC algorithm isolated recursion loop `[B, C]`. |
| **Orphaned Unreachable Subgraph** | Disconnected Node `orphan_audit` | **WARNING** | **WARNING** | **82.00 / 100** | Forward reachability BFS identified unreachable component. |
| **Auto-Repaired Topology** | Auto-inserted Approval Gate + Precondition rewire | **SAFE** | **SAFE (PASSED)** | **98.00 / 100** | Full formal re-verification passed. |

---

## 3. Attack Simulation Suite (9 Penetration Vectors)

| Attack Type | Simulated Adversarial Vector | Engine Detection | Outcome |
|---|---|:---:|:---:|
| `APPROVAL_BYPASS` | Direct edge mutation circumventing manager approval | **DETECTED** | Attack path isolated; workflow flagged as vulnerable |
| `UNAUTHORIZED_ACTOR` | Requester invoking privileged payment disbursement | **DETECTED** | Role scope violation flagged (`PAYMENT_ADMIN` required) |
| `INVALID_STATE` | Injecting terminal status before validation | **DETECTED** | FSM invariant violation caught |
| `DEPENDENCY_FAILURE` | Dropping upstream required token payload | **DETECTED** | Missing token input trapped before execution |
| `SERVICE_TIMEOUT` | External ERP service exceeding 30s timeout SLA | **DETECTED** | Flagged missing fallback policy & retry threshold |
| `DUPLICATE_EXECUTION` | Double-invocation replay of refund action | **DETECTED** | Idempotency guard violation flagged |
| `MISSING_APPROVAL` | Deleting approval node from intermediate DAG | **DETECTED** | High-risk action detected without upstream gating |
| `INVALID_TRANSITION` | Forcing illegal state transition jump | **DETECTED** | Edge condition mismatch caught |
| `RECOVERY_FAILURE` | Fault injection on primary node with broken fallback | **DETECTED** | Fallback completeness failure detected |

---

## 4. Monte-Carlo Stress Testing

- **Scenarios Evaluated**: 1,000 to 10,000 randomized fault injection runs.
- **Methodology**: Evaluates stochastic network latencies, actor unavailability rates, upstream API failures, and concurrent execution spikes.
- **Result Metrics**: Mean Time Between Failures (MTBF), 99th percentile recovery success rate, and bottleneck identification.
