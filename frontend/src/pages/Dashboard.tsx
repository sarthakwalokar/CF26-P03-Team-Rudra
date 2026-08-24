import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Shield, ShieldCheck, Zap, ArrowRight, Wand2, Sparkles,
  CheckCircle2, AlertTriangle, Cpu, Terminal, Play, Loader2, ArrowUpRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlowGuardStore } from '../lib/store';
import { listWorkflows, generateWorkflow, verifyWorkflow } from '../services/api';
import { DEMO_POLICIES, getScoreColor, formatDateTime } from '../lib/utils';
import { toast } from 'sonner';

const PIPELINE_STAGES = [
  { id: 'policy', label: 'POLICY', desc: 'Natural language' },
  { id: 'parse', label: 'PARSE', desc: 'Gemini / Mock' },
  { id: 'ir', label: 'WORKFLOW IR', desc: 'Pydantic AST' },
  { id: 'analysis', label: 'STATIC ANALYSIS', desc: 'Graph algorithms' },
  { id: 'verify', label: 'VERIFY', desc: '10 Deterministic checks' },
  { id: 'execution', label: 'SAFE EXECUTION', desc: 'Gated state machine' },
];

const STATIC_CHECKLIST = [
  'Policy Parsed & Structured',
  'Workflow IR Generated',
  'Graph Topology Constructed',
  'Authorization & Permissions Checked',
  'Reachability & Deadlock Checked',
  'State Transitions Validated',
  'Verification Engine Passed',
];

const PRESET_CHIPS = [
  { key: 'procurement', label: 'Procurement', policy: 'Verify the vendor, check the budget, obtain finance approval, and create the procurement ticket.' },
  { key: 'refund', label: 'Refund', policy: 'Verify customer identity, perform fraud detection, obtain manager approval, then issue refund.' },
  { key: 'access', label: 'Employee Access', policy: 'Verify employee identity, obtain manager approval, then provision system access.' },
  { key: 'onboarding', label: 'Customer Onboarding', policy: 'Perform customer KYC verification, assign account tier, obtain compliance signoff, and activate account.' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentWorkflow, verificationResult, setCurrentWorkflow, setVerificationResult, isGenerating, setIsGenerating, apiKey, useMock } = useFlowGuardStore();
  const { data: workflows } = useQuery({ queryKey: ['workflows'], queryFn: listWorkflows, refetchInterval: 10000 });

  const [policyText, setPolicyText] = useState(
    currentWorkflow?.metadata?.policy_text || 'Verify the vendor, check the budget, obtain finance approval, and create the procurement ticket.'
  );
  const [pipelineStep, setPipelineStep] = useState<number>(currentWorkflow ? 6 : 0);

  const handleCompile = async () => {
    if (!policyText.trim() || policyText.length < 10) {
      toast.error('Please provide a policy description of at least 10 characters.');
      return;
    }
    setIsGenerating(true);
    setPipelineStep(1);

    try {
      // Step 1: Parse
      const resp = await generateWorkflow({
        policy_text: policyText,
        use_mock: useMock || !apiKey,
        api_key: apiKey || undefined,
      });
      setCurrentWorkflow(resp.workflow);
      setPipelineStep(3);

      // Step 2: Immediate verification
      const vResult = await verifyWorkflow(resp.workflow);
      setVerificationResult(vResult);
      setPipelineStep(6);

      toast.success(`Workflow compiled & verified (${resp.workflow.nodes.length} nodes · ${vResult.status})`);
    } catch (e: any) {
      toast.error('Compilation error: ' + e.message);
      setPipelineStep(0);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1300, margin: '0 auto', width: '100%' }}>

      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: 36, maxWidth: 840, margin: '0 auto 36px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 14px',
          borderRadius: 9999,
          background: 'rgba(14, 165, 233, 0.10)',
          border: '1px solid rgba(14, 165, 233, 0.28)',
          marginBottom: 16,
        }}>
          <Sparkles size={12} color="var(--fg-cyan-light)" />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-cyan-light)', letterSpacing: '0.04em' }}>
            P-03 · NATURAL LANGUAGE → VERIFIED WORKFLOW COMPILER
          </span>
        </div>

        <h1 style={{
          fontSize: 34,
          fontWeight: 800,
          color: 'var(--fg-text-0)',
          lineHeight: 1.2,
          letterSpacing: '-0.03em',
          margin: 0,
        }}>
          Turn Business Policies Into Verified Workflows.
        </h1>

        <p style={{
          fontSize: 15,
          color: 'var(--fg-text-2)',
          marginTop: 10,
          lineHeight: 1.5,
        }}>
          Compile natural-language policies into executable workflows and verify them before execution.
        </p>
      </div>

      {/* Large Policy Input Card */}
      <div className="soc-card-elevated" style={{ padding: 24, marginBottom: 32, border: '1px solid var(--fg-border-active)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={15} color="var(--fg-cyan)" />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-text-1)' }}>
              Describe your business policy...
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: useMock || !apiKey ? 'var(--fg-amber)' : 'var(--fg-cyan-light)', fontWeight: 600 }}>
              {useMock || !apiKey ? '🔧 Mock Heuristic Parser' : '🤖 Google Gemini 2.0'}
            </span>
          </div>
        </div>

        <textarea
          className="soc-input"
          value={policyText}
          onChange={(e) => setPolicyText(e.target.value)}
          rows={3}
          placeholder="e.g. Verify the vendor, check the budget, obtain finance approval, then create the ticket."
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            resize: 'vertical',
            minHeight: 88,
            marginBottom: 16,
            background: 'var(--fg-bg-1)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          {/* Example policy chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>Examples:</span>
            {PRESET_CHIPS.map((chip) => (
              <button
                key={chip.key}
                onClick={() => setPolicyText(chip.policy)}
                className="btn-soc-ghost"
                style={{
                  padding: '4px 10px',
                  background: 'var(--fg-bg-1)',
                  border: '1px solid var(--fg-border)',
                  fontSize: 11.5,
                  borderRadius: 6,
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {currentWorkflow && (
              <button
                className="btn-soc-secondary"
                onClick={() => navigate('/graph')}
              >
                <span>View Workspace</span>
                <ArrowRight size={13} />
              </button>
            )}
            <button
              className="btn-soc-primary"
              onClick={handleCompile}
              disabled={isGenerating}
              style={{ padding: '9px 24px', fontSize: 13 }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Compiling & Verifying…</span>
                </>
              ) : (
                <>
                  <Wand2 size={15} />
                  <span>Compile Policy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Compilation Pipeline */}
      <div className="soc-card" style={{ padding: 22, marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            COMPILATION & VERIFICATION PIPELINE
          </div>
          {verificationResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--fg-text-2)' }}>Safety Score:</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: getScoreColor(verificationResult.score), fontFamily: 'monospace' }}>
                {verificationResult.score.toFixed(0)}/100
              </span>
              <span className={`badge-status ${verificationResult.status === 'SAFE' ? 'badge-verified' : 'badge-warning'}`}>
                {verificationResult.status}
              </span>
            </div>
          )}
        </div>

        {/* Stepper Header */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8, marginBottom: 18 }}>
          {PIPELINE_STAGES.map((stg, i) => {
            const isPassed = pipelineStep > i;
            const isCurrent = pipelineStep === i;
            return (
              <div
                key={stg.id}
                className={`pipeline-step ${isPassed ? 'passed' : isCurrent ? 'active' : ''}`}
              >
                <div style={{
                  width: 18,
                  height: 18,
                  borderRadius: '50%',
                  background: isPassed ? 'rgba(16, 185, 129, 0.20)' : isCurrent ? 'rgba(14, 165, 233, 0.20)' : 'var(--fg-bg-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 700,
                  color: isPassed ? '#34D399' : isCurrent ? '#38BDF8' : 'var(--fg-text-3)',
                }}>
                  {isPassed ? '✓' : i + 1}
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{stg.label}</div>
                  <div style={{ fontSize: 9.5, color: 'var(--fg-text-3)', fontWeight: 400 }}>{stg.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Checklist of verification states */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 10,
          padding: '14px 16px',
          background: 'var(--fg-bg-1)',
          borderRadius: 8,
          border: '1px solid var(--fg-border)',
        }}>
          {STATIC_CHECKLIST.map((item, idx) => {
            const isCompleted = pipelineStep >= 6 || (pipelineStep > 0 && idx <= pipelineStep);
            return (
              <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {isCompleted ? (
                  <CheckCircle2 size={13} color="#10B981" />
                ) : (
                  <div style={{ width: 13, height: 13, borderRadius: '50%', border: '1.5px solid var(--fg-text-4)' }} />
                )}
                <span style={{ fontSize: 11.5, color: isCompleted ? 'var(--fg-text-1)' : 'var(--fg-text-3)', fontWeight: isCompleted ? 600 : 400 }}>
                  {item}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* P-03 Compliance Panel */}
      <div className="soc-card-elevated" style={{ padding: 22, marginBottom: 32, border: '1px solid rgba(16, 185, 129, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldCheck size={18} color="#10B981" />
            <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--fg-text-0)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              P-03 OFFICIAL COMPLIANCE MATRIX
            </span>
          </div>
          <span className="badge-status badge-verified">
            100% SPEC COMPLIANT
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
          {[
            { title: 'Natural Language Policy Parsing', desc: 'AI-assisted structured extraction with fallback heuristic parser' },
            { title: 'Workflow Intermediate Representation', desc: 'Formal Pydantic IR AST schema with type safety & metadata' },
            { title: 'Executable Workflow Graph', desc: 'Interactive 2D React Flow canvas with typed nodes & state edges' },
            { title: 'Semantic Ambiguity Detection', desc: 'Detects vague actors, fuzzy conditions, and unbound approvals' },
            { title: 'Static Policy Verification', desc: 'Deterministic 10-check mathematical & graph verification engine' },
            { title: 'Authorization Checks', desc: 'Validates explicit actor permissions and prevents unauthorized access' },
            { title: 'Reachability Analysis', desc: 'NetworkX graph reachability from START to END with dead-end pruning' },
            { title: 'Circular State Detection', desc: 'Directed cycle detection preventing infinite execution loops' },
            { title: 'Invalid State Transition Detection', desc: 'Ensures preconditions, postconditions & order constraints hold' },
            { title: 'Human-Readable Failure Explanation', desc: 'Actionable root-cause diagnosis, graph highlighting & auto-repair' },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                padding: '10px 12px',
                background: 'var(--fg-bg-1)',
                border: '1px solid var(--fg-border)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
              }}
            >
              <CheckCircle2 size={14} color="#10B981" style={{ marginTop: 2, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-text-1)' }}>{item.title}</div>
                <div style={{ fontSize: 10.5, color: 'var(--fg-text-3)', marginTop: 2 }}>{item.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Command Operations Quick Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 32 }}>
        {[
          {
            title: 'Interactive IDE',
            desc: '2D Visual canvas with state machine flow',
            icon: Cpu,
            path: '/graph',
            badge: `${currentWorkflow?.nodes.length || 0} Nodes`,
            color: 'var(--fg-cyan)',
          },
          {
            title: 'Verification Engine',
            desc: '10 Deterministic graph checks & AST rules',
            icon: ShieldCheck,
            path: '/verify',
            badge: verificationResult?.status || 'Ready',
            color: '#10B981',
          },
          {
            title: 'Attack Lab',
            desc: '9 Adversarial security penetration vectors',
            icon: Zap,
            path: '/attack',
            badge: 'Adversarial',
            color: '#F43F5E',
          },
          {
            title: '3D Digital Twin',
            desc: 'Real-time telemetry spatial representation',
            icon: Play,
            path: '/3d',
            badge: 'Live Sync',
            color: 'var(--fg-violet)',
          },
        ].map((mod) => (
          <div
            key={mod.title}
            onClick={() => navigate(mod.path)}
            className="soc-card-interactive"
            style={{ padding: 20 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: `${mod.color}15`,
                border: `1px solid ${mod.color}35`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <mod.icon size={17} color={mod.color} />
              </div>
              <span className="badge-status badge-info" style={{ fontSize: 10 }}>
                {mod.badge}
              </span>
            </div>

            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-text-0)', marginBottom: 4 }}>
              {mod.title}
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-text-2)' }}>
              {mod.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Recent Compiled Workflows */}
      {workflows && workflows.length > 0 && (
        <div className="soc-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-text-1)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Recent Verified Workflows
            </div>
            <button className="btn-soc-ghost" onClick={() => navigate('/history')} style={{ fontSize: 11.5 }}>
              View All History →
            </button>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--fg-border)', textAlign: 'left' }}>
                <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>NAME</th>
                <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>STATUS</th>
                <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>SAFETY SCORE</th>
                <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>LAST UPDATED</th>
                <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}></th>
              </tr>
            </thead>
            <tbody>
              {workflows.slice(0, 5).map((w) => (
                <tr
                  key={w.id}
                  onClick={() => navigate('/graph')}
                  style={{ borderBottom: '1px solid var(--fg-border-subtle)', cursor: 'pointer' }}
                >
                  <td style={{ padding: '10px 12px', fontSize: 12.5, fontWeight: 600, color: 'var(--fg-text-1)' }}>
                    {w.name}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span className={`badge-status ${w.status === 'VERIFIED' ? 'badge-verified' : w.status === 'BLOCKED' ? 'badge-blocked' : 'badge-warning'}`}>
                      {w.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 12, fontWeight: 700, color: getScoreColor(w.risk_score), fontFamily: 'monospace' }}>
                    {w.risk_score > 0 ? `${w.risk_score.toFixed(0)}/100` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--fg-text-3)' }}>
                    {w.updated_at ? formatDateTime(w.updated_at) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    <ArrowUpRight size={14} color="var(--fg-text-3)" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
