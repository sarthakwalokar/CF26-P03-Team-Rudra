import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Terminal, RefreshCw, Filter, ShieldCheck, Zap,
  Wrench, Play, CheckCircle2, AlertTriangle, XCircle, ArrowRight
} from 'lucide-react';
import { useFlowGuardStore } from '../lib/store';
import { getAuditTrail } from '../services/api';
import { formatDateTime, formatTimestamp } from '../lib/utils';

const EVENT_CATEGORY_ICONS: Record<string, any> = {
  WORKFLOW_CREATED: Terminal,
  WORKFLOW_PARSED: Terminal,
  VERIFICATION_STARTED: ShieldCheck,
  VERIFICATION_PASSED: CheckCircle2,
  VERIFICATION_FAILED: XCircle,
  ATTACK_STARTED: Zap,
  VULNERABILITY_FOUND: AlertTriangle,
  REPAIR_PROPOSED: Wrench,
  REPAIR_APPLIED: CheckCircle2,
  RE_VERIFICATION_PASSED: CheckCircle2,
  SIMULATION_RUN: Zap,
  STRESS_TEST_RUN: Zap,
  EXECUTION_STARTED: Play,
  EXECUTION_COMPLETED: CheckCircle2,
  EXECUTION_BLOCKED: XCircle,
  EXECUTION_FAILED: XCircle,
};

export default function AuditTrail() {
  const navigate = useNavigate();
  const { currentWorkflow } = useFlowGuardStore();

  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');

  const loadAuditLogs = async () => {
    if (!currentWorkflow) return;
    setIsLoading(true);
    try {
      const data = await getAuditTrail(currentWorkflow.id);
      setLogs(data);
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAuditLogs();
  }, [currentWorkflow?.id]);

  if (!currentWorkflow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)', gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12,
          background: 'rgba(14, 165, 233, 0.1)', border: '1px solid var(--fg-cyan-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Terminal size={24} color="var(--fg-cyan-light)" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-text-0)' }}>No Active Workflow Loaded</div>
        <button className="btn-soc-primary" onClick={() => navigate('/')}>
          <span>Compile Workflow First</span>
        </button>
      </div>
    );
  }

  const filteredLogs = logs.filter((log) => {
    if (filterSeverity === 'ALL') return true;
    return log.severity === filterSeverity;
  });

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1100, margin: '0 auto', width: '100%' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <Terminal size={16} color="var(--fg-cyan)" />
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-cyan-light)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              IMMUTABLE AUDIT TRAIL
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg-text-0)', margin: 0 }}>
            Chronological SOC Event Timeline
          </h1>
          <p style={{ fontSize: 13, color: 'var(--fg-text-2)', marginTop: 4 }}>
            Full lifecycle history for workflow: <strong style={{ color: 'var(--fg-text-1)' }}>{currentWorkflow.name}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Severity Filter */}
          <select
            className="soc-input"
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            style={{ width: 140, height: 36, padding: '4px 10px', fontSize: 12 }}
          >
            <option value="ALL">All Severities</option>
            <option value="INFO">Info</option>
            <option value="WARNING">Warnings</option>
            <option value="CRITICAL">Critical</option>
          </select>

          <button
            className="btn-soc-secondary"
            onClick={loadAuditLogs}
            disabled={isLoading}
            style={{ height: 36 }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Timeline Container */}
      <div className="soc-card-elevated" style={{ padding: 24, border: '1px solid var(--fg-border-active)' }}>
        {filteredLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px' }}>
            <Terminal size={36} color="var(--fg-text-3)" style={{ margin: '0 auto 12px' }} />
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-text-1)' }}>No Audit Logs Recorded Yet</div>
            <div style={{ fontSize: 12, color: 'var(--fg-text-3)', marginTop: 4 }}>
              Execute verification, attack simulations, or runtime actions to populate the SOC event log.
            </div>
          </div>
        ) : (
          <div style={{ position: 'relative', paddingLeft: 24 }}>
            {/* Vertical timeline spine */}
            <div style={{
              position: 'absolute',
              top: 8,
              bottom: 8,
              left: 11,
              width: 2,
              background: 'var(--fg-border)',
            }} />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {filteredLogs.map((log) => {
                const Icon = EVENT_CATEGORY_ICONS[log.event_type] || Terminal;
                const isCrit = log.severity === 'CRITICAL';
                const isWarn = log.severity === 'WARNING';

                return (
                  <div key={log.id} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    {/* Timeline bullet dot */}
                    <div style={{
                      position: 'absolute',
                      left: -24,
                      top: 4,
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'var(--fg-bg-1)',
                      border: `2px solid ${isCrit ? '#FB7185' : isWarn ? '#FBBF24' : '#0EA5E9'}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Icon size={11} color={isCrit ? '#FB7185' : isWarn ? '#FBBF24' : 'var(--fg-cyan-light)'} />
                    </div>

                    {/* Event Content Card */}
                    <div style={{
                      flex: 1,
                      padding: '12px 16px',
                      background: 'var(--fg-bg-1)',
                      border: `1px solid ${isCrit ? 'rgba(244, 63, 94, 0.3)' : 'var(--fg-border)'}`,
                      borderRadius: 8,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: 'var(--fg-cyan-light)' }}>
                            {log.timestamp ? new Date(log.timestamp).toLocaleTimeString() : '10:42:00'}
                          </span>
                          <span style={{ fontSize: 11, color: 'var(--fg-text-3)' }}>•</span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-text-0)' }}>
                            {log.title}
                          </span>
                        </div>

                        <span className={`badge-status ${isCrit ? 'badge-blocked' : isWarn ? 'badge-warning' : 'badge-info'}`} style={{ fontSize: 9.5 }}>
                          {log.severity}
                        </span>
                      </div>

                      <div style={{ fontSize: 11, color: 'var(--fg-text-3)', fontFamily: 'monospace' }}>
                        EVENT: {log.event_type}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
