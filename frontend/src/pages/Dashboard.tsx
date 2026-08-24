import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Shield, ShieldCheck, Zap, ArrowRight, Wand2, Sparkles,
  CheckCircle2, AlertTriangle, Cpu, Terminal, Play, Loader2, ArrowUpRight,
  FlaskConical, TestTube, Wrench, FileCode, Check
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFlowGuardStore } from '../lib/store';
import { listWorkflows, generateWorkflow, verifyWorkflow } from '../services/api';
import { DEMO_POLICIES, getScoreColor, formatDateTime } from '../lib/utils';
import { toast } from 'sonner';

const PIPELINE_STAGES = [
  { id: 'policy', label: '1. POLICY', desc: 'Natural Language Input' },
  { id: 'parse', label: '2. AI PARSER', desc: 'Gemini / Heuristic Engine' },
  { id: 'ir', label: '3. WORKFLOW IR', desc: 'Pydantic AST Graph' },
  { id: 'verify', label: '4. VERIFICATION', desc: '10 Static Checks' },
  { id: 'attack', label: '5. ATTACK LAB', desc: '9 Security Exploit Scenarios' },
  { id: 'repair', label: '6. AUTO-REPAIR', desc: 'AST Patch & Re-Verification' },
  { id: 'execute', label: '7. SAFE EXECUTE', desc: 'Zero-Untrusted Runtime Gate' },
];

const PRESET_CHIPS = [
  { key: 'procurement', label: 'Procurement Approval', policy: 'Verify the vendor, check the budget, obtain finance approval, and create the procurement ticket.' },
  { key: 'refund', label: 'Customer Refund', policy: 'Verify customer identity, perform fraud risk scoring, obtain manager approval for amounts over $500, then issue refund.' },
  { key: 'access', label: 'Employee Access', policy: 'Verify employee identity, obtain manager approval, then provision system access.' },
  { key: 'onboarding', label: 'Customer Onboarding', policy: 'Perform customer KYC verification, assign account tier, obtain compliance signoff, and activate account.' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentWorkflow, verificationResult, setCurrentWorkflow, setVerificationResult, isGenerating, setIsGenerating, apiKey, useMock } = useFlowGuardStore();
  const { data: workflows } = useQuery({ queryKey: ['workflows'], queryFn: listWorkflows, refetchInterval: 10000 });

  const [policyText, setPolicyText] = useState(
    currentWorkflow?.metadata?.policy_text || 'Verify the vendor, check the budget, obtain finance approval, and create the procurement ticket.'
  );
  const [pipelineStep, setPipelineStep] = useState<number>(currentWorkflow ? 7 : 0);

  const handleCompile = async () => {
    if (!policyText.trim() || policyText.length < 10) {
      toast.error('Please provide a policy description of at least 10 characters.');
      return;
    }
    setIsGenerating(true);
    setPipelineStep(1);

    try {
      // Step 1: Parse
      const resp = await generateWorkflow({
        policy_text: policyText,
        use_mock: useMock || !apiKey,
        api_key: apiKey || undefined,
      });
      setCurrentWorkflow(resp.workflow);
      setPipelineStep(3);

      // Step 2: Immediate verification
      const vResult = await verifyWorkflow(resp.workflow);
      setVerificationResult(vResult);
      setPipelineStep(7);

      toast.success(`Workflow compiled & verified (${resp.workflow.nodes.length} nodes · ${vResult.status})`);
    } catch (e: any) {
      toast.error('Compilation error: ' + e.message);
      setPipelineStep(0);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1300, margin: '0 auto', width: '100%' }}>

      {/* Hero Section */}
      <div style={{ textAlign: 'center', marginBottom: 36, maxWidth: 880, margin: '0 auto 36px' }}>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '4px 14px',
          borderRadius: 9999,
          background: 'rgba(14, 165, 233, 0.10)',
          border: '1px solid rgba(14, 165, 233, 0.28)',
          marginBottom: 16,
        }}>
          <Sparkles size={12} color="var(--fg-cyan-light)" />
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-cyan-light)', letterSpacing: '0.04em' }}>
            P-03 · NATURAL LANGUAGE → VERIFIED WORKFLOW COMPILER
          </span>
        </div>

        <h1 style={{
          fontSize: 34,
          fontWeight: 800,
          color: 'var(--fg-text-0)',
          lineHeight: 1.2,
          letterSpacing: '-0.03em',
          margin: 0,
        }}>
          Turn Business Policies Into Verified Workflows.
        </h1>

        <div style={{
          padding: '10px 18px',
          background: 'rgba(14, 165, 233, 0.08)',
          border: '1px solid rgba(14, 165, 233, 0.22)',
          borderRadius: 8,
          fontSize: 13.5,
          fontWeight: 600,
          color: 'var(--fg-cyan-light)',
          marginTop: 14,
          display: 'inline-block',
        }}>
          💡 "AI understands the policy. Deterministic verification decides whether it is safe to execute."
        </div>
      </div>

      {/* Large Policy Input Card */}
      <div className="soc-card-elevated" style={{ padding: 24, marginBottom: 32, border: '1px solid var(--fg-border-active)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Terminal size={15} color="var(--fg-cyan)" />
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--fg-text-1)' }}>
              Describe your business policy in natural language...
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: useMock || !apiKey ? 'var(--fg-amber)' : 'var(--fg-cyan-light)', fontWeight: 600 }}>
              {useMock || !apiKey ? '⚡ Offline Policy Parser (Zero-Config)' : '🤖 Google Gemini 2.0 Parser'}
            </span>
          </div>
        </div>

        <textarea
          className="soc-input"
          value={policyText}
          onChange={(e) => setPolicyText(e.target.value)}
          rows={3}
          placeholder="e.g. Verify the vendor, check the budget, obtain finance approval, and create the procurement ticket."
          style={{
            fontSize: 14,
            lineHeight: 1.5,
            resize: 'vertical',
            minHeight: 88,
            marginBottom: 16,
            background: 'var(--fg-bg-1)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          {/* Example policy chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--fg-text-3)', fontWeight: 600 }}>Presets:</span>
            {PRESET_CHIPS.map((chip) => (
              <button
                key={chip.key}
                onClick={() => setPolicyText(chip.policy)}
                className="btn-soc-ghost"
                style={{
                  padding: '4px 10px',
                  background: 'var(--fg-bg-1)',
                  border: '1px solid var(--fg-border)',
                  fontSize: 11.5,
                  borderRadius: 6,
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>

          {/* Action Button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {currentWorkflow && (
              <button
                className="btn-soc-secondary"
                onClick={() => navigate('/graph')}
              >
                <span>View Workspace Canvas</span>
                <ArrowRight size={13} />
              </button>
            )}
            <button
              className="btn-soc-primary"
              onClick={handleCompile}
              disabled={isGenerating}
              style={{ padding: '9px 24px', fontSize: 13 }}
            >
              {isGenerating ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Compiling & Verifying…</span>
                </>
              ) : (
                <>
                  <Wand2 size={15} />
                  <span>Compile Policy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* FlowGuard Security Pipeline Story */}
      <div className="soc-card" style={{ padding: 22, marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            HOW FLOWGUARD VERIFIES SAFETY BEFORE RUNTIME
          </div>
          {verificationResult && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--fg-text-3)' }}>VERIFICATION SCORE:</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: getScoreColor(verificationResult.score), fontFamily: 'monospace' }}>
                {verificationResult.score.toFixed(0)}/100
              </span>
              <span className={`badge-status ${verificationResult.status === 'SAFE' ? 'badge-safe' : verificationResult.status === 'WARNING' ? 'badge-warning' : 'badge-blocked'}`}>
                {verificationResult.status}
              </span>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
          {PIPELINE_STAGES.map((stage, idx) => {
            const isCompleted = pipelineStep > idx;
            const isCurrent = pipelineStep === idx + 1;
            return (
              <div
                key={stage.id}
                style={{
                  padding: '12px 10px',
                  background: isCurrent ? 'rgba(14, 165, 233, 0.16)' : (isCompleted ? 'rgba(16, 185, 129, 0.08)' : 'var(--fg-bg-1)'),
                  border: `1px solid ${isCurrent ? 'var(--fg-cyan-light)' : (isCompleted ? 'rgba(16, 185, 129, 0.3)' : 'var(--fg-border)')}`,
                  borderRadius: 8,
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{
                  fontSize: 10,
                  fontWeight: 800,
                  color: isCurrent ? 'var(--fg-cyan-light)' : (isCompleted ? '#34D399' : 'var(--fg-text-3)'),
                  letterSpacing: '0.04em',
                  marginBottom: 4,
                }}>
                  {stage.label}
                </div>
                <div style={{ fontSize: 10, color: 'var(--fg-text-2)', lineHeight: 1.2 }}>
                  {stage.desc}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Workflow Summary Panel */}
      {currentWorkflow && verificationResult && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 24, marginBottom: 32 }}>
          {/* Main Info */}
          <div className="soc-card-elevated" style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className={`badge-status ${verificationResult.status === 'SAFE' ? 'badge-safe' : verificationResult.status === 'WARNING' ? 'badge-warning' : 'badge-blocked'}`}>
                  {verificationResult.status}
                </span>
                <span style={{ fontSize: 11, color: 'var(--fg-text-3)', fontFamily: 'monospace' }}>
                  ID: {currentWorkflow.id.substring(0, 8)}
                </span>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-soc-ghost" onClick={() => navigate('/verify')}>
                  <ShieldCheck size={13} />
                  <span>Verify</span>
                </button>
                <button className="btn-soc-ghost" onClick={() => navigate('/attack')}>
                  <Zap size={13} />
                  <span>Attack</span>
                </button>
                <button className="btn-soc-ghost" onClick={() => navigate('/repair')}>
                  <Wrench size={13} />
                  <span>Repair</span>
                </button>
                <button className="btn-soc-primary" onClick={() => navigate('/execute')}>
                  <Play size={13} />
                  <span>Safe Execute</span>
                </button>
              </div>
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--fg-text-0)', margin: '0 0 8px' }}>
              {currentWorkflow.name}
            </h2>
            <p style={{ fontSize: 13, color: 'var(--fg-text-2)', margin: '0 0 16px', lineHeight: 1.4 }}>
              {currentWorkflow.description}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
              <div style={{ padding: 10, background: 'var(--fg-bg-1)', borderRadius: 6, border: '1px solid var(--fg-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-text-3)' }}>NODES</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg-text-0)', fontFamily: 'monospace' }}>
                  {currentWorkflow.nodes.length}
                </div>
              </div>
              <div style={{ padding: 10, background: 'var(--fg-bg-1)', borderRadius: 6, border: '1px solid var(--fg-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-text-3)' }}>EDGES</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--fg-text-0)', fontFamily: 'monospace' }}>
                  {currentWorkflow.edges.length}
                </div>
              </div>
              <div style={{ padding: 10, background: 'var(--fg-bg-1)', borderRadius: 6, border: '1px solid var(--fg-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-text-3)' }}>CRITICAL ISSUES</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: verificationResult.issues.length > 0 ? '#FB7185' : '#34D399', fontFamily: 'monospace' }}>
                  {verificationResult.issues.length}
                </div>
              </div>
              <div style={{ padding: 10, background: 'var(--fg-bg-1)', borderRadius: 6, border: '1px solid var(--fg-border)' }}>
                <div style={{ fontSize: 10, color: 'var(--fg-text-3)' }}>WARNINGS</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: verificationResult.warnings.length > 0 ? '#FBBF24' : '#34D399', fontFamily: 'monospace' }}>
                  {verificationResult.warnings.length}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Score Card */}
          <div className="soc-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', textAlign: 'center' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 12 }}>
                VERIFICATION SCORE
              </div>
              <div style={{ fontSize: 44, fontWeight: 900, color: getScoreColor(verificationResult.score), fontFamily: 'monospace', lineHeight: 1 }}>
                {verificationResult.score.toFixed(0)}
                <span style={{ fontSize: 16, color: 'var(--fg-text-3)' }}>/100</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--fg-text-2)', marginTop: 8 }}>
                {verificationResult.status === 'SAFE' ? '✓ Safe to execute in runtime' : (verificationResult.status === 'WARNING' ? '⚠ Advisory warnings detected' : '✕ Strict execution block active')}
              </div>
            </div>

            <button className="btn-soc-primary" onClick={() => navigate('/verify')} style={{ width: '100%', marginTop: 16 }}>
              <span>View Verification Analysis</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
