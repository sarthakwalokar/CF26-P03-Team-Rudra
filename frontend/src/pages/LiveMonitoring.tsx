import React from 'react';
import { Activity } from 'lucide-react';
import { useFlowGuardStore } from '../lib/store';
import WorkflowGraphView from '../components/WorkflowGraphView';
import { formatDuration } from '../lib/utils';

export default function LiveMonitoring() {
  const { currentWorkflow, executionRun } = useFlowGuardStore();

  if (!currentWorkflow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '70vh', gap: 16 }}>
        <Activity size={40} color="var(--fg-text-muted)" />
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--fg-text-primary)' }}>No Workflow Loaded</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 52px)' }}>
      <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--fg-border)', background: 'var(--fg-bg-secondary)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <Activity size={16} color="#3B82F6" />
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-text-primary)' }}>Live Monitoring</span>
        {executionRun && (
          <div style={{ display: 'flex', gap: 16, marginLeft: 'auto', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: 'var(--fg-text-secondary)' }}>Run: {executionRun.id}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: executionRun.status === 'COMPLETED' ? '#10B981' : executionRun.status === 'FAILED' ? '#EF4444' : '#3B82F6' }}>
              {executionRun.status}
            </div>
            {executionRun.duration_ms && <div style={{ fontSize: 12, color: 'var(--fg-text-muted)' }}>{formatDuration(executionRun.duration_ms)}</div>}
          </div>
        )}
      </div>
      <div style={{ flex: 1 }}>
        <WorkflowGraphView workflow={currentWorkflow} executionMode={!!executionRun} style={{ width: '100%', height: '100%' }} />
      </div>
      {executionRun && (
        <div style={{ height: 160, borderTop: '1px solid var(--fg-border)', background: 'var(--fg-bg-secondary)', padding: '12px 20px', overflowY: 'auto' }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--fg-text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>EXECUTION EVENTS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {executionRun.events.slice(-12).reverse().map(e => (
              <div key={e.id} style={{ display: 'flex', gap: 10, fontSize: 11 }}>
                <span style={{ color: 'var(--fg-text-muted)', fontFamily: 'monospace', flexShrink: 0 }}>{new Date(e.timestamp).toLocaleTimeString()}</span>
                <span style={{ color: e.event_type.includes('FAIL') || e.event_type === 'BLOCKED' ? '#EF4444' : e.event_type.includes('COMPLETE') ? '#10B981' : 'var(--fg-text-secondary)' }}>
                  {e.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
