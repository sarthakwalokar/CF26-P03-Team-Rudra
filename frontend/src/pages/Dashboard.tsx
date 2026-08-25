import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield, ShieldCheck, Zap, ArrowRight, Wand2, Sparkles,
  CheckCircle2, AlertTriangle, Cpu, Terminal, Play, Loader2,
  FlaskConical, Wrench, FileCode, Check, ChevronRight, XCircle, AlertOctagon
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlowGuardStore } from '../lib/store';
import { generateWorkflow, verifyWorkflow } from '../services/api';
import { DEMO_POLICIES, getScoreColor } from '../lib/utils';
import { toast } from 'sonner';

const PIPELINE_STAGES = [
  { id: 'policy', label: '1. NATURAL POLICY', desc: 'English Business Input' },
  { id: 'parse', label: '2. POLICY PARSER', desc: 'Entity & Intent Parser' },
  { id: 'ir', label: '3. FORMAL IR / AST', desc: 'Pydantic Strongly-Typed Tree' },
  { id: 'graph', label: '4. WORKFLOW DAG', desc: 'Directed Graph Nodes & Edges' },
  { id: 'verify', label: '5. STATIC VERIFICATION', desc: '10 Deterministic Checks' },
  { id: 'gate', label: '6. EXECUTION GATE', desc: 'Zero-Untrusted Runtime Gate' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    currentWorkflow,
    verificationResult,
    setCurrentWorkflow,
    setVerificationResult,
    isGenerating,
    setIsGenerating,
    apiKey,
    useMock,
    setHighlightedNodes,
    setHighlightedEdges,
    setHighlightMode,
  } = useFlowGuardStore();

  const [policyText, setPolicyText] = useState(
    currentWorkflow?.metadata?.policy_text ||
    'Verify the vendor, check the budget, obtain finance approval, and create the procurement ticket.'
  );
  const [pipelineStep, setPipelineStep] = useState<number>(currentWorkflow ? 6 : 0);
  const [showIRTree, setShowIRTree] = useState<boolean>(true);

  const handleCompileWithPolicy = async (targetPolicy: string) => {
    setPolicyText(targetPolicy);
    setIsGenerating(true);
    setPipelineStep(1);

    try {
      // Step 1: Parse policy into Intermediate Representation (IR / AST)
      setPipelineStep(2);
      const resp = await generateWorkflow({
        policy_text: targetPolicy,
        use_mock: useMock || !apiKey,
        api_key: apiKey || undefined,
      });

      setPipelineStep(3);
      setCurrentWorkflow(resp.workflow);

      // Step 2: Build Workflow DAG & Run Deterministic Static Verification
      setPipelineStep(4);
      const vResult = await verifyWorkflow(resp.workflow);
      setVerificationResult(vResult);

      setHighlightedNodes(new Set(vResult.affected_nodes));
      setHighlightedEdges(new Set(vResult.affected_edges));
      setHighlightMode(vResult.status === 'SAFE' ? 'verified' : 'attack');

      setPipelineStep(6);

      if (vResult.status === 'SAFE') {
        toast.success(`Workflow Compiled & Formally Verified: Score ${vResult.score.toFixed(0)}/100 (VERIFIED)`);
      } else if (vResult.status === 'WARNING') {
        toast.warning(`Workflow Compiled with Warnings: Score ${vResult.score.toFixed(0)}/100`);
      } else {
        toast.error(`Workflow BLOCKED: ${vResult.issues.length} Critical Violations Found`);
      }
    } catch (e: any) {
      toast.error('Compilation failed: ' + e.message);
      setPipelineStep(0);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCompile = () => handleCompileWithPolicy(policyText);

  return (
    <div style={{ padding: '28px 36px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>

      {/* Header Badge */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 12px',
            borderRadius: 9999,
            background: 'rgba(14, 165, 233, 0.10)',
            border: '1px solid rgba(14, 165, 233, 0.28)',
            marginBottom: 8,
          }}>
            <Sparkles size={12} color="var(--fg-cyan-light)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-cyan-light)', letterSpacing: '0.04em' }}>
              OFFICIAL PROBLEM STATEMENT COMPILER · P-03
            </span>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--fg-text-0)', margin: 0, letterSpacing: '-0.02em' }}>
            Natural Language to Verified Workflow Compiler
          </h1>
          <p style={{ fontSize: 13, color: 'var(--fg-text-2)', marginTop: 4 }}>
            Transforms unstructured English policies into strongly-typed intermediate representations, conducts 10 deterministic static checks, and gates execution.
          </p>
        </div>

        {/* Engine Principle Badge */}
        <div style={{
          padding: '8px 16px',
          background: 'var(--fg-bg-2)',
          border: '1px solid var(--fg-border)',
          borderRadius: 8,
          fontSize: 11.5,
          color: 'var(--fg-text-2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: 2,
        }}>
          <span style={{ fontWeight: 700, color: 'var(--fg-cyan-light)' }}>
            {useMock || !apiKey ? 'Deterministic Policy Parser (Offline)' : 'Google Gemini 2.0 Policy Parser'}
          </span>
          <span style={{ fontSize: 10.5, color: 'var(--fg-text-3)' }}>
            Mathematical Verification: 100% Deterministic Rule Engine
          </span>
        </div>
      </div>

      {/* Pipeline Progression Bar */}
      <div className="soc-card" style={{ padding: '14px 18px', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.08em' }}>
            FORMAL COMPILATION PIPELINE
          </span>
          {verificationResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--fg-text-3)' }}>VERIFICATION SCORE:</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: getScoreColor(verificationResult.score), fontFamily: 'monospace' }}>
                {verificationResult.score.toFixed(0)}/100
              </span>
              <span className={`badge-status ${verificationResult.status === 'SAFE' ? 'badge-safe' : verificationResult.status === 'WARNING' ? 'badge-warning' : 'badge-blocked'}`}>
                {verificationResult.status === 'SAFE' ? 'SAFE / VERIFIED' : verificationResult.status}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 8 }}>
          {PIPELINE_STAGES.map((stage, idx) => {
            const isCompleted = pipelineStep > idx;
            const isCurrent = pipelineStep === idx + 1;
            return (
              <div
                key={stage.id}
                style={{
                  padding: '10px 8px',
                  background: isCurrent ? 'rgba(14, 165, 233, 0.16)' : (isCompleted ? 'rgba(16, 185, 129, 0.08)' : 'var(--fg-bg-1)'),
                  border: `1px solid ${isCurrent ? 'var(--fg-cyan-light)' : (isCompleted ? 'rgba(16, 185, 129, 0.3)' : 'var(--fg-border)')}`,
                  borderRadius: 6,
                  textAlign: 'center',
                }}
              >
                <div style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: isCurrent ? 'var(--fg-cyan-light)' : (isCompleted ? '#34D399' : 'var(--fg-text-3)'),
                  marginBottom: 2,
                }}>
                  {stage.label}
                </div>
                <div style={{ fontSize: 9.5, color: 'var(--fg-text-2)' }}>
                  {stage.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main 2-Column Hero Grid: Left Editor & Benchmark Presets | Right IR & Verification */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

        {/* LEFT PANEL: Policy Editor & 6 Benchmark Test Cases */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="soc-card-elevated" style={{ padding: 22, border: '1px solid var(--fg-border-active)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Terminal size={15} color="var(--fg-cyan)" />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-text-1)' }}>
                  Natural Language Policy Editor
                </span>
              </div>
            </div>

            <textarea
              className="soc-input"
              value={policyText}
              onChange={(e) => setPolicyText(e.target.value)}
              rows={4}
              placeholder="e.g. Verify the vendor, check the budget, obtain finance approval, and create the procurement ticket."
              style={{
                fontSize: 13.5,
                lineHeight: 1.5,
                resize: 'vertical',
                minHeight: 100,
                marginBottom: 16,
                background: 'var(--fg-bg-1)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, color: 'var(--fg-text-3)' }}>
                Click below to load benchmark scenarios or type custom policy.
              </span>
              <button
                className="btn-soc-primary"
                onClick={handleCompile}
                disabled={isGenerating || !policyText.trim()}
                style={{ padding: '9px 22px', fontSize: 13 }}
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Compiling & Verifying…</span>
                  </>
                ) : (
                  <>
                    <Wand2 size={14} />
                    <span>Compile Policy to IR</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 6 Benchmark Presets Selection Cards */}
          <div className="soc-card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.08em' }}>
                1-CLICK PROBLEM STATEMENT BENCHMARKS
              </span>
              <span style={{ fontSize: 10.5, color: 'var(--fg-text-3)' }}>6 Test Cases</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
              {DEMO_POLICIES.slice(0, 6).map((preset) => {
                const isSelected = policyText === preset.policy;
                return (
                  <div
                    key={preset.key}
                    onClick={() => handleCompileWithPolicy(preset.policy)}
                    style={{
                      padding: '10px 12px',
                      background: isSelected ? 'rgba(14, 165, 233, 0.12)' : 'var(--fg-bg-1)',
                      border: `1px solid ${isSelected ? 'var(--fg-cyan-light)' : 'var(--fg-border)'}`,
                      borderRadius: 8,
                      cursor: 'pointer',
                      transition: 'all 0.18s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                    }}
                    className="hover:border-cyan-500"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
                      <span style={{ fontSize: 16 }}>{preset.icon}</span>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-text-0)' }}>
                            {preset.label}
                          </span>
                          <span className={`badge-status ${preset.expectedStatus === 'SAFE' ? 'badge-safe' : 'badge-blocked'}`} style={{ fontSize: 9.5 }}>
                            Expected: {preset.expectedStatus}
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--fg-text-3)', marginTop: 2 }}>
                          "{preset.policy}"
                        </div>
                      </div>
                    </div>

                    <button
                      className="btn-soc-ghost"
                      style={{ fontSize: 11, padding: '4px 8px', flexShrink: 0 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCompileWithPolicy(preset.policy);
                      }}
                    >
                      <span>Run</span>
                      <ArrowRight size={11} />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Compilation IR AST & Verification Result */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {currentWorkflow && verificationResult ? (
            <>
              {/* Verification Verdict Card */}
              <div className="soc-card-elevated" style={{ padding: 22, border: `1px solid ${verificationResult.status === 'SAFE' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--fg-cyan-light)', letterSpacing: '0.08em', marginBottom: 2 }}>
                      VERIFICATION VERDICT
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--fg-text-0)' }}>
                      {currentWorkflow.name}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: getScoreColor(verificationResult.score), fontFamily: 'monospace' }}>
                        {verificationResult.score.toFixed(0)}/100
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--fg-text-3)' }}>Score</div>
                    </div>
                    <span className={`badge-status ${verificationResult.status === 'SAFE' ? 'badge-safe' : verificationResult.status === 'WARNING' ? 'badge-warning' : 'badge-blocked'}`} style={{ padding: '6px 12px', fontSize: 12 }}>
                      {verificationResult.status === 'SAFE' ? 'SAFE / VERIFIED' : 'EXECUTION BLOCKED'}
                    </span>
                  </div>
                </div>

                {/* Primary Action Buttons */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                  <button className="btn-soc-secondary" onClick={() => navigate('/verify')} style={{ fontSize: 12 }}>
                    <ShieldCheck size={13} color="var(--fg-cyan-light)" />
                    <span>View 10 Checks</span>
                  </button>

                  <button className="btn-soc-secondary" onClick={() => navigate('/ir')} style={{ fontSize: 12 }}>
                    <FileCode size={13} color="var(--fg-cyan-light)" />
                    <span>Inspect Full IR AST</span>
                  </button>

                  <button className="btn-soc-secondary" onClick={() => navigate('/graph')} style={{ fontSize: 12 }}>
                    <Cpu size={13} color="var(--fg-cyan-light)" />
                    <span>Workflow Canvas</span>
                  </button>

                  {verificationResult.issues.length > 0 && (
                    <button className="btn-soc-secondary" onClick={() => navigate('/repair')} style={{ fontSize: 12, borderColor: 'rgba(244, 63, 94, 0.4)', color: '#FB7185' }}>
                      <Wrench size={13} />
                      <span>Auto-Repair Studio</span>
                    </button>
                  )}

                  <button className="btn-soc-primary" onClick={() => navigate('/execute')} style={{ fontSize: 12 }}>
                    <Play size={13} />
                    <span>Safe Execution Gate</span>
                  </button>
                </div>

                {/* Issues List or Safe Confirmation */}
                {verificationResult.issues.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: '#FB7185', letterSpacing: '0.04em' }}>
                      CRITICAL VERIFICATION FAILURES ({verificationResult.issues.length}):
                    </div>
                    {verificationResult.issues.map((issue) => (
                      <div key={issue.id} style={{ padding: '10px 12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#FB7185' }}>
                          <XCircle size={14} />
                          <span>{issue.title}</span>
                        </div>
                        <div style={{ fontSize: 11.5, color: 'var(--fg-text-2)', marginTop: 4 }}>
                          {issue.message}
                        </div>
                        {issue.suggestion && (
                          <div style={{ fontSize: 11, color: '#34D399', marginTop: 4 }}>
                            💡 Fix: {issue.suggestion}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: '12px 14px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <CheckCircle2 size={18} color="#34D399" />
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: '#34D399' }}>
                        Deterministic Verification Passed
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--fg-text-2)' }}>
                        All 10 mathematical graph and authorization constraints are satisfied. Ready for safe execution.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Structured IR Tree Preview */}
              <div className="soc-card" style={{ padding: 18 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileCode size={14} color="var(--fg-cyan-light)" />
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-cyan-light)', letterSpacing: '0.08em' }}>
                      INTERMEDIATE REPRESENTATION (IR AST)
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--fg-text-3)' }}>
                    {currentWorkflow.nodes.length} Nodes · {currentWorkflow.edges.length} Transitions
                  </span>
                </div>

                <div style={{
                  padding: 14,
                  background: '#040711',
                  borderRadius: 6,
                  border: '1px solid var(--fg-border)',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 11.5,
                  color: '#38BDF8',
                  maxHeight: 240,
                  overflowY: 'auto',
                }}>
                  {currentWorkflow.nodes.map((node) => (
                    <div key={node.id} style={{ marginBottom: 6 }}>
                      <span style={{ color: '#34D399' }}>Node[{node.id}]</span>{' '}
                      <span style={{ color: 'var(--fg-text-0)', fontWeight: 600 }}>"{node.name}"</span>{' '}
                      <span style={{ color: 'var(--fg-text-3)', fontSize: 10.5 }}>({node.type} · Actor: {node.actor})</span>
                      {node.preconditions && node.preconditions.length > 0 && (
                        <div style={{ marginLeft: 20, color: '#FBBF24', fontSize: 10.5 }}>
                          └─ Preconditions: [{node.preconditions.join(', ')}]
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="soc-card" style={{ padding: 40, textAlign: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 10, background: 'rgba(14, 165, 233, 0.1)', border: '1px solid var(--fg-cyan-border)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <Sparkles size={20} color="var(--fg-cyan-light)" />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg-text-0)' }}>
                No Compiled Workflow Active
              </div>
              <p style={{ fontSize: 12, color: 'var(--fg-text-2)', maxWidth: 360, margin: '6px auto 16px' }}>
                Enter a business policy on the left and click "Compile Policy to IR" or select one of the 6 benchmark scenarios.
              </p>
              <button
                className="btn-soc-primary"
                onClick={() => handleCompileWithPolicy('Verify the vendor, check the budget, obtain finance approval, and create the procurement ticket.')}
              >
                <span>Run Hero Procurement Demo</span>
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}

