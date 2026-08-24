"""
Natural Language Policy Parser
Supports two modes:
  1. Mock Parser (deterministic, always works, 3 demo presets + heuristic parsing)
  2. Gemini LLM Parser (real AI, falls back to mock if key missing or error)

The LLM only GENERATES the Workflow IR JSON.
The verification engine independently decides if it is SAFE.
"""
from __future__ import annotations
import json
import os
import re
import uuid
from typing import List, Optional, Tuple
from datetime import datetime

from app.schemas.workflow import (
    WorkflowIR, WorkflowNode, WorkflowEdge, WorkflowMetadata,
    NodeType, RiskLevel, FailurePolicy, TransitionType, WorkflowStatus
)


# ── Demo Presets ───────────────────────────────────────────────────────────────

DEMO_PRESETS = {
    "procurement": {
        "name": "Procurement Approval Workflow",
        "description": "Enterprise procurement process with vendor verification and finance approval.",
        "policy_text": "Verify the vendor, check the budget, obtain finance approval, and create the procurement ticket.",
        "nodes": [
            {"id": "n0", "name": "Start", "type": "START", "action": "begin_workflow", "actor": "System", "risk_level": "LOW", "failure_policy": "BLOCK", "is_critical": False},
            {"id": "n1", "name": "Vendor Verification", "type": "VALIDATION", "action": "verify_vendor", "actor": "Procurement Officer", "required_permissions": ["vendor:verify"], "outputs": ["vendor_verified"], "risk_level": "MEDIUM", "failure_policy": "BLOCK", "is_critical": True, "description": "Verify vendor credentials, compliance, and standing."},
            {"id": "n2", "name": "Budget Check", "type": "VALIDATION", "action": "check_budget", "actor": "Finance System", "required_permissions": ["budget:read"], "inputs": ["vendor_verified"], "outputs": ["budget_approved"], "preconditions": ["vendor_verified == true"], "risk_level": "MEDIUM", "failure_policy": "BLOCK", "is_critical": True, "description": "Verify available budget for procurement."},
            {"id": "n3", "name": "Finance Approval", "type": "APPROVAL", "action": "approve_finance", "actor": "Finance Manager", "required_permissions": ["finance:approve", "procurement:approve"], "inputs": ["budget_approved"], "outputs": ["finance_approved"], "preconditions": ["budget_approved == true"], "risk_level": "HIGH", "failure_policy": "BLOCK", "is_critical": True, "description": "Finance Manager must approve the procurement request."},
            {"id": "n4", "name": "Create Procurement Ticket", "type": "ACTION", "action": "create_ticket", "actor": "Procurement System", "required_permissions": ["ticket:create"], "inputs": ["finance_approved"], "preconditions": ["finance_approved == true"], "risk_level": "LOW", "failure_policy": "RETRY", "retry_count": 3, "description": "Create the procurement ticket in the system."},
            {"id": "n5", "name": "End", "type": "END", "action": "complete_workflow", "actor": "System", "risk_level": "LOW", "failure_policy": "BLOCK"},
        ],
        "edges": [
            {"id": "e0", "source": "n0", "target": "n1", "transition_type": "SEQUENTIAL"},
            {"id": "e1", "source": "n1", "target": "n2", "transition_type": "SEQUENTIAL", "required_state": "vendor_verified"},
            {"id": "e2", "source": "n2", "target": "n3", "transition_type": "SEQUENTIAL", "required_state": "budget_approved"},
            {"id": "e3", "source": "n3", "target": "n4", "transition_type": "SEQUENTIAL", "required_state": "finance_approved"},
            {"id": "e4", "source": "n4", "target": "n5", "transition_type": "SEQUENTIAL"},
        ],
        "ambiguities": [],
    },
    "refund": {
        "name": "Customer Refund Workflow",
        "description": "Refund processing with KYC, fraud detection, and manager approval.",
        "policy_text": "Verify customer identity, perform fraud detection, obtain manager approval, then issue refund.",
        "nodes": [
            {"id": "n0", "name": "Start", "type": "START", "action": "begin_workflow", "actor": "System", "risk_level": "LOW", "failure_policy": "BLOCK"},
            {"id": "n1", "name": "KYC Verification", "type": "VALIDATION", "action": "verify_kyc", "actor": "Identity Service", "required_permissions": ["kyc:verify"], "outputs": ["identity_verified"], "risk_level": "HIGH", "failure_policy": "BLOCK", "is_critical": True, "description": "Verify customer identity (Know Your Customer)."},
            {"id": "n2", "name": "Fraud Detection", "type": "SERVICE", "action": "run_fraud_check", "actor": "Fraud Detection System", "required_permissions": ["fraud:check"], "inputs": ["identity_verified"], "outputs": ["fraud_check_passed"], "preconditions": ["identity_verified == true"], "risk_level": "HIGH", "failure_policy": "BLOCK", "is_critical": True, "description": "Run automated fraud detection analysis."},
            {"id": "n3", "name": "Manager Approval", "type": "APPROVAL", "action": "approve_refund", "actor": "Customer Service Manager", "required_permissions": ["refund:approve", "manager:approve"], "inputs": ["fraud_check_passed"], "outputs": ["refund_approved"], "preconditions": ["fraud_check_passed == true"], "risk_level": "HIGH", "failure_policy": "BLOCK", "is_critical": True, "description": "Manager must approve the refund request."},
            {"id": "n4", "name": "Issue Refund", "type": "ACTION", "action": "process_refund", "actor": "Payment System", "required_permissions": ["payment:refund"], "inputs": ["refund_approved"], "preconditions": ["refund_approved == true"], "risk_level": "CRITICAL", "failure_policy": "RETRY", "retry_count": 3, "is_critical": True, "description": "Issue refund to customer payment method."},
            {"id": "n5", "name": "End", "type": "END", "action": "complete_workflow", "actor": "System", "risk_level": "LOW", "failure_policy": "BLOCK"},
        ],
        "edges": [
            {"id": "e0", "source": "n0", "target": "n1", "transition_type": "SEQUENTIAL"},
            {"id": "e1", "source": "n1", "target": "n2", "transition_type": "SEQUENTIAL", "required_state": "identity_verified"},
            {"id": "e2", "source": "n2", "target": "n3", "transition_type": "SEQUENTIAL", "required_state": "fraud_check_passed"},
            {"id": "e3", "source": "n3", "target": "n4", "transition_type": "SEQUENTIAL", "required_state": "refund_approved"},
            {"id": "e4", "source": "n4", "target": "n5", "transition_type": "SEQUENTIAL"},
        ],
        "ambiguities": ["'Manager' is not mapped to a specific role — could be Customer Service Manager or Finance Manager.", "Refund amount limit not specified — may require additional authorization for high-value refunds."],
    },
    "employee_access": {
        "name": "Employee System Access Workflow",
        "description": "Employee identity verification and access provisioning with manager sign-off.",
        "policy_text": "Verify employee identity, obtain manager approval, then provision system access.",
        "nodes": [
            {"id": "n0", "name": "Start", "type": "START", "action": "begin_workflow", "actor": "System", "risk_level": "LOW", "failure_policy": "BLOCK"},
            {"id": "n1", "name": "Identity Verification", "type": "VALIDATION", "action": "verify_employee", "actor": "HR System", "required_permissions": ["employee:verify"], "outputs": ["employee_verified"], "risk_level": "MEDIUM", "failure_policy": "BLOCK", "is_critical": True, "description": "Verify employee identity and employment status."},
            {"id": "n2", "name": "Manager Approval", "type": "APPROVAL", "action": "approve_access", "actor": "Direct Manager", "required_permissions": ["access:approve", "manager:approve"], "inputs": ["employee_verified"], "outputs": ["access_approved"], "preconditions": ["employee_verified == true"], "risk_level": "HIGH", "failure_policy": "BLOCK", "is_critical": True, "description": "Direct manager must approve system access request."},
            {"id": "n3", "name": "Provision Access", "type": "SERVICE", "action": "provision_access", "actor": "IT System", "required_permissions": ["system:provision"], "inputs": ["access_approved"], "preconditions": ["access_approved == true"], "risk_level": "HIGH", "failure_policy": "BLOCK", "is_critical": True, "description": "Provision required system access and permissions."},
            {"id": "n4", "name": "End", "type": "END", "action": "complete_workflow", "actor": "System", "risk_level": "LOW", "failure_policy": "BLOCK"},
        ],
        "edges": [
            {"id": "e0", "source": "n0", "target": "n1", "transition_type": "SEQUENTIAL"},
            {"id": "e1", "source": "n1", "target": "n2", "transition_type": "SEQUENTIAL", "required_state": "employee_verified"},
            {"id": "e2", "source": "n2", "target": "n3", "transition_type": "SEQUENTIAL", "required_state": "access_approved"},
            {"id": "e3", "source": "n3", "target": "n4", "transition_type": "SEQUENTIAL"},
        ],
        "ambiguities": ["'Manager' is vague — does not specify which management role (direct manager vs. department head).", "Access level not specified — 'system access' could mean read-only or full administrative access."],
    },
    "invalid_procurement": {
        "name": "Invalid Procurement (Approval Bypass)",
        "description": "Flawed procurement policy where Procurement Ticket is issued BEFORE Finance Approval.",
        "policy_text": "Verify the vendor, create the procurement ticket, then obtain finance approval.",
        "nodes": [
            {"id": "n0", "name": "Start", "type": "START", "action": "begin_workflow", "actor": "System", "risk_level": "LOW", "failure_policy": "BLOCK"},
            {"id": "n1", "name": "Vendor Verification", "type": "VALIDATION", "action": "verify_vendor", "actor": "Procurement Officer", "required_permissions": ["vendor:verify"], "outputs": ["vendor_verified"], "risk_level": "MEDIUM", "failure_policy": "BLOCK", "is_critical": True, "description": "Verify vendor credentials."},
            {"id": "n2", "name": "Create Procurement Ticket", "type": "ACTION", "action": "create_ticket", "actor": "Procurement System", "required_permissions": ["ticket:create"], "inputs": ["finance_approved"], "preconditions": ["finance_approved == true"], "risk_level": "HIGH", "failure_policy": "BLOCK", "is_critical": True, "description": "Create procurement ticket prematurely before approval."},
            {"id": "n3", "name": "Finance Approval", "type": "APPROVAL", "action": "approve_finance", "actor": "Finance Manager", "required_permissions": ["finance:approve"], "outputs": ["finance_approved"], "risk_level": "HIGH", "failure_policy": "BLOCK", "is_critical": True, "description": "Finance Approval positioned after ticket creation."},
            {"id": "n4", "name": "End", "type": "END", "action": "complete_workflow", "actor": "System", "risk_level": "LOW", "failure_policy": "BLOCK"},
        ],
        "edges": [
            {"id": "e0", "source": "n0", "target": "n1", "transition_type": "SEQUENTIAL"},
            {"id": "e1", "source": "n1", "target": "n2", "transition_type": "SEQUENTIAL"},
            {"id": "e2", "source": "n2", "target": "n3", "transition_type": "SEQUENTIAL"},
            {"id": "e3", "source": "n3", "target": "n4", "transition_type": "SEQUENTIAL"},
        ],
        "ambiguities": ["Ordering Violation: Procurement Ticket executes before Finance Approval is granted."],
    },
    "circular_workflow": {
        "name": "Circular Deadlock Workflow",
        "description": "Workflow containing an illegal circular dependency between state transitions (A → B → C → B).",
        "policy_text": "Step A initiates, transitions to Step B, which invokes Step C, which routes back to Step B.",
        "nodes": [
            {"id": "n0", "name": "Start", "type": "START", "action": "begin_workflow", "actor": "System", "risk_level": "LOW", "failure_policy": "BLOCK"},
            {"id": "n1", "name": "Step A (Initiation)", "type": "ACTION", "action": "initiate_a", "actor": "Operator", "required_permissions": ["step:a"], "outputs": ["a_done"], "risk_level": "LOW", "failure_policy": "BLOCK"},
            {"id": "n2", "name": "Step B (Processing)", "type": "SERVICE", "action": "process_b", "actor": "Core Engine", "required_permissions": ["step:b"], "inputs": ["a_done", "c_done"], "outputs": ["b_done"], "preconditions": ["a_done == true"], "risk_level": "MEDIUM", "failure_policy": "BLOCK"},
            {"id": "n3", "name": "Step C (Verification)", "type": "VALIDATION", "action": "verify_c", "actor": "Security Service", "required_permissions": ["step:c"], "inputs": ["b_done"], "outputs": ["c_done"], "risk_level": "HIGH", "failure_policy": "BLOCK"},
            {"id": "n4", "name": "End", "type": "END", "action": "complete_workflow", "actor": "System", "risk_level": "LOW", "failure_policy": "BLOCK"},
        ],
        "edges": [
            {"id": "e0", "source": "n0", "target": "n1", "transition_type": "SEQUENTIAL"},
            {"id": "e1", "source": "n1", "target": "n2", "transition_type": "SEQUENTIAL"},
            {"id": "e2", "source": "n2", "target": "n3", "transition_type": "SEQUENTIAL"},
            {"id": "e3", "source": "n3", "target": "n2", "transition_type": "SEQUENTIAL", "label": "CIRCULAR LOOP (C -> B)"},
            {"id": "e4", "source": "n3", "target": "n4", "transition_type": "SEQUENTIAL"},
        ],
        "ambiguities": ["Circular Loop: State transition creates a circular deadlock (Step B -> Step C -> Step B)."],
    },
    "customer_onboarding": {
        "name": "Customer Onboarding Workflow",
        "description": "Enterprise customer onboarding with KYC, tier assignment, compliance approval, and activation.",
        "policy_text": "Perform customer KYC verification, assign account tier, obtain compliance signoff, and activate account.",
        "nodes": [
            {"id": "n0", "name": "Start", "type": "START", "action": "begin_workflow", "actor": "System", "risk_level": "LOW", "failure_policy": "BLOCK"},
            {"id": "n1", "name": "KYC Verification", "type": "VALIDATION", "action": "verify_kyc", "actor": "Identity Service", "required_permissions": ["kyc:verify"], "outputs": ["kyc_verified"], "risk_level": "MEDIUM", "failure_policy": "BLOCK", "is_critical": True, "description": "Verify customer identity and credentials."},
            {"id": "n2", "name": "Assign Account Tier", "type": "ACTION", "action": "assign_tier", "actor": "Risk Engine", "required_permissions": ["tier:assign"], "inputs": ["kyc_verified"], "outputs": ["tier_assigned"], "preconditions": ["kyc_verified == true"], "risk_level": "LOW", "failure_policy": "BLOCK", "description": "Assign account tier based on profile."},
            {"id": "n3", "name": "Compliance Approval", "type": "APPROVAL", "action": "approve_compliance", "actor": "Compliance Officer", "required_permissions": ["compliance:approve"], "inputs": ["tier_assigned"], "outputs": ["compliance_approved"], "preconditions": ["tier_assigned == true"], "risk_level": "HIGH", "failure_policy": "BLOCK", "is_critical": True, "description": "Compliance signoff required before activation."},
            {"id": "n4", "name": "Activate Account", "type": "SERVICE", "action": "activate_account", "actor": "Core Banking", "required_permissions": ["account:activate"], "inputs": ["compliance_approved"], "preconditions": ["compliance_approved == true"], "risk_level": "HIGH", "failure_policy": "RETRY", "retry_count": 2, "is_critical": True, "description": "Activate the customer account in core banking."},
            {"id": "n5", "name": "End", "type": "END", "action": "complete_workflow", "actor": "System", "risk_level": "LOW", "failure_policy": "BLOCK"},
        ],
        "edges": [
            {"id": "e0", "source": "n0", "target": "n1", "transition_type": "SEQUENTIAL"},
            {"id": "e1", "source": "n1", "target": "n2", "transition_type": "SEQUENTIAL", "required_state": "kyc_verified"},
            {"id": "e2", "source": "n2", "target": "n3", "transition_type": "SEQUENTIAL", "required_state": "tier_assigned"},
            {"id": "e3", "source": "n3", "target": "n4", "transition_type": "SEQUENTIAL", "required_state": "compliance_approved"},
            {"id": "e4", "source": "n4", "target": "n5", "transition_type": "SEQUENTIAL"},
        ],
        "ambiguities": [],
    },
}


def _detect_preset(policy_text: str) -> Optional[str]:
    """Detect if the input matches a known demo preset."""
    lower = policy_text.lower()
    if "circular" in lower or ("step a" in lower and "step b" in lower and "step c" in lower) or "a -> b -> c" in lower:
        return "circular_workflow"
    if "create" in lower and "ticket" in lower and "then" in lower and "approval" in lower:
        # Invalid procurement: ticket created before approval
        return "invalid_procurement"
    if any(kw in lower for kw in ["onboarding", "tier", "compliance signoff", "activate account"]):
        return "customer_onboarding"
    if any(kw in lower for kw in ["vendor", "procurement", "budget", "procurement ticket"]):
        return "procurement"
    if any(kw in lower for kw in ["refund", "kyc", "fraud", "customer identity"]):
        return "refund"
    if any(kw in lower for kw in ["employee", "provision", "system access", "employee identity"]):
        return "employee_access"
    return None


def _build_ir_from_preset(preset_key: str, policy_text: str) -> Tuple[WorkflowIR, List[str], float]:
    """Build a WorkflowIR from a preset definition."""
    preset = DEMO_PRESETS[preset_key]
    nodes = [WorkflowNode(**n) for n in preset["nodes"]]
    edges = [WorkflowEdge(**e) for e in preset["edges"]]
    metadata = WorkflowMetadata(
        domain=preset_key,
        policy_text=policy_text,
        parsed_by="mock",
        actors=list({n.actor for n in nodes if n.actor}),
        permissions=list({p for n in nodes for p in n.required_permissions}),
        ambiguities=preset["ambiguities"],
    )
    ir = WorkflowIR(
        id=str(uuid.uuid4()),
        name=preset["name"],
        description=preset["description"],
        nodes=nodes,
        edges=edges,
        metadata=metadata,
    )
    return ir, preset["ambiguities"], 0.97


# ── Heuristic Keyword Parser (fallback for unknown policies) ───────────────────

ACTION_KEYWORDS = {
    "verify": (NodeType.VALIDATION, RiskLevel.MEDIUM),
    "check": (NodeType.VALIDATION, RiskLevel.MEDIUM),
    "validate": (NodeType.VALIDATION, RiskLevel.MEDIUM),
    "approve": (NodeType.APPROVAL, RiskLevel.HIGH),
    "approval": (NodeType.APPROVAL, RiskLevel.HIGH),
    "review": (NodeType.HUMAN_REVIEW, RiskLevel.MEDIUM),
    "create": (NodeType.ACTION, RiskLevel.LOW),
    "generate": (NodeType.ACTION, RiskLevel.LOW),
    "send": (NodeType.ACTION, RiskLevel.LOW),
    "notify": (NodeType.ACTION, RiskLevel.LOW),
    "process": (NodeType.SERVICE, RiskLevel.MEDIUM),
    "execute": (NodeType.SERVICE, RiskLevel.HIGH),
    "run": (NodeType.SERVICE, RiskLevel.MEDIUM),
    "issue": (NodeType.ACTION, RiskLevel.HIGH),
    "provision": (NodeType.SERVICE, RiskLevel.HIGH),
    "detect": (NodeType.SERVICE, RiskLevel.HIGH),
    "perform": (NodeType.SERVICE, RiskLevel.MEDIUM),
    "obtain": (NodeType.APPROVAL, RiskLevel.HIGH),
}

AMBIGUOUS_TERMS = {
    "manager": "Role 'manager' is ambiguous — specify the exact role (e.g., Finance Manager, Department Manager).",
    "someone": "Actor 'someone' is not specified — assign a concrete role.",
    "appropriate": "Qualifier 'appropriate' is ambiguous — define the specific criteria.",
    "necessary": "Qualifier 'necessary' is undefined — specify required steps explicitly.",
    "if needed": "Conditional 'if needed' creates undefined branch — specify when the step is required.",
    "may": "Modal 'may' creates optional ambiguity — specify whether the step is mandatory.",
    "should": "Modal 'should' is ambiguous — replace with 'must' if mandatory.",
    "team": "Actor 'team' is not a specific role — assign a named role.",
}


def _heuristic_parse(policy_text: str) -> Tuple[WorkflowIR, List[str], float]:
    """Heuristic keyword-based parser for unknown policies."""
    ambiguities = []
    lower = policy_text.lower()

    # Detect ambiguous terms
    for term, msg in AMBIGUOUS_TERMS.items():
        if term in lower:
            ambiguities.append(msg)

    # Split on conjunctions, commas, periods
    raw_steps = re.split(r",\s*|\band\b|\bthen\b|\bafter\b|\bfinally\b|\bnext\b", policy_text, flags=re.IGNORECASE)
    raw_steps = [s.strip() for s in raw_steps if s.strip() and len(s.strip()) > 3]

    nodes: List[WorkflowNode] = []
    edges: List[WorkflowEdge] = []

    # START node
    start_id = "n0"
    nodes.append(WorkflowNode(
        id=start_id, name="Start", type=NodeType.START,
        action="begin_workflow", actor="System", risk_level=RiskLevel.LOW,
        failure_policy=FailurePolicy.BLOCK
    ))

    prev_id = start_id
    outputs_chain: List[str] = []

    for idx, step in enumerate(raw_steps):
        node_id = f"n{idx + 1}"
        step_lower = step.lower()

        # Determine node type from keywords
        node_type = NodeType.ACTION
        risk_level = RiskLevel.LOW
        for kw, (ntype, rlevel) in ACTION_KEYWORDS.items():
            if kw in step_lower:
                node_type = ntype
                risk_level = rlevel
                break

        # Build a clean name
        name = step.strip().capitalize()
        if len(name) > 40:
            name = name[:37] + "..."

        output_state = f"step_{idx + 1}_complete"
        input_state = outputs_chain[-1] if outputs_chain else None
        outputs_chain.append(output_state)

        node = WorkflowNode(
            id=node_id,
            name=name,
            type=node_type,
            action=step_lower.replace(" ", "_")[:50],
            actor="System",
            required_permissions=[f"{node_type.lower()}:execute"] if node_type != NodeType.ACTION else [],
            inputs=[input_state] if input_state else [],
            outputs=[output_state],
            preconditions=[f"{input_state} == true"] if input_state else [],
            postconditions=[f"{output_state} == true"],
            risk_level=risk_level,
            failure_policy=FailurePolicy.BLOCK if node_type == NodeType.APPROVAL else FailurePolicy.RETRY,
            is_critical=(node_type in [NodeType.APPROVAL, NodeType.VALIDATION]),
            description=step.strip(),
        )
        nodes.append(node)

        edge = WorkflowEdge(
            id=f"e{idx}",
            source=prev_id,
            target=node_id,
            transition_type=TransitionType.SEQUENTIAL,
            required_state=input_state,
        )
        edges.append(edge)
        prev_id = node_id

    # END node
    end_id = f"n{len(raw_steps) + 1}"
    nodes.append(WorkflowNode(
        id=end_id, name="End", type=NodeType.END,
        action="complete_workflow", actor="System", risk_level=RiskLevel.LOW,
        failure_policy=FailurePolicy.BLOCK
    ))
    edges.append(WorkflowEdge(
        id=f"e{len(raw_steps)}",
        source=prev_id, target=end_id,
        transition_type=TransitionType.SEQUENTIAL
    ))

    metadata = WorkflowMetadata(
        domain="custom",
        policy_text=policy_text,
        parsed_by="mock_heuristic",
        ambiguities=ambiguities,
    )

    workflow_name = " ".join(raw_steps[0].split()[:4]).capitalize() + " Workflow" if raw_steps else "Custom Workflow"
    ir = WorkflowIR(
        id=str(uuid.uuid4()),
        name=workflow_name,
        description=f"Workflow generated from policy: {policy_text[:100]}",
        nodes=nodes,
        edges=edges,
        metadata=metadata,
    )
    return ir, ambiguities, 0.72


# ── Gemini LLM Parser ──────────────────────────────────────────────────────────

GEMINI_SCHEMA_PROMPT = """
You are a workflow compiler. Parse the given natural language business policy into a structured workflow JSON.

Return ONLY valid JSON matching this schema exactly. No markdown, no explanation.

Schema:
{
  "name": "string (workflow name)",
  "description": "string",
  "nodes": [
    {
      "id": "string (n0, n1, n2...)",
      "name": "string",
      "type": "START|ACTION|CONDITION|APPROVAL|VALIDATION|SERVICE|HUMAN_REVIEW|END|FAILURE|RECOVERY",
      "action": "string (snake_case action name)",
      "actor": "string (role or system)",
      "required_permissions": ["string"],
      "inputs": ["string (state names required)"],
      "outputs": ["string (state names produced)"],
      "preconditions": ["string"],
      "postconditions": ["string"],
      "dependencies": ["string (node ids)"],
      "risk_level": "LOW|MEDIUM|HIGH|CRITICAL",
      "failure_policy": "BLOCK|RETRY|FALLBACK|IGNORE",
      "timeout_seconds": null,
      "retry_count": 0,
      "is_critical": false,
      "description": "string"
    }
  ],
  "edges": [
    {
      "id": "string (e0, e1, e2...)",
      "source": "string (node id)",
      "target": "string (node id)",
      "condition": null,
      "transition_type": "SEQUENTIAL|CONDITIONAL|PARALLEL|FALLBACK|ERROR",
      "required_state": "string or null",
      "label": "string or null"
    }
  ],
  "ambiguities": ["string (describe each ambiguity found)"]
}

Rules:
1. First node MUST be type START with id "n0"
2. Last node MUST be type END
3. Approval steps MUST be type APPROVAL with required_permissions including "approve"
4. Validation steps MUST be type VALIDATION
5. Identify ALL ambiguous roles, missing conditions, and undefined actors
6. Make dependencies explicit via preconditions and required_state on edges
7. Critical steps (approvals, financial) must have is_critical: true

Policy to parse:
"""


async def parse_with_gemini(policy_text: str, api_key: str) -> Tuple[WorkflowIR, List[str], float]:
    """Parse policy using Google Gemini API."""
    try:
        import httpx
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={api_key}"
        payload = {
            "contents": [{"parts": [{"text": GEMINI_SCHEMA_PROMPT + policy_text}]}],
            "generationConfig": {
                "temperature": 0.1,
                "maxOutputTokens": 4096,
                "responseMimeType": "application/json",
            }
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            data = response.json()

        raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
        raw_json = json.loads(raw_text)

        # Extract ambiguities before building IR
        ambiguities = raw_json.pop("ambiguities", [])

        # Normalize nodes / edges
        nodes = []
        for n in raw_json.get("nodes", []):
            n.setdefault("failure_policy", "BLOCK")
            n.setdefault("risk_level", "MEDIUM")
            n.setdefault("retry_count", 0)
            n.setdefault("is_critical", False)
            nodes.append(WorkflowNode(**{k: v for k, v in n.items() if v is not None or k in ["timeout_seconds"]}))

        edges = [WorkflowEdge(**e) for e in raw_json.get("edges", [])]

        metadata = WorkflowMetadata(
            domain="llm_generated",
            policy_text=policy_text,
            parsed_by="gemini",
            actors=list({n.actor for n in nodes if n.actor}),
            permissions=list({p for n in nodes for p in n.required_permissions}),
            ambiguities=ambiguities,
        )

        ir = WorkflowIR(
            id=str(uuid.uuid4()),
            name=raw_json.get("name", "Generated Workflow"),
            description=raw_json.get("description", ""),
            nodes=nodes,
            edges=edges,
            metadata=metadata,
        )
        return ir, ambiguities, 0.91

    except Exception as e:
        raise RuntimeError(f"Gemini parsing failed: {e}")


# ── Public API ─────────────────────────────────────────────────────────────────

async def parse_policy(
    policy_text: str,
    use_mock: bool = True,
    api_key: Optional[str] = None,
) -> Tuple[WorkflowIR, List[str], float, str]:
    """
    Parse a natural language policy into a WorkflowIR.
    Returns: (workflow_ir, ambiguities, confidence, parser_used)
    """
    # 1. Try Gemini if key provided and mock not forced
    if api_key and not use_mock:
        try:
            ir, ambiguities, confidence = await parse_with_gemini(policy_text, api_key)
            return ir, ambiguities, confidence, "gemini"
        except Exception:
            # Fall through to mock
            pass

    # 2. Try preset match
    preset_key = _detect_preset(policy_text)
    if preset_key:
        ir, ambiguities, confidence = _build_ir_from_preset(preset_key, policy_text)
        return ir, ambiguities, confidence, "mock_preset"

    # 3. Heuristic parse
    ir, ambiguities, confidence = _heuristic_parse(policy_text)
    return ir, ambiguities, confidence, "mock_heuristic"
