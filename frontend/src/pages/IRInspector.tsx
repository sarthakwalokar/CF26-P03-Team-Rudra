import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Copy, ChevronDown, ChevronRight, FileCode, Check, Layers, ArrowRight, Key, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useFlowGuardStore } from '../lib/store';
import { NODE_TYPE_CONFIG, getScoreColor } from '../lib/utils';

export default function IRInspector() {
  const navigate = useNavigate();
  const { currentWorkflow, verificationResult } = useFlowGuardStore();
  const [viewMode, setViewMode] = useState<'visual' | 'json'>('visual');
  const [copied, setCopied] = useState(false);

  if (!currentWorkflow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)', gap: 16 }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: 'rgba(14, 165, 233, 0.1)', border: '1px solid var(--fg-cyan-border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FileCode size={24} color="var(--fg-cyan-light)" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-text-0)' }}>No Active Workflow Loaded</div>
        <button className="btn-soc-primary" onClick={() => navigate('/')}>
          <span>Compile Workflow First</span>
        </button>
      </div>
    );
  }

  const copyAll = () => {
    navigator.clipboard.writeText(JSON.stringify(currentWorkflow, null, 2));
    setCopied(true);
    toast.success('Workflow IR JSON copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px', borderRadius: 9999, background: 'rgba(14, 165, 233, 0.10)', border: '1px solid rgba(14, 165, 233, 0.28)', marginBottom: 8, width: 'fit-content' }}>
            <FileCode size={12} color="var(--fg-cyan-light)" />
            <span style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--fg-cyan-light)', letterSpacing: '0.04em' }}>
              WORKFLOW IR AST SPECIFICATION · P-03
            </span>
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--fg-text-0)', margin: 0, letterSpacing: '-0.02em' }}>
            Intermediate Representation (IR) Inspector
          </h1>
          <p style={{ fontSize: 13, color: 'var(--fg-text-2)', marginTop: 4 }}>
            Structured schema containing typed nodes, explicit permissions, preconditions, transitions, and failure policies.
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            className="btn-soc-secondary"
            onClick={() => setViewMode(v => v === 'visual' ? 'json' : 'visual')}
            style={{ fontSize: 12 }}
          >
            {viewMode === 'visual' ? 'Raw JSON AST' : 'Structured Visual IR'}
          </button>
          <button className="btn-soc-primary" onClick={copyAll} style={{ fontSize: 12 }}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            <span>{copied ? 'Copied!' : 'Copy IR JSON'}</span>
          </button>
        </div>
      </div>

      {viewMode === 'json' ? (
        <div className="soc-card" style={{ padding: 20 }}>
          <pre style={{
            margin: 0,
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
            color: '#38BDF8',
            background: 'var(--fg-bg-1)',
            padding: 16,
            borderRadius: 8,
            border: '1px solid var(--fg-border)',
            overflowX: 'auto',
            lineHeight: 1.6,
            maxHeight: 'calc(100vh - 220px)',
            overflowY: 'auto'
          }}>
            {JSON.stringify(currentWorkflow, null, 2)}
          </pre>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Metadata Bar */}
          <div className="soc-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
              WORKFLOW METADATA & COMPILE CONTEXT
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 14 }}>
              {[
                { label: 'WORKFLOW ID', value: currentWorkflow.id, mono: true },
                { label: 'VERSION', value: currentWorkflow.version, mono: true },
                { label: 'STATUS', value: currentWorkflow.status, mono: false },
                { label: 'DOMAIN', value: currentWorkflow.metadata?.domain || 'Enterprise Security', mono: false },
              ].map(f => (
                <div key={f.label} style={{ padding: '10px 14px', background: 'var(--fg-bg-1)', borderRadius: 8, border: '1px solid var(--fg-border)' }}>
                  <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fg-text-3)', marginBottom: 4 }}>{f.label}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-text-1)', fontFamily: f.mono ? 'monospace' : undefined }}>{f.value}</div>
                </div>
              ))}
            </div>

            {currentWorkflow.metadata?.policy_text && (
              <div style={{ padding: '10px 14px', background: 'var(--fg-bg-1)', borderRadius: 8, border: '1px solid var(--fg-border)' }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fg-text-3)', marginBottom: 4 }}>SOURCE POLICY STATEMENT</div>
                <div style={{ fontSize: 12, color: 'var(--fg-text-2)', fontStyle: 'italic' }}>"{currentWorkflow.metadata.policy_text}"</div>
              </div>
            )}
          </div>

          {/* Nodes Specifications */}
          <div className="soc-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
              IR NODES AST ({currentWorkflow.nodes.length})
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {currentWorkflow.nodes.map(node => {
                const cfg = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.ACTION;
                return (
                  <div
                    key={node.id}
                    style={{
                      padding: 14,
                      background: 'var(--fg-bg-1)',
                      borderRadius: 8,
                      border: '1px solid var(--fg-border)',
                      borderLeft: `3px solid ${cfg.borderColor}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, color: cfg.color }}>{cfg.icon}</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-text-0)' }}>{node.name}</span>
                        <span style={{ fontSize: 10.5, fontFamily: 'monospace', color: 'var(--fg-text-3)' }}>({node.id})</span>
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        {node.is_critical && <span className="badge-status badge-blocked" style={{ fontSize: 9.5 }}>CRITICAL</span>}
                        <span className="badge-status badge-info" style={{ fontSize: 9.5 }}>{node.type}</span>
                        <span style={{ fontSize: 10, color: 'var(--fg-text-3)', padding: '2px 6px', background: 'var(--fg-bg-2)', borderRadius: 4 }}>
                          Risk: {node.risk_level}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, fontSize: 11.5, color: 'var(--fg-text-2)', background: 'var(--fg-bg-2)', padding: '8px 12px', borderRadius: 6 }}>
                      <div><strong>Actor:</strong> <span style={{ color: 'var(--fg-text-1)' }}>{node.actor || 'None specified'}</span></div>
                      <div><strong>Failure Policy:</strong> <span style={{ color: 'var(--fg-cyan-light)', fontFamily: 'monospace' }}>{node.failure_policy}</span></div>
                      <div><strong>Permissions:</strong> <span style={{ color: 'var(--fg-cyan-light)', fontFamily: 'monospace' }}>{node.required_permissions?.join(', ') || 'None'}</span></div>
                      <div><strong>Preconditions:</strong> <span style={{ color: 'var(--fg-amber)', fontFamily: 'monospace' }}>{node.preconditions?.join(', ') || 'None'}</span></div>
                      <div><strong>Outputs:</strong> <span style={{ color: '#34D399', fontFamily: 'monospace' }}>{node.outputs?.join(', ') || 'None'}</span></div>
                      <div><strong>Timeout:</strong> <span style={{ color: 'var(--fg-text-3)' }}>{node.timeout_seconds ? `${node.timeout_seconds}s` : 'None'}</span></div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Edges Specifications */}
          <div className="soc-card" style={{ padding: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 14 }}>
              IR EDGES & TRANSITIONS ({currentWorkflow.edges.length})
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--fg-border)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>SOURCE</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}></th>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>TARGET</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>TYPE</th>
                  <th style={{ padding: '8px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>REQUIRED STATE / CONDITION</th>
                </tr>
              </thead>
              <tbody>
                {currentWorkflow.edges.map(edge => {
                  const src = currentWorkflow.nodes.find(n => n.id === edge.source);
                  const tgt = currentWorkflow.nodes.find(n => n.id === edge.target);
                  const typeColors: Record<string, string> = { SEQUENTIAL: '#0EA5E9', CONDITIONAL: '#F59E0B', PARALLEL: '#8B5CF6', FALLBACK: '#F97316', ERROR: '#EF4444' };
                  return (
                    <tr key={edge.id} style={{ borderBottom: '1px solid var(--fg-border-subtle)' }}>
                      <td style={{ padding: '10px 12px', color: 'var(--fg-text-1)', fontWeight: 600, fontSize: 12 }}>{src?.name || edge.source}</td>
                      <td style={{ padding: '10px 12px', color: typeColors[edge.transition_type] || '#0EA5E9', fontWeight: 800 }}>→</td>
                      <td style={{ padding: '10px 12px', color: 'var(--fg-text-1)', fontWeight: 600, fontSize: 12 }}>{tgt?.name || edge.target}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 10.5, fontWeight: 700, color: typeColors[edge.transition_type], fontFamily: 'monospace' }}>
                          {edge.transition_type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--fg-text-3)', fontFamily: 'monospace' }}>
                        {edge.label || edge.required_state || edge.condition || '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
