"""
FlowGuard AI — Workflow API Routes
All workflow lifecycle endpoints: generate, verify, attack, repair, simulate, stress-test, execute.
"""
import json
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc

from app.database.connection import get_db
from app.models.workflow import WorkflowModel, VerificationRunModel, AttackRunModel, StressTestRunModel
from app.schemas.workflow import (
    WorkflowIR, GenerateWorkflowRequest, GenerateWorkflowResponse,
    VerifyWorkflowRequest, VerificationResult,
    AttackWorkflowRequest, AttackResult,
    RepairWorkflowRequest, RepairProposal,
    SimulateRequest, SimulationResult,
    StressTestRequest, StressTestResult,
    ExecuteWorkflowRequest, ExecutionRun,
    AuditEventType, WorkflowStatus,
)
from app.services.parser import parse_policy
from app.verification.engine import verify_workflow
from app.simulation.attack import run_attack_suite
from app.repair.engine import generate_repair
from app.simulation.whatif import run_simulation
from app.simulation.stress import run_stress_test
from app.execution.engine import execute_workflow, ExecutionBlockedError
from app.services.audit import log_event

router = APIRouter()


def _ir_to_model(ir: WorkflowIR) -> WorkflowModel:
    return WorkflowModel(
        id=ir.id,
        name=ir.name,
        description=ir.description,
        version=ir.version,
        status=ir.status.value,
        risk_score=ir.risk_score,
        ir_json=ir.model_dump_json(),
        created_at=ir.created_at,
        updated_at=ir.updated_at,
    )


# ── GET /api/workflows/ ────────────────────────────────────────────────────────

@router.get("/", response_model=List[dict])
async def list_workflows(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(WorkflowModel).order_by(desc(WorkflowModel.updated_at)).limit(50)
    )
    workflows = result.scalars().all()
    return [
        {
            "id": w.id,
            "name": w.name,
            "description": w.description,
            "version": w.version,
            "status": w.status,
            "risk_score": w.risk_score,
            "created_at": w.created_at.isoformat() if w.created_at else None,
            "updated_at": w.updated_at.isoformat() if w.updated_at else None,
        }
        for w in workflows
    ]


# ── GET /api/workflows/{id} ────────────────────────────────────────────────────

@router.get("/{workflow_id}", response_model=WorkflowIR)
async def get_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WorkflowModel).where(WorkflowModel.id == workflow_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail=f"Workflow {workflow_id} not found")
    return WorkflowIR.model_validate_json(row.ir_json)


# ── POST /api/workflows/generate ──────────────────────────────────────────────

@router.post("/generate", response_model=GenerateWorkflowResponse)
async def generate_workflow(
    request: GenerateWorkflowRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        ir, ambiguities, confidence, parser_used = await parse_policy(
            policy_text=request.policy_text,
            use_mock=request.use_mock,
            api_key=request.api_key,
        )
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Policy parsing failed: {str(e)}")

    if request.name:
        ir.name = request.name

    # Save to DB
    model = _ir_to_model(ir)
    db.add(model)
    await db.flush()

    await log_event(db, ir.id, AuditEventType.WORKFLOW_CREATED,
                    f"Workflow '{ir.name}' created",
                    details={"nodes": len(ir.nodes), "edges": len(ir.edges), "parsed_by": parser_used})
    await log_event(db, ir.id, AuditEventType.WORKFLOW_PARSED,
                    f"Policy parsed by '{parser_used}' with {len(ambiguities)} ambiguities",
                    details={"confidence": confidence, "parser": parser_used, "ambiguities": ambiguities})

    return GenerateWorkflowResponse(
        workflow=ir,
        ambiguities=ambiguities,
        parse_confidence=confidence,
        parsed_by=parser_used,
    )


# ── POST /api/workflows/verify ────────────────────────────────────────────────

@router.post("/verify", response_model=VerificationResult)
async def verify(
    request: VerifyWorkflowRequest,
    db: AsyncSession = Depends(get_db),
):
    workflow = request.workflow
    await log_event(db, workflow.id, AuditEventType.VERIFICATION_STARTED,
                    f"Verification started for '{workflow.name}'")

    result = verify_workflow(workflow)

    # Update workflow status in DB
    db_result = await db.execute(select(WorkflowModel).where(WorkflowModel.id == workflow.id))
    row = db_result.scalar_one_or_none()
    if row:
        status_map = {"SAFE": WorkflowStatus.VERIFIED, "WARNING": WorkflowStatus.WARNING, "BLOCKED": WorkflowStatus.BLOCKED}
        row.status = status_map.get(result.status.value, WorkflowStatus.DRAFT).value
        row.risk_score = result.score
        row.updated_at = datetime.utcnow()
        updated_ir = WorkflowIR.model_validate_json(row.ir_json)
        updated_ir.status = status_map.get(result.status.value, WorkflowStatus.DRAFT)
        updated_ir.risk_score = result.score
        row.ir_json = updated_ir.model_dump_json()

    # Save verification run
    vrun = VerificationRunModel(
        id=str(uuid.uuid4()),
        workflow_id=workflow.id,
        status=result.status.value,
        score=result.score,
        dimension_scores_json=json.dumps(result.dimension_scores.model_dump()),
        issues_json=json.dumps([i.model_dump() for i in result.issues + result.warnings]),
        passed_checks_json=json.dumps(result.passed_checks),
        failed_checks_json=json.dumps(result.failed_checks),
        verified_at=result.verified_at,
    )
    db.add(vrun)

    severity = "CRITICAL" if result.status.value == "BLOCKED" else ("WARNING" if result.status.value == "WARNING" else "INFO")
    event_type = AuditEventType.VERIFICATION_FAILED if result.status.value == "BLOCKED" else AuditEventType.VERIFICATION_PASSED
    await log_event(db, workflow.id, event_type,
                    f"Verification {result.status.value}: score {result.score:.1f}/100 — {len(result.issues)} critical, {len(result.warnings)} warnings",
                    details={"score": result.score, "status": result.status.value,
                             "critical_count": len(result.issues), "warning_count": len(result.warnings)},
                    severity=severity)

    return result


# ── POST /api/workflows/attack ────────────────────────────────────────────────

@router.post("/attack", response_model=AttackResult)
async def attack(
    request: AttackWorkflowRequest,
    db: AsyncSession = Depends(get_db),
):
    workflow = request.workflow
    await log_event(db, workflow.id, AuditEventType.ATTACK_STARTED,
                    f"Attack suite started for '{workflow.name}'",
                    details={"attack_types": [t.value for t in (request.attack_types or [])],
                             "all_attacks": request.attack_types is None})

    result = run_attack_suite(workflow, request.attack_types)

    # Save attack run
    arun = AttackRunModel(
        id=str(uuid.uuid4()),
        workflow_id=workflow.id,
        scenarios_run=result.scenarios_run,
        vulnerabilities_found=result.vulnerabilities_found,
        critical_count=result.critical_count,
        findings_json=json.dumps([f.model_dump() for f in result.findings]),
        overall_security_score=result.overall_security_score,
        attacked_at=result.attacked_at,
    )
    db.add(arun)

    for finding in result.findings:
        severity = "CRITICAL" if finding.severity.value == "CRITICAL" else "WARNING"
        await log_event(db, workflow.id, AuditEventType.VULNERABILITY_FOUND,
                        f"Vulnerability found: {finding.title}",
                        details={"attack_type": finding.attack_type.value, "severity": finding.severity.value},
                        severity=severity)

    return result


# ── POST /api/workflows/repair ────────────────────────────────────────────────

@router.post("/repair", response_model=Optional[RepairProposal])
async def repair(
    request: RepairWorkflowRequest,
    db: AsyncSession = Depends(get_db),
):
    workflow = request.workflow
    issue = request.issue

    proposal = generate_repair(workflow, issue)
    if not proposal:
        raise HTTPException(status_code=422, detail=f"Could not generate repair for issue: {issue.check_name}")

    await log_event(db, workflow.id, AuditEventType.REPAIR_PROPOSED,
                    f"Repair proposed: {proposal.title}",
                    details={"steps": len(proposal.steps), "issue": issue.check_name})

    if proposal.verification_result:
        await log_event(db, workflow.id, AuditEventType.REPAIR_APPLIED,
                        f"Repair re-verified: {proposal.verification_result.status.value}",
                        details={"post_repair_score": proposal.verification_result.score,
                                 "post_repair_status": proposal.verification_result.status.value})

    return proposal


# ── POST /api/workflows/simulate ─────────────────────────────────────────────

@router.post("/simulate", response_model=SimulationResult)
async def simulate(
    request: SimulateRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        result = run_simulation(request.workflow, request.scenario_type, request.affected_node_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    await log_event(db, request.workflow.id, AuditEventType.SIMULATION_RUN,
                    f"What-If simulation: {request.scenario_type}",
                    details={"outcome": result.scenario.outcome, "can_continue": result.can_continue,
                             "affected_node": request.affected_node_id})
    return result


# ── POST /api/workflows/stress-test ──────────────────────────────────────────

@router.post("/stress-test", response_model=StressTestResult)
async def stress_test(
    request: StressTestRequest,
    db: AsyncSession = Depends(get_db),
):
    result = run_stress_test(request.workflow, request.config)

    strun = StressTestRunModel(
        id=str(uuid.uuid4()),
        workflow_id=request.workflow.id,
        total=result.total,
        passed=result.passed,
        failed=result.failed,
        critical_failures=result.critical_failures,
        warnings=result.warnings,
        robustness_score=result.robustness_score,
        breakdown_json=json.dumps(result.scenario_breakdown),
        completed_at=result.completed_at,
    )
    db.add(strun)

    await log_event(db, request.workflow.id, AuditEventType.STRESS_TEST_RUN,
                    f"Stress test: {result.total} scenarios, {result.robustness_score:.2f}% robustness",
                    details={"total": result.total, "passed": result.passed, "failed": result.failed,
                             "robustness_score": result.robustness_score})
    return result


# ── POST /api/workflows/execute ──────────────────────────────────────────────

@router.post("/execute", response_model=ExecutionRun)
async def execute(
    request: ExecuteWorkflowRequest,
    db: AsyncSession = Depends(get_db),
):
    if request.verification_result.status.value == "BLOCKED":
        await log_event(db, request.workflow_id, AuditEventType.EXECUTION_BLOCKED,
                        f"Execution BLOCKED — workflow not verified",
                        severity="CRITICAL")
        raise HTTPException(
            status_code=403,
            detail="Execution BLOCKED: Workflow has unresolved critical verification failures."
        )

    await log_event(db, request.workflow_id, AuditEventType.EXECUTION_STARTED,
                    f"Execution started for '{request.workflow.name}'",
                    details={"verification_score": request.verification_result.score})

    try:
        run = await execute_workflow(request.workflow, request.verification_result)
    except ExecutionBlockedError as e:
        await log_event(db, request.workflow_id, AuditEventType.EXECUTION_BLOCKED,
                        str(e), severity="CRITICAL")
        raise HTTPException(status_code=403, detail=str(e))
    except Exception as e:
        await log_event(db, request.workflow_id, AuditEventType.EXECUTION_FAILED,
                        f"Execution error: {str(e)}", severity="CRITICAL")
        raise HTTPException(status_code=500, detail=f"Execution error: {str(e)}")

    event_type = AuditEventType.EXECUTION_COMPLETED if run.status == "COMPLETED" else AuditEventType.EXECUTION_FAILED
    severity = "INFO" if run.status == "COMPLETED" else "CRITICAL"
    await log_event(db, request.workflow_id, event_type,
                    f"Execution {run.status}: {len(run.events)} events, {run.duration_ms}ms",
                    details={"status": run.status, "duration_ms": run.duration_ms,
                             "events": len(run.events)},
                    severity=severity)
    return run


# ── DELETE /api/workflows/{id} ───────────────────────────────────────────────

@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(WorkflowModel).where(WorkflowModel.id == workflow_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Workflow not found")
    await db.delete(row)
    return {"deleted": True}
