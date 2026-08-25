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

def test_all_six_benchmark_presets():
    from app.services.parser import DEMO_PRESETS, _build_ir_from_preset

    # Case 1: Safe
    ir1, _, _ = _build_ir_from_preset("procurement", DEMO_PRESETS["procurement"]["policy_text"])
    res1 = verify_workflow(ir1)
    assert res1.status in [VerificationStatus.SAFE, VerificationStatus.WARNING]
    assert res1.score >= 85.0

    # Case 2: Ambiguous
    ir2, _, _ = _build_ir_from_preset("case_2_ambiguous", DEMO_PRESETS["case_2_ambiguous"]["policy_text"])
    res2 = verify_workflow(ir2)
    assert res2.status == VerificationStatus.BLOCKED
    assert any("appropriate" in i.message.lower() or "ambiguity" in i.title.lower() for i in res2.issues + res2.warnings)

    # Case 3: Approval Bypass
    ir3, _, _ = _build_ir_from_preset("case_3_approval_bypass", DEMO_PRESETS["case_3_approval_bypass"]["policy_text"])
    res3 = verify_workflow(ir3)
    assert res3.status == VerificationStatus.BLOCKED
    assert any("ordering" in i.title.lower() or "bypass" in i.message.lower() or "precondition" in i.title.lower() for i in res3.issues + res3.warnings)

    # Case 4: Unauthorized Actor
    ir4, _, _ = _build_ir_from_preset("case_4_unauthorized_actor", DEMO_PRESETS["case_4_unauthorized_actor"]["policy_text"])
    res4 = verify_workflow(ir4)
    assert res4.status == VerificationStatus.BLOCKED
    assert any("unauthorized" in i.title.lower() or "separation of duties" in i.message.lower() for i in res4.issues)

    # Case 5: Circular Workflow
    ir5, _, _ = _build_ir_from_preset("case_5_circular", DEMO_PRESETS["case_5_circular"]["policy_text"])
    res5 = verify_workflow(ir5)
    assert res5.status == VerificationStatus.BLOCKED
    assert any("circular" in i.title.lower() or "cycle" in i.title.lower() for i in res5.issues)

    # Case 6: Unreachable State
    ir6, _, _ = _build_ir_from_preset("case_6_unreachable", DEMO_PRESETS["case_6_unreachable"]["policy_text"])
    res6 = verify_workflow(ir6)
    assert res6.status == VerificationStatus.BLOCKED
    assert any("unreachable" in i.title.lower() for i in res6.issues)

