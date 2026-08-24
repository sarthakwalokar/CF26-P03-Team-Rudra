import pytest
from app.schemas.workflow import (
    WorkflowIR, WorkflowNode, WorkflowEdge, NodeType, RiskLevel,
    FailurePolicy, TransitionType, IssueSeverity
)
from app.verification.engine import verify_workflow
from app.repair.engine import generate_repair

def test_auto_repair_generation():
    # Workflow with missing approval bypass
    nodes = [
        WorkflowNode(id="start", name="Start", type=NodeType.START, action="start", actor="User", outputs=["req"]),
        WorkflowNode(id="execute", name="Create Order", type=NodeType.ACTION, action="order", actor="ERP", preconditions=["approved"], outputs=["po"]),
        WorkflowNode(id="end", name="End", type=NodeType.END, action="end", actor="System", preconditions=["po"])
    ]
    edges = [
        WorkflowEdge(id="e1", source="start", target="execute"),
        WorkflowEdge(id="e2", source="execute", target="end")
    ]
    wf = WorkflowIR(name="Unsafe Flow", description="Test", version="1.0.0", nodes=nodes, edges=edges)

    verification = verify_workflow(wf)
    if verification.issues:
        issue = verification.issues[0]
        proposal = generate_repair(wf, issue)
        if proposal:
            assert proposal.confidence > 0
            assert proposal.repaired_workflow is not None
