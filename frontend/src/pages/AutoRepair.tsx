import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Wrench, ShieldCheck, CheckCircle2, AlertTriangle, ArrowRight,
  GitCompare, ArrowDown, Check, X, Loader2, Sparkles, RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlowGuardStore } from '../lib/store';
import { repairWorkflow, verifyWorkflow } from '../services/api';
import { getScoreColor } from '../lib/utils';

export default function AutoRepair() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    currentWorkflow, verificationResult, setCurrentWorkflow,
    setVerificationResult, repairProposal, setRepairProposal,
    isRepairing, setIsRepairing
  } = useFlowGuardStore();

  const issueFromState = (location.state as any)?.issue;
  const [selectedIssue, setSelectedIssue] = useState<any>(issueFromState || null);
  const [isApplied, setIsApplied] = useState(false);

  const allIssues = verificationResult ? [...verificationResult.issues, ...verificationResult.warnings] : [];

  const handleGenerateProposal = async (issue: any) => {
    if (!currentWorkflow) return;
    setIsRepairing(true);
    setRepairProposal(null);
    setIsApplied(false);
    try {
      const proposal = await repairWorkflow(currentWorkflow, issue);
      setRepairProposal(proposal);
      toast.success(`Repair proposal generated for: ${issue.title}`);
    } catch (e: any) {
      toast.error('Failed to generate repair: ' + e.message);
    } finally {
      setIsRepairing(false);
    }
  };

  const handleApplyRepair = async () => {
    if (!repairProposal) return;
    setIsRepairing(true);
    try {
      setCurrentWorkflow(repairProposal.repaired_workflow);

      // Re-verify immediately
      const newResult = await verifyWorkflow(repairProposal.repaired_workflow);
      setVerificationResult(newResult);
      setIsApplied(true);

      toast.success(`Repair successfully applied! Post-repair verification: ${newResult.status} (${newResult.score.toFixed(0)}/100)`);
    } catch (e: any) {
      toast.error('Re-verification failed: ' + e.message);
    } finally {
      setIsRepairing(false);
    }
  };

  if (!currentWorkflow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)', gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12,
          background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Wrench size={24} color="#34D399" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-text-0)' }}>No Active Workflow Loaded</div>
        <button className="btn-soc-primary" onClick={() => navigate('/')}>
          <span>Compile Workflow First</span>
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Wrench size={16} color="var(--fg-cyan)" />
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-cyan-light)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              AUTO-REPAIR STUDIO
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg-text-0)', margin: 0 }}>
            Automated Workflow Correction & Re-Verification
          </h1>
          <p style={{ fontSize: 13, color: 'var(--fg-text-2)', marginTop: 4 }}>
            Generate mathematical repair proposals for identified security and ordering vulnerabilities, then re-verify.
          </p>
        </div>

        <button className="btn-soc-secondary" onClick={() => navigate('/graph')}>
          <span>View Canvas IDE</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Main Studio Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: 24 }}>

        {/* ── LEFT: Anomaly / Issue Selector ─────────────────────────────────── */}
        <div>
          <div className="soc-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
              DETECTED ISSUES ({allIssues.length})
            </div>

            {allIssues.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 12px' }}>
                <CheckCircle2 size={28} color="#10B981" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontSize: 13, fontWeight: 700, color: '#34D399' }}>Zero Anomalies</div>
                <div style={{ fontSize: 11, color: 'var(--fg-text-3)', marginTop: 2 }}>
                  All 10 deterministic checks passed.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {allIssues.map((issue) => {
                  const isSelected = selectedIssue?.id === issue.id;
                  const isCrit = issue.severity === 'CRITICAL';
                  return (
                    <div
                      key={issue.id}
                      onClick={() => {
                        setSelectedIssue(issue);
                        handleGenerateProposal(issue);
                      }}
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        background: isSelected ? 'rgba(14, 165, 233, 0.12)' : 'var(--fg-bg-1)',
                        border: `1px solid ${isSelected ? 'var(--fg-cyan-border)' : 'var(--fg-border)'}`,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span className={`badge-status ${isCrit ? 'badge-blocked' : 'badge-warning'}`} style={{ fontSize: 9.5 }}>
                          {issue.severity}
                        </span>
                        <span style={{ fontSize: 10, color: 'var(--fg-text-3)', fontFamily: 'monospace' }}>
                          {issue.check_name}
                        </span>
                      </div>

                      <div style={{ fontSize: 12, fontWeight: 700, color: isSelected ? 'var(--fg-cyan-light)' : 'var(--fg-text-1)', marginBottom: 2 }}>
                        {issue.title}
                      </div>

                      <div style={{ fontSize: 10.5, color: 'var(--fg-text-3)', lineHeight: 1.3 }}>
                        {issue.suggestion || issue.message}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Before/After Visual Diff & Proposal Studio ──────────────── */}
        <div>
          {isRepairing && (
            <div className="soc-card" style={{ padding: 48, textAlign: 'center' }}>
              <Loader2 size={32} className="animate-spin" color="var(--fg-cyan)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-text-0)' }}>Synthesizing Graph Mutation…</div>
              <div style={{ fontSize: 12, color: 'var(--fg-text-3)', marginTop: 4 }}>
                Routing edges, creating recovery handlers, and calculating post-repair invariant proof.
              </div>
            </div>
          )}

          {repairProposal && !isRepairing && (
            <div className="soc-card-elevated" style={{ padding: 24, border: '1px solid var(--fg-border-active)' }}>
              {/* Proposal Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--fg-border)', paddingBottom: 16 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <Sparkles size={14} color="var(--fg-cyan-light)" />
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-cyan-light)', textTransform: 'uppercase' }}>
                      PROPOSED REPAIR MATRIX
                    </span>
                  </div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg-text-0)', margin: 0 }}>
                    {repairProposal.title}
                  </h3>
                </div>

                {repairProposal.verification_result && (
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 10, color: 'var(--fg-text-3)', textTransform: 'uppercase' }}>POST-REPAIR SCORE</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: getScoreColor(repairProposal.verification_result.score), fontFamily: 'monospace' }}>
                      {repairProposal.verification_result.score.toFixed(0)}/100
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <p style={{ fontSize: 12.5, color: 'var(--fg-text-2)', lineHeight: 1.5, marginBottom: 20 }}>
                {repairProposal.description}
              </p>

              {/* ── BEFORE vs AFTER Visual Flow Comparison ──────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
                {/* BEFORE Card */}
                <div style={{
                  padding: 16,
                  borderRadius: 8,
                  background: 'rgba(244, 63, 94, 0.05)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#FB7185', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                    BEFORE REPAIR (VULNERABLE)
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {repairProposal.original_workflow.nodes.slice(0, 4).map((node, i) => (
                      <React.Fragment key={node.id}>
                        <div style={{
                          padding: '8px 10px',
                          background: 'var(--fg-bg-2)',
                          border: '1px solid rgba(244, 63, 94, 0.3)',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: '#FB7185',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}>
                          <span>{node.name}</span>
                          <span style={{ fontSize: 9.5, opacity: 0.7 }}>{node.type}</span>
                        </div>
                        {i < 3 && <ArrowDown size={12} color="#FB7185" style={{ margin: '0 auto' }} />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* AFTER Card */}
                <div style={{
                  padding: 16,
                  borderRadius: 8,
                  background: 'rgba(16, 185, 129, 0.05)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#34D399', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                    AFTER REPAIR (VERIFIED)
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {repairProposal.repaired_workflow.nodes.slice(0, 4).map((node, i) => (
                      <React.Fragment key={node.id}>
                        <div style={{
                          padding: '8px 10px',
                          background: 'var(--fg-bg-2)',
                          border: '1px solid rgba(16, 185, 129, 0.4)',
                          borderRadius: 6,
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: '#34D399',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}>
                          <span>{node.name}</span>
                          <span style={{ fontSize: 9.5, opacity: 0.7 }}>{node.type}</span>
                        </div>
                        {i < 3 && <ArrowDown size={12} color="#34D399" style={{ margin: '0 auto' }} />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step-by-Step Action List */}
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                  MUTATION STEPS
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {repairProposal.steps.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        background: 'var(--fg-bg-1)',
                        border: '1px solid var(--fg-border)',
                        borderRadius: 6,
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%',
                        background: 'rgba(14, 165, 233, 0.15)', border: '1px solid var(--fg-cyan-border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 700, color: 'var(--fg-cyan-light)',
                      }}>
                        {idx + 1}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-cyan-light)', fontFamily: 'monospace' }}>
                        {step.action}
                      </span>
                      <span style={{ fontSize: 11.5, color: 'var(--fg-text-1)', flex: 1 }}>
                        {step.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 16, borderTop: '1px solid var(--fg-border)' }}>
                <button
                  className="btn-soc-ghost"
                  onClick={() => setRepairProposal(null)}
                  style={{ fontSize: 12 }}
                >
                  <X size={13} />
                  <span>Reject / Dismiss</span>
                </button>

                <div style={{ display: 'flex', gap: 10 }}>
                  {isApplied ? (
                    <button className="btn-soc-success" onClick={() => navigate('/graph')} style={{ padding: '8px 20px' }}>
                      <CheckCircle2 size={14} />
                      <span>Repair Applied · View Canvas</span>
                    </button>
                  ) : (
                    <button className="btn-soc-primary" onClick={handleApplyRepair} style={{ padding: '9px 24px' }}>
                      <Check size={14} />
                      <span>Apply Repair & Re-Verify</span>
                    </button>
                  )}
                </div>
              </div>

            </div>
          )}

          {!repairProposal && !isRepairing && (
            <div className="soc-card" style={{ padding: 48, textAlign: 'center' }}>
              <Wrench size={36} color="var(--fg-text-3)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-text-1)' }}>No Anomaly Selected</div>
              <div style={{ fontSize: 12, color: 'var(--fg-text-3)', marginTop: 4 }}>
                Choose an issue from the list on the left to synthesize an automated fix.
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
