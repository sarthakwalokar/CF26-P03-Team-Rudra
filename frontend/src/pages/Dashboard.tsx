import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Shield, ShieldCheck, Zap, ArrowRight, Wand2, Sparkles,
  CheckCircle2, AlertTriangle, Cpu, Terminal, Play, Loader2, ArrowUpRight,
  FlaskConical, TestTube, Wrench, FileCode, Check, ChevronDown, ChevronRight, Bug
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlowGuardStore } from '../lib/store';
import { listWorkflows, generateWorkflow, verifyWorkflow } from '../services/api';
import { DEMO_POLICIES, getScoreColor, formatDateTime } from '../lib/utils';
import { toast } from 'sonner';

const PIPELINE_STAGES = [
  { id: 'policy', label: '1. POLICY', desc: 'Natural Language Input' },
  { id: 'parse', label: '2. PARSER', desc: 'Natural Language Policy Parser' },
  { id: 'ir', label: '3. FORMAL IR', desc: 'Pydantic AST Tree' },
  { id: 'graph', label: '4. GRAPH', desc: 'DAG Workflow Graph' },
  { id: 'verify', label: '5. VERIFICATION', desc: '10 Static Checks' },
  { id: 'repair', label: '6. AUTO-REPAIR', desc: 'AST Patch & Synthesis' },
  { id: 'execute', label: '7. SAFE GATE', desc: 'Runtime Execution Gate' },
];

const PRESET_CHIPS = [
  { key: 'procurement', label: 'Procurement (Valid)', policy: 'Verify the vendor, check the budget, obtain finance approval, and create the procurement ticket.', unsafe: false },
  { key: 'unsafe_procurement', label: '⚠️ Unsafe Procurement (Demo Bug)', policy: 'Verify vendor and check budget. Finance approval may be obtained if required. Then create the procurement ticket.', unsafe: true },
  { key: 'refund', label: 'Customer Refund', policy: 'Verify customer identity, perform fraud risk scoring, obtain manager approval for amounts over $500, then issue refund.', unsafe: false },
  { key: 'onboarding', label: 'Customer Onboarding', policy: 'Perform customer KYC verification, assign account tier, obtain compliance signoff, and activate account.', unsafe: false },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentWorkflow, verificationResult, setCurrentWorkflow, setVerificationResult, isGenerating, setIsGenerating, apiKey, useMock } = useFlowGuardStore();

  const [policyText, setPolicyText] = useState(
    currentWorkflow?.metadata?.policy_text || 'Verify the vendor, check the budget, obtain finance approval, and create the procurement ticket.'
  );
  const [pipelineStep, setPipelineStep] = useState<number>(currentWorkflow ? 7 : 0);
  const [showIRTree, setShowIRTree] = useState<boolean>(false);

  const handleCompileWithPolicy = async (targetPolicy: string) => {
    setPolicyText(targetPolicy);
    setIsGenerating(true);
    setPipelineStep(1);

    try {
      // Step 1: Parse & generate IR
      const resp = await generateWorkflow({
        policy_text: targetPolicy,
        use_mock: useMock || !apiKey,
        api_key: apiKey || undefined,
      });
      setCurrentWorkflow(resp.workflow);
      setPipelineStep(4);

      // Step 2: Immediate static verification
      const vResult = await verifyWorkflow(resp.workflow);
      setVerificationResult(vResult);
      setPipelineStep(7);

      if (vResult.status === 'SAFE') {
        toast.success(`Workflow compiled & verified: ${resp.workflow.nodes.length} nodes · VERIFIED`);
      } else {
        toast.warning(`Workflow compiled with warnings/critical issues (${vResult.issues.length} critical, ${vResult.warnings.length} warnings)`);
      }
    } catch (e: any) {
      toast.error('Compilation error: ' + e.message);
      setPipelineStep(0);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCompile = () => handleCompileWithPolicy(policyText);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1300, margin: '0 auto', width: '100%' }}>

      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: 36, maxWidth: 900, margin: '0 auto 36px' }}>
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
            P-03 · NATURAL LANGUAGE TO VERIFIED WORKFLOW COMPILER
          </span>
        </div>

        <h1 style={{
          fontSize: 36,
          fontWeight: 800,
          color: 'var(--fg-text-0)',
          lineHeight: 1.2,
          letterSpacing: '-0.03em',
          margin: 0,
        }}>
          Turn Natural Language Policies Into Verified Workflows.
        </h1>

        <p style={{
          fontSize: 15,
          color: 'var(--fg-text-2)',
          marginTop: 10,
          lineHeight: 1.5,
        }}>
          Compile natural-language business policies into formal, executable workflows — then verify them before execution.
        </p>

        {/* Hero Tagline & Demo Button */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginTop: 18, flexWrap: 'wrap' }}>
          <button
            className="btn-soc-primary"
            onClick={() => handleCompileWithPolicy('Verify the vendor, check the budget, obtain finance approval, and create the procurement ticket.')}
            disabled={isGenerating}
            style={{ padding: '10px 24px', fontSize: 13.5 }}
          >
            <Play size={15} />
            <span>Try Live Demo (Verified Procurement)</span>
          </button>

          <button
            className="btn-soc-secondary"
            onClick={() => handleCompileWithPolicy('Verify vendor and check budget. Finance approval may be obtained if required. Then create the procurement ticket.')}
            disabled={isGenerating}
            style={{ padding: '10px 20px', fontSize: 13.5, borderColor: 'rgba(244, 63, 94, 0.4)', color: '#FB7185' }}
          >
            <Bug size={15} color="#FB7185" />
            <span>Try Unsafe Policy (Demo Bug)</span>
          </button>
        </div>

        <div style={{
          padding: '8px 16px',
          background: 'rgba(14, 165, 233, 0.08)',
          border: '1px solid rgba(14, 165, 233, 0.22)',
          borderRadius: 8,
          fontSize: 12.5,
          fontWeight: 600,
          color: 'var(--fg-cyan-light)',
          marginTop: 16,
          display: 'inline-block',
        }}>
          💡 "FlowGuard doesn't just generate workflows — it verifies whether they are safe to execute."
        </div>
      </div>

      {/* Large Policy Input Card */}
      <div className="soc-card-elevated" style={{ padding: 24, marginBottom: 32, border: '1px solid var(--fg-border-active)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={15} color="var(--fg-cyan)" />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-text-1)' }}>
              Natural Language Policy Input
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: useMock || !apiKey ? 'var(--fg-amber)' : 'var(--fg-cyan-light)', fontWeight: 600 }}>
              {useMock || !apiKey ? '⚡ Natural Language Policy Parser (Offline Heuristic)' : '🤖 Google Gemini 2.0 Policy Parser'}
            </span>
          </div>
        </div>

        <textarea
          className="soc-input"
          value={policyText}
          onChange={(e) => setPolicyText(e.target.value)}
          rows={3}
          placeholder="e.g. Verify the vendor, check the budget, obtain finance approval, and create the procurement ticket."
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
            <span style={{ fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>Presets:</span>
            {PRESET_CHIPS.map((chip) => (
              <button
                key={chip.key}
                onClick={() => setPolicyText(chip.policy)}
                className="btn-soc-ghost"
                style={{
                  padding: '4px 10px',
                  background: 'var(--fg-bg-1)',
                  border: `1px solid ${chip.unsafe ? 'rgba(244, 63, 94, 0.35)' : 'var(--fg-border)'}`,
                  color: chip.unsafe ? '#FB7185' : 'var(--fg-text-1)',
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
                <span>View Workflow Canvas</span>
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

      {/* Compiler Pipeline Progression */}
      <div className="soc-card" style={{ padding: 22, marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            COMPILER & VERIFICATION LIFECYCLE
          </div>
          {verificationResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--fg-text-3)' }}>VERIFICATION SCORE:</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: getScoreColor(verificationResult.score), fontFamily: 'monospace' }}>
                {verificationResult.score.toFixed(0)}/100
              </span>
              <span className={`badge-status ${verificationResult.status === 'SAFE' ? 'badge-safe' : verificationResult.status === 'WARNING' ? 'badge-warning' : 'badge-blocked'}`}>
                {verificationResult.status}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {PIPELINE_STAGES.map((stage, idx) => {
            const isCompleted = pipelineStep > idx;
            const isCurrent = pipelineStep === idx + 1;
            return (
              <div
                key={stage.id}
                style={{
                  padding: '12px 10px',
                  background: isCurrent ? 'rgba(14, 165, 233, 0.16)' : (isCompleted ? 'rgba(16, 185, 129, 0.08)' : 'var(--fg-bg-1)'),
                  border: `1px solid ${isCurrent ? 'var(--fg-cyan-light)' : (isCompleted ? 'rgba(16, 185, 129, 0.3)' : 'var(--fg-border)')}`,
                  borderRadius: 8,
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: isCurrent ? 'var(--fg-cyan-light)' : (isCompleted ? '#34D399' : 'var(--fg-text-3)'),
                  letterSpacing: '0.04em',
                  marginBottom: 4,
                }}>
                  {stage.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--fg-text-2)', lineHeight: 1.2 }}>
                  {stage.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Compilation Summary & IR Preview */}
      {currentWorkflow && verificationResult && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, marginBottom: 32 }}>

          {/* Compilation Checklist Summary */}
          <div className="soc-card-elevated" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-cyan-light)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                  COMPILATION RESULT SUMMARY
                </div>
                <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fg-text-0)', margin: 0 }}>
                  {currentWorkflow.name}
                </h2>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-soc-ghost" onClick={() => setShowIRTree(!showIRTree)}>
                  <FileCode size={13} />
                  <span>{showIRTree ? 'Hide Formal IR' : 'Inspect Formal IR'}</span>
                </button>
                <button className="btn-soc-ghost" onClick={() => navigate('/verify')}>
                  <ShieldCheck size={13} />
                  <span>Verify ({verificationResult.score.toFixed(0)}/100)</span>
                </button>
                {verificationResult.issues.length > 0 && (
                  <button className="btn-soc-secondary" onClick={() => navigate('/repair')} style={{ borderColor: 'rgba(244, 63, 94, 0.4)', color: '#FB7185' }}>
                    <Wrench size={13} />
                    <span>Launch Auto-Repair</span>
                  </button>
                )}
                <button className="btn-soc-primary" onClick={() => navigate('/execute')}>
                  <Play size={13} />
                  <span>Safe Execution Gate</span>
                </button>
              </div>
            </div>

            {/* Checklist items */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'Policy Parsed', sub: 'Natural Language' },
                { label: 'Formal IR Generated', sub: 'Pydantic AST Tree' },
                { label: 'Workflow DAG Built', sub: `${currentWorkflow.nodes.length} Nodes · ${currentWorkflow.edges.length} Edges` },
                { label: '10 Static Checks', sub: `${verificationResult.issues.length} Critical · ${verificationResult.warnings.length} Warnings` },
              ].map((item, idx) => (
                <div key={idx} style={{ padding: '12px 14px', background: 'var(--fg-bg-1)', borderRadius: 8, border: '1px solid var(--fg-border)', display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <CheckCircle2 size={16} color="#34D399" style={{ flexShrink: 0, marginTop: 2 }} />
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-text-0)' }}>{item.label}</div>
                    <div style={{ fontSize: 10.5, color: 'var(--fg-text-3)', marginTop: 2 }}>{item.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Metric counters */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
              <div style={{ padding: 10, background: 'var(--fg-bg-1)', borderRadius: 6, border: '1px solid var(--fg-border)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-text-3)' }}>WORKFLOW NODES</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg-text-0)', fontFamily: 'monospace' }}>
                  {currentWorkflow.nodes.length}
                </div>
              </div>
              <div style={{ padding: 10, background: 'var(--fg-bg-1)', borderRadius: 6, border: '1px solid var(--fg-border)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-text-3)' }}>TRANSITIONS</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg-text-0)', fontFamily: 'monospace' }}>
                  {currentWorkflow.edges.length}
                </div>
              </div>
              <div style={{ padding: 10, background: 'var(--fg-bg-1)', borderRadius: 6, border: '1px solid var(--fg-border)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-text-3)' }}>STATIC CHECKS</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#34D399', fontFamily: 'monospace' }}>
                  10 / 10
                </div>
              </div>
              <div style={{ padding: 10, background: 'var(--fg-bg-1)', borderRadius: 6, border: '1px solid var(--fg-border)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-text-3)' }}>CRITICAL ISSUES</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: verificationResult.issues.length > 0 ? '#FB7185' : '#34D399', fontFamily: 'monospace' }}>
                  {verificationResult.issues.length}
                </div>
              </div>
              <div style={{ padding: 10, background: 'var(--fg-bg-1)', borderRadius: 6, border: '1px solid var(--fg-border)', textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-text-3)' }}>WARNINGS</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: verificationResult.warnings.length > 0 ? '#FBBF24' : '#34D399', fontFamily: 'monospace' }}>
                  {verificationResult.warnings.length}
                </div>
              </div>
            </div>
          </div>

          {/* Formal IR Tree Structure Viewer */}
          {showIRTree && (
            <div className="soc-card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-cyan-light)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  FORMAL INTERMEDIATE REPRESENTATION (IR AST)
                </div>
                <span style={{ fontSize: 11, color: 'var(--fg-text-3)' }}>
                  Intermediate Representation generated from natural-language policy.
                </span>
              </div>

              <div style={{
                padding: 16, background: '#040711', borderRadius: 8, border: '1px solid var(--fg-border)',
                fontFamily: 'monospace', fontSize: 11.5, color: '#38BDF8', overflowX: 'auto', maxHeight: 300
              }}>
                <div style={{ color: 'var(--fg-text-2)', marginBottom: 8 }}>
                  Policy AST Root ── {currentWorkflow.name}
                </div>
                {currentWorkflow.nodes.map((node) => (
                  <div key={node.id} style={{ marginLeft: 16, marginBottom: 4 }}>
                    <span style={{ color: '#34D399' }}>├── Node[{node.id}]</span> ("{node.name}")
                    <span style={{ color: 'var(--fg-text-3)', marginLeft: 8 }}>Type: {node.type} | Actor: {node.actor}</span>
                    {node.preconditions && node.preconditions.length > 0 && (
                      <div style={{ marginLeft: 32, color: '#FBBF24', fontSize: 11 }}>
                        └─ Preconditions: [{node.preconditions.join(', ')}]
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
