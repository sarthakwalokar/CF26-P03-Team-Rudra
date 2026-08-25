// Shared utility helpers
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { NodeType, RiskLevel, VerificationStatus, IssueSeverity } from '../types/workflow';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getStatusBadgeClass(status: VerificationStatus | string): string {
  switch (status) {
    case 'SAFE': return 'badge-safe';
    case 'WARNING': return 'badge-warning';
    case 'BLOCKED': return 'badge-blocked';
    default: return 'badge-info';
  }
}

export function getSeverityBadgeClass(severity: IssueSeverity | string): string {
  switch (severity) {
    case 'CRITICAL': return 'badge-critical';
    case 'WARNING': return 'badge-warning';
    case 'INFO': return 'badge-info';
    default: return 'badge-info';
  }
}

export function getScoreColor(score: number): string {
  if (score >= 85) return '#10B981';
  if (score >= 60) return '#F59E0B';
  return '#EF4444';
}

export function getScoreClass(score: number): string {
  if (score >= 85) return 'score-high';
  if (score >= 60) return 'score-medium';
  return 'score-low';
}

export function getRiskLevelColor(level: RiskLevel): string {
  switch (level) {
    case 'LOW': return '#10B981';
    case 'MEDIUM': return '#F59E0B';
    case 'HIGH': return '#F97316';
    case 'CRITICAL': return '#EF4444';
  }
}

export const NODE_TYPE_CONFIG: Record<NodeType, { color: string; icon: string; label: string; borderColor: string }> = {
  START: { color: '#10B981', icon: '▶', label: 'START', borderColor: '#10B981' },
  END: { color: '#10B981', icon: '■', label: 'END', borderColor: '#10B981' },
  ACTION: { color: '#06B6D4', icon: '⚡', label: 'ACTION', borderColor: '#06B6D4' },
  CONDITION: { color: '#EC4899', icon: '◆', label: 'CONDITION', borderColor: '#EC4899' },
  APPROVAL: { color: '#F59E0B', icon: '✓', label: 'APPROVAL', borderColor: '#F59E0B' },
  VALIDATION: { color: '#3B82F6', icon: '🔍', label: 'VALIDATION', borderColor: '#3B82F6' },
  SERVICE: { color: '#8B5CF6', icon: '⚙', label: 'SERVICE', borderColor: '#8B5CF6' },
  HUMAN_REVIEW: { color: '#FBBF24', icon: '👤', label: 'REVIEW', borderColor: '#FBBF24' },
  FAILURE: { color: '#EF4444', icon: '✗', label: 'FAILURE', borderColor: '#EF4444' },
  RECOVERY: { color: '#F97316', icon: '↺', label: 'RECOVERY', borderColor: '#F97316' },
};

export function formatDuration(ms?: number): string {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
    d.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' });
}

export interface BenchmarkScenario {
  key: string;
  caseNumber: number;
  label: string;
  policy: string;
  expectedStatus: 'SAFE' | 'BLOCKED' | 'WARNING';
  expectedExplanation: string;
  description: string;
  badge: string;
  icon: string;
}

export const DEMO_POLICIES: BenchmarkScenario[] = [
  {
    key: 'procurement',
    caseNumber: 1,
    label: 'Case 1: Procurement (Hero)',
    policy: 'Verify the vendor, check the budget, obtain finance approval, and create the procurement ticket.',
    expectedStatus: 'SAFE',
    expectedExplanation: 'All 10 deterministic checks pass: proper role separation, explicit authorization, complete ordering.',
    description: 'Hero demo workflow from the official problem statement',
    badge: 'SAFE (Hero)',
    icon: '🏢',
  },
  {
    key: 'case_2_ambiguous',
    caseNumber: 2,
    label: 'Case 2: Semantic Ambiguity',
    policy: 'Review the request and approve it when appropriate.',
    expectedStatus: 'BLOCKED',
    expectedExplanation: "'appropriate' has no machine-verifiable definition. Approver role is unspecified.",
    description: 'Ambiguous policy with non-deterministic qualifiers',
    badge: 'BLOCKED',
    icon: '❓',
  },
  {
    key: 'case_3_approval_bypass',
    caseNumber: 3,
    label: 'Case 3: Approval Bypass',
    policy: 'Check the purchase request, create the procurement ticket, and obtain finance approval if necessary.',
    expectedStatus: 'BLOCKED',
    expectedExplanation: 'Procurement ticket creation occurs before required financial authorization.',
    description: 'High-risk action executed before required approval',
    badge: 'BLOCKED',
    icon: '⚠️',
  },
  {
    key: 'case_4_unauthorized_actor',
    caseNumber: 4,
    label: 'Case 4: Unauthorized Actor',
    policy: 'Employee verifies the request and approves the finance transaction.',
    expectedStatus: 'BLOCKED',
    expectedExplanation: 'Employee role is not authorized for financial approval (Separation of Duties violation).',
    description: 'Privilege escalation where low-privilege actor approves sensitive action',
    badge: 'BLOCKED',
    icon: '🚫',
  },
  {
    key: 'case_5_circular',
    caseNumber: 5,
    label: 'Case 5: Circular Deadlock',
    policy: 'Approval transitions to review, which routes back to approval.',
    expectedStatus: 'BLOCKED',
    expectedExplanation: 'Circular dependency can cause non-terminating execution loop (Deadlock).',
    description: 'Illegal cyclical transition causing infinite loop',
    badge: 'BLOCKED',
    icon: '🔄',
  },
  {
    key: 'case_6_unreachable',
    caseNumber: 6,
    label: 'Case 6: Unreachable State',
    policy: 'Verify the vendor, check the budget, and create the procurement ticket. (Offline Audit Logger is disconnected).',
    expectedStatus: 'BLOCKED',
    expectedExplanation: 'This state cannot be reached from START (disconnected orphan component).',
    description: 'Workflow graph containing dead disconnected node',
    badge: 'BLOCKED',
    icon: '🔌',
  },
  {
    key: 'refund',
    caseNumber: 7,
    label: 'Customer Refund',
    policy: 'Verify customer identity, perform fraud detection, obtain manager approval, then issue refund.',
    expectedStatus: 'WARNING',
    expectedExplanation: "Role 'Manager' is ambiguous without department specification.",
    description: 'Customer refund with KYC, fraud detection and manager sign-off',
    badge: 'MULTI-ROLE',
    icon: '💳',
  },
  {
    key: 'customer_onboarding',
    caseNumber: 8,
    label: 'Customer Onboarding',
    policy: 'Perform customer KYC verification, assign account tier, obtain compliance signoff, and activate account.',
    expectedStatus: 'SAFE',
    expectedExplanation: 'Complete banking onboarding pipeline with KYC and compliance signoff.',
    description: 'Enterprise onboarding pipeline with tier assignment and compliance gate',
    badge: 'SAFE',
    icon: '🚀',
  },
];
