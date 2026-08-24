import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  FlaskConical, AlertTriangle, CheckCircle2, XCircle, ArrowRight,
  ArrowDown, Loader2, Play, GitBranch, RefreshCw, Cpu, ServerOff
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useFlowGuardStore } from '../lib/store';
import { simulateWorkflow } from '../services/api';
import { getScoreColor } from '../lib/utils';

const SIM_SCENARIOS = [
  {
    key: 'service_unavailable',
    title: 'Service Outage',
    desc: 'Target service endpoint drops offline or returns HTTP 503 errors.',
    icon: ServerOff,
  },
  {
    key: 'approval_rejected',
    title: 'Approval Rejected',
    desc: 'Designated manager / officer explicitly rejects authorization request.',
    icon: XCircle,
  },
  {
    key: 'timeout',
    title: 'Execution Timeout',
    desc: 'Integration call hangs indefinitely with no acknowledgment returned.',
    icon: AlertTriangle,
  },
  {
    key: 'actor_unavailable',
    title: 'Actor Absent / Unassigned',
    desc: 'Primary officer is out-of-office with no delegate pre-configured.',
    icon: Cpu,
  },
];

export default function WhatIfSimulator() {
  const navigate = useNavigate();
  const { currentWorkflow } = useFlowGuardStore();

  const [selectedScenario, setSelectedScenario] = useState('service_unavailable');
  const [selectedNodeId, setSelectedNodeId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [simulationResult, setSimulationResult] = useState<any>(null);

  if (!currentWorkflow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)', gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12,
          background: 'rgba(14, 165, 233, 0.1)', border: '1px solid var(--fg-cyan-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <FlaskConical size={24} color="var(--fg-cyan-light)" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-text-0)' }}>No Active Workflow Loaded</div>
        <button className="btn-soc-primary" onClick={() => navigate('/')}>
          <span>Compile Workflow First</span>
        </button>
      </div>
    );
  }

  const actionNodes = currentWorkflow.nodes.filter(n => !['START', 'END'].includes(n.type));

  const handleRunSimulation = async () => {
    if (!selectedNodeId) {
      toast.error('Select a target component to challenge.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await simulateWorkflow(currentWorkflow, selectedScenario, selectedNodeId);
      setSimulationResult(res);
      toast[res.can_continue ? 'success' : 'error'](
        res.can_continue ? 'Simulation Passed: Safe recovery path exists' : 'Simulation Failed: Workflow would be hard-blocked'
      );
    } catch (e: any) {
      toast.error('Simulation error: ' + e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const targetNode = currentWorkflow.nodes.find(n => n.id === selectedNodeId);

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <FlaskConical size={16} color="var(--fg-cyan)" />
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-cyan-light)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              WHAT-IF SIMULATION WORKSPACE
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg-text-0)', margin: 0 }}>
            “What happens if...?”
          </h1>
          <p style={{ fontSize: 13, color: 'var(--fg-text-2)', marginTop: 4 }}>
            Simulate runtime outages, rejections, and timeouts to stress-test your recovery pathways.
          </p>
        </div>

        <button className="btn-soc-secondary" onClick={() => navigate('/graph')}>
          <span>View Canvas</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '380px 1fr', gap: 24 }}>

        {/* ── LEFT: Scenario Configuration ───────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Scenario Selector */}
          <div className="soc-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
              1. SELECT FAILURE SCENARIO
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {SIM_SCENARIOS.map((sc) => {
                const isSelected = selectedScenario === sc.key;
                const Icon = sc.icon;
                return (
                  <div
                    key={sc.key}
                    onClick={() => setSelectedScenario(sc.key)}
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: isSelected ? 'rgba(14, 165, 233, 0.12)' : 'var(--fg-bg-1)',
                      border: `1px solid ${isSelected ? 'var(--fg-cyan-border)' : 'var(--fg-border)'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <Icon size={16} color={isSelected ? 'var(--fg-cyan-light)' : 'var(--fg-text-3)'} style={{ marginTop: 2 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: isSelected ? 'var(--fg-cyan-light)' : 'var(--fg-text-1)' }}>
                        {sc.title}
                      </div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-text-3)', marginTop: 2, lineHeight: 1.3 }}>
                        {sc.desc}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Target Component Selector */}
          <div className="soc-card" style={{ padding: 18 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
              2. SELECT TARGET COMPONENT
            </div>

            <select
              className="soc-input"
              value={selectedNodeId}
              onChange={(e) => setSelectedNodeId(e.target.value)}
              style={{ marginBottom: 14 }}
            >
              <option value="">Choose a workflow node…</option>
              {actionNodes.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name} ({n.type})
                </option>
              ))}
            </select>

            <button
              className="btn-soc-primary"
              onClick={handleRunSimulation}
              disabled={isLoading || !selectedNodeId}
              style={{ width: '100%', padding: '10px 16px', fontSize: 13 }}
            >
              {isLoading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Simulating Dynamic Outage…</span>
                </>
              ) : (
                <>
                  <FlaskConical size={15} />
                  <span>Run What-If Simulation</span>
                </>
              )}
            </button>
          </div>

        </div>

        {/* ── RIGHT: Simulation Analysis & Branch Comparison ─────────────────── */}
        <div>
          {simulationResult ? (
            <div className="soc-card-elevated" style={{ padding: 24, border: '1px solid var(--fg-border-active)' }}>
              {/* Header Status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--fg-border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {simulationResult.can_continue ? (
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <CheckCircle2 size={20} color="#34D399" />
                    </div>
                  ) : (
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <XCircle size={20} color="#FB7185" />
                    </div>
                  )}

                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-text-3)', textTransform: 'uppercase' }}>
                      SIMULATION OUTCOME
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: simulationResult.can_continue ? '#34D399' : '#FB7185' }}>
                      {simulationResult.scenario.outcome} — {simulationResult.can_continue ? 'Workflow Recovers' : 'Execution Blocked'}
                    </div>
                  </div>
                </div>

                <span className={`badge-status ${simulationResult.can_continue ? 'badge-verified' : 'badge-blocked'}`}>
                  {simulationResult.scenario.fallback_available ? 'FALLBACK READY' : 'NO FALLBACK'}
                </span>
              </div>

              {/* Detailed Explanation */}
              <div style={{ padding: '14px 16px', background: 'var(--fg-bg-1)', borderRadius: 8, border: '1px solid var(--fg-border)', marginBottom: 20, fontSize: 12.5, color: 'var(--fg-text-1)', lineHeight: 1.5 }}>
                {simulationResult.explanation}
              </div>

              {/* ── CURRENT PATH vs RECOVERY ANALYSIS ──────────────────────── */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>

                {/* CURRENT PATH (Failed) */}
                <div style={{
                  padding: 16,
                  borderRadius: 8,
                  background: 'rgba(244, 63, 94, 0.05)',
                  border: '1px solid rgba(244, 63, 94, 0.25)',
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: '#FB7185', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                    PRIMARY FAILURE PATH
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                    <div style={{ padding: '8px 14px', background: 'var(--fg-bg-2)', borderRadius: 6, fontSize: 12, fontWeight: 600, color: 'var(--fg-text-1)', width: '100%', textAlign: 'center' }}>
                      {targetNode?.name || 'Target Component'}
                    </div>
                    <ArrowDown size={14} color="#FB7185" />
                    <div style={{ padding: '8px 14px', background: 'rgba(244, 63, 94, 0.15)', border: '1px solid rgba(244, 63, 94, 0.4)', borderRadius: 6, fontSize: 12, fontWeight: 700, color: '#FB7185', width: '100%', textAlign: 'center' }}>
                      CRITICAL FAILURE (OUTAGE)
                    </div>
                  </div>
                </div>

                {/* RECOVERY ANALYSIS */}
                <div style={{
                  padding: 16,
                  borderRadius: 8,
                  background: simulationResult.can_continue ? 'rgba(16, 185, 129, 0.05)' : 'rgba(245, 158, 11, 0.05)',
                  border: `1px solid ${simulationResult.can_continue ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: simulationResult.can_continue ? '#34D399' : '#FBBF24', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                    RECOVERY ANALYSIS
                  </div>

                  {simulationResult.can_continue ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                      <div style={{ padding: '8px 14px', background: 'var(--fg-bg-2)', borderRadius: 6, fontSize: 12, fontWeight: 600, color: '#34D399', width: '100%', textAlign: 'center' }}>
                        Fallback Transition Triggered
                      </div>
                      <ArrowDown size={14} color="#34D399" />
                      <div style={{ padding: '8px 14px', background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: 6, fontSize: 12, fontWeight: 700, color: '#34D399', width: '100%', textAlign: 'center' }}>
                        Alternate Path → Re-Verified
                      </div>
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '16px 8px', color: '#FBBF24', fontSize: 12 }}>
                      No recovery / fallback handler configured for this component. Workflow terminates in unhandled deadlock state.
                    </div>
                  )}
                </div>

              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                {!simulationResult.can_continue && (
                  <button className="btn-soc-primary" onClick={() => navigate('/repair')} style={{ padding: '8px 18px' }}>
                    <span>Synthesize Recovery Route in Auto-Repair →</span>
                  </button>
                )}
              </div>

            </div>
          ) : (
            <div className="soc-card" style={{ padding: 48, textAlign: 'center' }}>
              <FlaskConical size={36} color="var(--fg-text-3)" style={{ margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-text-1)' }}>Simulation Ready</div>
              <div style={{ fontSize: 12, color: 'var(--fg-text-3)', marginTop: 4 }}>
                Select a failure scenario and a target component on the left, then click "Run What-If Simulation".
              </div>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
