import React from 'react';
import { Settings, Key, Bot, Database } from 'lucide-react';
import { toast } from 'sonner';
import { useFlowGuardStore } from '../lib/store';

export default function SettingsPage() {
  const { apiKey, setApiKey, useMock, setUseMock, reset } = useFlowGuardStore();

  return (
    <div style={{ padding: 24, maxWidth: 680, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--fg-text-primary)', margin: 0 }}>Settings</h2>
        <p style={{ fontSize: 13, color: 'var(--fg-text-secondary)', marginTop: 4 }}>FlowGuard AI configuration</p>
      </div>

      {/* LLM Config */}
      <div className="fg-panel" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <Bot size={16} color="#3B82F6" />
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-text-primary)' }}>LLM Configuration</div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-text-secondary)', display: 'block', marginBottom: 6 }}>
            Parser Mode
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setUseMock(true)}
              style={{
                flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                background: useMock ? 'rgba(59,130,246,0.1)' : 'var(--fg-bg-elevated)',
                border: `1px solid ${useMock ? 'rgba(59,130,246,0.4)' : 'var(--fg-border)'}`,
                color: useMock ? '#3B82F6' : 'var(--fg-text-secondary)',
                fontFamily: 'Inter', fontSize: 13, fontWeight: 600,
              }}
            >
              ⚡ Deterministic Policy Parser (Zero-Config)
            </button>
            <button
              onClick={() => setUseMock(false)}
              style={{
                flex: 1, padding: '10px', borderRadius: 8, cursor: 'pointer',
                background: !useMock ? 'rgba(16,185,129,0.1)' : 'var(--fg-bg-elevated)',
                border: `1px solid ${!useMock ? 'rgba(16,185,129,0.4)' : 'var(--fg-border)'}`,
                color: !useMock ? '#10B981' : 'var(--fg-text-secondary)',
                fontFamily: 'Inter', fontSize: 13, fontWeight: 600,
              }}
            >
              🤖 Google Gemini 2.0 LLM
            </button>
          </div>
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-text-secondary)', display: 'block', marginBottom: 6 }}>
            <Key size={12} style={{ display: 'inline', marginRight: 5 }} />
            Gemini API Key
          </label>
          <input
            className="fg-input"
            type="password"
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="AIza…"
            style={{ height: 38, fontFamily: 'monospace' }}
          />
          <div style={{ fontSize: 11, color: 'var(--fg-text-muted)', marginTop: 4 }}>
            Key is stored in localStorage only. Leave blank to use the deterministic offline policy parser.
          </div>
        </div>
      </div>

      {/* Architecture info */}
      <div className="fg-panel" style={{ padding: 20, marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--fg-text-primary)', marginBottom: 14 }}>Architecture</div>
        {[
          { label: 'Parser', value: useMock ? 'Deterministic Rule Engine (Offline)' : 'Google Gemini 2.0 LLM', icon: '🤖' },
          { label: 'IR Schema', value: 'Pydantic v2 (Python)', icon: '🧩' },
          { label: 'Verification', value: 'Deterministic NetworkX algorithms', icon: '⚡' },
          { label: 'Database', value: 'SQLite (SQLAlchemy async)', icon: '🗄️' },
          { label: 'Backend', value: 'FastAPI + Uvicorn', icon: '🚀' },
          { label: 'Frontend', value: 'React + Vite + React Flow', icon: '⚛️' },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: 12, color: 'var(--fg-text-muted)' }}>{item.icon} {item.label}</span>
            <span style={{ fontSize: 12, color: 'var(--fg-text-primary)', fontWeight: 500 }}>{item.value}</span>
          </div>
        ))}
      </div>

      {/* P-03 compliance */}
      <div className="fg-panel" style={{ padding: 20, marginBottom: 16, border: '1px solid rgba(59,130,246,0.2)' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#3B82F6', marginBottom: 12 }}>P-03 Compliance</div>
        {[
          '✅ Parse natural-language business policies',
          '✅ Convert to intermediate representation (IR)',
          '✅ Generate executable workflow graphs',
          '✅ Detect semantic ambiguity',
          '✅ Static policy and authorization checks',
          '✅ Identify unreachable/circular workflow states',
          '✅ Human-readable verification failure explanations',
        ].map(item => (
          <div key={item} style={{ fontSize: 12, color: 'var(--fg-text-secondary)', padding: '4px 0' }}>{item}</div>
        ))}
      </div>

      <button className="btn-danger" onClick={() => { reset(); toast.success('Workspace cleared'); }}>
        Clear Workspace
      </button>
    </div>
  );
}
