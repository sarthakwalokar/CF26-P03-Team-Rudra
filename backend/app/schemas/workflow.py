"""
Workflow IR (Intermediate Representation) Pydantic Schemas
This is the core typed data model — the source of truth for the entire system.
"""
from __future__ import annotations
from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator
import uuid


# ── Enumerations ──────────────────────────────────────────────────────────────

class NodeType(str, Enum):
    START = "START"
    ACTION = "ACTION"
    CONDITION = "CONDITION"
    APPROVAL = "APPROVAL"
    VALIDATION = "VALIDATION"
    SERVICE = "SERVICE"
    HUMAN_REVIEW = "HUMAN_REVIEW"
    END = "END"
    FAILURE = "FAILURE"
    RECOVERY = "RECOVERY"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class FailurePolicy(str, Enum):
    BLOCK = "BLOCK"
    RETRY = "RETRY"
    FALLBACK = "FALLBACK"
    IGNORE = "IGNORE"


class TransitionType(str, Enum):
    SEQUENTIAL = "SEQUENTIAL"
    CONDITIONAL = "CONDITIONAL"
    PARALLEL = "PARALLEL"
    FALLBACK = "FALLBACK"
    ERROR = "ERROR"


class WorkflowStatus(str, Enum):
    DRAFT = "DRAFT"
    PARSING = "PARSING"
    VERIFIED = "VERIFIED"
    WARNING = "WARNING"
    BLOCKED = "BLOCKED"
    EXECUTING = "EXECUTING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class VerificationStatus(str, Enum):
    SAFE = "SAFE"
    WARNING = "WARNING"
    BLOCKED = "BLOCKED"


class IssueSeverity(str, Enum):
    CRITICAL = "CRITICAL"
    WARNING = "WARNING"
    INFO = "INFO"


# ── Core IR Models ─────────────────────────────────────────────────────────────

class WorkflowNode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str
    type: NodeType
    action: str
    actor: str = ""
    required_permissions: List[str] = Field(default_factory=list)
    inputs: List[str] = Field(default_factory=list)
    outputs: List[str] = Field(default_factory=list)
    preconditions: List[str] = Field(default_factory=list)
    postconditions: List[str] = Field(default_factory=list)
    dependencies: List[str] = Field(default_factory=list)
    risk_level: RiskLevel = RiskLevel.LOW
    failure_policy: FailurePolicy = FailurePolicy.BLOCK
    timeout_seconds: Optional[int] = None
    retry_count: int = 0
    is_critical: bool = False
    description: str = ""
    position: Optional[Dict[str, float]] = None  # x, y for visualization


class WorkflowEdge(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    source: str
    target: str
    condition: Optional[str] = None
    transition_type: TransitionType = TransitionType.SEQUENTIAL
    required_state: Optional[str] = None
    label: Optional[str] = None
    is_critical: bool = False


class WorkflowMetadata(BaseModel):
    domain: str = ""
    policy_text: str = ""
    parsed_by: str = "mock"  # "mock" | "llm"
    tags: List[str] = Field(default_factory=list)
    actors: List[str] = Field(default_factory=list)
    permissions: List[str] = Field(default_factory=list)
    ambiguities: List[str] = Field(default_factory=list)


class WorkflowIR(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str = ""
    version: str = "1.0.0"
    status: WorkflowStatus = WorkflowStatus.DRAFT
    risk_score: float = 0.0
    nodes: List[WorkflowNode]
    edges: List[WorkflowEdge]
    metadata: WorkflowMetadata = Field(default_factory=WorkflowMetadata)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    @field_validator("nodes")
    @classmethod
    def must_have_start_end(cls, nodes: List[WorkflowNode]) -> List[WorkflowNode]:
        types = {n.type for n in nodes}
        if NodeType.START not in types:
            raise ValueError("Workflow must have a START node")
        if NodeType.END not in types:
            raise ValueError("Workflow must have an END node")
        return nodes

    def get_node(self, node_id: str) -> Optional[WorkflowNode]:
        return next((n for n in self.nodes if n.id == node_id), None)

    def get_edges_from(self, node_id: str) -> List[WorkflowEdge]:
        return [e for e in self.edges if e.source == node_id]

    def get_edges_to(self, node_id: str) -> List[WorkflowEdge]:
        return [e for e in self.edges if e.target == node_id]


# ── Verification Models ────────────────────────────────────────────────────────

class VerificationIssue(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    check_name: str
    severity: IssueSeverity
    title: str
    message: str
    affected_nodes: List[str] = Field(default_factory=list)
    affected_edges: List[str] = Field(default_factory=list)
    rule_violated: str = ""
    suggestion: str = ""


class DimensionScores(BaseModel):
    security: float = 100.0
    correctness: float = 100.0
    authorization: float = 100.0
    reliability: float = 100.0
    ambiguity: float = 100.0


class VerificationResult(BaseModel):
    workflow_id: str
    status: VerificationStatus
    score: float
    dimension_scores: DimensionScores
    issues: List[VerificationIssue] = Field(default_factory=list)
    warnings: List[VerificationIssue] = Field(default_factory=list)
    passed_checks: List[str] = Field(default_factory=list)
    failed_checks: List[str] = Field(default_factory=list)
    affected_nodes: List[str] = Field(default_factory=list)
    affected_edges: List[str] = Field(default_factory=list)
    repair_suggestions: List[str] = Field(default_factory=list)
    verified_at: datetime = Field(default_factory=datetime.utcnow)


# ── Attack Models ──────────────────────────────────────────────────────────────

class AttackType(str, Enum):
    APPROVAL_BYPASS = "APPROVAL_BYPASS"
    UNAUTHORIZED_ACTOR = "UNAUTHORIZED_ACTOR"
    MISSING_DEPENDENCY = "MISSING_DEPENDENCY"
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE"
    TIMEOUT = "TIMEOUT"
    SERVICE_TIMEOUT = "SERVICE_TIMEOUT"
    DUPLICATE_ACTION = "DUPLICATE_ACTION"
    DUPLICATE_EXECUTION = "DUPLICATE_EXECUTION"
    INVALID_STATE = "INVALID_STATE"
    FAILED_PREREQUISITE = "FAILED_PREREQUISITE"
    DEPENDENCY_FAILURE = "DEPENDENCY_FAILURE"
    INVALID_INPUT = "INVALID_INPUT"
    MISSING_APPROVAL = "MISSING_APPROVAL"
    INVALID_TRANSITION = "INVALID_TRANSITION"
    RECOVERY_FAILURE = "RECOVERY_FAILURE"


class AttackFinding(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    attack_type: AttackType
    severity: IssueSeverity
    title: str
    description: str
    attack_path: List[str] = Field(default_factory=list)
    affected_nodes: List[str] = Field(default_factory=list)
    affected_edges: List[str] = Field(default_factory=list)
    exploit_scenario: str = ""
    mitigation: str = ""


class AttackResult(BaseModel):
    workflow_id: str
    scenarios_run: int
    vulnerabilities_found: int
    critical_count: int
    warning_count: int
    findings: List[AttackFinding] = Field(default_factory=list)
    overall_security_score: float
    attacked_at: datetime = Field(default_factory=datetime.utcnow)


# ── Repair Models ──────────────────────────────────────────────────────────────

class RepairAction(str, Enum):
    ADD_NODE = "ADD_NODE"
    REMOVE_EDGE = "REMOVE_EDGE"
    ADD_EDGE = "ADD_EDGE"
    REORDER = "REORDER"
    ADD_PERMISSION = "ADD_PERMISSION"
    ADD_FAILURE_PATH = "ADD_FAILURE_PATH"
    CLARIFY_ACTOR = "CLARIFY_ACTOR"


class RepairStep(BaseModel):
    action: RepairAction
    description: str
    node_id: Optional[str] = None
    edge_id: Optional[str] = None
    new_node: Optional[WorkflowNode] = None
    new_edge: Optional[WorkflowEdge] = None


class RepairProposal(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    issue_id: str
    title: str
    description: str
    steps: List[RepairStep]
    original_workflow: WorkflowIR
    repaired_workflow: WorkflowIR
    verification_result: Optional[VerificationResult] = None
    proposed_at: datetime = Field(default_factory=datetime.utcnow)


# ── Simulation Models ──────────────────────────────────────────────────────────

class SimulationScenario(BaseModel):
    scenario_type: str  # "service_unavailable" | "timeout" | "approval_rejected" | etc.
    affected_node_id: str
    description: str
    fallback_available: bool = False
    fallback_path: List[str] = Field(default_factory=list)
    outcome: str = ""  # "CONTINUE" | "BLOCKED" | "FALLBACK"


class SimulationResult(BaseModel):
    workflow_id: str
    scenario: SimulationScenario
    modified_workflow: WorkflowIR
    verification_result: VerificationResult
    can_continue: bool
    explanation: str
    simulated_at: datetime = Field(default_factory=datetime.utcnow)


# ── Stress Test Models ─────────────────────────────────────────────────────────

class StressTestConfig(BaseModel):
    total_scenarios: int = Field(default=1000, ge=100, le=10000)
    scenario_mix: Dict[str, float] = Field(default_factory=lambda: {
        "normal": 0.40,
        "missing_input": 0.10,
        "failed_service": 0.15,
        "timeout": 0.10,
        "approval_rejection": 0.10,
        "dependency_failure": 0.05,
        "invalid_state": 0.05,
        "retry": 0.03,
        "recovery": 0.02,
    })


class StressTestResult(BaseModel):
    workflow_id: str
    total: int
    passed: int
    failed: int
    critical_failures: int
    warnings: int
    robustness_score: float
    scenario_breakdown: Dict[str, Dict[str, int]]
    completed_at: datetime = Field(default_factory=datetime.utcnow)


# ── Execution Models ───────────────────────────────────────────────────────────

class ExecutionEventType(str, Enum):
    STARTED = "STARTED"
    NODE_ENTER = "NODE_ENTER"
    NODE_COMPLETE = "NODE_COMPLETE"
    NODE_FAILED = "NODE_FAILED"
    NODE_RETRY = "NODE_RETRY"
    NODE_SKIPPED = "NODE_SKIPPED"
    FALLBACK_TRIGGERED = "FALLBACK_TRIGGERED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    BLOCKED = "BLOCKED"


class ExecutionEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    run_id: str
    node_id: Optional[str] = None
    node_name: Optional[str] = None
    event_type: ExecutionEventType
    message: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    duration_ms: Optional[int] = None
    metadata: Dict[str, Any] = Field(default_factory=dict)


class NodeExecutionState(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"
    RETRYING = "RETRYING"


class ExecutionRun(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    workflow_id: str
    status: str = "PENDING"
    node_states: Dict[str, NodeExecutionState] = Field(default_factory=dict)
    events: List[ExecutionEvent] = Field(default_factory=list)
    current_node_id: Optional[str] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    duration_ms: Optional[int] = None


# ── API Request/Response Models ────────────────────────────────────────────────

class GenerateWorkflowRequest(BaseModel):
    policy_text: str = Field(..., min_length=10, max_length=2000)
    use_mock: bool = True
    api_key: Optional[str] = None
    name: Optional[str] = None


class GenerateWorkflowResponse(BaseModel):
    workflow: WorkflowIR
    ambiguities: List[str]
    parse_confidence: float
    parsed_by: str


class VerifyWorkflowRequest(BaseModel):
    workflow: WorkflowIR


class AttackWorkflowRequest(BaseModel):
    workflow: WorkflowIR
    attack_types: Optional[List[AttackType]] = None  # None = all


class RepairWorkflowRequest(BaseModel):
    workflow: WorkflowIR
    issue_id: str
    issue: VerificationIssue


class SimulateRequest(BaseModel):
    workflow: WorkflowIR
    scenario_type: str
    affected_node_id: str


class StressTestRequest(BaseModel):
    workflow: WorkflowIR
    config: StressTestConfig = Field(default_factory=StressTestConfig)


class ExecuteWorkflowRequest(BaseModel):
    workflow_id: str
    workflow: WorkflowIR
    verification_result: VerificationResult


# ── Audit Models ──────────────────────────────────────────────────────────────

class AuditEventType(str, Enum):
    WORKFLOW_CREATED = "WORKFLOW_CREATED"
    WORKFLOW_PARSED = "WORKFLOW_PARSED"
    VERIFICATION_STARTED = "VERIFICATION_STARTED"
    VERIFICATION_PASSED = "VERIFICATION_PASSED"
    VERIFICATION_FAILED = "VERIFICATION_FAILED"
    ATTACK_STARTED = "ATTACK_STARTED"
    VULNERABILITY_FOUND = "VULNERABILITY_FOUND"
    REPAIR_PROPOSED = "REPAIR_PROPOSED"
    REPAIR_APPLIED = "REPAIR_APPLIED"
    RE_VERIFICATION_PASSED = "RE_VERIFICATION_PASSED"
    SIMULATION_RUN = "SIMULATION_RUN"
    STRESS_TEST_RUN = "STRESS_TEST_RUN"
    EXECUTION_STARTED = "EXECUTION_STARTED"
    EXECUTION_COMPLETED = "EXECUTION_COMPLETED"
    EXECUTION_BLOCKED = "EXECUTION_BLOCKED"
    EXECUTION_FAILED = "EXECUTION_FAILED"


class AuditLog(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    workflow_id: str
    event_type: AuditEventType
    title: str
    details: Dict[str, Any] = Field(default_factory=dict)
    severity: str = "INFO"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
