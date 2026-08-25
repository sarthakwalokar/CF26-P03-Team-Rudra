import React from 'react';
import { useFlowGuardStore } from '../lib/store';
import { CheckCircle2, AlertCircle, ShieldAlert, ArrowRight, ShieldCheck } from 'lucide-react';

interface Stage {
  id: string;
  label: string;
  desc: string;
}

const STAGES: Stage[] = [
  { id: 'policy', label: 'POLICY', desc: 'Natural Input' },
  { id: 'compiled', label: 'COMPILED', desc: 'IR AST Built' },
  { id: 'verified', label: 'VERIFIED', desc: 'Deterministic Check' },
  { id: 'security_tested', label: 'SECURITY TESTED', desc: 'Attack Penetration' },
  { id: 'repaired', label: 'REPAIRED', desc: 'AST Patch Applied' },
  { id: 're_verified', label: 'RE-VERIFIED', desc: 'Formally Proved' },
  { id: 'executable', label: 'EXECUTABLE', desc: 'Gate Unlocked' },
];

export default function LifecycleIndicator() {
  const { currentWorkflow, verificationResult, attackResult, repairProposal, executionRun } = useFlowGuardStore();

  if (!currentWorkflow) return null;

  // Determine active stages
  const isCompiled = !!currentWorkflow;
  const isVerified = !!verificationResult;
  const isBlocked = verificationResult?.status === 'BLOCKED';
  const isSafe = verificationResult?.status === 'SAFE';
  const isSecurityTested = !!attackResult;
  const isRepaired = !!repairProposal || currentWorkflow.name.includes('Repaired') || currentWorkflow.name.includes('Patched');
  const isReVerified = isRepaired && isSafe;
  const isExecutable = isSafe;

  const getStageStatus = (stageId: string): 'completed' | 'active' | 'blocked' | 'pending' => {
    switch (stageId) {
      case 'policy':
        return 'completed';
      case 'compiled':
        return isCompiled ? 'completed' : 'pending';
      case 'verified':
        if (!isVerified) return 'pending';
        return isBlocked ? 'blocked' : 'completed';
      case 'security_tested':
        if (isSecurityTested) return 'completed';
        return isBlocked ? 'active' : 'pending';
      case 'repaired':
        if (isRepaired) return 'completed';
        return isBlocked ? 'pending' : 'pending';
      case 're_verified':
        if (isReVerified) return 'completed';
        return isRepaired && isBlocked ? 'blocked' : 'pending';
      case 'executable':
        if (isExecutable) return 'completed';
        return isBlocked ? 'blocked' : 'pending';
      default:
        return 'pending';
    }
  };

  return (
    <div
      style={{
        background: 'var(--fg-bg-1)',
        border: '1px solid var(--fg-border)',
        borderRadius: 8,
        padding: '10px 16px',
        marginBottom: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 8,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--fg-text-3)', letterSpacing: '0.08em' }}>
          WORKFLOW LIFECYCLE
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
        {STAGES.map((s, idx) => {
          const status = getStageStatus(s.id);
          const isLast = idx === STAGES.length - 1;

          let badgeBg = 'var(--fg-bg-2)';
          let badgeBorder = 'var(--fg-border)';
          let badgeColor = 'var(--fg-text-3)';

          if (status === 'completed') {
            badgeBg = 'rgba(16, 185, 129, 0.12)';
            badgeBorder = 'rgba(16, 185, 129, 0.35)';
            badgeColor = '#34D399';
          } else if (status === 'blocked') {
            badgeBg = 'rgba(239, 68, 68, 0.12)';
            badgeBorder = 'rgba(239, 68, 68, 0.4)';
            badgeColor = '#FB7185';
          } else if (status === 'active') {
            badgeBg = 'rgba(14, 165, 233, 0.14)';
            badgeBorder = 'var(--fg-cyan-light)';
            badgeColor = 'var(--fg-cyan-light)';
          }

          return (
            <React.Fragment key={s.id}>
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '4px 8px',
                  borderRadius: 5,
                  background: badgeBg,
                  border: `1px solid ${badgeBorder}`,
                  fontSize: 10,
                  fontWeight: 700,
                  color: badgeColor,
                  letterSpacing: '0.03em',
                }}
                title={s.desc}
              >
                {status === 'completed' && <CheckCircle2 size={11} />}
                {status === 'blocked' && <AlertCircle size={11} />}
                <span>{s.label}</span>
              </div>
              {!isLast && (
                <span style={{ color: 'var(--fg-text-3)', fontSize: 10, opacity: 0.5 }}>→</span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
