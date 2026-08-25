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


from httpx import AsyncClient, ASGITransport
from main import app
from app.database.connection import init_db

@pytest.mark.asyncio
async def test_execute_api_route_safe():
    await init_db()
    ir, _, _ = _build_ir_from_preset("procurement", DEMO_PRESETS["procurement"]["policy_text"])
    vresult = verify_workflow(ir)
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/workflows/execute", json={
            "workflow_id": ir.id,
            "workflow": ir.model_dump(mode="json"),
            "verification_result": vresult.model_dump(mode="json")
        })
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "COMPLETED"
        assert len(data["events"]) > 0

@pytest.mark.asyncio
async def test_execute_api_route_blocked_returns_403():
    await init_db()
    ir, _, _ = _build_ir_from_preset("case_3_approval_bypass", DEMO_PRESETS["case_3_approval_bypass"]["policy_text"])
    vresult = verify_workflow(ir)
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/workflows/execute", json={
            "workflow_id": ir.id,
            "workflow": ir.model_dump(mode="json"),
            "verification_result": vresult.model_dump(mode="json")
        })
        assert response.status_code == 403
        assert "BLOCKED" in response.json()["detail"]
