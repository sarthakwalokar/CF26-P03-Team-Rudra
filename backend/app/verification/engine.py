"""
FlowGuard AI — Deterministic Verification Engine
=================================================
This is the technical centerpiece of the system.

All checks are deterministic graph algorithms and rule-based validations.
The LLM has NO role here. This engine independently decides workflow safety.

Implements all 8 P-03 required checks:
  A. Ordering Validation
  B. Authorization Validation
  C. Required Approval Bypass Detection
  D. Reachability Analysis
  E. Cycle Detection
  F. Invalid State Transitions
  G. Missing Dependency Check
  H. Failure Path Validation

Plus:
  I. Semantic Ambiguity Detection
  J. Disconnected Subgraph Detection
  K. Dead-end (unreachable END) Detection
"""
from __future__ import annotations
import uuid
from typing import Dict, List, Optional, Set, Tuple
import networkx as nx

from app.schemas.workflow import (
    WorkflowIR, WorkflowNode, WorkflowEdge,
    NodeType, RiskLevel, IssueSeverity,
    VerificationResult, VerificationIssue, VerificationStatus, DimensionScores,
)


# ── Check Name Constants ───────────────────────────────────────────────────────
CHECK_ORDERING = "ordering_validation"
CHECK_AUTHORIZATION = "authorization_validation"
CHECK_APPROVAL_BYPASS = "approval_bypass_detection"
CHECK_REACHABILITY = "reachability_analysis"
CHECK_CYCLE = "cycle_detection"
CHECK_STATE_TRANSITIONS = "state_transition_validation"
CHECK_DEPENDENCIES = "missing_dependency_check"
CHECK_FAILURE_PATHS = "failure_path_validation"
CHECK_AMBIGUITY = "ambiguity_detection"
CHECK_CONNECTIVITY = "connectivity_check"
CHECK_DEAD_END = "dead_end_detection"


def _make_issue(check_name: str, severity: IssueSeverity, title: str, message: str,
                affected_nodes: List[str] = None, affected_edges: List[str] = None,
                rule_violated: str = "", suggestion: str = "") -> VerificationIssue:
    return VerificationIssue(
        id=str(uuid.uuid4())[:8],
        check_name=check_name,
        severity=severity,
        title=title,
        message=message,
        affected_nodes=affected_nodes or [],
        affected_edges=affected_edges or [],
        rule_violated=rule_violated,
        suggestion=suggestion,
    )


def _build_nx_graph(workflow: WorkflowIR) -> nx.DiGraph:
    """Build a NetworkX DiGraph from the Workflow IR."""
    G = nx.DiGraph()
    for node in workflow.nodes:
        G.add_node(node.id, data=node)
    for edge in workflow.edges:
        G.add_edge(edge.source, edge.target, data=edge)
    return G


def _get_node_map(workflow: WorkflowIR) -> Dict[str, WorkflowNode]:
    return {n.id: n for n in workflow.nodes}


def _get_edge_map(workflow: WorkflowIR) -> Dict[str, WorkflowEdge]:
    return {e.id: e for e in workflow.edges}


# ── CHECK A: Ordering Validation ───────────────────────────────────────────────

def check_ordering(workflow: WorkflowIR, G: nx.DiGraph, node_map: Dict[str, WorkflowNode]) -> List[VerificationIssue]:
    """
    Validate that nodes are reachable in a topologically sound order.
    Checks preconditions — if a node requires state X, and the node that produces
    state X comes AFTER it in topological order, that's an ordering violation.
    """
    issues = []
    # Build state → producer map
    state_producers: Dict[str, str] = {}
    for node in workflow.nodes:
        for output in node.outputs:
            state_producers[output] = node.id

    try:
        topo_order = list(nx.topological_sort(G))
        topo_rank = {nid: rank for rank, nid in enumerate(topo_order)}
    except nx.NetworkXUnfeasible:
        # Cycle detected — cycle check will report it
        return issues

    for node in workflow.nodes:
        for precond in node.preconditions:
            # Parse "state == true" or "state == value"
            state_name = precond.split("==")[0].strip()
            if state_name in state_producers:
                producer_id = state_producers[state_name]
                if producer_id not in topo_rank or node.id not in topo_rank:
                    continue
                if topo_rank.get(producer_id, -1) >= topo_rank.get(node.id, 9999):
                    producer_node = node_map.get(producer_id)
                    issues.append(_make_issue(
                        check_name=CHECK_ORDERING,
                        severity=IssueSeverity.CRITICAL,
                        title="Invalid Ordering: Precondition Not Yet Satisfied",
                        message=(
                            f"Node '{node.name}' requires '{state_name}' to be true, "
                            f"but the node that produces this state ('{producer_node.name if producer_node else producer_id}') "
                            f"appears AFTER '{node.name}' in the workflow. "
                            f"This creates an impossible execution path."
                        ),
                        affected_nodes=[node.id, producer_id],
                        rule_violated="Precondition states must be produced by preceding nodes",
                        suggestion=f"Move '{producer_node.name if producer_node else producer_id}' before '{node.name}', "
                                   f"or remove the precondition if the step is optional.",
                    ))

    return issues


# ── CHECK B: Authorization Validation ─────────────────────────────────────────

def check_authorization(workflow: WorkflowIR, G: nx.DiGraph, node_map: Dict[str, WorkflowNode]) -> List[VerificationIssue]:
    """
    Validate that every node requiring permissions has them explicitly declared.
    Flag nodes where actor is 'System' or empty but permissions are required.
    """
    issues = []
    vague_actors = {"system", "", "unknown", "anyone", "user", "someone", "team"}

    for node in workflow.nodes:
        if node.type in [NodeType.START, NodeType.END]:
            continue

        actor_lower = node.actor.lower().strip()

        # Check for high-risk nodes with vague actors
        if node.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            if actor_lower in vague_actors:
                issues.append(_make_issue(
                    check_name=CHECK_AUTHORIZATION,
                    severity=IssueSeverity.CRITICAL,
                    title=f"Authorization Gap: Unspecified Actor on High-Risk Node",
                    message=(
                        f"Node '{node.name}' is classified as {node.risk_level.value} risk "
                        f"but has no specific actor assigned (actor: '{node.actor}'). "
                        f"High-risk operations require explicit role assignment to enforce "
                        f"the principle of least privilege."
                    ),
                    affected_nodes=[node.id],
                    rule_violated="High-risk nodes must have an explicitly named actor/role",
                    suggestion=f"Assign a specific role to '{node.name}' (e.g., 'Finance Manager', 'Security Officer').",
                ))

        # Check for approval nodes specifically
        if node.type == NodeType.APPROVAL:
            if actor_lower in vague_actors:
                issues.append(_make_issue(
                    check_name=CHECK_AUTHORIZATION,
                    severity=IssueSeverity.CRITICAL,
                    title=f"Authorization Violation: Approval Node Has No Assigned Approver",
                    message=(
                        f"Approval node '{node.name}' has no specific approver role assigned. "
                        f"This means any user could potentially approve the action, "
                        f"creating an authorization bypass risk."
                    ),
                    affected_nodes=[node.id],
                    rule_violated="APPROVAL nodes must have explicit actor with approval permissions",
                    suggestion=f"Assign a specific approver role to '{node.name}' and add 'approve' to required_permissions.",
                ))

            # Check for approval permissions
            has_approve_perm = any("approve" in p.lower() for p in node.required_permissions)
            if not has_approve_perm:
                issues.append(_make_issue(
                    check_name=CHECK_AUTHORIZATION,
                    severity=IssueSeverity.WARNING,
                    title=f"Missing Approval Permission Declaration",
                    message=(
                        f"Approval node '{node.name}' does not declare an 'approve' permission in "
                        f"required_permissions. Without explicit permission requirements, "
                        f"the authorization model is incomplete."
                    ),
                    affected_nodes=[node.id],
                    rule_violated="APPROVAL nodes must declare explicit approval permissions",
                    suggestion=f"Add '{node.action}:approve' to required_permissions for '{node.name}'.",
                ))

    return issues


# ── CHECK C: Required Approval Bypass Detection ────────────────────────────────

def check_approval_bypass(workflow: WorkflowIR, G: nx.DiGraph, node_map: Dict[str, WorkflowNode]) -> List[VerificationIssue]:
    """
    Detect if any path from START to END bypasses a required APPROVAL node.
    This is the most critical security check.
    """
    issues = []
    approval_nodes = [n.id for n in workflow.nodes if n.type == NodeType.APPROVAL]
    if not approval_nodes:
        return issues

    start_nodes = [n.id for n in workflow.nodes if n.type == NodeType.START]
    end_nodes = [n.id for n in workflow.nodes if n.type == NodeType.END]

    if not start_nodes or not end_nodes:
        return issues

    start_id = start_nodes[0]
    end_id = end_nodes[0]

    # Find ALL simple paths from START to END
    try:
        all_paths = list(nx.all_simple_paths(G, source=start_id, target=end_id, cutoff=20))
    except Exception:
        return issues

    for approval_id in approval_nodes:
        approval_node = node_map.get(approval_id)
        if not approval_node:
            continue

        # Check if any path reaches END without passing through this approval
        bypass_paths = []
        for path in all_paths:
            if approval_id not in path:
                bypass_paths.append(path)

        if bypass_paths:
            # Get the names of nodes on the bypass path for a human-readable explanation
            example_path = bypass_paths[0]
            path_names = [node_map[n].name for n in example_path if n in node_map]
            path_str = " → ".join(path_names)

            issues.append(_make_issue(
                check_name=CHECK_APPROVAL_BYPASS,
                severity=IssueSeverity.CRITICAL,
                title=f"CRITICAL: Approval Bypass Detected — '{approval_node.name}'",
                message=(
                    f"Required approval '{approval_node.name}' (actor: {approval_node.actor}) "
                    f"can be bypassed. A path exists from START to END that does not pass "
                    f"through this approval node.\n"
                    f"Bypass path: {path_str}\n"
                    f"This is a critical security vulnerability — workflow can execute "
                    f"without required authorization."
                ),
                affected_nodes=[approval_id] + list(set(n for p in bypass_paths for n in p)),
                rule_violated="All execution paths must pass through required approval nodes",
                suggestion=(
                    f"Ensure all paths from START to END include '{approval_node.name}'. "
                    f"Add the approval node to all parallel branches, or make it a required "
                    f"dependency for the nodes following it."
                ),
            ))

    return issues


# ── CHECK D: Reachability Analysis ────────────────────────────────────────────

def check_reachability(workflow: WorkflowIR, G: nx.DiGraph, node_map: Dict[str, WorkflowNode]) -> List[VerificationIssue]:
    """
    Detect unreachable nodes (no path from START) and nodes that cannot reach END.
    Uses BFS/DFS from START and reverse BFS from END.
    """
    issues = []
    start_nodes = [n.id for n in workflow.nodes if n.type == NodeType.START]
    end_nodes = [n.id for n in workflow.nodes if n.type == NodeType.END]

    if not start_nodes:
        issues.append(_make_issue(
            check_name=CHECK_REACHABILITY,
            severity=IssueSeverity.CRITICAL,
            title="No START Node Found",
            message="The workflow has no START node. Execution cannot begin.",
            rule_violated="Every workflow must have exactly one START node",
            suggestion="Add a START node as the entry point of the workflow.",
        ))
        return issues

    if not end_nodes:
        issues.append(_make_issue(
            check_name=CHECK_REACHABILITY,
            severity=IssueSeverity.CRITICAL,
            title="No END Node Found",
            message="The workflow has no END node. Execution has no defined terminal state.",
            rule_violated="Every workflow must have at least one END node",
            suggestion="Add an END node as the terminal state of the workflow.",
        ))
        return issues

    start_id = start_nodes[0]
    end_id = end_nodes[0]

    # BFS forward from START
    reachable_from_start = nx.descendants(G, start_id) | {start_id}
    all_node_ids = {n.id for n in workflow.nodes}

    unreachable = all_node_ids - reachable_from_start
    for nid in unreachable:
        node = node_map.get(nid)
        if not node:
            continue
        issues.append(_make_issue(
            check_name=CHECK_REACHABILITY,
            severity=IssueSeverity.CRITICAL,
            title=f"Unreachable Node: '{node.name}'",
            message=(
                f"Node '{node.name}' (type: {node.type.value}) cannot be reached from the START node. "
                f"It is a dead node that will never execute, potentially indicating a "
                f"missing edge or a disconnected workflow branch."
            ),
            affected_nodes=[nid],
            rule_violated="All nodes must be reachable from START",
            suggestion=f"Add an edge connecting to '{node.name}', or remove this node if it is not needed.",
        ))

    # BFS backward from END (can this node reach END?)
    G_reverse = G.reverse()
    can_reach_end = nx.descendants(G_reverse, end_id) | {end_id}
    cannot_reach_end = all_node_ids - can_reach_end

    for nid in cannot_reach_end:
        node = node_map.get(nid)
        if not node or nid in unreachable:  # Already reported as unreachable
            continue
        issues.append(_make_issue(
            check_name=CHECK_REACHABILITY,
            severity=IssueSeverity.CRITICAL,
            title=f"Dead-End Node: '{node.name}' Cannot Reach END",
            message=(
                f"Node '{node.name}' is reachable from START but has no path leading to the END node. "
                f"This creates a workflow branch that can never complete successfully."
            ),
            affected_nodes=[nid],
            rule_violated="All non-terminal nodes must have a path to END",
            suggestion=f"Add an edge from '{node.name}' leading toward the END state, "
                       f"or add an explicit FAILURE/END node at this branch.",
        ))

    return issues


# ── CHECK E: Cycle Detection ──────────────────────────────────────────────────

def check_cycles(workflow: WorkflowIR, G: nx.DiGraph, node_map: Dict[str, WorkflowNode]) -> List[VerificationIssue]:
    """
    Detect circular dependencies using NetworkX cycle detection.
    Some cycles (retry loops) may be intentional — flag based on node types.
    """
    issues = []
    try:
        cycle = nx.find_cycle(G, orientation="original")
        cycle_node_ids = list({u for u, v, d in cycle} | {v for u, v, d in cycle})
        cycle_node_names = [node_map[n].name for n in cycle_node_ids if n in node_map]
        cycle_path = " → ".join([node_map[u].name for u, v, d in cycle if u in node_map])

        # Check if all cycle nodes are RECOVERY type (intentional retry)
        cycle_types = {node_map[n].type for n in cycle_node_ids if n in node_map}
        is_recovery_cycle = cycle_types.issubset({NodeType.RECOVERY, NodeType.FAILURE})

        if not is_recovery_cycle:
            issues.append(_make_issue(
                check_name=CHECK_CYCLE,
                severity=IssueSeverity.CRITICAL,
                title="Circular Dependency Detected",
                message=(
                    f"A circular dependency exists in the workflow: {cycle_path} → ...\n"
                    f"Nodes involved: {', '.join(cycle_node_names)}\n"
                    f"This creates an infinite loop that will never reach the END state. "
                    f"The workflow cannot complete execution."
                ),
                affected_nodes=cycle_node_ids,
                rule_violated="Workflows must be directed acyclic graphs (DAGs) unless cycles are explicit recovery loops",
                suggestion=(
                    "Break the circular dependency by:\n"
                    "1. Removing one of the edges in the cycle\n"
                    "2. Adding a termination condition to one of the nodes\n"
                    "3. Converting to an explicit RECOVERY node with a maximum retry count"
                ),
            ))

    except nx.NetworkXNoCycle:
        pass  # No cycle — this is correct

    return issues


# ── CHECK F: State Transition Validation ──────────────────────────────────────

def check_state_transitions(workflow: WorkflowIR, G: nx.DiGraph, node_map: Dict[str, WorkflowNode]) -> List[VerificationIssue]:
    """
    Validate that each edge's required_state is actually produced by the source node
    or an ancestor of the source node (reachable in the forward graph).
    """
    issues = []
    # Build a map of what states are available at each node (produced by predecessors)
    state_producers: Dict[str, str] = {}
    for node in workflow.nodes:
        for output in node.outputs:
            state_producers[output] = node.id

    try:
        topo_order = list(nx.topological_sort(G))
    except nx.NetworkXUnfeasible:
        return issues

    # Compute available states at each node via forward propagation
    available_states: Dict[str, Set[str]] = {n.id: set() for n in workflow.nodes}
    for nid in topo_order:
        node = node_map.get(nid)
        if not node:
            continue
        # Add own outputs to successors
        for output in node.outputs:
            for successor in G.successors(nid):
                available_states[successor].add(output)
        # Propagate predecessor states
        for predecessor in G.predecessors(nid):
            available_states[nid].update(available_states.get(predecessor, set()))

    # Check each edge
    for edge in workflow.edges:
        if not edge.required_state:
            continue
        target = node_map.get(edge.target)
        if not target:
            continue

        states_at_target = available_states.get(edge.target, set())
        if edge.required_state not in states_at_target:
            source = node_map.get(edge.source)
            issues.append(_make_issue(
                check_name=CHECK_STATE_TRANSITIONS,
                severity=IssueSeverity.CRITICAL,
                title=f"Invalid State Transition: Required State Not Available",
                message=(
                    f"Edge from '{source.name if source else edge.source}' to "
                    f"'{target.name}' requires state '{edge.required_state}', "
                    f"but this state is not produced by any preceding node. "
                    f"The transition cannot be made safely."
                ),
                affected_nodes=[edge.source, edge.target],
                affected_edges=[edge.id],
                rule_violated="Edge required_state must be produced by a preceding node",
                suggestion=(
                    f"Add a node before '{target.name}' that produces the state "
                    f"'{edge.required_state}', or remove the required_state constraint "
                    f"from this edge if it is optional."
                ),
            ))

    return issues


# ── CHECK G: Missing Dependency Check ─────────────────────────────────────────

def check_dependencies(workflow: WorkflowIR, G: nx.DiGraph, node_map: Dict[str, WorkflowNode]) -> List[VerificationIssue]:
    """
    Verify that all declared dependencies (node.dependencies) have corresponding
    edges pointing to those dependency nodes AND those nodes exist in the workflow.
    """
    issues = []
    all_node_ids = {n.id for n in workflow.nodes}
    edges_from: Dict[str, Set[str]] = {}
    for edge in workflow.edges:
        edges_from.setdefault(edge.source, set()).add(edge.target)

    # Also build reverse: what nodes point TO each node
    edges_to: Dict[str, Set[str]] = {}
    for edge in workflow.edges:
        edges_to.setdefault(edge.target, set()).add(edge.source)

    for node in workflow.nodes:
        # Check declared node dependencies
        for dep_id in node.dependencies:
            if dep_id not in all_node_ids:
                issues.append(_make_issue(
                    check_name=CHECK_DEPENDENCIES,
                    severity=IssueSeverity.CRITICAL,
                    title=f"Missing Dependency Node: '{dep_id}'",
                    message=(
                        f"Node '{node.name}' declares a dependency on node '{dep_id}', "
                        f"but this node does not exist in the workflow. "
                        f"The dependency cannot be satisfied."
                    ),
                    affected_nodes=[node.id],
                    rule_violated="All declared dependencies must exist as nodes in the workflow",
                    suggestion=f"Add the missing node '{dep_id}' to the workflow, or remove the invalid dependency declaration.",
                ))
            else:
                # Check that there's an edge from the dependency to this node (or an ancestor path)
                dep_ancestors = nx.ancestors(G, node.id) if node.id in G else set()
                if dep_id not in dep_ancestors:
                    dep_node = node_map.get(dep_id)
                    issues.append(_make_issue(
                        check_name=CHECK_DEPENDENCIES,
                        severity=IssueSeverity.CRITICAL,
                        title=f"Dependency Not Enforced: '{dep_node.name if dep_node else dep_id}' → '{node.name}'",
                        message=(
                            f"Node '{node.name}' declares '{dep_node.name if dep_node else dep_id}' as a dependency, "
                            f"but there is no edge path enforcing this dependency. "
                            f"'{node.name}' could execute before its dependency completes."
                        ),
                        affected_nodes=[node.id, dep_id],
                        rule_violated="Dependencies must be enforced by edge connections in the graph",
                        suggestion=f"Add an edge from '{dep_node.name if dep_node else dep_id}' to '{node.name}', "
                                   f"or add it as a required predecessor.",
                    ))

        # Check declared inputs — each input state must be produceable
        state_producers = {output: n.id for n in workflow.nodes for output in n.outputs}
        for inp in node.inputs:
            if inp not in state_producers:
                issues.append(_make_issue(
                    check_name=CHECK_DEPENDENCIES,
                    severity=IssueSeverity.CRITICAL,
                    title=f"Unsatisfied Input: '{node.name}' requires '{inp}'",
                    message=(
                        f"Node '{node.name}' declares '{inp}' as a required input, "
                        f"but no node in the workflow produces this state. "
                        f"The input can never be satisfied."
                    ),
                    affected_nodes=[node.id],
                    rule_violated="All declared node inputs must be produced by at least one other node",
                    suggestion=f"Add a node that produces '{inp}' before '{node.name}' in the workflow.",
                ))

    return issues


# ── CHECK H: Failure Path Validation ──────────────────────────────────────────

def check_failure_paths(workflow: WorkflowIR, G: nx.DiGraph, node_map: Dict[str, WorkflowNode]) -> List[VerificationIssue]:
    """
    Identify critical nodes (is_critical=True or APPROVAL type) that have no
    outgoing FAILURE or RECOVERY edge. These nodes have no recovery mechanism.
    """
    issues = []
    edge_types_from: Dict[str, List[str]] = {}
    for edge in workflow.edges:
        edge_types_from.setdefault(edge.source, []).append(edge.transition_type.value)

    failure_node_ids = {n.id for n in workflow.nodes if n.type in [NodeType.FAILURE, NodeType.RECOVERY]}
    failure_targets: Dict[str, bool] = {}
    for edge in workflow.edges:
        if edge.target in failure_node_ids or edge.transition_type.value in ["FALLBACK", "ERROR"]:
            failure_targets[edge.source] = True

    for node in workflow.nodes:
        if node.type in [NodeType.START, NodeType.END, NodeType.FAILURE, NodeType.RECOVERY]:
            continue

        if node.is_critical or node.type == NodeType.APPROVAL or node.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL]:
            has_failure_path = failure_targets.get(node.id, False)
            if not has_failure_path:
                issues.append(_make_issue(
                    check_name=CHECK_FAILURE_PATHS,
                    severity=IssueSeverity.WARNING,
                    title=f"No Failure Recovery Path: '{node.name}'",
                    message=(
                        f"Critical node '{node.name}' (type: {node.type.value}, risk: {node.risk_level.value}) "
                        f"has no failure/recovery edge. If this node fails, the workflow has "
                        f"no defined recovery mechanism and may leave the system in an undefined state."
                    ),
                    affected_nodes=[node.id],
                    rule_violated="Critical and high-risk nodes must have defined failure/recovery paths",
                    suggestion=(
                        f"Add a FAILURE or RECOVERY node connected from '{node.name}' "
                        f"with transition_type='ERROR' or 'FALLBACK'. "
                        f"Define what happens when this step fails (retry, fallback actor, manual review)."
                    ),
                ))

    return issues


# ── CHECK I: Ambiguity Detection ──────────────────────────────────────────────

AMBIGUOUS_ACTOR_PATTERNS = {
    "manager": "Role 'Manager' is ambiguous — which manager? (Finance, HR, Department, Direct?)",
    "team": "Actor 'Team' is not a specific role — assign a named role or group.",
    "admin": "Actor 'Admin' is too broad — specify which administrative role.",
    "user": "Actor 'User' is overly generic — specify the exact user role.",
    "someone": "Actor 'someone' is undefined — assign a concrete role.",
    "anyone": "Actor 'anyone' creates authorization ambiguity — restrict to a specific role.",
    "system": "Actor 'System' on a non-automated step is ambiguous — if human involvement is expected, specify the role.",
    "approver": "Actor 'Approver' without role qualification is ambiguous.",
    "reviewer": "Actor 'Reviewer' without role qualification is ambiguous.",
}

AMBIGUOUS_CONDITION_PATTERNS = [
    "if needed", "if necessary", "when appropriate", "if applicable",
    "may be required", "as needed", "optionally",
]


def check_ambiguity(workflow: WorkflowIR, node_map: Dict[str, WorkflowNode]) -> List[VerificationIssue]:
    """
    Detect semantic ambiguities in actors, conditions, and permissions.
    Combines pattern matching with structural validation.
    """
    issues = []

    for node in workflow.nodes:
        if node.type in [NodeType.START, NodeType.END]:
            continue

        actor_lower = node.actor.lower().strip()

        # Check actor ambiguity (only exact match or standalone generic term)
        actor_words = set(actor_lower.replace('_', ' ').replace('-', ' ').split())
        for pattern, message in AMBIGUOUS_ACTOR_PATTERNS.items():
            if actor_lower == pattern or pattern in actor_words:
                issues.append(_make_issue(
                    check_name=CHECK_AMBIGUITY,
                    severity=IssueSeverity.WARNING,
                    title=f"Ambiguous Actor: '{node.actor}' on '{node.name}'",
                    message=(
                        f"Node '{node.name}': {message}\n"
                        f"Ambiguous actors create authorization gaps and make policy "
                        f"enforcement unpredictable."
                    ),
                    affected_nodes=[node.id],
                    rule_violated="All actors must be specifically named roles or systems",
                    suggestion=f"Replace '{node.actor}' with a specific role name in '{node.name}'.",
                ))
                break

        # Check for ambiguous conditions in preconditions
        for precond in node.preconditions:
            for pattern in AMBIGUOUS_CONDITION_PATTERNS:
                if pattern.lower() in precond.lower():
                    issues.append(_make_issue(
                        check_name=CHECK_AMBIGUITY,
                        severity=IssueSeverity.WARNING,
                        title=f"Ambiguous Condition in '{node.name}'",
                        message=(
                            f"Precondition '{precond}' in node '{node.name}' contains "
                            f"ambiguous qualifier '{pattern}'. This creates non-deterministic "
                            f"execution paths that cannot be reliably verified."
                        ),
                        affected_nodes=[node.id],
                        rule_violated="Preconditions must be deterministic boolean expressions",
                        suggestion=f"Replace '{pattern}' with a specific, testable condition.",
                    ))

        # Check APPROVAL nodes with no explicit recipients
        if node.type == NodeType.APPROVAL and not node.required_permissions:
            issues.append(_make_issue(
                check_name=CHECK_AMBIGUITY,
                severity=IssueSeverity.WARNING,
                title=f"Approval Without Permission Specification: '{node.name}'",
                message=(
                    f"Approval node '{node.name}' has no required_permissions specified. "
                    f"Without explicit permission requirements, the approval process is "
                    f"ambiguous and could be performed by any user."
                ),
                affected_nodes=[node.id],
                rule_violated="APPROVAL nodes must have explicit required_permissions",
                suggestion=f"Add required_permissions to '{node.name}' specifying who can approve.",
            ))

    # Also report workflow-level ambiguities from metadata
    for amb in workflow.metadata.ambiguities:
        issues.append(_make_issue(
            check_name=CHECK_AMBIGUITY,
            severity=IssueSeverity.WARNING,
            title="Policy-Level Ambiguity Detected",
            message=amb,
            rule_violated="Natural language policies must be unambiguous",
            suggestion="Clarify the policy statement to remove ambiguity before generation.",
        ))

    return issues


# ── CHECK J: Connectivity ─────────────────────────────────────────────────────

def check_connectivity(workflow: WorkflowIR, G: nx.DiGraph) -> List[VerificationIssue]:
    """
    Detect disconnected subgraphs — nodes that are isolated from the main workflow.
    """
    issues = []
    if G.number_of_nodes() == 0:
        return issues

    undirected = G.to_undirected()
    components = list(nx.connected_components(undirected))

    if len(components) > 1:
        main_component = max(components, key=len)
        for component in components:
            if component == main_component:
                continue
            node_names = [G.nodes[n]["data"].name for n in component if "data" in G.nodes.get(n, {})]
            issues.append(_make_issue(
                check_name=CHECK_CONNECTIVITY,
                severity=IssueSeverity.WARNING,
                title=f"Disconnected Workflow Subgraph Detected",
                message=(
                    f"A group of {len(component)} node(s) is disconnected from the main workflow: "
                    f"{', '.join(node_names or list(component))}. "
                    f"These nodes will never execute as part of the main workflow."
                ),
                affected_nodes=list(component),
                rule_violated="All nodes must be part of a single connected workflow graph",
                suggestion="Connect these nodes to the main workflow or remove them if unnecessary.",
            ))

    return issues


# ── SCORING ENGINE ────────────────────────────────────────────────────────────

def calculate_scores(issues: List[VerificationIssue], warnings: List[VerificationIssue],
                     passed_checks: List[str], workflow: WorkflowIR) -> Tuple[float, DimensionScores]:
    """
    Calculate the overall risk score and dimension scores from actual verification results.
    
    Scoring logic:
    - Base score: 100
    - Each CRITICAL issue: -15 points
    - Each WARNING: -5 points
    - Dimension scores are independent sub-scores
    """
    # Dimension issue mapping
    security_checks = {CHECK_APPROVAL_BYPASS, CHECK_AUTHORIZATION}
    correctness_checks = {CHECK_ORDERING, CHECK_STATE_TRANSITIONS, CHECK_CYCLE}
    authorization_checks = {CHECK_AUTHORIZATION, CHECK_APPROVAL_BYPASS}
    reliability_checks = {CHECK_FAILURE_PATHS, CHECK_REACHABILITY, CHECK_CONNECTIVITY}
    ambiguity_checks = {CHECK_AMBIGUITY}

    def score_dimension(relevant_checks: Set[str]) -> float:
        base = 100.0
        for issue in issues:
            if issue.check_name in relevant_checks:
                base -= 35.0
        for warning in warnings:
            if warning.check_name in relevant_checks:
                base -= 8.0
        return max(0.0, base)

    dim = DimensionScores(
        security=score_dimension(security_checks),
        correctness=score_dimension(correctness_checks),
        authorization=score_dimension(authorization_checks),
        reliability=score_dimension(reliability_checks),
        ambiguity=score_dimension(ambiguity_checks),
    )

    # Base overall calculation with direct critical penalty
    overall = (
        dim.security * 0.30 +
        dim.correctness * 0.25 +
        dim.authorization * 0.25 +
        dim.reliability * 0.15 +
        dim.ambiguity * 0.05
    )
    if issues:
        overall = min(overall, max(20.0, 100.0 - len(issues) * 30.0))
    overall = max(0.0, min(100.0, overall))

    return overall, dim


# ── PUBLIC API: Run Full Verification ─────────────────────────────────────────

def verify_workflow(workflow: WorkflowIR) -> VerificationResult:
    """
    Run the complete deterministic verification suite on a WorkflowIR.
    This is the primary public API for the verification engine.
    
    Returns a VerificationResult with status, score, all issues, and suggestions.
    """
    G = _build_nx_graph(workflow)
    node_map = _get_node_map(workflow)

    all_issues: List[VerificationIssue] = []
    all_warnings: List[VerificationIssue] = []
    passed_checks: List[str] = []
    failed_checks: List[str] = []

    # Run all checks in order
    checks = [
        (CHECK_CONNECTIVITY, lambda: check_connectivity(workflow, G)),
        (CHECK_REACHABILITY, lambda: check_reachability(workflow, G, node_map)),
        (CHECK_CYCLE, lambda: check_cycles(workflow, G, node_map)),
        (CHECK_ORDERING, lambda: check_ordering(workflow, G, node_map)),
        (CHECK_AUTHORIZATION, lambda: check_authorization(workflow, G, node_map)),
        (CHECK_APPROVAL_BYPASS, lambda: check_approval_bypass(workflow, G, node_map)),
        (CHECK_STATE_TRANSITIONS, lambda: check_state_transitions(workflow, G, node_map)),
        (CHECK_DEPENDENCIES, lambda: check_dependencies(workflow, G, node_map)),
        (CHECK_FAILURE_PATHS, lambda: check_failure_paths(workflow, G, node_map)),
        (CHECK_AMBIGUITY, lambda: check_ambiguity(workflow, node_map)),
    ]

    for check_name, check_fn in checks:
        try:
            found = check_fn()
            criticals = [i for i in found if i.severity == IssueSeverity.CRITICAL]
            warnings = [i for i in found if i.severity == IssueSeverity.WARNING]

            if criticals:
                all_issues.extend(criticals)
                failed_checks.append(check_name)
            elif warnings:
                all_warnings.extend(warnings)
                if check_name not in failed_checks:
                    passed_checks.append(check_name)
            else:
                passed_checks.append(check_name)

        except Exception as e:
            all_issues.append(_make_issue(
                check_name=check_name,
                severity=IssueSeverity.CRITICAL,
                title=f"Verification Check Error: {check_name}",
                message=f"Check '{check_name}' encountered an error: {str(e)}",
                rule_violated="Verification checks must complete successfully",
                suggestion="Review the workflow structure for malformed nodes or edges.",
            ))
            failed_checks.append(check_name)

    # Calculate scores
    overall_score, dim_scores = calculate_scores(all_issues, all_warnings, passed_checks, workflow)

    # Determine status
    if all_issues:
        status = VerificationStatus.BLOCKED
    elif all_warnings and overall_score < 85:
        status = VerificationStatus.WARNING
    else:
        status = VerificationStatus.SAFE

    # Collect affected nodes/edges
    affected_nodes = list(set(n for issue in all_issues + all_warnings for n in issue.affected_nodes))
    affected_edges = list(set(e for issue in all_issues + all_warnings for e in issue.affected_edges))

    # Build repair suggestions
    repair_suggestions = list(set(
        issue.suggestion for issue in all_issues + all_warnings
        if issue.suggestion
    ))

    return VerificationResult(
        workflow_id=workflow.id,
        status=status,
        score=overall_score,
        dimension_scores=dim_scores,
        issues=all_issues,
        warnings=all_warnings,
        passed_checks=passed_checks,
        failed_checks=failed_checks,
        affected_nodes=affected_nodes,
        affected_edges=affected_edges,
        repair_suggestions=repair_suggestions,
    )
