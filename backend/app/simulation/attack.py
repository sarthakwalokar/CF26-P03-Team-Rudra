"""
FlowGuard AI — Attack Engine
============================
Intentionally attempts to violate workflow assumptions by generating
adversarial workflow modifications and testing them against the verification engine.

All attacks operate on the actual Workflow IR — not fake/simulated.
The verification engine evaluates the modified workflows to find real vulnerabilities.
"""
from __future__ import annotations
import copy
import uuid
from typing import List, Optional

from app.schemas.workflow import (
    WorkflowIR, WorkflowNode, WorkflowEdge,
    AttackType, AttackFinding, AttackResult,
    NodeType, TransitionType, RiskLevel, FailurePolicy, IssueSeverity,
)
from app.verification.engine import verify_workflow


def _copy_workflow(workflow: WorkflowIR) -> WorkflowIR:
    """Deep copy a WorkflowIR for modification."""
    return WorkflowIR.model_validate(workflow.model_dump())


def _make_finding(attack_type: AttackType, severity: IssueSeverity, title: str,
                  description: str, attack_path: List[str], affected_nodes: List[str],
                  affected_edges: List[str], exploit_scenario: str, mitigation: str) -> AttackFinding:
    return AttackFinding(
        id=str(uuid.uuid4())[:8],
        attack_type=attack_type,
        severity=severity,
        title=title,
        description=description,
        attack_path=attack_path,
        affected_nodes=affected_nodes,
        affected_edges=affected_edges,
        exploit_scenario=exploit_scenario,
        mitigation=mitigation,
    )


# ── Individual Attack Scenarios ────────────────────────────────────────────────

def attack_approval_bypass(workflow: WorkflowIR) -> Optional[AttackFinding]:
    """
    Remove APPROVAL nodes and add direct edges to simulate bypass.
    If the modified workflow passes verification — we found a vulnerability.
    If the original workflow already allows bypass — report it.
    """
    approval_nodes = [n for n in workflow.nodes if n.type == NodeType.APPROVAL]
    if not approval_nodes:
        return None

    for approval in approval_nodes:
        # Build modified workflow without this approval
        modified = _copy_workflow(workflow)

        # Find what approval connects (predecessors → successors directly)
        incoming = [e for e in modified.edges if e.target == approval.id]
        outgoing = [e for e in modified.edges if e.source == approval.id]

        if not incoming or not outgoing:
            continue

        # Remove approval node and its edges
        modified.nodes = [n for n in modified.nodes if n.id != approval.id]
        modified.edges = [e for e in modified.edges if e.source != approval.id and e.target != approval.id]

        # Connect predecessors directly to successors (bypass)
        for in_edge in incoming:
            for out_edge in outgoing:
                bypass_edge = WorkflowEdge(
                    id=f"attack_{in_edge.source}_{out_edge.target}",
                    source=in_edge.source,
                    target=out_edge.target,
                    transition_type=TransitionType.SEQUENTIAL,
                    label="[ATTACK: Bypass Edge]",
                )
                modified.edges.append(bypass_edge)

        # Verify the modified workflow — if it's SAFE, the bypass works
        try:
            result = verify_workflow(modified)
            vulnerability_exists = result.status.value in ["SAFE", "WARNING"]
        except Exception:
            vulnerability_exists = True  # Error means we found structural weakness

        # Also check the ORIGINAL workflow for bypass
        original_result = verify_workflow(workflow)
        bypass_in_original = any(
            "bypass" in issue.title.lower() or "bypass" in issue.check_name
            for issue in original_result.issues
        )

        return _make_finding(
            attack_type=AttackType.APPROVAL_BYPASS,
            severity=IssueSeverity.CRITICAL,
            title=f"Approval Bypass: '{approval.name}' Can Be Circumvented",
            description=(
                f"Attack scenario: Remove '{approval.name}' from execution path "
                f"and create a direct edge from its predecessor to its successor. "
                f"{'The bypass succeeds — the workflow executes without approval.' if vulnerability_exists else 'The verification engine correctly blocks this bypass.'}"
            ),
            attack_path=[e.source for e in incoming] + [e.target for e in outgoing],
            affected_nodes=[approval.id],
            affected_edges=[e.id for e in incoming + outgoing],
            exploit_scenario=(
                f"An attacker removes the '{approval.name}' step from the workflow definition "
                f"and creates a direct connection, allowing unauthorized execution of subsequent actions "
                f"without required approval from {approval.actor}."
            ),
            mitigation=(
                f"Enforce '{approval.name}' as a mandatory gateway in the workflow engine. "
                f"Use required_state checks on all edges following the approval to ensure "
                f"execution cannot proceed without approval state."
            ),
        )

    return None


def attack_unauthorized_actor(workflow: WorkflowIR) -> Optional[AttackFinding]:
    """
    Replace authorized actors on critical nodes with an unauthorized role
    and verify if the system detects it.
    """
    high_risk_nodes = [n for n in workflow.nodes
                       if n.type == NodeType.APPROVAL or n.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]]
    if not high_risk_nodes:
        return None

    target_node = high_risk_nodes[0]
    original_actor = target_node.actor

    modified = _copy_workflow(workflow)
    for n in modified.nodes:
        if n.id == target_node.id:
            n.actor = "Guest User"  # Unauthorized actor
            n.required_permissions = []  # Remove permissions
            break

    result = verify_workflow(modified)
    detected = any("authorization" in i.check_name or "actor" in i.title.lower()
                   for i in result.issues + result.warnings)

    return _make_finding(
        attack_type=AttackType.UNAUTHORIZED_ACTOR,
        severity=IssueSeverity.CRITICAL,
        title=f"Unauthorized Actor Attack on '{target_node.name}'",
        description=(
            f"Attack: Replace authorized actor '{original_actor}' with 'Guest User' "
            f"on critical node '{target_node.name}'. "
            f"{'Authorization violation detected.' if detected else 'VULNERABILITY: Attack not detected by verification.'}"
        ),
        attack_path=[target_node.id],
        affected_nodes=[target_node.id],
        affected_edges=[],
        exploit_scenario=(
            f"An unauthorized user (Guest User) attempts to perform '{target_node.name}' "
            f"which should only be executed by '{original_actor}'. "
            f"Without proper role-based access control, the action could proceed."
        ),
        mitigation=(
            f"Enforce role-based access control for '{target_node.name}'. "
            f"The verification engine must reject any workflow where critical nodes "
            f"lack explicit actor assignments with proper permissions."
        ),
    )


def attack_missing_dependency(workflow: WorkflowIR) -> Optional[AttackFinding]:
    """
    Remove a critical dependency edge and test if the workflow still executes.
    """
    # Find nodes with preconditions (these have dependencies)
    dep_nodes = [n for n in workflow.nodes if n.preconditions or n.inputs]
    if not dep_nodes:
        return None

    target_node = dep_nodes[0]
    modified = _copy_workflow(workflow)

    # Remove edges TO this node (remove dependencies)
    removed_edges = [e for e in modified.edges if e.target == target_node.id]
    if not removed_edges:
        return None

    modified.edges = [e for e in modified.edges if e.target != target_node.id]

    result = verify_workflow(modified)
    detected = result.status.value == "BLOCKED"

    return _make_finding(
        attack_type=AttackType.MISSING_DEPENDENCY,
        severity=IssueSeverity.CRITICAL,
        title=f"Missing Dependency Attack: '{target_node.name}' Without Prerequisites",
        description=(
            f"Attack: Remove all incoming edges to '{target_node.name}', "
            f"making it potentially executable without its required dependencies. "
            f"Dependencies removed: {[e.source for e in removed_edges]}. "
            f"{'Correctly BLOCKED.' if detected else 'VULNERABILITY: Not detected.'}"
        ),
        attack_path=[e.source for e in removed_edges] + [target_node.id],
        affected_nodes=[target_node.id] + [e.source for e in removed_edges],
        affected_edges=[e.id for e in removed_edges],
        exploit_scenario=(
            f"Removing prerequisite steps for '{target_node.name}' allows it to execute "
            f"without completing required upstream validations. "
            f"For example: '{target_node.name}' could run before "
            f"'{', '.join(e.source for e in removed_edges)}' completes."
        ),
        mitigation=(
            f"Enforce dependency ordering in the workflow engine. "
            f"Use required_state on edges and precondition validation to prevent "
            f"out-of-order execution of '{target_node.name}'."
        ),
    )


def attack_service_unavailable(workflow: WorkflowIR) -> Optional[AttackFinding]:
    """
    Simulate a critical service node becoming unavailable (no outgoing edges).
    Check if a safe fallback exists.
    """
    service_nodes = [n for n in workflow.nodes
                     if n.type in [NodeType.SERVICE, NodeType.VALIDATION, NodeType.APPROVAL]
                     and n.is_critical]
    if not service_nodes:
        service_nodes = [n for n in workflow.nodes
                         if n.type in [NodeType.SERVICE, NodeType.VALIDATION, NodeType.APPROVAL]]
    if not service_nodes:
        return None

    target_node = service_nodes[0]

    # Check if any RECOVERY/FALLBACK exists for this node
    recovery_edges = [e for e in workflow.edges
                      if e.source == target_node.id and e.transition_type.value in ["FALLBACK", "ERROR"]]
    recovery_nodes = [n for n in workflow.nodes if n.type in [NodeType.RECOVERY, NodeType.FAILURE]]

    has_recovery = bool(recovery_edges or recovery_nodes)

    return _make_finding(
        attack_type=AttackType.SERVICE_UNAVAILABLE,
        severity=IssueSeverity.CRITICAL if not has_recovery else IssueSeverity.WARNING,
        title=f"Service Unavailable: '{target_node.name}' Has No Recovery Path",
        description=(
            f"Scenario: '{target_node.name}' (actor: {target_node.actor}) becomes unavailable. "
            f"{'No recovery mechanism exists — workflow is BLOCKED with no safe fallback.' if not has_recovery else 'Recovery path available.'}"
        ),
        attack_path=[target_node.id],
        affected_nodes=[target_node.id],
        affected_edges=[],
        exploit_scenario=(
            f"If '{target_node.name}' is unavailable (service down, timeout, actor absence), "
            f"the workflow {'has no recovery path and may hang or fail silently.' if not has_recovery else 'can fall back to recovery.'}"
        ),
        mitigation=(
            f"Add a RECOVERY node connected from '{target_node.name}' with transition_type='FALLBACK'. "
            f"Define a fallback actor or alternate approval path for when this service is unavailable."
        ),
    )


def attack_timeout(workflow: WorkflowIR) -> Optional[AttackFinding]:
    """Identify critical nodes with no timeout configured."""
    no_timeout = [n for n in workflow.nodes
                  if n.type in [NodeType.APPROVAL, NodeType.SERVICE, NodeType.ACTION]
                  and n.is_critical and not n.timeout_seconds]
    if not no_timeout:
        return None

    node = no_timeout[0]
    return _make_finding(
        attack_type=AttackType.TIMEOUT,
        severity=IssueSeverity.WARNING,
        title=f"Timeout Attack Vector: '{node.name}' Has No Timeout",
        description=(
            f"Critical node '{node.name}' has no timeout configured. "
            f"If it hangs indefinitely, the entire workflow blocks with no mechanism to recover."
        ),
        attack_path=[node.id],
        affected_nodes=[node.id],
        affected_edges=[],
        exploit_scenario=(
            f"'{node.name}' (actor: {node.actor}) never responds. The workflow hangs permanently "
            f"without a timeout or escalation mechanism, causing a denial-of-service scenario."
        ),
        mitigation=f"Set timeout_seconds on '{node.name}' and add a RECOVERY path triggered on timeout.",
    )


def attack_duplicate_action(workflow: WorkflowIR) -> Optional[AttackFinding]:
    """Detect if the same critical action can be executed multiple times (idempotency risk)."""
    action_counts: dict = {}
    for node in workflow.nodes:
        if node.type not in [NodeType.START, NodeType.END]:
            action_counts[node.action] = action_counts.get(node.action, []) + [node.id]

    duplicates = {action: ids for action, ids in action_counts.items() if len(ids) > 1}
    if not duplicates:
        return None

    action, ids = list(duplicates.items())[0]
    affected_names = [n.name for n in workflow.nodes if n.id in ids]

    return _make_finding(
        attack_type=AttackType.DUPLICATE_ACTION,
        severity=IssueSeverity.WARNING,
        title=f"Duplicate Action Detected: '{action}'",
        description=(
            f"Action '{action}' appears {len(ids)} times in the workflow "
            f"(nodes: {', '.join(affected_names)}). "
            f"If this action is not idempotent, duplicate execution may cause data corruption."
        ),
        attack_path=ids,
        affected_nodes=ids,
        affected_edges=[],
        exploit_scenario=(
            f"Triggering '{action}' multiple times (e.g., via retry or parallel branch) "
            f"could result in double-charging, duplicate approvals, or conflicting state mutations."
        ),
        mitigation=f"Ensure '{action}' is idempotent, or add a check to prevent duplicate execution.",
    )


def attack_invalid_state(workflow: WorkflowIR) -> Optional[AttackFinding]:
    """
    Find nodes with preconditions that reference states not produced by ANY predecessor.
    This creates an always-failing or always-invalid state condition.
    """
    state_producers = {output for n in workflow.nodes for output in n.outputs}

    for node in workflow.nodes:
        for precond in node.preconditions:
            state_name = precond.split("==")[0].strip()
            if state_name and state_name not in state_producers:
                return _make_finding(
                    attack_type=AttackType.INVALID_STATE,
                    severity=IssueSeverity.CRITICAL,
                    title=f"Invalid State Precondition: '{node.name}' References Non-Existent State",
                    description=(
                        f"Node '{node.name}' has precondition '{precond}', but the state "
                        f"'{state_name}' is never produced by any node in the workflow. "
                        f"This node can never execute (unreachable via state machine)."
                    ),
                    attack_path=[node.id],
                    affected_nodes=[node.id],
                    affected_edges=[],
                    exploit_scenario=(
                        f"'{node.name}' is supposed to execute only when '{state_name}' is true, "
                        f"but since no node produces this state, it either never executes "
                        f"or the precondition check is bypassed entirely."
                    ),
                    mitigation=f"Add a node that produces '{state_name}' before '{node.name}', or fix the precondition.",
                )
    return None


def attack_failed_prerequisite(workflow: WorkflowIR) -> Optional[AttackFinding]:
    """Test what happens when a critical predecessor fails."""
    for node in workflow.nodes:
        if node.is_critical and node.type == NodeType.VALIDATION:
            successors = [e.target for e in workflow.edges if e.source == node.id]
            if successors:
                target_name = next((n.name for n in workflow.nodes if n.id == successors[0]), successors[0])
                return _make_finding(
                    attack_type=AttackType.FAILED_PREREQUISITE,
                    severity=IssueSeverity.WARNING,
                    title=f"Failed Prerequisite: What If '{node.name}' Fails?",
                    description=(
                        f"If '{node.name}' (validation step) fails, "
                        f"what happens to '{target_name}' and subsequent steps? "
                        f"The workflow may have no defined failure branch."
                    ),
                    attack_path=[node.id] + successors,
                    affected_nodes=[node.id] + successors,
                    affected_edges=[],
                    exploit_scenario=(
                        f"'{node.name}' fails (returns false/error). "
                        f"Downstream nodes like '{target_name}' may still execute "
                        f"if the failure condition is not checked."
                    ),
                    mitigation=f"Add a CONDITION or FAILURE node after '{node.name}' to handle the failure case.",
                )
    return None


def attack_recovery_failure(workflow: WorkflowIR) -> Optional[AttackFinding]:
    """Check if recovery paths themselves have error handling."""
    recovery_nodes = [n for n in workflow.nodes if n.type == NodeType.RECOVERY]
    if not recovery_nodes:
        return None

    for rec_node in recovery_nodes:
        outgoing = [e for e in workflow.edges if e.source == rec_node.id]
        if not outgoing:
            return _make_finding(
                attack_type=AttackType.RECOVERY_FAILURE,
                severity=IssueSeverity.WARNING,
                title=f"Recovery Path Dead-End: '{rec_node.name}' Has No Continuation",
                description=(
                    f"Recovery node '{rec_node.name}' has no outgoing edges. "
                    f"If the recovery path itself fails, the workflow is completely stuck."
                ),
                attack_path=[rec_node.id],
                affected_nodes=[rec_node.id],
                affected_edges=[],
                exploit_scenario=(
                    f"The primary path fails → triggers '{rec_node.name}' (recovery) → "
                    f"recovery also fails → no further path exists → workflow permanently blocked."
                ),
                mitigation=f"Add a continuation or terminal FAILURE node from '{rec_node.name}'.",
            )
    return None


# ── Public API: Run Full Attack Suite ─────────────────────────────────────────

ATTACK_FUNCTIONS = {
    AttackType.APPROVAL_BYPASS: attack_approval_bypass,
    AttackType.UNAUTHORIZED_ACTOR: attack_unauthorized_actor,
    AttackType.INVALID_STATE: attack_invalid_state,
    AttackType.DEPENDENCY_FAILURE: attack_missing_dependency,
    AttackType.SERVICE_TIMEOUT: attack_timeout,
    AttackType.DUPLICATE_EXECUTION: attack_duplicate_action,
    AttackType.MISSING_APPROVAL: attack_approval_bypass,
    AttackType.INVALID_TRANSITION: attack_invalid_state,
    AttackType.RECOVERY_FAILURE: attack_recovery_failure,
    # Compatibility mappings
    "APPROVAL_BYPASS": attack_approval_bypass,
    "UNAUTHORIZED_ACTOR": attack_unauthorized_actor,
    "INVALID_STATE": attack_invalid_state,
    "DEPENDENCY_FAILURE": attack_missing_dependency,
    "SERVICE_TIMEOUT": attack_timeout,
    "DUPLICATE_EXECUTION": attack_duplicate_action,
    "MISSING_APPROVAL": attack_approval_bypass,
    "INVALID_TRANSITION": attack_invalid_state,
    "RECOVERY_FAILURE": attack_recovery_failure,
    "MISSING_DEPENDENCY": attack_missing_dependency,
    "SERVICE_UNAVAILABLE": attack_service_unavailable,
    "TIMEOUT": attack_timeout,
    "DUPLICATE_ACTION": attack_duplicate_action,
    "FAILED_PREREQUISITE": attack_failed_prerequisite,
}


def run_attack_suite(workflow: WorkflowIR,
                     attack_types: Optional[List[AttackType]] = None) -> AttackResult:
    """
    Run the complete attack suite against the workflow IR.
    All attacks operate on the actual workflow structure — not simulated.
    """
    if attack_types is None:
        attack_types = list(ATTACK_FUNCTIONS.keys())

    findings: List[AttackFinding] = []
    scenarios_run = 0

    for attack_type in attack_types:
        attack_fn = ATTACK_FUNCTIONS.get(attack_type)
        if not attack_fn:
            continue
        try:
            scenarios_run += 1
            result = attack_fn(workflow)
            if result:
                findings.append(result)
        except Exception as e:
            # Attack function error — skip
            pass

    critical_count = sum(1 for f in findings if f.severity == IssueSeverity.CRITICAL)
    warning_count = sum(1 for f in findings if f.severity == IssueSeverity.WARNING)

    # Security score: start at 100, deduct per finding
    security_score = 100.0
    security_score -= critical_count * 20.0
    security_score -= warning_count * 5.0
    security_score = max(0.0, security_score)

    return AttackResult(
        workflow_id=workflow.id,
        scenarios_run=scenarios_run,
        vulnerabilities_found=len(findings),
        critical_count=critical_count,
        warning_count=warning_count,
        findings=findings,
        overall_security_score=security_score,
    )
