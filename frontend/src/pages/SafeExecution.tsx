import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Play, CheckCircle2, XCircle, AlertTriangle, RotateCcw,
  SkipForward, ShieldOff, Clock, Activity, ArrowRight, Loader2, ShieldCheck,
  Zap, Wrench, RefreshCw, Lock, Unlock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlowGuardStore } from '../lib/store';
import { executeWorkflow, verifyWorkflow } from '../services/api';
import { formatDuration, formatTimestamp, getScoreColor } from '../lib/utils';
import LifecycleIndicator from '../components/LifecycleIndicator';
import type { ExecutionEvent } from '../types/workflow';

export default function SafeExecution() {
  const navigate = useNavigate();
  const {
    currentWorkflow, verificationResult, setVerificationResult, executionRun, setExecutionRun,
    isExecuting, setIsExecuting, setHighlightedNodes, setHighlightedEdges, setHighlightMode
  } = useFlowGuardStore();

  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [isReVerifying, setIsReVerifying] = useState<boolean>(false);

  useEffect(() => {
    let interval: any;
    if (isExecuting) {
      const start = Date.now();
      interval = setInterval(() => {
        setElapsedSec((Date.now() - start) / 1000);
      }, 100);
    } else {
      setElapsedSec(0);
    }
    return () => clearInterval(interval);
  }, [isExecuting]);

  if (!currentWorkflow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)', gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12,
          background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Play size={24} color="#34D399" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-text-0)' }}>No Active Workflow Loaded</div>
        <button className="btn-soc-primary" onClick={() => navigate('/')}>
          <span>Compile Workflow First</span>
        </button>
      </div>
    );
  }

  const isBlocked = verificationResult?.status === 'BLOCKED';
  const isVerified = verificationResult && verificationResult.status !== 'BLOCKED';

  const handleRunExecution = async () => {
    if (!verificationResult || isBlocked) {
      toast.error('Execution strictly BLOCKED: Unresolved critical verification failures (HTTP 403).');
      return;
    }

    setIsExecuting(true);
    setExecutionRun(null);
    try {
      const run = await executeWorkflow(currentWorkflow, verificationResult);
      setExecutionRun(run);
      toast[run.status === 'COMPLETED' ? 'success' : 'error'](
        `Execution ${run.status} in ${formatDuration(run.duration_ms)} (${run.events.length} state events)`
      );
    } catch (e: any) {
      toast.error('Execution failure: ' + e.message);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReVerify = async () => {
    if (!currentWorkflow) return;
    setIsReVerifying(true);
    try {
      const res = await verifyWorkflow(currentWorkflow);
      setVerificationResult(res);
      toast[res.status === 'SAFE' ? 'success' : 'error'](
        `Re-Verification Complete: ${res.status} (${res.score.toFixed(0)}/100)`
      );
    } catch (e: any) {
      toast.error('Re-verification failed: ' + e.message);
    } finally {
      setIsReVerifying(false);
    }
  };

  const handleViewAttackPath = () => {
    if (verificationResult?.issues?.length) {
      const issue = verificationResult.issues[0];
      setHighlightedNodes(new Set(issue.affected_nodes || []));
      setHighlightedEdges(new Set(issue.affected_edges || []));
      setHighlightMode('attack');
    }
    navigate('/attack');
  };

  const handleLaunchAutoRepair = () => {
    if (verificationResult?.issues?.length) {
      navigate('/repair', { state: { issue: verificationResult.issues[0] } });
    } else {
      navigate('/repair');
    }
  };

  // Find active node name
  const activeNodeName = executionRun?.current_node_id
    ? currentWorkflow.nodes.find(n => n.id === executionRun.current_node_id)?.name
    : 'None';

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>

      {/* 7-Stage Visual Lifecycle Indicator */}
      <LifecycleIndicator />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Activity size={16} color="#34D399" />
            <span style={{ fontSize: 11, fontWeight: 800, color: '#34D399', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              DETERMINISTIC STATE MACHINE
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg-text-0)', margin: 0 }}>
            Live Workflow Execution Engine
          </h1>
          <p style={{ fontSize: 13, color: 'var(--fg-text-2)', marginTop: 4 }}>
            Zero-Untrusted Execution Gate — Unverified or vulnerable workflows are strictly prevented from executing.
          </p>
        </div>

        <button className="btn-soc-secondary" onClick={() => navigate('/monitor')}>
          <span>Live Canvas Telemetry</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Pre-Flight Gate Status Banner */}
      <div className="soc-card" style={{
        padding: '22px 26px',
        marginBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        border: `1px solid ${isBlocked ? 'rgba(239, 68, 68, 0.5)' : 'rgba(16, 185, 129, 0.5)'}`,
        background: isBlocked ? 'rgba(239, 68, 68, 0.06)' : 'rgba(16, 185, 129, 0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: isBlocked ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.18)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {isBlocked ? <Lock size={24} color="#EF4444" /> : <Unlock size={24} color="#10B981" />}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15.5, fontWeight: 800, color: isBlocked ? '#EF4444' : '#10B981' }}>
                  {isBlocked ? 'ZERO-UNTRUSTED EXECUTION GATE: LOCKED (HTTP 403)' : 'ZERO-UNTRUSTED EXECUTION GATE: UNLOCKED'}
                </span>
                <span className={`badge-status ${isBlocked ? 'badge-blocked' : 'badge-safe'}`}>
                  {isBlocked ? 'BLOCKED' : 'SAFE / VERIFIED'}
                </span>
              </div>
              <div style={{ fontSize: 12.5, color: 'var(--fg-text-2)', marginTop: 3 }}>
                Workflow: <strong style={{ color: 'var(--fg-text-1)' }}>{currentWorkflow.name}</strong> · Verification Score: <strong style={{ color: getScoreColor(verificationResult?.score || 0) }}>{verificationResult ? verificationResult.score.toFixed(0) : 0}/100</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button
              className={isBlocked ? 'btn-soc-danger' : 'btn-soc-success'}
              onClick={handleRunExecution}
              disabled={isExecuting || isBlocked || !isVerified}
              style={{ padding: '10px 26px', fontSize: 13, cursor: isBlocked ? 'not-allowed' : 'pointer' }}
              title={isBlocked ? 'Execution is strictly blocked by the zero-untrusted gate' : 'Execute verified workflow'}
            >
              {isExecuting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Executing State Machine…</span>
                </>
              ) : (
                <>
                  <Play size={15} />
                  <span>{isBlocked ? 'Execution Denied (Blocked)' : 'Execute Verified Workflow'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* If Safe, Show Explicit Clearance Banner */}
        {!isBlocked && isVerified && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(16, 185, 129, 0.10)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: '#34D399',
            fontSize: 12.5,
            fontWeight: 600,
          }}>
            <CheckCircle2 size={16} color="#34D399" />
            <span>Workflow verified. Execution is now permitted. All 10 deterministic invariants are satisfied.</span>
          </div>
        )}

        {/* If Blocked, Show 4-Part Diagnostic and Guided Next Steps */}
        {isBlocked && verificationResult && verificationResult.issues.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{
              padding: '16px 18px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#FB7185', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                SECURITY VIOLATION BREAKDOWN (HTTP 403 CAUSE)
              </div>

              {verificationResult.issues.map((issue) => (
                <div key={issue.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, paddingBottom: 8, borderBottom: '1px solid rgba(239, 68, 68, 0.15)' }}>
                  <div style={{ color: 'var(--fg-text-1)', lineHeight: 1.45 }}>
                    <strong style={{ color: '#FB7185' }}>WHAT FAILED:</strong> {issue.message}
                  </div>
                  <div style={{ color: 'var(--fg-text-2)', lineHeight: 1.45 }}>
                    <strong style={{ color: '#FBBF24' }}>WHY IT IS DANGEROUS:</strong> {issue.rule_violated ? `Violates rule [${issue.rule_violated}]: Allows unapproved financial execution or bypass of authorization gates.` : 'Bypasses required approval gates, allowing autonomous actions without necessary human authorization.'}
                  </div>
                  <div style={{ color: 'var(--fg-text-2)' }}>
                    <strong style={{ color: 'var(--fg-cyan-light)' }}>WHERE THE BYPASS EXISTS:</strong> {issue.affected_nodes?.length ? `Nodes [${issue.affected_nodes.join(', ')}]` : (issue.affected_edges?.length ? `Edges [${issue.affected_edges.join(', ')}]` : 'Graph Ordering')}
                  </div>
                  {issue.suggestion && (
                    <div style={{ color: '#34D399', background: 'rgba(16, 185, 129, 0.06)', padding: '6px 10px', borderRadius: 4 }}>
                      <strong>HOW TO FIX IT:</strong> {issue.suggestion}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Guided Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--fg-bg-1)', padding: '12px 16px', borderRadius: 8, border: '1px solid var(--fg-border)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-text-1)' }}>
                Guided Remediation Workflow:
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-soc-danger" onClick={handleViewAttackPath} style={{ fontSize: 12 }}>
                  <Zap size={13} />
                  <span>View Attack Path</span>
                </button>
                <button className="btn-soc-primary" onClick={handleLaunchAutoRepair} style={{ fontSize: 12 }}>
                  <Wrench size={13} />
                  <span>Launch Auto-Repair</span>
                </button>
                <button className="btn-soc-secondary" onClick={handleReVerify} disabled={isReVerifying} style={{ fontSize: 12 }}>
                  {isReVerifying ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                  <span>Re-Verify After Repair</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Execution Monitor Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24 }}>

        {/* ── LEFT: Sequential Node Timeline ──────────────────────────────────── */}
        <div className="soc-card-elevated" style={{ padding: 24, border: '1px solid var(--fg-border-active)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--fg-border)' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                STATE MACHINE PROGRESSION
              </div>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg-text-0)', marginTop: 2 }}>
                {executionRun?.status ? `Status: ${executionRun.status}` : 'Pending Execution'}
              </div>
            </div>

            {executionRun && (
              <span className={`badge-status ${executionRun.status === 'COMPLETED' ? 'badge-verified' : 'badge-blocked'}`}>
                {executionRun.status}
              </span>
            )}
          </div>

          {/* Sequential Progression Steps */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24 }}>
            {currentWorkflow.nodes.map((node, idx) => {
              const nodeState = executionRun?.node_states[node.id];
              const isCurrent = isExecuting && idx === 1;

              return (
                <div
                  key={node.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: 8,
                    background: nodeState === 'COMPLETED' ? 'rgba(16, 185, 129, 0.08)' : nodeState === 'RUNNING' || isCurrent ? 'rgba(14, 165, 233, 0.12)' : 'var(--fg-bg-1)',
                    border: `1px solid ${nodeState === 'COMPLETED' ? 'rgba(16, 185, 129, 0.3)' : nodeState === 'RUNNING' || isCurrent ? 'var(--fg-cyan-border)' : 'var(--fg-border)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {nodeState === 'COMPLETED' ? (
                      <CheckCircle2 size={16} color="#34D399" />
                    ) : nodeState === 'RUNNING' || isCurrent ? (
                      <div className="pulse-dot dot-cyan" />
                    ) : (
                      <div style={{ width: 14, height: 14, borderRadius: '50%', border: '1.5px solid var(--fg-text-4)' }} />
                    )}

                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-text-0)' }}>
                        {node.name}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-text-3)' }}>
                        Actor: {node.actor || 'System'} · Type: {node.type}
                      </div>
                    </div>
                  </div>

                  <span style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    color: nodeState === 'COMPLETED' ? '#34D399' : nodeState === 'RUNNING' || isCurrent ? 'var(--fg-cyan-light)' : 'var(--fg-text-3)',
                  }}>
                    {nodeState || 'PENDING'}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Event Stream Log */}
          {executionRun && executionRun.events.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                AUDIT EVENT STREAM
              </div>
              <div style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {executionRun.events.map((e) => (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <span style={{ color: 'var(--fg-text-3)', fontFamily: 'monospace', width: 60 }}>
                      {formatTimestamp(e.timestamp)}
                    </span>
                    <span style={{ color: e.event_type.includes('COMPLETE') ? '#34D399' : e.event_type.includes('FAIL') ? '#FB7185' : 'var(--fg-text-2)' }}>
                      {e.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: Execution Telemetry Sidebar ─────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Metric Cards */}
          <div className="soc-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
              RUNTIME TELEMETRY
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--fg-text-3)' }}>Current State</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-cyan-light)', marginTop: 2 }}>
                  {isExecuting ? 'Active Execution' : executionRun ? 'Terminated' : 'Standby'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--fg-text-3)' }}>Execution Time</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--fg-text-0)', fontFamily: 'monospace', marginTop: 2 }}>
                  {isExecuting ? `${elapsedSec.toFixed(1)}s` : executionRun?.duration_ms ? formatDuration(executionRun.duration_ms) : '00.0s'}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--fg-text-3)' }}>Retries Triggered</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#34D399', fontFamily: 'monospace', marginTop: 2 }}>
                  0 (Optimal)
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, color: 'var(--fg-text-3)' }}>Dynamic Recovery</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-text-2)', marginTop: 2 }}>
                  Not Required
                </div>
              </div>
            </div>
          </div>

          {/* Verification Shield Reminder */}
          <div className="soc-card" style={{ padding: 16, background: 'rgba(14, 165, 233, 0.05)', border: '1px solid var(--fg-cyan-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <ShieldCheck size={14} color="var(--fg-cyan-light)" />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-cyan-light)', textTransform: 'uppercase' }}>
                HARD-GATED SAFETY
              </span>
            </div>
            <p style={{ fontSize: 11.5, color: 'var(--fg-text-2)', lineHeight: 1.4, margin: 0 }}>
              The runtime engine rejects execution if any invariant fails static verification checks.
            </p>
          </div>

        </div>

      </div>

    </div>
  );
}
