import pytest
from app.schemas.workflow import (
    WorkflowIR, WorkflowNode, WorkflowEdge, NodeType, RiskLevel,
    FailurePolicy, TransitionType, VerificationStatus
)
from app.verification.engine import verify_workflow

def create_sample_valid_workflow() -> WorkflowIR:
    nodes = [
        WorkflowNode(
            id="start",
            name="Initiate Procurement",
            type=NodeType.START,
            action="initiate_procurement",
            actor="Requester",
            outputs=["procurement_request"],
            is_critical=False,
            risk_level=RiskLevel.LOW,
            failure_policy=FailurePolicy.BLOCK,
            retry_count=0
        ),
        WorkflowNode(
            id="budget_check",
            name="Verify Budget Availability",
            type=NodeType.VALIDATION,
            action="check_budget",
            actor="Finance Service",
            preconditions=["procurement_request"],
            outputs=["budget_verified"],
            is_critical=True,
            risk_level=RiskLevel.MEDIUM,
            failure_policy=FailurePolicy.BLOCK,
            retry_count=2
        ),
        WorkflowNode(
            id="finance_approval",
            name="Finance Director Approval",
            type=NodeType.APPROVAL,
            action="approve_budget",
            actor="Finance Director",
            required_permissions=["FINANCE_APPROVER"],
            preconditions=["budget_verified"],
            outputs=["finance_approved"],
            is_critical=True,
            risk_level=RiskLevel.HIGH,
            failure_policy=FailurePolicy.BLOCK,
            retry_count=0
        ),
        WorkflowNode(
            id="po_creation",
            name="Generate Purchase Order",
            type=NodeType.ACTION,
            action="create_po",
            actor="ERP Service",
            preconditions=["finance_approved"],
            outputs=["po_number"],
            is_critical=True,
            risk_level=RiskLevel.MEDIUM,
            failure_policy=FailurePolicy.RETRY,
            retry_count=3
        ),
        WorkflowNode(
            id="end",
            name="Procurement Completed",
            type=NodeType.END,
            action="notify_parties",
            actor="Notification Service",
            preconditions=["po_number"],
            outputs=[],
            is_critical=False,
            risk_level=RiskLevel.LOW,
            failure_policy=FailurePolicy.IGNORE,
            retry_count=0
        ),
    ]

    edges = [
        WorkflowEdge(id="e1", source="start", target="budget_check", transition_type=TransitionType.SEQUENTIAL),
        WorkflowEdge(id="e2", source="budget_check", target="finance_approval", transition_type=TransitionType.SEQUENTIAL),
        WorkflowEdge(id="e3", source="finance_approval", target="po_creation", transition_type=TransitionType.SEQUENTIAL),
        WorkflowEdge(id="e4", source="po_creation", target="end", transition_type=TransitionType.SEQUENTIAL),
    ]

    return WorkflowIR(
        name="Enterprise Procurement Approval",
        description="Standard verified procurement workflow",
        version="1.0.0",
        nodes=nodes,
        edges=edges
    )

def test_valid_workflow_verification():
    wf = create_sample_valid_workflow()
    result = verify_workflow(wf)

    assert result.status in [VerificationStatus.SAFE, VerificationStatus.WARNING]
    assert result.score >= 80.0
    assert len(result.issues) == 0

def test_unreachable_node_detection():
    wf = create_sample_valid_workflow()
    orphan = WorkflowNode(
        id="orphan_node",
        name="Orphaned Audit Task",
        type=NodeType.ACTION,
        action="orphan_audit",
        actor="Auditor",
        is_critical=False,
        risk_level=RiskLevel.LOW,
        failure_policy=FailurePolicy.IGNORE,
        retry_count=0
    )
    wf.nodes.append(orphan)

    result = verify_workflow(wf)
    all_issues = result.issues + result.warnings
    unreached = [i for i in all_issues if "unreachable" in i.title.lower() or "connectivity" in i.title.lower() or "orphan" in i.title.lower() or "reachability" in i.title.lower()]
    assert len(unreached) > 0 or result.score < 90

def test_circular_dependency_detection():
    wf = create_sample_valid_workflow()
    cycle_edge = WorkflowEdge(id="e_cycle", source="po_creation", target="budget_check", transition_type=TransitionType.SEQUENTIAL)
    wf.edges.append(cycle_edge)

    result = verify_workflow(wf)
    assert result.status == VerificationStatus.BLOCKED or result.score < 70
    cycle_issues = [i for i in result.issues if "cycle" in i.title.lower() or "circular" in i.title.lower() or "loop" in i.title.lower()]
    assert len(cycle_issues) > 0

def test_missing_approval_bypass_detection():
    wf = create_sample_valid_workflow()
    bypass_edge = WorkflowEdge(id="e_bypass", source="start", target="po_creation", transition_type=TransitionType.SEQUENTIAL)
    wf.edges.append(bypass_edge)

    result = verify_workflow(wf)
    bypass_findings = [i for i in result.issues + result.warnings if "bypass" in i.title.lower() or "approval" in i.title.lower() or "precondition" in i.title.lower()]
    assert len(bypass_findings) > 0
