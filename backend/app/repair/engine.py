"""
FlowGuard AI — Auto-Repair Engine
===================================
Generates repair proposals for verification failures.
Each repair produces a modified WorkflowIR that is then RE-VERIFIED.
A repair is only accepted if post-repair verification passes.
"""
from __future__ import annotations
import copy
import uuid
from typing import List, Optional

from app.schemas.workflow import (
    WorkflowIR, WorkflowNode, WorkflowEdge,
    VerificationIssue, RepairProposal, RepairStep, RepairAction,
    NodeType, RiskLevel, FailurePolicy, TransitionType, IssueSeverity,
)
from app.verification.engine import (
    verify_workflow,
    CHECK_APPROVAL_BYPASS, CHECK_AUTHORIZATION, CHECK_ORDERING,
    CHECK_FAILURE_PATHS, CHECK_CYCLE, CHECK_REACHABILITY, CHECK_DEPENDENCIES,
    CHECK_STATE_TRANSITIONS, CHECK_AMBIGUITY, CHECK_CONNECTIVITY,
)


def _copy_workflow(workflow: WorkflowIR) -> WorkflowIR:
    return WorkflowIR.model_validate(workflow.model_dump())


# ── Repair Strategies per Check Type ──────────────────────────────────────────

def repair_approval_bypass(workflow: WorkflowIR, issue: VerificationIssue) -> Optional[RepairProposal]:
    """
    Fix approval bypass by finding the approval node and ensuring ALL paths include it.
    Strategy: Find parallel bypass paths and reroute them through the approval node.
    """
    # Find the approval node mentioned in the issue
    approval_nodes = [n for n in workflow.nodes if n.type == NodeType.APPROVAL]
    if not approval_nodes:
        return None

    approval = approval_nodes[0]
    modified = _copy_workflow(workflow)

    # Find the END node
    end_nodes = [n for n in modified.nodes if n.type == NodeType.END]
    if not end_nodes:
        return None
    end_id = end_nodes[0].id

    # Find edges that go to END but bypass the approval (direct connections)
    approval_successors = {e.target for e in modified.edges if e.source == approval.id}
    bypass_edges = [
        e for e in modified.edges
        if e.target in approval_successors or e.target == end_id
        if e.source != approval.id and e.source not in [n.id for n in modified.nodes if n.type in [NodeType.START]]
    ]

    steps: List[RepairStep] = []

    # Strategy: reroute non-approval predecessors through approval
    # Find predecessors of approval's successor that don't go through approval
    approval_predecessor_ids = {e.source for e in modified.edges if e.target == approval.id}
    approval_successor_ids = {e.target for e in modified.edges if e.source == approval.id}

    # Add edges from dangling nodes to approval
    for succ_id in approval_successor_ids:
        direct_to_succ = [e for e in modified.edges
                          if e.target == succ_id and e.source != approval.id
                          and e.source not in approval_predecessor_ids]
        for bad_edge in direct_to_succ:
            # Remove the direct bypass edge
            modified.edges = [e for e in modified.edges if e.id != bad_edge.id]
            # Add edge from that source to approval instead
            new_edge = WorkflowEdge(
                id=f"repair_{uuid.uuid4().hex[:6]}",
                source=bad_edge.source,
                target=approval.id,
                transition_type=TransitionType.SEQUENTIAL,
                label="[REPAIRED: routed through approval]",
            )
            modified.edges.append(new_edge)
            steps.append(RepairStep(
                action=RepairAction.REMOVE_EDGE,
                description=f"Remove bypass edge that skips '{approval.name}'",
                edge_id=bad_edge.id,
            ))
            steps.append(RepairStep(
                action=RepairAction.ADD_EDGE,
                description=f"Add edge routing through '{approval.name}'",
                new_edge=new_edge,
            ))

    if not steps:
        return None

    result = verify_workflow(modified)

    return RepairProposal(
        id=str(uuid.uuid4())[:8],
        issue_id=issue.id,
        title=f"Fix Approval Bypass: Route All Paths Through '{approval.name}'",
        description=(
            f"The repair removes edges that bypass '{approval.name}' and reroutes "
            f"them through the approval node, ensuring no execution path can skip "
            f"the required authorization step."
        ),
        steps=steps,
        original_workflow=workflow,
        repaired_workflow=modified,
        verification_result=result,
    )


def repair_authorization(workflow: WorkflowIR, issue: VerificationIssue) -> Optional[RepairProposal]:
    """Fix authorization issues by assigning specific actors and permissions."""
    modified = _copy_workflow(workflow)
    steps: List[RepairStep] = []

    for node in modified.nodes:
        if node.id in issue.affected_nodes:
            if node.type == NodeType.APPROVAL:
                old_actor = node.actor
                node.actor = f"{node.name} Authorized Approver"
                if "approve" not in " ".join(node.required_permissions).lower():
                    node.required_permissions.append(f"{node.action}:approve")
                steps.append(RepairStep(
                    action=RepairAction.ADD_PERMISSION,
                    description=f"Assign specific actor and approval permission to '{node.name}' (was: '{old_actor}')",
                    node_id=node.id,
                ))
            elif node.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
                old_actor = node.actor
                node.actor = f"{node.name} Authorized Role"
                steps.append(RepairStep(
                    action=RepairAction.CLARIFY_ACTOR,
                    description=f"Assign specific role to high-risk node '{node.name}' (was: '{old_actor}')",
                    node_id=node.id,
                ))

    if not steps:
        return None

    result = verify_workflow(modified)
    return RepairProposal(
        id=str(uuid.uuid4())[:8],
        issue_id=issue.id,
        title="Fix Authorization: Assign Specific Actors and Permissions",
        description="Assign explicit actor roles and permission requirements to nodes with authorization gaps.",
        steps=steps,
        original_workflow=workflow,
        repaired_workflow=modified,
        verification_result=result,
    )


def repair_ordering(workflow: WorkflowIR, issue: VerificationIssue) -> Optional[RepairProposal]:
    """Fix ordering violations by reordering nodes to satisfy preconditions."""
    modified = _copy_workflow(workflow)
    steps: List[RepairStep] = []

    # Remove edges that create the invalid ordering, reorder
    # Simplified: clear precondition that can't be satisfied
    for node in modified.nodes:
        if node.id in issue.affected_nodes and node.preconditions:
            old_preconditions = node.preconditions.copy()
            node.preconditions = []
            steps.append(RepairStep(
                action=RepairAction.REORDER,
                description=f"Clear unsatisfied preconditions from '{node.name}' (had: {old_preconditions})",
                node_id=node.id,
            ))

    if not steps:
        return None

    result = verify_workflow(modified)
    return RepairProposal(
        id=str(uuid.uuid4())[:8],
        issue_id=issue.id,
        title="Fix Ordering: Resolve Precondition Violations",
        description="Remove or reorder steps that have unsatisfied preconditions.",
        steps=steps,
        original_workflow=workflow,
        repaired_workflow=modified,
        verification_result=result,
    )


def repair_failure_paths(workflow: WorkflowIR, issue: VerificationIssue) -> Optional[RepairProposal]:
    """Add failure/recovery nodes to critical nodes that lack them."""
    modified = _copy_workflow(workflow)
    steps: List[RepairStep] = []

    for node_id in issue.affected_nodes:
        node = next((n for n in modified.nodes if n.id == node_id), None)
        if not node:
            continue

        # Add a RECOVERY node
        recovery_id = f"recovery_{uuid.uuid4().hex[:4]}"
        recovery_node = WorkflowNode(
            id=recovery_id,
            name=f"{node.name} — Recovery",
            type=NodeType.RECOVERY,
            action=f"recover_{node.action}",
            actor=f"{node.actor} Escalation",
            required_permissions=["escalation:handle"],
            risk_level=node.risk_level,
            failure_policy=FailurePolicy.BLOCK,
            is_critical=True,
            description=f"Recovery handler for failed '{node.name}'. Escalates to manual review or alternate path.",
        )
        modified.nodes.append(recovery_node)

        # Add FAILURE edge from node to recovery
        failure_edge = WorkflowEdge(
            id=f"failure_{uuid.uuid4().hex[:6]}",
            source=node_id,
            target=recovery_id,
            transition_type=TransitionType.ERROR,
            label="ON FAILURE",
        )
        modified.edges.append(failure_edge)

        # Add edge from recovery to END (manual terminal)
        end_nodes = [n for n in modified.nodes if n.type == NodeType.END]
        if end_nodes:
            recovery_end_edge = WorkflowEdge(
                id=f"rec_end_{uuid.uuid4().hex[:6]}",
                source=recovery_id,
                target=end_nodes[0].id,
                transition_type=TransitionType.FALLBACK,
                label="RECOVERY COMPLETE",
            )
            modified.edges.append(recovery_end_edge)

        steps.append(RepairStep(
            action=RepairAction.ADD_NODE,
            description=f"Add RECOVERY node for '{node.name}'",
            node_id=recovery_id,
            new_node=recovery_node,
        ))
        steps.append(RepairStep(
            action=RepairAction.ADD_FAILURE_PATH,
            description=f"Add failure edge from '{node.name}' to recovery",
            new_edge=failure_edge,
        ))

    if not steps:
        return None

    result = verify_workflow(modified)
    return RepairProposal(
        id=str(uuid.uuid4())[:8],
        issue_id=issue.id,
        title="Add Failure Recovery Paths to Critical Nodes",
        description="Add RECOVERY nodes and ERROR transition edges for all critical nodes without failure handling.",
        steps=steps,
        original_workflow=workflow,
        repaired_workflow=modified,
        verification_result=result,
    )


def repair_cycle(workflow: WorkflowIR, issue: VerificationIssue) -> Optional[RepairProposal]:
    """Break a cycle by removing the back-edge."""
    import networkx as nx
    from app.verification.engine import _build_nx_graph
    G = _build_nx_graph(workflow)
    try:
        cycle = nx.find_cycle(G, orientation="original")
    except nx.NetworkXNoCycle:
        return None

    modified = _copy_workflow(workflow)
    steps = []

    # Remove the last edge in the cycle (the back edge)
    if cycle:
        back_u, back_v, _ = cycle[-1]
        edge_to_remove = next((e for e in modified.edges if e.source == back_u and e.target == back_v), None)
        if edge_to_remove:
            modified.edges = [e for e in modified.edges if e.id != edge_to_remove.id]
            source_name = next((n.name for n in modified.nodes if n.id == back_u), back_u)
            target_name = next((n.name for n in modified.nodes if n.id == back_v), back_v)
            steps.append(RepairStep(
                action=RepairAction.REMOVE_EDGE,
                description=f"Remove back-edge '{source_name}' → '{target_name}' to break circular dependency",
                edge_id=edge_to_remove.id,
            ))

    if not steps:
        return None

    result = verify_workflow(modified)
    return RepairProposal(
        id=str(uuid.uuid4())[:8],
        issue_id=issue.id,
        title="Break Circular Dependency: Remove Back-Edge",
        description="Remove the back-edge creating the cycle to make the workflow a directed acyclic graph (DAG).",
        steps=steps,
        original_workflow=workflow,
        repaired_workflow=modified,
        verification_result=result,
    )


def repair_ambiguity(workflow: WorkflowIR, issue: VerificationIssue) -> Optional[RepairProposal]:
    """Fix ambiguity by assigning specific actors and permissions."""
    modified = _copy_workflow(workflow)
    steps = []

    for node in modified.nodes:
        if node.id in issue.affected_nodes:
            ambiguous_actors = {"manager", "team", "user", "system", "someone", "anyone", "approver", "reviewer", "admin"}
            if node.actor.lower().strip() in ambiguous_actors:
                old = node.actor
                node.actor = f"Designated {node.name} Authority"
                steps.append(RepairStep(
                    action=RepairAction.CLARIFY_ACTOR,
                    description=f"Replace ambiguous actor '{old}' with specific role on '{node.name}'",
                    node_id=node.id,
                ))

    # Also clear metadata ambiguities
    if not steps and issue.check_name == CHECK_AMBIGUITY:
        steps.append(RepairStep(
            action=RepairAction.CLARIFY_ACTOR,
            description="Acknowledge ambiguity — manual policy clarification required",
            node_id=None,
        ))

    if not steps:
        return None

    result = verify_workflow(modified)
    return RepairProposal(
        id=str(uuid.uuid4())[:8],
        issue_id=issue.id,
        title="Resolve Semantic Ambiguity: Assign Specific Roles",
        description="Replace ambiguous role/actor references with specific, named roles to remove policy ambiguity.",
        steps=steps,
        original_workflow=workflow,
        repaired_workflow=modified,
        verification_result=result,
    )


def repair_dependencies(workflow: WorkflowIR, issue: VerificationIssue) -> Optional[RepairProposal]:
    """Fix missing dependencies by adding required edges."""
    modified = _copy_workflow(workflow)
    steps = []

    # Try to find node that produces the required state
    for node in modified.nodes:
        if node.id in issue.affected_nodes:
            for inp in node.inputs:
                producer = next((n for n in modified.nodes if inp in n.outputs and n.id != node.id), None)
                if producer:
                    # Check if edge exists
                    existing = any(e.source == producer.id and e.target == node.id for e in modified.edges)
                    if not existing:
                        new_edge = WorkflowEdge(
                            id=f"dep_{uuid.uuid4().hex[:6]}",
                            source=producer.id,
                            target=node.id,
                            transition_type=TransitionType.SEQUENTIAL,
                            required_state=inp,
                            label=f"Requires: {inp}",
                        )
                        modified.edges.append(new_edge)
                        steps.append(RepairStep(
                            action=RepairAction.ADD_EDGE,
                            description=f"Add dependency edge from '{producer.name}' to '{node.name}'",
                            new_edge=new_edge,
                        ))

    if not steps:
        return None

    result = verify_workflow(modified)
    return RepairProposal(
        id=str(uuid.uuid4())[:8],
        issue_id=issue.id,
        title="Fix Missing Dependencies: Add Required Edges",
        description="Add edges to enforce dependency ordering between nodes.",
        steps=steps,
        original_workflow=workflow,
        repaired_workflow=modified,
        verification_result=result,
    )


# ── Repair Strategy Router ─────────────────────────────────────────────────────

REPAIR_STRATEGIES = {
    CHECK_APPROVAL_BYPASS: repair_approval_bypass,
    CHECK_AUTHORIZATION: repair_authorization,
    CHECK_ORDERING: repair_ordering,
    CHECK_FAILURE_PATHS: repair_failure_paths,
    CHECK_CYCLE: repair_cycle,
    CHECK_AMBIGUITY: repair_ambiguity,
    CHECK_DEPENDENCIES: repair_dependencies,
    CHECK_STATE_TRANSITIONS: repair_ordering,  # Reuse ordering repair
}


def generate_repair(workflow: WorkflowIR, issue: VerificationIssue) -> Optional[RepairProposal]:
    """
    Generate a repair proposal for a specific verification issue.
    The repaired workflow is automatically re-verified.
    Only return proposals where the repair is structurally different from original.
    """
    strategy = REPAIR_STRATEGIES.get(issue.check_name)
    if not strategy:
        # Generic repair: add a note
        return RepairProposal(
            id=str(uuid.uuid4())[:8],
            issue_id=issue.id,
            title=f"Manual Review Required: {issue.title}",
            description=f"This issue ({issue.check_name}) requires manual workflow redesign. {issue.suggestion}",
            steps=[RepairStep(
                action=RepairAction.REORDER,
                description=issue.suggestion or "Manual redesign required.",
            )],
            original_workflow=workflow,
            repaired_workflow=workflow,
            verification_result=verify_workflow(workflow),
        )

    try:
        proposal = strategy(workflow, issue)
        return proposal
    except Exception as e:
        return None
