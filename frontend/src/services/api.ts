// FlowGuard AI — API Service Layer
// All backend communication goes through this module

import axios from 'axios';
import type {
  WorkflowIR, GenerateWorkflowResponse, VerificationResult, VerificationIssue,
  AttackResult, AttackType, RepairProposal, SimulationResult, StressTestConfig,
  StressTestResult, ExecutionRun, AuditLog, WorkflowListItem,
} from '../types/workflow';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 60000,
});

// ── Workflows CRUD ──────────────────────────────────────────────────────────

export const listWorkflows = (): Promise<WorkflowListItem[]> =>
  api.get('/workflows/').then(r => r.data);

export const getWorkflow = (id: string): Promise<WorkflowIR> =>
  api.get(`/workflows/${id}`).then(r => r.data);

export const deleteWorkflow = (id: string): Promise<void> =>
  api.delete(`/workflows/${id}`).then(() => undefined);

// ── Generate Workflow from NL Policy ───────────────────────────────────────

export const generateWorkflow = (params: {
  policy_text: string;
  use_mock?: boolean;
  api_key?: string;
  name?: string;
}): Promise<GenerateWorkflowResponse> =>
  api.post('/workflows/generate', {
    policy_text: params.policy_text,
    use_mock: params.use_mock ?? true,
    api_key: params.api_key,
    name: params.name,
  }).then(r => r.data);

// ── Verification ────────────────────────────────────────────────────────────

export const verifyWorkflow = (workflow: WorkflowIR): Promise<VerificationResult> =>
  api.post('/workflows/verify', { workflow }).then(r => r.data);

// ── Attack Mode ─────────────────────────────────────────────────────────────

export const attackWorkflow = (
  workflow: WorkflowIR,
  attack_types?: AttackType[]
): Promise<AttackResult> =>
  api.post('/workflows/attack', { workflow, attack_types }).then(r => r.data);

// ── Auto-Repair ─────────────────────────────────────────────────────────────

export const repairWorkflow = (
  workflow: WorkflowIR,
  issue: VerificationIssue
): Promise<RepairProposal> =>
  api.post('/workflows/repair', { workflow, issue_id: issue.id, issue }).then(r => r.data);

// ── What-If Simulation ──────────────────────────────────────────────────────

export const simulateWorkflow = (
  workflow: WorkflowIR,
  scenario_type: string,
  affected_node_id: string
): Promise<SimulationResult> =>
  api.post('/workflows/simulate', { workflow, scenario_type, affected_node_id }).then(r => r.data);

// ── Stress Testing ──────────────────────────────────────────────────────────

export const stressTestWorkflow = (
  workflow: WorkflowIR,
  config: Partial<StressTestConfig>
): Promise<StressTestResult> =>
  api.post('/workflows/stress-test', {
    workflow,
    config: { total_scenarios: 1000, ...config },
  }).then(r => r.data);

// ── Safe Execution ──────────────────────────────────────────────────────────

export const executeWorkflow = (
  workflow: WorkflowIR,
  verification_result: VerificationResult
): Promise<ExecutionRun> =>
  api.post('/workflows/execute', {
    workflow_id: workflow.id,
    workflow,
    verification_result,
  }).then(r => r.data);

// ── Audit Trail ─────────────────────────────────────────────────────────────

export const getAuditTrail = (workflowId: string): Promise<AuditLog[]> =>
  api.get(`/audit/${workflowId}`).then(r => r.data);

// ── Error handling ──────────────────────────────────────────────────────────

api.interceptors.response.use(
  response => response,
  error => {
    const msg = error.response?.data?.detail || error.message || 'API error';
    return Promise.reject(new Error(typeof msg === 'string' ? msg : JSON.stringify(msg)));
  }
);
