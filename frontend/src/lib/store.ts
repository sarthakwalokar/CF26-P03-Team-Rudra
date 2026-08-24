// FlowGuard AI — Global Application Store (Zustand)
import { create } from 'zustand';
import type {
  WorkflowIR, VerificationResult, AttackResult,
  RepairProposal, StressTestResult, ExecutionRun, AuditLog,
} from '../types/workflow';

interface FlowGuardStore {
  // Current workflow
  currentWorkflow: WorkflowIR | null;
  setCurrentWorkflow: (w: WorkflowIR | null) => void;

  // Verification
  verificationResult: VerificationResult | null;
  setVerificationResult: (r: VerificationResult | null) => void;

  // Attack
  attackResult: AttackResult | null;
  setAttackResult: (r: AttackResult | null) => void;

  // Repair
  repairProposal: RepairProposal | null;
  setRepairProposal: (p: RepairProposal | null) => void;

  // Stress test
  stressTestResult: StressTestResult | null;
  setStressTestResult: (r: StressTestResult | null) => void;

  // Execution
  executionRun: ExecutionRun | null;
  setExecutionRun: (r: ExecutionRun | null) => void;

  // Audit
  auditLogs: AuditLog[];
  setAuditLogs: (logs: AuditLog[]) => void;
  addAuditLog: (log: AuditLog) => void;

  // UI state
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;

  highlightedNodes: Set<string>;
  setHighlightedNodes: (nodes: Set<string>) => void;

  highlightedEdges: Set<string>;
  setHighlightedEdges: (edges: Set<string>) => void;

  highlightMode: 'none' | 'attack' | 'verified' | 'executing' | 'repair';
  setHighlightMode: (mode: 'none' | 'attack' | 'verified' | 'executing' | 'repair') => void;

  // Settings
  apiKey: string;
  setApiKey: (key: string) => void;
  useMock: boolean;
  setUseMock: (v: boolean) => void;

  // Loading states
  isGenerating: boolean;
  setIsGenerating: (v: boolean) => void;
  isVerifying: boolean;
  setIsVerifying: (v: boolean) => void;
  isAttacking: boolean;
  setIsAttacking: (v: boolean) => void;
  isRepairing: boolean;
  setIsRepairing: (v: boolean) => void;
  isExecuting: boolean;
  setIsExecuting: (v: boolean) => void;
  isStressTesting: boolean;
  setIsStressTesting: (v: boolean) => void;

  // Clear all
  reset: () => void;
}

export const useFlowGuardStore = create<FlowGuardStore>((set) => ({
  currentWorkflow: null,
  setCurrentWorkflow: (w) => set({ currentWorkflow: w }),

  verificationResult: null,
  setVerificationResult: (r) => set({ verificationResult: r }),

  attackResult: null,
  setAttackResult: (r) => set({ attackResult: r }),

  repairProposal: null,
  setRepairProposal: (p) => set({ repairProposal: p }),

  stressTestResult: null,
  setStressTestResult: (r) => set({ stressTestResult: r }),

  executionRun: null,
  setExecutionRun: (r) => set({ executionRun: r }),

  auditLogs: [],
  setAuditLogs: (logs) => set({ auditLogs: logs }),
  addAuditLog: (log) => set((s) => ({ auditLogs: [log, ...s.auditLogs] })),

  selectedNodeId: null,
  setSelectedNodeId: (id) => set({ selectedNodeId: id }),

  highlightedNodes: new Set(),
  setHighlightedNodes: (nodes) => set({ highlightedNodes: nodes }),

  highlightedEdges: new Set(),
  setHighlightedEdges: (edges) => set({ highlightedEdges: edges }),

  highlightMode: 'none',
  setHighlightMode: (mode) => set({ highlightMode: mode }),

  apiKey: localStorage.getItem('fg_api_key') || '',
  setApiKey: (key) => {
    localStorage.setItem('fg_api_key', key);
    set({ apiKey: key });
  },

  useMock: localStorage.getItem('fg_use_mock') !== 'false',
  setUseMock: (v) => {
    localStorage.setItem('fg_use_mock', String(v));
    set({ useMock: v });
  },

  isGenerating: false,
  setIsGenerating: (v) => set({ isGenerating: v }),
  isVerifying: false,
  setIsVerifying: (v) => set({ isVerifying: v }),
  isAttacking: false,
  setIsAttacking: (v) => set({ isAttacking: v }),
  isRepairing: false,
  setIsRepairing: (v) => set({ isRepairing: v }),
  isExecuting: false,
  setIsExecuting: (v) => set({ isExecuting: v }),
  isStressTesting: false,
  setIsStressTesting: (v) => set({ isStressTesting: v }),

  reset: () => set({
    currentWorkflow: null,
    verificationResult: null,
    attackResult: null,
    repairProposal: null,
    stressTestResult: null,
    executionRun: null,
    auditLogs: [],
    selectedNodeId: null,
    highlightedNodes: new Set(),
    highlightedEdges: new Set(),
    highlightMode: 'none',
  }),
}));
