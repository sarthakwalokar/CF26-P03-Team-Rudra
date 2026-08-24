// FlowGuard AI — TypeScript types mirroring the backend Pydantic schemas

export type NodeType =
  | 'START' | 'ACTION' | 'CONDITION' | 'APPROVAL' | 'VALIDATION'
  | 'SERVICE' | 'HUMAN_REVIEW' | 'END' | 'FAILURE' | 'RECOVERY';

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type FailurePolicy = 'BLOCK' | 'RETRY' | 'FALLBACK' | 'IGNORE';
export type TransitionType = 'SEQUENTIAL' | 'CONDITIONAL' | 'PARALLEL' | 'FALLBACK' | 'ERROR';
export type WorkflowStatus = 'DRAFT' | 'PARSING' | 'VERIFIED' | 'WARNING' | 'BLOCKED' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
export type VerificationStatus = 'SAFE' | 'WARNING' | 'BLOCKED';
export type IssueSeverity = 'CRITICAL' | 'WARNING' | 'INFO';
export type AttackType =
  | 'APPROVAL_BYPASS' | 'UNAUTHORIZED_ACTOR' | 'MISSING_DEPENDENCY'
  | 'SERVICE_UNAVAILABLE' | 'TIMEOUT' | 'SERVICE_TIMEOUT' | 'DUPLICATE_ACTION' | 'DUPLICATE_EXECUTION'
  | 'INVALID_STATE' | 'FAILED_PREREQUISITE' | 'DEPENDENCY_FAILURE'
  | 'INVALID_INPUT' | 'MISSING_APPROVAL' | 'INVALID_TRANSITION' | 'RECOVERY_FAILURE';

export type AuditEventType =
  | 'WORKFLOW_CREATED' | 'WORKFLOW_PARSED'
  | 'VERIFICATION_STARTED' | 'VERIFICATION_PASSED' | 'VERIFICATION_FAILED'
  | 'ATTACK_STARTED' | 'VULNERABILITY_FOUND'
  | 'REPAIR_PROPOSED' | 'REPAIR_APPLIED' | 'RE_VERIFICATION_PASSED'
  | 'SIMULATION_RUN' | 'STRESS_TEST_RUN'
  | 'EXECUTION_STARTED' | 'EXECUTION_COMPLETED' | 'EXECUTION_BLOCKED' | 'EXECUTION_FAILED';

// ── Core IR ──────────────────────────────────────────────────────────────────

export interface WorkflowNode {
  id: string;
  name: string;
  type: NodeType;
  action: string;
  actor: string;
  required_permissions: string[];
  inputs: string[];
  outputs: string[];
  preconditions: string[];
  postconditions: string[];
  dependencies: string[];
  risk_level: RiskLevel;
  failure_policy: FailurePolicy;
  timeout_seconds: number | null;
  retry_count: number;
  is_critical: boolean;
  description: string;
  position?: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  condition: string | null;
  transition_type: TransitionType;
  required_state: string | null;
  label: string | null;
  is_critical: boolean;
}

export interface WorkflowMetadata {
  domain: string;
  policy_text: string;
  parsed_by: string;
  tags: string[];
  actors: string[];
  permissions: string[];
  ambiguities: string[];
}

export interface WorkflowIR {
  id: string;
  name: string;
  description: string;
  version: string;
  status: WorkflowStatus;
  risk_score: number;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  metadata: WorkflowMetadata;
  created_at: string;
  updated_at: string;
}

// ── Verification ─────────────────────────────────────────────────────────────

export interface VerificationIssue {
  id: string;
  check_name: string;
  severity: IssueSeverity;
  title: string;
  message: string;
  affected_nodes: string[];
  affected_edges: string[];
  rule_violated: string;
  suggestion: string;
}

export interface DimensionScores {
  security: number;
  correctness: number;
  authorization: number;
  reliability: number;
  ambiguity: number;
}

export interface VerificationResult {
  workflow_id: string;
  status: VerificationStatus;
  score: number;
  dimension_scores: DimensionScores;
  issues: VerificationIssue[];
  warnings: VerificationIssue[];
  passed_checks: string[];
  failed_checks: string[];
  affected_nodes: string[];
  affected_edges: string[];
  repair_suggestions: string[];
  verified_at: string;
}

// ── Attack ───────────────────────────────────────────────────────────────────

export interface AttackFinding {
  id: string;
  attack_type: AttackType;
  severity: IssueSeverity;
  title: string;
  description: string;
  attack_path: string[];
  affected_nodes: string[];
  affected_edges: string[];
  exploit_scenario: string;
  mitigation: string;
}

export interface AttackResult {
  workflow_id: string;
  scenarios_run: number;
  vulnerabilities_found: number;
  critical_count: number;
  warning_count: number;
  findings: AttackFinding[];
  overall_security_score: number;
  attacked_at: string;
}

// ── Repair ───────────────────────────────────────────────────────────────────

export interface RepairStep {
  action: string;
  description: string;
  node_id?: string;
  edge_id?: string;
}

export interface RepairProposal {
  id: string;
  issue_id: string;
  title: string;
  description: string;
  steps: RepairStep[];
  original_workflow: WorkflowIR;
  repaired_workflow: WorkflowIR;
  verification_result?: VerificationResult;
  proposed_at: string;
}

// ── Simulation ───────────────────────────────────────────────────────────────

export interface SimulationScenario {
  scenario_type: string;
  affected_node_id: string;
  description: string;
  fallback_available: boolean;
  fallback_path: string[];
  outcome: string;
}

export interface SimulationResult {
  workflow_id: string;
  scenario: SimulationScenario;
  modified_workflow: WorkflowIR;
  verification_result: VerificationResult;
  can_continue: boolean;
  explanation: string;
  simulated_at: string;
}

// ── Stress Test ──────────────────────────────────────────────────────────────

export interface StressTestConfig {
  total_scenarios: number;
  scenario_mix: Record<string, number>;
}

export interface StressTestResult {
  workflow_id: string;
  total: number;
  passed: number;
  failed: number;
  critical_failures: number;
  warnings: number;
  robustness_score: number;
  scenario_breakdown: Record<string, Record<string, number>>;
  completed_at: string;
}

// ── Execution ────────────────────────────────────────────────────────────────

export type ExecutionEventType =
  | 'STARTED' | 'NODE_ENTER' | 'NODE_COMPLETE' | 'NODE_FAILED'
  | 'NODE_RETRY' | 'NODE_SKIPPED' | 'FALLBACK_TRIGGERED'
  | 'COMPLETED' | 'FAILED' | 'BLOCKED';

export type NodeExecutionState =
  | 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED' | 'RETRYING';

export interface ExecutionEvent {
  id: string;
  run_id: string;
  node_id?: string;
  node_name?: string;
  event_type: ExecutionEventType;
  message: string;
  timestamp: string;
  duration_ms?: number;
  metadata: Record<string, unknown>;
}

export interface ExecutionRun {
  id: string;
  workflow_id: string;
  status: string;
  node_states: Record<string, NodeExecutionState>;
  events: ExecutionEvent[];
  current_node_id?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number;
}

// ── Audit ────────────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  workflow_id: string;
  event_type: AuditEventType;
  title: string;
  details: Record<string, unknown>;
  severity: string;
  timestamp: string;
}

// ── API Request/Response ─────────────────────────────────────────────────────

export interface GenerateWorkflowResponse {
  workflow: WorkflowIR;
  ambiguities: string[];
  parse_confidence: number;
  parsed_by: string;
}

export interface WorkflowListItem {
  id: string;
  name: string;
  description: string;
  version: string;
  status: WorkflowStatus;
  risk_score: number;
  created_at: string;
  updated_at: string;
}
