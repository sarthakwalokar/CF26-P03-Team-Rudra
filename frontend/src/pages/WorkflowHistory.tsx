import React from 'react';
import { useNavigate } from 'react-router-dom';
import { History, GitBranch, ArrowRight, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { listWorkflows, getWorkflow, deleteWorkflow } from '../services/api';
import { useFlowGuardStore } from '../lib/store';
import { getStatusBadgeClass, formatDateTime } from '../lib/utils';

export default function WorkflowHistory() {
  const navigate = useNavigate();
  const { setCurrentWorkflow } = useFlowGuardStore();
  const qc = useQueryClient();

  const { data: workflows, isLoading } = useQuery({
    queryKey: ['workflows'],
    queryFn: listWorkflows,
  });

  const deleteMut = useMutation({
    mutationFn: deleteWorkflow,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['workflows'] }); toast.success('Deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  const handleLoad = async (id: string) => {
    try {
      const wf = await getWorkflow(id);
      setCurrentWorkflow(wf);
      toast.success(`Loaded: ${wf.name}`);
      navigate('/graph');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-text-primary)', margin: 0 }}>Workflow History</h2>
        <p style={{ fontSize: 13, color: 'var(--fg-text-secondary)', marginTop: 4 }}>All generated workflows — click to load into the graph.</p>
      </div>

      {isLoading ? (
        <div className="fg-panel" style={{ padding: 40, textAlign: 'center', color: 'var(--fg-text-muted)' }}>Loading…</div>
      ) : !workflows?.length ? (
        <div className="fg-panel" style={{ padding: 40, textAlign: 'center' }}>
          <History size={40} color="var(--fg-text-muted)" style={{ margin: '0 auto 14px' }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--fg-text-primary)', marginBottom: 8 }}>No Workflows Yet</div>
          <button className="btn-primary" onClick={() => navigate('/create')}>Create First Workflow</button>
        </div>
      ) : (
        <div className="fg-panel" style={{ overflow: 'hidden' }}>
          <table className="fg-table">
            <thead>
              <tr><th>Name</th><th>Status</th><th>Score</th><th>Version</th><th>Updated</th><th></th></tr>
            </thead>
            <tbody>
              {workflows.map(w => (
                <tr key={w.id}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <GitBranch size={12} color="var(--fg-text-muted)" />
                      <span style={{ color: 'var(--fg-text-primary)', fontWeight: 500 }}>{w.name}</span>
                    </div>
                  </td>
                  <td><span className={getStatusBadgeClass(w.status)}>{w.status}</span></td>
                  <td style={{ color: w.risk_score >= 85 ? '#10B981' : w.risk_score >= 60 ? '#F59E0B' : 'var(--fg-text-muted)' }}>
                    {w.risk_score > 0 ? `${w.risk_score.toFixed(0)}/100` : '—'}
                  </td>
                  <td style={{ color: 'var(--fg-text-muted)', fontFamily: 'monospace', fontSize: 11 }}>{w.version}</td>
                  <td style={{ color: 'var(--fg-text-muted)', fontSize: 11 }}>{w.updated_at ? formatDateTime(w.updated_at) : '—'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-ghost" onClick={() => handleLoad(w.id)} style={{ fontSize: 11 }}>
                        <ArrowRight size={11} /> Load
                      </button>
                      <button className="btn-ghost" onClick={() => deleteMut.mutate(w.id)} style={{ fontSize: 11, color: '#EF4444' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
