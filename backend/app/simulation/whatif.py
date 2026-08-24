"""
FlowGuard AI — What-If Simulator
==================================
Simulates failure scenarios on workflow states and transitions.
Operates on the actual Workflow IR and state machine.
"""
from __future__ import annotations
import copy
import uuid
from typing import List, Optional

from app.schemas.workflow import (
    WorkflowIR, WorkflowNode, WorkflowEdge,
    SimulationScenario, SimulationResult,
    NodeType, TransitionType, FailurePolicy,
)
from app.verification.engine import verify_workflow


def _copy_workflow(workflow: WorkflowIR) -> WorkflowIR:
    return WorkflowIR.model_validate(workflow.model_dump())


SCENARIO_DESCRIPTIONS = {
    "service_unavailable": "Service node is unavailable — check if fallback path exists",
    "timeout": "Node times out — check retry/recovery mechanism",
    "approval_rejected": "Approval is rejected — check if workflow handles rejection",
    "dependency_failure": "Dependency node fails — propagate failure downstream",
    "actor_unavailable": "Required actor is unavailable — check for delegation or escalation",
    "invalid_input": "Node receives invalid input — check input validation handling",
    "partial_failure": "Node partially completes — check idempotency and state consistency",
}


def simulate_service_unavailable(workflow: WorkflowIR, node_id: str) -> SimulationResult:
    """Remove a service node and check if workflow can still complete."""
    target = next((n for n in workflow.nodes if n.id == node_id), None)
    if not target:
        raise ValueError(f"Node {node_id} not found")

    modified = _copy_workflow(workflow)

    # Check for FALLBACK/RECOVERY path from this node
    fallback_edges = [e for e in modified.edges
                      if e.source == node_id and e.transition_type in [TransitionType.FALLBACK, TransitionType.ERROR]]
    recovery_nodes = [n for n in modified.nodes if n.type in [NodeType.RECOVERY, NodeType.FAILURE]]

    has_fallback = bool(fallback_edges or recovery_nodes)
    fallback_path = [e.target for e in fallback_edges]

    # Simulate: remove the node's success edges, keep only fallback
    if not has_fallback:
        # No fallback — remove node entirely (service down)
        modified.nodes = [n for n in modified.nodes if n.id != node_id]
        modified.edges = [e for e in modified.edges
                          if e.source != node_id and e.target != node_id]
        outcome = "BLOCKED"
        explanation = (
            f"'{target.name}' is unavailable and no fallback path exists. "
            f"Workflow execution is BLOCKED at this step. "
            f"Manual intervention required to continue."
        )
    else:
        outcome = "FALLBACK"
        explanation = (
            f"'{target.name}' is unavailable but a fallback path exists via: "
            f"{' → '.join(fallback_path)}. "
            f"Workflow can continue through the recovery path."
        )

    result = verify_workflow(modified)

    scenario = SimulationScenario(
        scenario_type="service_unavailable",
        affected_node_id=node_id,
        description=f"'{target.name}' becomes unavailable",
        fallback_available=has_fallback,
        fallback_path=fallback_path,
        outcome=outcome,
    )

    return SimulationResult(
        workflow_id=workflow.id,
        scenario=scenario,
        modified_workflow=modified,
        verification_result=result,
        can_continue=has_fallback,
        explanation=explanation,
    )


def simulate_approval_rejected(workflow: WorkflowIR, node_id: str) -> SimulationResult:
    """Simulate an approval being rejected — check if rejection path exists."""
    target = next((n for n in workflow.nodes if n.id == node_id), None)
    if not target:
        raise ValueError(f"Node {node_id} not found")

    modified = _copy_workflow(workflow)

    # Check for rejection handling: CONDITION node after approval or FAILURE edge
    rejection_edges = [e for e in modified.edges
                       if e.source == node_id
                       and (e.label and "reject" in e.label.lower()
                            or e.transition_type in [TransitionType.ERROR, TransitionType.FALLBACK])]

    has_rejection_path = bool(rejection_edges)
    fallback_path = [e.target for e in rejection_edges]

    outcome = "FALLBACK" if has_rejection_path else "BLOCKED"
    explanation = (
        f"'{target.name}' approval is REJECTED by {target.actor}. "
        f"{'A rejection path exists.' if has_rejection_path else 'No rejection handling — workflow is BLOCKED.'}"
    )

    result = verify_workflow(modified)

    scenario = SimulationScenario(
        scenario_type="approval_rejected",
        affected_node_id=node_id,
        description=f"'{target.name}' approval is rejected",
        fallback_available=has_rejection_path,
        fallback_path=fallback_path,
        outcome=outcome,
    )

    return SimulationResult(
        workflow_id=workflow.id,
        scenario=scenario,
        modified_workflow=modified,
        verification_result=result,
        can_continue=has_rejection_path,
        explanation=explanation,
    )


def simulate_timeout(workflow: WorkflowIR, node_id: str) -> SimulationResult:
    """Simulate a node timeout."""
    target = next((n for n in workflow.nodes if n.id == node_id), None)
    if not target:
        raise ValueError(f"Node {node_id} not found")

    has_timeout = target.timeout_seconds is not None
    has_retry = target.retry_count > 0
    has_fallback = target.failure_policy in [FailurePolicy.FALLBACK, FailurePolicy.RETRY]

    can_continue = has_timeout or has_retry or has_fallback
    outcome = "RETRY" if has_retry else ("FALLBACK" if has_fallback else "BLOCKED")

    explanation = (
        f"'{target.name}' times out. "
        f"{'Timeout is configured (' + str(target.timeout_seconds) + 's). ' if has_timeout else 'No timeout configured — may hang indefinitely. '}"
        f"{'Retry count: ' + str(target.retry_count) + '. ' if has_retry else ''}"
        f"{'Failure policy: ' + target.failure_policy.value + '.' if has_fallback else 'No recovery.'}"
    )

    scenario = SimulationScenario(
        scenario_type="timeout",
        affected_node_id=node_id,
        description=f"'{target.name}' times out",
        fallback_available=can_continue,
        outcome=outcome,
    )

    modified = _copy_workflow(workflow)
    result = verify_workflow(modified)

    return SimulationResult(
        workflow_id=workflow.id,
        scenario=scenario,
        modified_workflow=modified,
        verification_result=result,
        can_continue=can_continue,
        explanation=explanation,
    )


def simulate_actor_unavailable(workflow: WorkflowIR, node_id: str) -> SimulationResult:
    """Simulate required actor being unavailable."""
    target = next((n for n in workflow.nodes if n.id == node_id), None)
    if not target:
        raise ValueError(f"Node {node_id} not found")

    recovery_nodes = [n for n in workflow.nodes
                      if n.type == NodeType.RECOVERY
                      and any(e.source == node_id for e in workflow.edges if e.target == n.id)]

    has_fallback = bool(recovery_nodes)
    fallback_names = [n.name for n in recovery_nodes]
    outcome = "FALLBACK" if has_fallback else "BLOCKED"

    explanation = (
        f"'{target.actor}' required for '{target.name}' is unavailable. "
        f"{'Escalation to: ' + ', '.join(fallback_names) + '.' if has_fallback else 'No delegation/escalation defined — workflow BLOCKED.'}"
    )

    modified = _copy_workflow(workflow)
    result = verify_workflow(modified)

    scenario = SimulationScenario(
        scenario_type="actor_unavailable",
        affected_node_id=node_id,
        description=f"Actor '{target.actor}' for '{target.name}' is unavailable",
        fallback_available=has_fallback,
        fallback_path=[n.id for n in recovery_nodes],
        outcome=outcome,
    )

    return SimulationResult(
        workflow_id=workflow.id,
        scenario=scenario,
        modified_workflow=modified,
        verification_result=result,
        can_continue=has_fallback,
        explanation=explanation,
    )


SIMULATION_FUNCTIONS = {
    "service_unavailable": simulate_service_unavailable,
    "approval_rejected": simulate_approval_rejected,
    "timeout": simulate_timeout,
    "actor_unavailable": simulate_actor_unavailable,
}


def run_simulation(workflow: WorkflowIR, scenario_type: str, node_id: str) -> SimulationResult:
    """Run a what-if simulation for a given scenario and node."""
    sim_fn = SIMULATION_FUNCTIONS.get(scenario_type)
    if not sim_fn:
        raise ValueError(f"Unknown scenario type: {scenario_type}")
    return sim_fn(workflow, node_id)
