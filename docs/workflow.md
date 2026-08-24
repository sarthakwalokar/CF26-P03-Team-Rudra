# FlowGuard AI — Intermediate Representation (IR) & Workflow Specification

## 1. Core IR Schema Overview

FlowGuard AI compiles natural-language business processes into a canonical **Workflow Intermediate Representation (IR)**. The IR is serialized as structured JSON and modeled using Pydantic on the backend and TypeScript on the frontend.

```json
{
  "id": "wf-8f4b29c1",
  "name": "High-Value Customer Refund",
  "description": "Multi-tier refund verification and payment execution",
  "version": "1.0.0",
  "nodes": [
    {
      "id": "start",
      "name": "Refund Request Initiated",
      "type": "START",
      "action": "initiate_refund",
      "actor": "Customer Support Agent",
      "required_permissions": ["SUPPORT_TIER_1"],
      "inputs": ["customer_id", "order_id", "refund_amount"],
      "outputs": ["refund_token"],
      "preconditions": [],
      "postconditions": ["refund_token_created"],
      "dependencies": [],
      "risk_level": "LOW",
      "failure_policy": "BLOCK",
      "timeout_seconds": 60,
      "retry_count": 0,
      "is_critical": false
    },
    {
      "id": "eligibility_check",
      "name": "Verify Return Window & Order Status",
      "type": "VALIDATION",
      "action": "verify_order_eligibility",
      "actor": "Order Management Service",
      "required_permissions": ["SYSTEM_SERVICE"],
      "inputs": ["refund_token"],
      "outputs": ["eligibility_verdict"],
      "preconditions": ["refund_token"],
      "postconditions": ["order_eligible"],
      "dependencies": ["start"],
      "risk_level": "MEDIUM",
      "failure_policy": "BLOCK",
      "timeout_seconds": 30,
      "retry_count": 2,
      "is_critical": true
    },
    {
      "id": "fraud_check",
      "name": "AI Fraud Risk Assessment",
      "type": "VALIDATION",
      "action": "score_fraud_risk",
      "actor": "Risk Engine",
      "required_permissions": ["FRAUD_ENGINE"],
      "inputs": ["refund_token", "customer_id"],
      "outputs": ["fraud_score"],
      "preconditions": ["refund_token"],
      "postconditions": ["fraud_score_computed"],
      "dependencies": ["start"],
      "risk_level": "HIGH",
      "failure_policy": "BLOCK",
      "timeout_seconds": 45,
      "retry_count": 1,
      "is_critical": true
    },
    {
      "id": "finance_approval",
      "name": "Manager Approval Gate (Amounts > $500)",
      "type": "APPROVAL",
      "action": "approve_refund",
      "actor": "Finance Manager",
      "required_permissions": ["FINANCE_APPROVER"],
      "inputs": ["refund_token", "fraud_score"],
      "outputs": ["approval_signature"],
      "preconditions": ["eligibility_verdict", "fraud_score"],
      "postconditions": ["refund_approved"],
      "dependencies": ["eligibility_check", "fraud_check"],
      "risk_level": "HIGH",
      "failure_policy": "BLOCK",
      "timeout_seconds": 86400,
      "retry_count": 0,
      "is_critical": true
    },
    {
      "id": "payment_gateway",
      "name": "Disburse Funds via Stripe/Stellar",
      "type": "SERVICE",
      "action": "process_payout",
      "actor": "Payment Gateway Service",
      "required_permissions": ["PAYMENT_ADMIN"],
      "inputs": ["refund_token", "approval_signature"],
      "outputs": ["transaction_id"],
      "preconditions": ["approval_signature"],
      "postconditions": ["funds_disbursed"],
      "dependencies": ["finance_approval"],
      "risk_level": "CRITICAL",
      "failure_policy": "RETRY",
      "timeout_seconds": 30,
      "retry_count": 3,
      "is_critical": true
    },
    {
      "id": "end",
      "name": "Refund Completed & Customer Notified",
      "type": "END",
      "action": "send_customer_receipt",
      "actor": "Notification Service",
      "required_permissions": ["NOTIFICATION_SERVICE"],
      "inputs": ["transaction_id"],
      "outputs": [],
      "preconditions": ["transaction_id"],
      "postconditions": ["workflow_complete"],
      "dependencies": ["payment_gateway"],
      "risk_level": "LOW",
      "failure_policy": "IGNORE",
      "timeout_seconds": 15,
      "retry_count": 1,
      "is_critical": false
    }
  ],
  "edges": [
    { "id": "e1", "source": "start", "target": "eligibility_check", "transition_type": "SEQUENTIAL" },
    { "id": "e2", "source": "start", "target": "fraud_check", "transition_type": "PARALLEL" },
    { "id": "e3", "source": "eligibility_check", "target": "finance_approval", "transition_type": "SEQUENTIAL" },
    { "id": "e4", "source": "fraud_check", "target": "finance_approval", "transition_type": "SEQUENTIAL" },
    { "id": "e5", "source": "finance_approval", "target": "payment_gateway", "transition_type": "SEQUENTIAL" },
    { "id": "e6", "source": "payment_gateway", "target": "end", "transition_type": "SEQUENTIAL" }
  ]
}
```

---

## 2. Node Types

| Node Type | Purpose | Security Relevance |
|---|---|---|
| `START` | Entry point of the workflow | Validates requester identity and initial payload |
| `VALIDATION` | Automated assertion (e.g., balance check, KYC) | Proves prerequisite conditions prior to state changes |
| `APPROVAL` | Mandatory human-in-the-loop authorization | Protects against automated exploitation & bypass |
| `HUMAN_REVIEW` | Manual inspection / secondary review | Non-binary evaluation of complex edge cases |
| `ACTION` | Internal state change or database mutation | Modifies enterprise assets |
| `SERVICE` | External API / payment / cloud integration | High-risk integration point subject to timeouts |
| `CONDITION` | Branching decision gate | Evaluates predicates to steer execution |
| `RECOVERY` | Fallback handler on failure | Prevents unhandled crashes and data inconsistency |
| `FAILURE` | Explicit terminal failure state | Securely aborts and records audit event |
| `END` | Terminal success state | Emits completion telemetry and audit signoff |

---

## 3. Failure Policies

- `BLOCK`: Immediately halt workflow execution and alert security operator.
- `RETRY`: Retry the step with exponential backoff up to `retry_count`.
- `FALLBACK`: Route execution to an explicit recovery handler branch.
- `IGNORE`: Log non-critical warning and continue execution flow.
