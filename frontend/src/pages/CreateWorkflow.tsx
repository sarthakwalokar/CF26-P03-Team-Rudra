import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { Wand2, AlertTriangle, ChevronRight, Loader2, Sparkles, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlowGuardStore } from '../lib/store';
import { generateWorkflow, verifyWorkflow } from '../services/api';
import { DEMO_POLICIES } from '../lib/utils';

export default function CreateWorkflow() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setCurrentWorkflow, setVerificationResult, isGenerating, setIsGenerating, apiKey, useMock } = useFlowGuardStore();
  const [policy, setPolicy] = useState((location.state as any)?.policy || '');
  const [workflowName, setWorkflowName] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!policy.trim() || policy.length < 10) {
      setError('Please enter a policy with at least 10 characters.');
      return;
    }
    setError('');
    setIsGenerating(true);
    try {
      const resp = await generateWorkflow({
        policy_text: policy,
        use_mock: useMock || !apiKey,
        api_key: apiKey || undefined,
        name: workflowName || undefined,
      });
      setResult(resp);
      setCurrentWorkflow(resp.workflow);
      try {
        const vResult = await verifyWorkflow(resp.workflow);
        setVerificationResult(vResult);
      } catch {}
      toast.success(`Workflow parsed by ${resp.parsed_by} — ${resp.workflow.nodes.length} nodes`);
    } catch (e: any) {
      setError(e.message || 'Generation failed');
      toast.error('Generation failed: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleProceed = () => {
    navigate('/graph');
  };

  return (
    <div style={{ padding: 24, maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-text-primary)', margin: 0 }}>
          Create Workflow
        </h2>
        <p style={{ fontSize: 13, color: 'var(--fg-text-secondary)', marginTop: 4 }}>
          Enter a natural language business policy and generate a verified Workflow IR.
        </p>
      </div>

      {/* Demo presets */}
      <div className="fg-panel" style={{ padding: '16px 20px', marginBottom: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-text-muted)', letterSpacing: '0.08em', marginBottom: 12 }}>
          QUICK DEMO PRESETS
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DEMO_POLICIES.map(demo => (
            <button
              key={demo.key}
              className="btn-secondary"
              onClick={() => { setPolicy(demo.policy); setWorkflowName(demo.label + ' Workflow'); }}
              style={{ fontSize: 12 }}
            >
              {demo.icon} {demo.label}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <div className="fg-panel" style={{ padding: '20px' }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-text-secondary)', display: 'block', marginBottom: 6 }}>
            Workflow Name (optional)
          </label>
          <input
            className="fg-input"
            value={workflowName}
            onChange={e => setWorkflowName(e.target.value)}
            placeholder="e.g. Procurement Approval Workflow"
            style={{ height: 38 }}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-text-secondary)', display: 'block', marginBottom: 6 }}>
            Natural Language Policy <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <textarea
            className="fg-input"
            value={policy}
            onChange={e => setPolicy(e.target.value)}
            rows={5}
            placeholder="Example: Verify the vendor, check the budget, obtain finance approval, and create the procurement ticket."
            style={{ resize: 'vertical', minHeight: 120 }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--fg-text-muted)' }}>
              {policy.length} characters
            </span>
            <span style={{ fontSize: 11, color: useMock || !apiKey ? '#F59E0B' : '#10B981' }}>
              {useMock || !apiKey ? '⚡ Offline Policy Parser (Zero-Config)' : '🤖 Google Gemini 2.0 Parser'}
            </span>
          </div>
        </div>

        {error && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '10px 12px', background: 'rgba(239,68,68,0.08)', borderRadius: 8, border: '1px solid rgba(239,68,68,0.2)', marginBottom: 16 }}>
            <AlertTriangle size={14} color="#EF4444" style={{ flexShrink: 0, marginTop: 1 }} />
            <span style={{ fontSize: 12, color: '#EF4444' }}>{error}</span>
          </div>
        )}

        <button
          className="btn-primary"
          onClick={handleGenerate}
          disabled={isGenerating}
          style={{ width: '100%', justifyContent: 'center', padding: '10px 24px', fontSize: 14 }}
        >
          {isGenerating ? <><Loader2 size={14} className="animate-spin" /> Generating…</> : <><Wand2 size={14} /> Generate Workflow IR</>}
        </button>
      </div>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} style={{ marginTop: 20 }}>
            <div className="fg-panel" style={{ padding: '20px', border: '1px solid rgba(59,130,246,0.25)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <Sparkles size={16} color="#3B82F6" />
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg-text-primary)' }}>
                  Workflow IR Generated
                </span>
                <span style={{ fontSize: 11, color: 'var(--fg-text-muted)' }}>
                  parsed by <strong>{result.parsed_by}</strong> · confidence {(result.parse_confidence * 100).toFixed(0)}%
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
                {[
                  { label: 'Nodes', value: result.workflow.nodes.length },
                  { label: 'Edges', value: result.workflow.edges.length },
                  { label: 'Ambiguities', value: result.ambiguities.length },
                  { label: 'Actors', value: result.workflow.metadata.actors.length },
                ].map(stat => (
                  <div key={stat.label} style={{ padding: '10px 14px', background: 'var(--fg-bg-elevated)', borderRadius: 8, textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--fg-accent-blue)' }}>{stat.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-text-muted)' }}>{stat.label}</div>
                  </div>
                ))}
              </div>

              {result.ambiguities.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#F59E0B', letterSpacing: '0.06em', marginBottom: 8 }}>
                    ⚠ AMBIGUITIES DETECTED
                  </div>
                  {result.ambiguities.map((a: string, i: number) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '8px 10px', background: 'rgba(245,158,11,0.06)', borderRadius: 6, marginBottom: 4 }}>
                      <AlertTriangle size={12} color="#F59E0B" style={{ flexShrink: 0, marginTop: 2 }} />
                      <span style={{ fontSize: 12, color: 'var(--fg-text-secondary)' }}>{a}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn-primary" onClick={handleProceed} style={{ flex: 1, justifyContent: 'center' }}>
                  View Workflow Graph <ChevronRight size={14} />
                </button>
                <button className="btn-secondary" onClick={() => navigate('/verify')} style={{ flex: 1, justifyContent: 'center' }}>
                  Run Verification <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
