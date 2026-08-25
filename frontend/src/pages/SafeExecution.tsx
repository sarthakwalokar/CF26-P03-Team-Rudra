import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Play, CheckCircle2, XCircle, AlertTriangle, RotateCcw,
  SkipForward, ShieldOff, Clock, Activity, ArrowRight, Loader2, ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlowGuardStore } from '../lib/store';
import { executeWorkflow } from '../services/api';
import { formatDuration, formatTimestamp, getScoreColor } from '../lib/utils';
import type { ExecutionEvent } from '../types/workflow';

export default function SafeExecution() {
  const navigate = useNavigate();
  const {
    currentWorkflow, verificationResult, executionRun, setExecutionRun,
    isExecuting, setIsExecuting
  } = useFlowGuardStore();

  const [elapsedSec, setElapsedSec] = useState<number>(0);

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
      toast.error('Execution strictly BLOCKED: Unresolved critical verification failures.');
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

  // Find active node name
  const activeNodeName = executionRun?.current_node_id
    ? currentWorkflow.nodes.find(n => n.id === executionRun.current_node_id)?.name
    : 'None';

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
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
            Execution Gate — Only statically verified workflows are allowed to enter runtime. Zero untrusted execution.
          </p>
        </div>

        <button className="btn-soc-secondary" onClick={() => navigate('/monitor')}>
          <span>Live Canvas Telemetry</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Pre-Flight Gate Status Banner */}
      <div className="soc-card" style={{
        padding: '20px 24px',
        marginBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        border: `1px solid ${isBlocked ? 'rgba(239, 68, 68, 0.5)' : 'rgba(16, 185, 129, 0.5)'}`,
        background: isBlocked ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 44,
              height: 44,
              borderRadius: 10,
              background: isBlocked ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {isBlocked ? <XCircle size={24} color="#EF4444" /> : <ShieldCheck size={24} color="#10B981" />}
            </div>

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: isBlocked ? '#EF4444' : '#10B981' }}>
                  {isBlocked ? 'ZERO-UNTRUSTED EXECUTION GATE: LOCKED (HTTP 403)' : 'ZERO-UNTRUSTED EXECUTION GATE: UNLOCKED'}
                </span>
                <span className={`badge-status ${isBlocked ? 'badge-blocked' : 'badge-safe'}`}>
                  {isBlocked ? 'BLOCKED' : 'VERIFIED'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-text-2)', marginTop: 2 }}>
                Workflow: <strong style={{ color: 'var(--fg-text-1)' }}>{currentWorkflow.name}</strong> · Verification Score: {verificationResult ? verificationResult.score.toFixed(0) : 0}/100
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            {isBlocked && (
              <button
                className="btn-soc-secondary"
                onClick={() => navigate('/repair')}
                style={{ borderColor: 'rgba(239, 68, 68, 0.4)', color: '#FB7185' }}
              >
                <span>Launch Auto-Repair</span>
              </button>
            )}
            <button
              className={isBlocked ? 'btn-soc-danger' : 'btn-soc-success'}
              onClick={handleRunExecution}
              disabled={isExecuting || isBlocked || !isVerified}
              style={{ padding: '9px 24px', fontSize: 13 }}
            >
              {isExecuting ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Executing State Machine…</span>
                </>
              ) : (
                <>
                  <Play size={15} />
                  <span>{isBlocked ? 'Execution Denied (Blocked)' : 'Execute Workflow'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* If Blocked, Show Explicit Reason */}
        {isBlocked && verificationResult && verificationResult.issues.length > 0 && (
          <div style={{
            padding: '12px 14px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.25)',
            borderRadius: 6,
            fontSize: 12,
            color: '#FB7185',
          }}>
            <strong>HTTP 403 Forbidden — Reason:</strong> {verificationResult.issues[0].title}: {verificationResult.issues[0].message}
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
