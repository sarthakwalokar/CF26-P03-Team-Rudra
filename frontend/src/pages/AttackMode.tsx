import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  Zap, ShieldAlert, AlertTriangle, XCircle, Loader2,
  Shield, CheckCircle2, Terminal, ArrowRight, Eye, Wrench
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlowGuardStore } from '../lib/store';
import { attackWorkflow } from '../services/api';
import WorkflowGraphView from '../components/WorkflowGraphView';

const ATTACK_VECTORS = [
  { key: 'APPROVAL_BYPASS', title: 'Approval Bypass', desc: 'Attempt bypassing critical review gates via alternative parallel graph transitions' },
  { key: 'UNAUTHORIZED_ACTOR', title: 'Unauthorized Actor', desc: 'Attempt privilege escalation by invoking high-risk steps with unassigned actors' },
  { key: 'INVALID_STATE', title: 'Invalid State Condition', desc: 'Inject corrupted state variables to force illegal transitions' },
  { key: 'DEPENDENCY_FAILURE', title: 'Dependency Failure', desc: 'Simulate prerequisite node failure and check if downstream nodes block safely' },
  { key: 'SERVICE_TIMEOUT', title: 'Service Timeout Attack', desc: 'Hang external integration services to check infinite deadlock vulnerabilities' },
  { key: 'DUPLICATE_EXECUTION', title: 'Duplicate Execution', desc: 'Fire duplicate concurrent requests to test idempotency and double-spend risks' },
  { key: 'MISSING_APPROVAL', title: 'Missing Approval Token', desc: 'Execute state-altering actions without required authorization grant' },
  { key: 'INVALID_TRANSITION', title: 'Invalid State Transition', desc: 'Attempt illegal jumps skipping required intermediate verification steps' },
  { key: 'RECOVERY_FAILURE', title: 'Recovery Failure Trap', desc: 'Simulate fallback handler crashes to check terminal unhandled exceptions' },
];

export default function AttackMode() {
  const navigate = useNavigate();
  const {
    currentWorkflow, attackResult, setAttackResult,
    isAttacking, setIsAttacking,
    setHighlightedNodes, setHighlightedEdges, setHighlightMode
  } = useFlowGuardStore();

  const [selectedVectors, setSelectedVectors] = useState<string[]>(ATTACK_VECTORS.map(v => v.key));

  if (!currentWorkflow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)', gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12,
          background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Zap size={24} color="#FB7185" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-text-0)' }}>No Active Workflow Loaded</div>
        <div style={{ fontSize: 13, color: 'var(--fg-text-2)' }}>Compile or load a workflow to challenge it in the Attack Lab.</div>
        <button className="btn-soc-primary" onClick={() => navigate('/')}>
          <span>Compile Workflow First</span>
        </button>
      </div>
    );
  }

  const handleLaunchAttack = async () => {
    setIsAttacking(true);
    setHighlightMode('attack');
    try {
      const res = await attackWorkflow(currentWorkflow, selectedVectors as any);
      setAttackResult(res);

      const affectedNodes = new Set(res.findings.flatMap(f => f.affected_nodes));
      const affectedEdges = new Set(res.findings.flatMap(f => f.affected_edges));
      setHighlightedNodes(affectedNodes);
      setHighlightedEdges(affectedEdges);

      toast[res.critical_count > 0 ? 'error' : 'warning'](
        `Attack Suite Complete: ${res.vulnerabilities_found} security gaps discovered`
      );
    } catch (e: any) {
      toast.error('Attack execution failed: ' + e.message);
    } finally {
      setIsAttacking(false);
    }
  };

  const highlightFinding = (finding: any) => {
    if (finding.affected_nodes?.length) setHighlightedNodes(new Set(finding.affected_nodes));
    if (finding.affected_edges?.length) setHighlightedEdges(new Set(finding.affected_edges));
    setHighlightMode('attack');
    toast.info(`Traced exploit path: "${finding.title}"`);
  };

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden' }}>

      {/* ── LEFT: Attack Vector Selection & Summary ─────────────────────────── */}
      <aside style={{
        width: 320,
        minWidth: 320,
        background: 'var(--fg-bg-1)',
        borderRight: '1px solid var(--fg-border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: 20, borderBottom: '1px solid var(--fg-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Zap size={16} color="#FB7185" />
            <div style={{ fontSize: 11, fontWeight: 800, color: '#FB7185', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              SECURITY ATTACK LAB
            </div>
          </div>

          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg-text-0)', margin: '4px 0 6px' }}>
            Challenge Workflow Before Production
          </h2>

          <p style={{ fontSize: 12, color: 'var(--fg-text-2)', lineHeight: 1.4, margin: 0 }}>
            Executes 9 deterministic mutations against the actual Workflow IR to discover hidden bypasses and state flaws.
          </p>

          <button
            className="btn-soc-danger"
            onClick={handleLaunchAttack}
            disabled={isAttacking}
            style={{ width: '100%', marginTop: 14, padding: '10px 16px', fontSize: 13 }}
          >
            {isAttacking ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Simulating Penetration Vectors…</span>
              </>
            ) : (
              <>
                <Zap size={15} />
                <span>RUN ATTACK SIMULATION</span>
              </>
            )}
          </button>
        </div>

        {/* Vector Selection Checklist */}
        <div style={{ padding: '16px 20px', flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 10 }}>
            ACTIVE ADVERSARIAL VECTORS ({ATTACK_VECTORS.length})
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ATTACK_VECTORS.map((vec) => {
              const isChecked = selectedVectors.includes(vec.key);
              return (
                <div
                  key={vec.key}
                  onClick={() => {
                    setSelectedVectors(
                      isChecked ? selectedVectors.filter(k => k !== vec.key) : [...selectedVectors, vec.key]
                    );
                  }}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 8,
                    background: isChecked ? 'rgba(244, 63, 94, 0.06)' : 'var(--fg-bg-2)',
                    border: `1px solid ${isChecked ? 'rgba(244, 63, 94, 0.28)' : 'var(--fg-border)'}`,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => {}}
                    style={{ marginTop: 2, accentColor: '#F43F5E' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isChecked ? '#FB7185' : 'var(--fg-text-1)' }}>
                      {vec.title}
                    </div>
                    <div style={{ fontSize: 10.5, color: 'var(--fg-text-3)', marginTop: 2, lineHeight: 1.3 }}>
                      {vec.desc}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </aside>

      {/* ── CENTER: Attack Graph Canvas ─────────────────────────────────────── */}
      <div style={{ flex: 1, position: 'relative', background: '#040711' }}>
        <WorkflowGraphView workflow={currentWorkflow} style={{ width: '100%', height: '100%' }} />

        {attackResult && (
          <div style={{
            position: 'absolute',
            top: 16,
            left: 16,
            padding: '8px 14px',
            background: 'rgba(244, 63, 94, 0.12)',
            border: '1px solid rgba(244, 63, 94, 0.35)',
            borderRadius: 8,
            backdropFilter: 'blur(12px)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            zIndex: 10,
          }}>
            <span className="pulse-dot dot-red" />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: '#FB7185' }}>
              Red Nodes & Dashed Edges Indicate Vulnerable Paths
            </span>
          </div>
        )}
      </div>

      {/* ── RIGHT: Attack Findings & Exploits Panel ─────────────────────────── */}
      <aside style={{
        width: 360,
        minWidth: 360,
        background: 'var(--fg-bg-1)',
        borderLeft: '1px solid var(--fg-border)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflowY: 'auto',
      }}>
        {/* Results Header */}
        <div style={{ padding: 16, borderBottom: '1px solid var(--fg-border)' }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
            PENETRATION TELEMETRY
          </div>

          {attackResult ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 10 }}>
              <div style={{ padding: 8, background: 'rgba(244, 63, 94, 0.10)', border: '1px solid rgba(244, 63, 94, 0.25)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#FB7185', fontFamily: 'monospace' }}>
                  {attackResult.critical_count}
                </div>
                <div style={{ fontSize: 9.5, color: 'var(--fg-text-3)', fontWeight: 600 }}>CRITICAL</div>
              </div>

              <div style={{ padding: 8, background: 'rgba(245, 158, 11, 0.10)', border: '1px solid rgba(245, 158, 11, 0.25)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#FBBF24', fontFamily: 'monospace' }}>
                  {attackResult.warning_count}
                </div>
                <div style={{ fontSize: 9.5, color: 'var(--fg-text-3)', fontWeight: 600 }}>WARNINGS</div>
              </div>

              <div style={{ padding: 8, background: 'var(--fg-bg-2)', border: '1px solid var(--fg-border)', borderRadius: 8, textAlign: 'center' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: attackResult.overall_security_score >= 85 ? '#34D399' : '#FB7185', fontFamily: 'monospace' }}>
                  {attackResult.overall_security_score.toFixed(0)}
                </div>
                <div style={{ fontSize: 9.5, color: 'var(--fg-text-3)', fontWeight: 600 }}>SECURITY</div>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--fg-text-3)', fontStyle: 'italic', marginTop: 4 }}>
              No attack run executed yet. Click "RUN ATTACK SIMULATION" on the left.
            </div>
          )}
        </div>

        {/* Findings List */}
        <div style={{ padding: 16, flex: 1, overflowY: 'auto' }}>
          {attackResult && attackResult.findings.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {attackResult.findings.map((f) => {
                const isCrit = f.severity === 'CRITICAL';
                return (
                  <div
                    key={f.id}
                    className="soc-card"
                    style={{
                      padding: 12,
                      border: `1px solid ${isCrit ? 'rgba(244, 63, 94, 0.35)' : 'rgba(245, 158, 11, 0.35)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span className={`badge-status ${isCrit ? 'badge-blocked' : 'badge-warning'}`} style={{ fontSize: 10 }}>
                        {f.severity}
                      </span>
                      <span style={{ fontSize: 10, color: 'var(--fg-text-3)', fontFamily: 'monospace' }}>
                        {f.attack_type}
                      </span>
                    </div>

                    <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-text-0)', marginBottom: 4 }}>
                      {f.title}
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--fg-text-2)', lineHeight: 1.35, marginBottom: 8 }}>
                      {f.description}
                    </div>

                    {/* Exploit Scenario */}
                    <div style={{ padding: '6px 8px', background: 'rgba(244, 63, 94, 0.06)', borderRadius: 6, fontSize: 10.5, color: '#FB7185', marginBottom: 6 }}>
                      <strong>Exploit:</strong> {f.exploit_scenario}
                    </div>

                    {/* Mitigation */}
                    <div style={{ padding: '6px 8px', background: 'rgba(16, 185, 129, 0.06)', borderRadius: 6, fontSize: 10.5, color: '#34D399', marginBottom: 8 }}>
                      <strong>Fix:</strong> {f.mitigation}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <button
                        className="btn-soc-ghost"
                        onClick={() => highlightFinding(f)}
                        style={{ fontSize: 10.5, padding: '3px 6px', color: 'var(--fg-cyan-light)' }}
                      >
                        <Eye size={11} />
                        <span>Trace Path</span>
                      </button>

                      <button
                        className="btn-soc-secondary"
                        onClick={() => navigate('/repair')}
                        style={{ fontSize: 10.5, padding: '3px 8px' }}
                      >
                        <Wrench size={11} />
                        <span>Repair</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : attackResult && attackResult.findings.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--fg-text-2)' }}>
              <CheckCircle2 size={32} color="#10B981" style={{ margin: '0 auto 10px' }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: '#34D399' }}>Zero Vulnerabilities Detected</div>
              <div style={{ fontSize: 11, color: 'var(--fg-text-3)', marginTop: 4 }}>
                Workflow is mathematically robust against all 9 adversarial vectors.
              </div>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--fg-text-3)' }}>
              Select attack vectors and launch simulation to inspect telemetry.
            </div>
          )}
        </div>

        {/* Action Bottom */}
        <div style={{ padding: 14, borderTop: '1px solid var(--fg-border)' }}>
          <button className="btn-soc-primary" onClick={() => navigate('/repair')} style={{ width: '100%', fontSize: 12 }}>
            <Wrench size={13} />
            <span>Launch Auto-Repair Studio →</span>
          </button>
        </div>
      </aside>

    </div>
  );
}
