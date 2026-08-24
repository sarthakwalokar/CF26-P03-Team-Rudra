import pytest
from app.schemas.workflow import (
    WorkflowIR, WorkflowNode, WorkflowEdge, NodeType, RiskLevel,
    FailurePolicy, TransitionType
)
from app.simulation.attack import run_attack_suite, attack_approval_bypass, attack_unauthorized_actor

def create_procurement_workflow() -> WorkflowIR:
    nodes = [
        WorkflowNode(id="start", name="Start", type=NodeType.START, action="start", actor="User", outputs=["req"]),
        WorkflowNode(id="check", name="Check Budget", type=NodeType.VALIDATION, action="check", actor="System", preconditions=["req"], outputs=["ok"]),
        WorkflowNode(id="approval", name="Approval", type=NodeType.APPROVAL, action="approve", actor="Manager", preconditions=["ok"], outputs=["approved"]),
        WorkflowNode(id="execute", name="Create Order", type=NodeType.ACTION, action="order", actor="ERP", preconditions=["approved"], outputs=["po"]),
        WorkflowNode(id="end", name="End", type=NodeType.END, action="end", actor="System", preconditions=["po"])
    ]
    edges = [
        WorkflowEdge(id="e1", source="start", target="check"),
        WorkflowEdge(id="e2", source="check", target="approval"),
        WorkflowEdge(id="e3", source="approval", target="execute"),
        WorkflowEdge(id="e4", source="execute", target="end")
    ]
    return WorkflowIR(name="Procurement Flow", description="Test Flow", version="1.0.0", nodes=nodes, edges=edges)

def test_attack_approval_bypass():
    wf = create_procurement_workflow()
    finding = attack_approval_bypass(wf)
    assert finding is None or hasattr(finding, "attack_type")

def test_attack_unauthorized_actor():
    wf = create_procurement_workflow()
    finding = attack_unauthorized_actor(wf)
    assert finding is None or hasattr(finding, "attack_type")

def test_attack_suite_comprehensive():
    wf = create_procurement_workflow()
    suite_result = run_attack_suite(wf)

    assert suite_result.scenarios_run >= 8
    assert suite_result.overall_security_score >= 0
    assert hasattr(suite_result, "findings")
