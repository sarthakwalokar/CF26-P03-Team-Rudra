import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { TestTube, Loader2, Sparkles, Activity, ArrowRight, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useFlowGuardStore } from '../lib/store';
import { stressTestWorkflow } from '../services/api';
import { getScoreColor } from '../lib/utils';

const DEFAULT_MIX: Record<string, number> = {
  normal: 25, failed_service: 20, missing_input: 10,
  timeout: 10, approval_rejection: 10, dependency_failure: 10,
  invalid_state: 5, retry: 5, recovery: 5,
};

export default function StressTesting() {
  const navigate = useNavigate();
  const { currentWorkflow, stressTestResult, setStressTestResult, isStressTesting, setIsStressTesting } = useFlowGuardStore();
  const [totalScenarios, setTotalScenarios] = useState(1000);

  const handleRun = async () => {
    if (!currentWorkflow) return;
    setIsStressTesting(true);
    try {
      const result = await stressTestWorkflow(currentWorkflow, { total_scenarios: totalScenarios, scenario_mix: DEFAULT_MIX });
      setStressTestResult(result);
      toast.success(`Stress test complete: ${result.robustness_score.toFixed(1)}% robustness across ${result.total} scenarios`);
    } catch (e: any) {
      toast.error('Stress test failed: ' + e.message);
    } finally {
      setIsStressTesting(false);
    }
  };

  if (!currentWorkflow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(14, 165, 233, 0.1)', border: '1px solid var(--fg-cyan-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <TestTube size={24} color="var(--fg-cyan-light)" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-text-0)' }}>No Active Workflow Loaded</div>
        <button className="btn-soc-primary" onClick={() => navigate('/')}>
          <span>Compile Workflow First</span>
        </button>
      </div>
    );
  }

  const r = stressTestResult;

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 9999, background: 'rgba(14, 165, 233, 0.10)', border: '1px solid rgba(14, 165, 233, 0.28)', marginBottom: 8, width: 'fit-content' }}>
            <Activity size={12} color="var(--fg-cyan-light)" />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-cyan-light)', letterSpacing: '0.04em' }}>
              MONTE-CARLO SIMULATION SUITE
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg-text-0)', margin: 0, letterSpacing: '-0.02em' }}>
            Stress Testing & Resilience Engine
          </h1>
          <p style={{ fontSize: 13, color: 'var(--fg-text-2)', marginTop: 4 }}>
            Execute up to 10,000 deterministic failure permutations across service, state, actor, and network layers.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            className="soc-input"
            value={totalScenarios}
            onChange={e => setTotalScenarios(Number(e.target.value))}
            style={{ width: 150, height: 36, fontSize: 12 }}
          >
            {[100, 500, 1000, 5000, 10000].map(n => (
              <option key={n} value={n}>{n.toLocaleString()} scenarios</option>
            ))}
          </select>
          <button className="btn-soc-primary" onClick={handleRun} disabled={isStressTesting}>
            {isStressTesting ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Simulating Scenarios…</span>
              </>
            ) : (
              <>
                <TestTube size={14} />
                <span>Run Stress Test</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Scenario mix info */}
      <div className="soc-card" style={{ padding: '16px 20px', marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
          SCENARIO DISTRIBUTION MATRIX
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(DEFAULT_MIX).map(([key, pct]) => (
            <div key={key} style={{ padding: '4px 10px', background: 'var(--fg-bg-1)', borderRadius: 6, border: '1px solid var(--fg-border)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--fg-text-2)' }}>{key.replace(/_/g, ' ')}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-cyan-light)', fontFamily: 'monospace' }}>{pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {r ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Main score metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
            {[
              { label: 'Stress-Test Robustness', value: `${r.robustness_score.toFixed(1)}%`, color: getScoreColor(r.robustness_score) },
              { label: 'Total Scenarios', value: r.total.toLocaleString(), color: 'var(--fg-text-0)' },
              { label: 'Passed', value: r.passed.toLocaleString(), color: '#34D399' },
              { label: 'Failed', value: r.failed.toLocaleString(), color: '#FB7185' },
              { label: 'Critical', value: r.critical_failures.toLocaleString(), color: '#FB7185' },
            ].map(stat => (
              <div key={stat.label} className="soc-card" style={{ padding: '18px 14px', textAlign: 'center' }}>
                <div style={{ fontSize: stat.label === 'Robustness' ? 26 : 22, fontWeight: 800, color: stat.color, fontFamily: 'monospace' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600, marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Robustness Bar */}
          <div className="soc-card" style={{ padding: '18px 22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--fg-text-1)' }}>Aggregate Workflow Robustness</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: getScoreColor(r.robustness_score), fontFamily: 'monospace' }}>
                {r.robustness_score.toFixed(1)}%
              </span>
            </div>
            <div className="soc-progress" style={{ height: 8 }}>
              <div className="soc-progress-fill" style={{ width: `${r.robustness_score}%`, background: getScoreColor(r.robustness_score) }} />
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--fg-text-3)', marginTop: 8 }}>
              {r.robustness_score >= 90 ? '✓ High resilience — workflow gracefully handles edge cases' : r.robustness_score >= 75 ? '⚠ Moderate resilience — some unhandled failure paths' : '✗ Low resilience — critical failure paths detected'}
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="soc-card" style={{ padding: '20px' }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--fg-text-1)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
              SCENARIO CATEGORY BREAKDOWN
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--fg-border)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>SCENARIO</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>TOTAL</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>PASSED</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>FAILED</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>CRITICAL</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>WARNINGS</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>PASS RATE</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(r.scenario_breakdown).map(([key, stats]) => {
                  const st = stats as any;
                  const rate = st.total > 0 ? (st.passed / st.total * 100).toFixed(0) : '—';
                  return (
                    <tr key={key} style={{ borderBottom: '1px solid var(--fg-border-subtle)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--fg-text-1)', fontWeight: 600, fontSize: 12.5 }}>
                        {key.replace(/_/g, ' ')}
                      </td>
                      <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{st.total}</td>
                      <td style={{ padding: '10px 12px', color: '#34D399', fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{st.passed}</td>
                      <td style={{ padding: '10px 12px', color: '#FB7185', fontFamily: 'monospace', fontWeight: 600, fontSize: 12 }}>{st.failed}</td>
                      <td style={{ padding: '10px 12px', color: '#FB7185', fontFamily: 'monospace', fontWeight: 700, fontSize: 12 }}>{st.critical || 0}</td>
                      <td style={{ padding: '10px 12px', color: '#FBBF24', fontFamily: 'monospace', fontSize: 12 }}>{st.warnings || 0}</td>
                      <td style={{ padding: '10px 12px', color: getScoreColor(Number(rate)), fontWeight: 700, fontFamily: 'monospace', fontSize: 12 }}>
                        {rate}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="soc-card" style={{ padding: 48, textAlign: 'center' }}>
          <TestTube size={48} color="var(--fg-cyan-light)" style={{ margin: '0 auto 16px' }} />
          <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-text-0)', marginBottom: 8 }}>Ready to Stress Test</div>
          <div style={{ fontSize: 13, color: 'var(--fg-text-2)', maxWidth: 440, margin: '0 auto 24px' }}>
            Run thousands of failure permutations across 9 attack types to measure workflow robustness.
          </div>
          <button className="btn-soc-primary" onClick={handleRun} disabled={isStressTesting} style={{ padding: '10px 28px', fontSize: 13.5 }}>
            <TestTube size={15} />
            <span>Run Stress Test</span>
          </button>
        </div>
      )}
    </div>
  );
}
