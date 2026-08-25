import pytest
from app.schemas.workflow import (
    WorkflowIR, WorkflowNode, WorkflowEdge, NodeType, RiskLevel,
    FailurePolicy, TransitionType, VerificationStatus
)
from app.verification.engine import verify_workflow
from app.execution.engine import execute_workflow, ExecutionBlockedError
from app.services.parser import DEMO_PRESETS, _build_ir_from_preset

@pytest.mark.asyncio
async def test_safe_workflow_execution():
    # Case 1: Procurement (Safe)
    ir, _, _ = _build_ir_from_preset("procurement", DEMO_PRESETS["procurement"]["policy_text"])
    vresult = verify_workflow(ir)
    assert vresult.status in [VerificationStatus.SAFE, VerificationStatus.WARNING]

    run = await execute_workflow(ir, vresult)
    assert run.status == "COMPLETED"
    assert len(run.events) > 0
    assert run.duration_ms >= 0

@pytest.mark.asyncio
async def test_blocked_workflow_execution_gated():
    # Case 3: Approval Bypass (Blocked)
    ir, _, _ = _build_ir_from_preset("case_3_approval_bypass", DEMO_PRESETS["case_3_approval_bypass"]["policy_text"])
    vresult = verify_workflow(ir)
    assert vresult.status == VerificationStatus.BLOCKED

    # Must raise ExecutionBlockedError
    with pytest.raises(ExecutionBlockedError) as exc_info:
        await execute_workflow(ir, vresult)
    assert "BLOCKED" in str(exc_info.value)
