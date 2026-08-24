import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShieldCheck, ShieldAlert, Zap, Wrench, Play, Eye,
  Layers, User, Key, CheckCircle2, AlertTriangle, XCircle,
  FileCode, Sparkles, Filter, ChevronRight, Activity, ArrowRight, CornerDownRight
} from 'lucide-react';
import { useFlowGuardStore } from '../lib/store';
import WorkflowGraphView from '../components/WorkflowGraphView';
import { NODE_TYPE_CONFIG, getScoreColor } from '../lib/utils';
import { verifyWorkflow } from '../services/api';
import { toast } from 'sonner';

export default function WorkflowGraph() {
  const navigate = useNavigate();
  const {
    currentWorkflow, verificationResult, setVerificationResult,
    selectedNodeId, setSelectedNodeId,
    setHighlightedNodes, setHighlightedEdges, setHighlightMode,
    isVerifying, setIsVerifying
  } = useFlowGuardStore();

  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  if (!currentWorkflow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)', gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12,
          background: 'rgba(14, 165, 233, 0.1)', border: '1px solid var(--fg-cyan-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Layers size={24} color="var(--fg-cyan-light)" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-text-0)' }}>No Active Workflow Loaded</div>
        <div style={{ fontSize: 13, color: 'var(--fg-text-2)' }}>Compile a policy from the Overview dashboard to start building.</div>
        <button className="btn-soc-primary" onClick={() => navigate('/')}>
          <Sparkles size={14} />
          <span>Compile New Policy</span>
        </button>
      </div>
    );
  }

  const selectedNode = selectedNodeId ? currentWorkflow.nodes.find((n) => n.id === selectedNodeId) : null;
  const v = verificationResult;

  // Handle clicking "View on Graph" for an issue
  const highlightIssueOnGraph = (issue: any) => {
    if (issue.affected_nodes?.length) {
      setHighlightedNodes(new Set(issue.affected_nodes));
    }
    if (issue.affected_edges?.length) {
      setHighlightedEdges(new Set(issue.affected_edges));
    }
    setHighlightMode('attack');
    toast.info(`Highlighting affected path on canvas: "${issue.title}"`);
  };

  const handleRunVerify = async () => {
    setIsVerifying(true);
    try {
      const res = await verifyWorkflow(currentWorkflow);
      setVerificationResult(res);
      toast[res.status === 'SAFE' ? 'success' : res.status === 'WARNING' ? 'warning' : 'error'](
        `Verification completed: Score ${res.score.toFixed(0)}/100 (${res.status})`
      );
    } catch (e: any) {
      toast.error('Verification error: ' + e.message);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

      {/* ── LEFT PANEL: Node Tools & Structure Explorer ──────────────────────── */}
      <aside style={{
        width: 230,
        minWidth: 230,
        background: 'var(--fg-bg-1)',
        borderRight: '1px solid var(--fg-border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--fg-border)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            WORKFLOW TOPOLOGY
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-text-0)' }}>
            {currentWorkflow.name}
          </div>
          <div style={{ fontSize: 11, color: 'var(--fg-text-3)', marginTop: 2 }}>
            {currentWorkflow.nodes.length} Nodes · {currentWorkflow.edges.length} Transitions
          </div>
        </div>

        {/* Node Categories List */}
        <div style={{ padding: '14px 12px', flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, paddingLeft: 6 }}>
            SYSTEM COMPONENTS
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {currentWorkflow.nodes.map((node) => {
              const cfg = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.ACTION;
              const isSelected = node.id === selectedNodeId;
              return (
                <div
                  key={node.id}
                  onClick={() => setSelectedNodeId(isSelected ? null : node.id)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 7,
                    background: isSelected ? 'rgba(14, 165, 233, 0.12)' : 'var(--fg-bg-2)',
                    border: `1px solid ${isSelected ? 'var(--fg-cyan-border)' : 'var(--fg-border)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ fontSize: 12, color: cfg.color }}>{cfg.icon}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: isSelected ? 'var(--fg-cyan-light)' : 'var(--fg-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.name}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--fg-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.actor || cfg.label}
                    </div>
                  </div>
                  {node.is_critical && (
                    <span style={{ fontSize: 8.5, color: '#FB7185', background: 'rgba(244, 63, 94, 0.12)', padding: '1px 4px', borderRadius: 3, fontWeight: 700 }}>
                      CRIT
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Footers */}
        <div style={{ padding: 14, borderTop: '1px solid var(--fg-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button className="btn-soc-secondary" onClick={() => navigate('/ir')} style={{ width: '100%', fontSize: 11.5 }}>
            <FileCode size={13} />
            <span>Inspect IR JSON</span>
          </button>
          <button className="btn-soc-ghost" onClick={() => navigate('/3d')} style={{ width: '100%', fontSize: 11.5 }}>
            <span>Launch 3D Digital Twin →</span>
          </button>
        </div>
      </aside>

      {/* ── CENTER: React Flow Large Canvas ─────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', background: '#040711' }}>
        <WorkflowGraphView workflow={currentWorkflow} style={{ width: '100%', height: '100%' }} />

        {/* Floating Canvas Quick Controls */}
        <div style={{
          position: 'absolute',
          top: 16,
          left: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          zIndex: 10,
        }}>
          <div className="soc-glass" style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981' }} />
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-text-1)' }}>Interactive Canvas</span>
            <span style={{ fontSize: 11, color: 'var(--fg-text-3)' }}>| Drag / Zoom to explore</span>
          </div>
        </div>

        {/* Bottom Floating Canvas Legend */}
        <div style={{
          position: 'absolute',
          bottom: 16,
          left: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 14px',
          background: 'rgba(8, 13, 26, 0.85)',
          backdropFilter: 'blur(12px)',
          border: '1px solid var(--fg-border)',
          borderRadius: 8,
          zIndex: 10,
        }}>
          {Object.entries(NODE_TYPE_CONFIG).slice(0, 6).map(([type, cfg]) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: cfg.borderColor }} />
              <span style={{ fontSize: 10, color: 'var(--fg-text-2)', fontWeight: 500 }}>{cfg.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── RIGHT PANEL: Verification Intelligence Panel ─────────────────────── */}
      <aside style={{
        width: 340,
        minWidth: 340,
        background: 'var(--fg-bg-1)',
        borderLeft: '1px solid var(--fg-border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
      }}>
        {/* Verification Intelligence Header */}
        <div style={{ padding: '16px', borderBottom: '1px solid var(--fg-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              VERIFICATION INTELLIGENCE
            </div>
            <button
              className="btn-soc-ghost"
              onClick={handleRunVerify}
              disabled={isVerifying}
              style={{ fontSize: 11, padding: '2px 6px' }}
            >
              {isVerifying ? 'Verifying…' : 'Re-Check'}
            </button>
          </div>

          {v ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
              <div>
                <div style={{ fontSize: 10, color: 'var(--fg-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>STATUS</div>
                <div style={{ fontSize: 14, fontWeight: 800, color: v.status === 'SAFE' ? '#34D399' : v.status === 'WARNING' ? '#FBBF24' : '#FB7185' }}>
                  {v.status === 'SAFE' ? '✓ VERIFIED' : v.status === 'WARNING' ? '⚠ WARNINGS' : '✗ BLOCKED'}
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>SAFETY SCORE</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: getScoreColor(v.score), fontFamily: 'monospace' }}>
                  {v.score.toFixed(0)}
                  <span style={{ fontSize: 11, color: 'var(--fg-text-3)' }}>/100</span>
                </div>
              </div>
            </div>
          ) : (
            <button className="btn-soc-primary" onClick={handleRunVerify} style={{ width: '100%', marginTop: 8 }}>
              <ShieldCheck size={14} />
              <span>Verify Workflow</span>
            </button>
          )}
        </div>

        {/* Selected Node Details or Intelligence Breakdown */}
        {selectedNode ? (
          <div style={{ padding: 16, borderBottom: '1px solid var(--fg-border)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
              COMPONENT INSPECTOR
            </div>

            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg-text-0)', marginBottom: 6 }}>
              {selectedNode.name}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
              <div style={{ padding: '6px 8px', background: 'var(--fg-bg-2)', borderRadius: 6 }}>
                <div style={{ fontSize: 9.5, color: 'var(--fg-text-3)' }}>TYPE</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--fg-cyan-light)' }}>{selectedNode.type}</div>
              </div>
              <div style={{ padding: '6px 8px', background: 'var(--fg-bg-2)', borderRadius: 6 }}>
                <div style={{ fontSize: 9.5, color: 'var(--fg-text-3)' }}>RISK LEVEL</div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: selectedNode.risk_level === 'CRITICAL' ? '#FB7185' : '#34D399' }}>{selectedNode.risk_level}</div>
              </div>
            </div>

            <div style={{ fontSize: 11, color: 'var(--fg-text-2)', marginBottom: 8 }}>
              <strong>Actor:</strong> {selectedNode.actor || 'None specified'}
            </div>

            {selectedNode.preconditions?.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--fg-text-3)', marginBottom: 6 }}>
                <strong>Preconditions:</strong> {selectedNode.preconditions.join(', ')}
              </div>
            )}

            <button className="btn-soc-ghost" onClick={() => setSelectedNodeId(null)} style={{ fontSize: 11, padding: '4px 0' }}>
              ← Back to Overall Checks
            </button>
          </div>
        ) : v && (
          <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
            {/* Dimension Breakdown */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                DIMENSION METRICS
              </div>
              {[
                { label: 'Security', val: v.dimension_scores.security },
                { label: 'Correctness', val: v.dimension_scores.correctness },
                { label: 'Authorization', val: v.dimension_scores.authorization },
                { label: 'Reliability', val: v.dimension_scores.reliability },
              ].map((d) => (
                <div key={d.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--fg-text-2)' }}>{d.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 70, height: 4, background: 'var(--fg-bg-3)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ width: `${d.val}%`, height: '100%', background: getScoreColor(d.val) }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: getScoreColor(d.val), fontFamily: 'monospace', width: 24, textAlign: 'right' }}>
                      {d.val.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Checks checklist */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                DETERMINISTIC CHECKS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { name: 'Authorization Validation', passed: !v.failed_checks.includes('CHECK_AUTHORIZATION') },
                  { name: 'Required Approval Paths', passed: !v.failed_checks.includes('CHECK_APPROVAL_BYPASS') },
                  { name: 'Reachability Analysis', passed: !v.failed_checks.includes('CHECK_REACHABILITY') },
                  { name: 'State Transitions', passed: !v.failed_checks.includes('CHECK_STATE_TRANSITIONS') },
                  { name: 'Dependency Resolution', passed: !v.failed_checks.includes('CHECK_DEPENDENCIES') },
                  { name: 'Failure Recovery Policy', passed: !v.failed_checks.includes('CHECK_FAILURE_PATHS') },
                ].map((chk) => (
                  <div key={chk.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5 }}>
                    {chk.passed ? (
                      <CheckCircle2 size={12} color="#10B981" />
                    ) : (
                      <AlertTriangle size={12} color="#F59E0B" />
                    )}
                    <span style={{ color: chk.passed ? 'var(--fg-text-2)' : '#FBBF24', fontWeight: chk.passed ? 400 : 600 }}>
                      {chk.name}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Critical Issues / Warnings with [View on Graph] */}
            {(v.issues.length > 0 || v.warnings.length > 0) && (
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                  DETECTED ANOMALIES
                </div>

                {[...v.issues, ...v.warnings].map((issue) => {
                  const isCrit = issue.severity === 'CRITICAL';
                  return (
                    <div
                      key={issue.id}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: isCrit ? 'rgba(244, 63, 94, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                        border: `1px solid ${isCrit ? 'rgba(244, 63, 94, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: isCrit ? '#FB7185' : '#FBBF24', marginBottom: 3 }}>
                        {issue.title}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--fg-text-2)', lineHeight: 1.4, marginBottom: 8 }}>
                        {issue.message}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <button
                          className="btn-soc-ghost"
                          onClick={() => highlightIssueOnGraph(issue)}
                          style={{ fontSize: 10.5, padding: '3px 6px', color: 'var(--fg-cyan-light)' }}
                        >
                          <Eye size={11} />
                          <span>View on Graph</span>
                        </button>

                        <button
                          className="btn-soc-secondary"
                          onClick={() => navigate('/repair', { state: { issue } })}
                          style={{ fontSize: 10.5, padding: '3px 8px' }}
                        >
                          <Wrench size={11} />
                          <span>Auto-Repair</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Bottom Fast Action Buttons */}
        <div style={{ padding: 14, borderTop: '1px solid var(--fg-border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <button className="btn-soc-danger" onClick={() => navigate('/attack')} style={{ fontSize: 11.5 }}>
            <Zap size={13} />
            <span>Attack Lab</span>
          </button>
          <button
            className="btn-soc-success"
            onClick={() => navigate('/execute')}
            disabled={v?.status === 'BLOCKED'}
            style={{ fontSize: 11.5 }}
          >
            <Play size={13} />
            <span>Execute</span>
          </button>
        </div>
      </aside>

    </div>
  );
}
