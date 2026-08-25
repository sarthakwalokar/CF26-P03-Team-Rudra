import React from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ShieldCheck, AlertTriangle, XCircle, CheckCircle2, ChevronDown, ChevronRight,
  Loader2, Wrench, Zap, Eye, Play, Sparkles, Activity
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlowGuardStore } from '../lib/store';
import { verifyWorkflow } from '../services/api';
import { getScoreColor } from '../lib/utils';

function ScoreRing({ score, size = 96 }: { score: number; size?: number }) {
  const color = getScoreColor(score);
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={9} />
        <circle
          cx={size/2}
          cy={size/2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={9}
          strokeDasharray={`${dash} ${circ - dash}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column' }}>
        <span style={{ fontSize: 22, fontWeight: 800, color, fontFamily: 'monospace' }}>{score.toFixed(0)}</span>
        <span style={{ fontSize: 10, color: 'var(--fg-text-3)', fontWeight: 600 }}>/100</span>
      </div>
    </div>
  );
}

function DimBar({ label, score }: { label: string; score: number }) {
  const color = getScoreColor(score);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
      <div style={{ width: 105, fontSize: 12, fontWeight: 600, color: 'var(--fg-text-2)', flexShrink: 0 }}>{label}</div>
      <div className="soc-progress" style={{ flex: 1 }}>
        <div className="soc-progress-fill" style={{ width: `${score}%`, background: color }} />
      </div>
      <div style={{ width: 38, fontSize: 12.5, fontWeight: 800, color, textAlign: 'right', fontFamily: 'monospace' }}>
        {score.toFixed(0)}
      </div>
    </div>
  );
}

export default function VerificationCenter() {
  const navigate = useNavigate();
  const {
    currentWorkflow, verificationResult, setVerificationResult,
    setIsVerifying, isVerifying, setHighlightedNodes, setHighlightedEdges, setHighlightMode, setRepairProposal
  } = useFlowGuardStore();

  const handleVerify = async () => {
    if (!currentWorkflow) return;
    setIsVerifying(true);
    try {
      const result = await verifyWorkflow(currentWorkflow);
      setVerificationResult(result);
      setHighlightedNodes(new Set(result.affected_nodes));
      setHighlightedEdges(new Set(result.affected_edges));
      setHighlightMode(result.status === 'SAFE' ? 'verified' : 'attack');
      toast[result.status === 'SAFE' ? 'success' : result.status === 'WARNING' ? 'warning' : 'error'](
        `Verification ${result.status === 'SAFE' ? 'VERIFIED' : result.status}: Score ${result.score.toFixed(0)}/100`
      );
    } catch (e: any) {
      toast.error('Verification error: ' + e.message);
    } finally {
      setIsVerifying(false);
    }
  };

  const highlightIssueOnGraph = (issue: any) => {
    if (issue.affected_nodes?.length) setHighlightedNodes(new Set(issue.affected_nodes));
    if (issue.affected_edges?.length) setHighlightedEdges(new Set(issue.affected_edges));
    setHighlightMode('attack');
    toast.info(`Highlighting affected path: "${issue.title}"`);
    navigate('/graph');
  };

  const handleRepair = (issue: any) => {
    setRepairProposal(null);
    navigate('/repair', { state: { issue } });
  };

  if (!currentWorkflow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(14, 165, 233, 0.1)', border: '1px solid var(--fg-cyan-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ShieldCheck size={24} color="var(--fg-cyan-light)" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-text-0)' }}>No Active Workflow Loaded</div>
        <div style={{ fontSize: 13, color: 'var(--fg-text-2)' }}>Compile a policy from the Overview dashboard to run verification.</div>
        <button className="btn-soc-primary" onClick={() => navigate('/')}>
          <Sparkles size={14} />
          <span>Compile New Policy</span>
        </button>
      </div>
    );
  }

  const r = verificationResult;

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 9999, background: 'rgba(14, 165, 233, 0.10)', border: '1px solid rgba(14, 165, 233, 0.28)', marginBottom: 8 }}>
            <Activity size={12} color="var(--fg-cyan-light)" />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-cyan-light)', letterSpacing: '0.04em' }}>
              DETERMINISTIC STATIC ANALYSIS ENGINE
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg-text-0)', margin: 0, letterSpacing: '-0.02em' }}>
            Verification Intelligence
          </h1>
          <p style={{ fontSize: 13.5, color: 'var(--fg-text-2)', marginTop: 4 }}>
            Active Workflow: <strong style={{ color: 'var(--fg-text-1)' }}>{currentWorkflow.name}</strong> ({currentWorkflow.nodes.length} nodes · {currentWorkflow.edges.length} edges)
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-soc-secondary" onClick={() => navigate('/graph')}>
            View on Canvas
          </button>
          <button className="btn-soc-primary" onClick={handleVerify} disabled={isVerifying}>
            {isVerifying ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Running Checks…</span>
              </>
            ) : (
              <>
                <ShieldCheck size={14} />
                <span>Re-Verify Workflow</span>
              </>
            )}
          </button>
        </div>
      </div>

      {r ? (
        <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>
          {/* Left Column: Safety Score & Sub-scores */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Overall Score Card */}
            <div className="soc-card-elevated" style={{ padding: 22, border: '1px solid var(--fg-border-active)' }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 16 }}>
                SAFETY VERIFICATION SCORE
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 20 }}>
                <ScoreRing score={r.score} />
                <div>
                  <div style={{ fontSize: 10, color: 'var(--fg-text-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>STATUS</div>
                  <div style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color: r.status === 'SAFE' ? '#34D399' : r.status === 'WARNING' ? '#FBBF24' : '#FB7185',
                    marginTop: 2,
                  }}>
                    {r.status === 'SAFE' ? '✓ VERIFIED' : r.status === 'WARNING' ? '⚠ WARNINGS' : '✗ BLOCKED'}
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-text-3)', marginTop: 4 }}>
                    {r.passed_checks.length} checks passed · {r.failed_checks.length} failed
                  </div>
                </div>
              </div>

              {/* Sub-dimension breakdown */}
              <div style={{ borderTop: '1px solid var(--fg-border)', paddingTop: 16 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                  SECURITY & CORRECTNESS DIMENSIONS
                </div>
                <DimBar label="Security" score={r.dimension_scores.security} />
                <DimBar label="Correctness" score={r.dimension_scores.correctness} />
                <DimBar label="Authorization" score={r.dimension_scores.authorization} />
                <DimBar label="Reliability" score={r.dimension_scores.reliability} />
                <DimBar label="Ambiguity" score={r.dimension_scores.ambiguity} />
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="soc-card" style={{ padding: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ textAlign: 'center', padding: '12px', background: 'var(--fg-bg-1)', borderRadius: 8, border: '1px solid var(--fg-border)' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: r.issues.length > 0 ? '#FB7185' : '#34D399', fontFamily: 'monospace' }}>
                    {r.issues.length}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600, marginTop: 2 }}>Critical Issues</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px', background: 'var(--fg-bg-1)', borderRadius: 8, border: '1px solid var(--fg-border)' }}>
                  <div style={{ fontSize: 24, fontWeight: 800, color: r.warnings.length > 0 ? '#FBBF24' : '#34D399', fontFamily: 'monospace' }}>
                    {r.warnings.length}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600, marginTop: 2 }}>Warnings</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Check Breakdown & Anomalies */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Deterministic Check Matrix */}
            <div className="soc-card" style={{ padding: 22 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--fg-text-1)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  DETERMINISTIC VERIFICATION CHECKS
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-soc-danger" onClick={() => navigate('/attack')} style={{ fontSize: 11.5, padding: '4px 10px' }}>
                    <Zap size={12} />
                    <span>Attack Lab</span>
                  </button>
                  <button
                    className="btn-soc-success"
                    onClick={() => navigate('/execute')}
                    disabled={r.status === 'BLOCKED'}
                    style={{ fontSize: 11.5, padding: '4px 10px' }}
                  >
                    <Play size={12} />
                    <span>Execute</span>
                  </button>
                </div>
              </div>

              {/* Passed checklist chips */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginBottom: 18 }}>
                {[
                  { key: 'CHECK_ORDERING', label: 'Ordering & Preconditions' },
                  { key: 'CHECK_AUTHORIZATION', label: 'Authorization & Roles' },
                  { key: 'CHECK_APPROVAL_BYPASS', label: 'Required Approval Bypass' },
                  { key: 'CHECK_REACHABILITY', label: 'Reachability & Deadlock' },
                  { key: 'CHECK_CYCLE', label: 'Cycle & Circularity' },
                  { key: 'CHECK_STATE_TRANSITIONS', label: 'State Transitions' },
                  { key: 'CHECK_DEPENDENCIES', label: 'Dependency Graph' },
                  { key: 'CHECK_FAILURE_PATHS', label: 'Failure Recovery Paths' },
                ].map((chk) => {
                  const isFailed = r.failed_checks.includes(chk.key.toLowerCase()) || r.failed_checks.includes(chk.key);
                  return (
                    <div
                      key={chk.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        background: 'var(--fg-bg-1)',
                        borderRadius: 6,
                        border: `1px solid ${isFailed ? 'rgba(244,63,94,0.3)' : 'rgba(16,185,129,0.2)'}`,
                      }}
                    >
                      {isFailed ? (
                        <XCircle size={13} color="#FB7185" />
                      ) : (
                        <CheckCircle2 size={13} color="#10B981" />
                      )}
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: isFailed ? '#FB7185' : 'var(--fg-text-1)' }}>
                        {chk.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Critical Issues List */}
              {r.issues.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#FB7185', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                    CRITICAL BLOCKING ISSUES ({r.issues.length})
                  </div>
                  {r.issues.map((issue) => (
                    <div
                      key={issue.id}
                      style={{
                        padding: '16px 18px',
                        background: 'rgba(244, 63, 94, 0.07)',
                        border: '1px solid rgba(244, 63, 94, 0.35)',
                        borderRadius: 8,
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 800, color: '#FB7185' }}>{issue.title}</div>
                        <span className="badge-status badge-blocked">CRITICAL</span>
                      </div>

                      {/* 4-Part Structured Explanation */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14, fontSize: 12 }}>
                        <div style={{ color: 'var(--fg-text-1)', lineHeight: 1.45, background: 'rgba(244, 63, 94, 0.06)', padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(244, 63, 94, 0.2)' }}>
                          <strong style={{ color: '#FB7185', display: 'block', fontSize: 11, letterSpacing: '0.04em', marginBottom: 2 }}>WHAT FAILED:</strong>
                          {issue.message}
                        </div>

                        <div style={{ color: 'var(--fg-text-2)', lineHeight: 1.45, background: 'rgba(245, 158, 11, 0.06)', padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                          <strong style={{ color: '#FBBF24', display: 'block', fontSize: 11, letterSpacing: '0.04em', marginBottom: 2 }}>WHY IT FAILED:</strong>
                          {issue.rule_violated ? `Violates rule [${issue.rule_violated}]: Safety or authorization invariant is broken.` : 'Bypasses required approval gates, breaks dependency order, or introduces deadlock.'}
                        </div>

                        <div style={{ color: 'var(--fg-text-2)', background: 'rgba(14, 165, 233, 0.06)', padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(14, 165, 233, 0.2)' }}>
                          <strong style={{ color: 'var(--fg-cyan-light)', display: 'block', fontSize: 11, letterSpacing: '0.04em', marginBottom: 2 }}>WHERE IT FAILED:</strong>
                          {issue.affected_nodes?.length ? `Nodes: [${issue.affected_nodes.join(', ')}]` : (issue.affected_edges?.length ? `Edges: [${issue.affected_edges.join(', ')}]` : 'Workflow Graph Structure')}
                        </div>

                        {issue.suggestion && (
                          <div style={{ padding: '8px 12px', background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.25)', borderRadius: 6, color: '#34D399' }}>
                            <strong style={{ color: '#34D399', display: 'block', fontSize: 11, letterSpacing: '0.04em', marginBottom: 2 }}>HOW TO FIX IT:</strong>
                            {issue.suggestion}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          className="btn-soc-ghost"
                          onClick={() => highlightIssueOnGraph(issue)}
                          style={{ fontSize: 11.5, color: 'var(--fg-cyan-light)' }}
                        >
                          <Eye size={12} />
                          <span>View on Graph</span>
                        </button>
                        <button
                          className="btn-soc-secondary"
                          onClick={() => handleRepair(issue)}
                          style={{ fontSize: 11.5 }}
                        >
                          <Wrench size={12} />
                          <span>Launch Auto-Repair</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Warnings List */}
              {r.warnings.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#FBBF24', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                    ADVISORY WARNINGS ({r.warnings.length})
                  </div>
                  {r.warnings.map((warn) => (
                    <div
                      key={warn.id}
                      style={{
                        padding: '16px 18px',
                        background: 'rgba(245, 158, 11, 0.06)',
                        border: '1px solid rgba(245, 158, 11, 0.28)',
                        borderRadius: 8,
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#FBBF24' }}>{warn.title}</div>
                        <span className="badge-status badge-warning">WARNING</span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, marginBottom: 8 }}>
                        <div style={{ color: 'var(--fg-text-2)' }}>
                          <strong style={{ color: '#FBBF24' }}>WHAT FAILED:</strong> {warn.message}
                        </div>
                        <div style={{ color: 'var(--fg-text-2)' }}>
                          <strong style={{ color: 'var(--fg-cyan-light)' }}>WHERE IT FAILED:</strong> {warn.affected_nodes?.length ? `Nodes: [${warn.affected_nodes.join(', ')}]` : 'Workflow Policy Specification'}
                        </div>
                        {warn.suggestion && (
                          <div style={{ color: '#34D399', background: 'rgba(16, 185, 129, 0.06)', padding: '6px 10px', borderRadius: 4 }}>
                            <strong>HOW TO FIX IT:</strong> {warn.suggestion}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Verified State */}
              {r.issues.length === 0 && r.warnings.length === 0 && (
                <div style={{ textAlign: 'center', padding: '36px 20px' }}>
                  <CheckCircle2 size={36} color="#10B981" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#34D399' }}>All 10 Deterministic Checks Passed</div>
                  <div style={{ fontSize: 12.5, color: 'var(--fg-text-2)', marginTop: 4 }}>
                    Workflow topology, authorizations, preconditions, and reachability are verified safe.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="soc-card" style={{ padding: 48, textAlign: 'center' }}>
          <ShieldCheck size={48} color="var(--fg-cyan-light)" style={{ margin: '0 auto 16px' }} />
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-text-0)', marginBottom: 8 }}>Ready for Deterministic Verification</div>
          <div style={{ fontSize: 13, color: 'var(--fg-text-2)', marginBottom: 24, maxWidth: 480, margin: '0 auto 24px' }}>
            Execute static graph verification across ordering, authorization, reachability, circular states, and runtime state transitions.
          </div>
          <button className="btn-soc-primary" onClick={handleVerify} disabled={isVerifying} style={{ padding: '10px 28px', fontSize: 13.5 }}>
            {isVerifying ? <><Loader2 size={15} className="animate-spin" /><span>Verifying…</span></> : <><ShieldCheck size={15} /><span>Run Verification Suite</span></>}
          </button>
        </div>
      )}
    </div>
  );
}
