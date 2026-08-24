import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster, toast } from 'sonner';
import {
  Shield, ShieldCheck, Zap, Wrench, FlaskConical, TestTube, Play,
  BarChart3, Box, Settings, Search, Bell, Sparkles, Cpu,
  CheckCircle2, AlertTriangle, XCircle, ArrowUpRight, Plus, Terminal,
  Layers, ChevronRight, Circle, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { useFlowGuardStore } from './lib/store';
import { DEMO_POLICIES, getScoreColor } from './lib/utils';
import { generateWorkflow } from './services/api';

// Pages
import Dashboard from './pages/Dashboard';
import CreateWorkflow from './pages/CreateWorkflow';
import WorkflowGraph from './pages/WorkflowGraph';
import VerificationCenter from './pages/VerificationCenter';
import AttackMode from './pages/AttackMode';
import AutoRepair from './pages/AutoRepair';
import WhatIfSimulator from './pages/WhatIfSimulator';
import StressTesting from './pages/StressTesting';
import SafeExecution from './pages/SafeExecution';
import LiveMonitoring from './pages/LiveMonitoring';
import AuditTrail from './pages/AuditTrail';
import WorkflowHistory from './pages/WorkflowHistory';
import DigitalTwin3D from './pages/DigitalTwin3D';
import IRInspector from './pages/IRInspector';
import SettingsPage from './pages/SettingsPage';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });

const SIDEBAR_NAV = [
  { path: '/', label: 'Overview', icon: BarChart3, exact: true },
  { path: '/graph', label: 'Workflows', icon: Cpu },
  { path: '/verify', label: 'Verification', icon: ShieldCheck },
  { path: '/attack', label: 'Attack Lab', icon: Zap },
  { path: '/repair', label: 'Auto-Repair', icon: Wrench },
  { path: '/whatif', label: 'What-If', icon: FlaskConical },
  { path: '/stress', label: 'Stress Test', icon: TestTube },
  { path: '/execute', label: 'Execution', icon: Play },
  { path: '/3d', label: '3D Twin', icon: Box },
  { path: '/audit', label: 'Audit', icon: Terminal },
];

const PAGE_TITLES: Record<string, string> = {
  '/': 'Overview & Policy Compiler',
  '/create': 'Compile New Policy',
  '/graph': 'Workflow Workspace (Canvas IDE)',
  '/ir': 'Intermediate Representation (IR) Inspector',
  '/verify': 'Deterministic Verification Engine',
  '/attack': 'Security Attack Lab (Penetration Testing)',
  '/repair': 'Auto-Repair Studio & Diff Inspector',
  '/whatif': 'What-If Runtime Outage Simulator',
  '/stress': 'Monte-Carlo Stress Testing (10K Scenarios)',
  '/3d': '3D Digital Twin Spatial Environment',
  '/execute': 'Deterministic Safe Execution Engine',
  '/monitor': 'Live Execution Stream & Telemetry',
  '/audit': 'Chronological SOC Audit Trail',
  '/history': 'Compiled Workflows Library',
  '/settings': 'System Architecture & LLM Settings',
};

// ── Left-Side Vertical Sidebar ────────────────────────────────────────────────

function LeftVerticalSidebar({
  collapsed,
  onToggleCollapse,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
}) {
  const { currentWorkflow, verificationResult } = useFlowGuardStore();
  const location = useLocation();
  const navigate = useNavigate();

  const width = collapsed ? 68 : 250;

  return (
    <aside style={{
      width,
      minWidth: width,
      background: 'var(--fg-bg-1)',
      borderRight: '1px solid var(--fg-border)',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      zIndex: 50,
      display: 'flex',
      flexDirection: 'column',
      userSelect: 'none',
      transition: 'width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      overflowX: 'hidden',
    }}>
      {/* Brand Header */}
      <div
        style={{
          padding: collapsed ? '18px 0' : '18px 18px',
          borderBottom: '1px solid var(--fg-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 10,
        }}
      >
        <div
          onClick={() => navigate('/')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            cursor: 'pointer',
          }}
        >
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: 'linear-gradient(135deg, #0EA5E9 0%, #6366F1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 16px rgba(14, 165, 233, 0.35)',
            flexShrink: 0,
          }}>
            <Shield size={17} color="#FFFFFF" />
          </div>

          {!collapsed && (
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--fg-text-0)', letterSpacing: '0.02em', display: 'flex', alignItems: 'center', gap: 4 }}>
                FLOWGUARD <span style={{ color: 'var(--fg-cyan-light)', fontWeight: 600 }}>AI</span>
              </div>
              <div style={{ fontSize: 9.5, color: 'var(--fg-text-3)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                Verified Compiler · P-03
              </div>
            </div>
          )}
        </div>

        {!collapsed && (
          <button
            onClick={onToggleCollapse}
            title="Collapse Sidebar"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--fg-text-3)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PanelLeftClose size={15} />
          </button>
        )}
      </div>

      {collapsed && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0', borderBottom: '1px solid var(--fg-border)' }}>
          <button
            onClick={onToggleCollapse}
            title="Expand Sidebar"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--fg-text-3)',
              cursor: 'pointer',
              padding: 4,
              borderRadius: 4,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <PanelLeftOpen size={16} />
          </button>
        </div>
      )}

      {/* Active Workflow Quick Widget (if loaded) */}
      {currentWorkflow && !collapsed && (
        <div
          onClick={() => navigate('/graph')}
          style={{
            margin: '12px 14px 6px',
            padding: '10px 12px',
            background: 'var(--fg-bg-2)',
            border: '1px solid var(--fg-border)',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fg-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>
            ACTIVE WORKFLOW
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--fg-text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentWorkflow.name}
          </div>
          {verificationResult && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: verificationResult.status === 'SAFE' ? '#34D399' : verificationResult.status === 'WARNING' ? '#FBBF24' : '#FB7185',
              }}>
                {verificationResult.status === 'SAFE' ? '✓ VERIFIED' : verificationResult.status}
              </span>
              <span style={{ fontSize: 10.5, fontWeight: 700, color: getScoreColor(verificationResult.score), fontFamily: 'monospace' }}>
                {verificationResult.score.toFixed(0)}/100
              </span>
            </div>
          )}
        </div>
      )}

      {/* Vertical Navigation Items */}
      <nav style={{ flex: 1, padding: collapsed ? '12px 8px' : '12px 10px', display: 'flex', flexDirection: 'column', gap: 3, overflowY: 'auto' }}>
        {!collapsed && (
          <div style={{ fontSize: 9.5, fontWeight: 800, color: 'var(--fg-text-4)', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', marginBottom: 2 }}>
            NAVIGATION
          </div>
        )}

        {SIDEBAR_NAV.map((item) => {
          const isActive = item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);
          const Icon = item.icon;

          return (
            <NavLink
              key={item.path}
              to={item.path}
              title={collapsed ? item.label : undefined}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: collapsed ? 'center' : 'flex-start',
                gap: 10,
                padding: collapsed ? '10px 0' : '8px 12px',
                borderRadius: 8,
                textDecoration: 'none',
                fontSize: 12.5,
                fontWeight: isActive ? 600 : 500,
                color: isActive ? 'var(--fg-cyan-light)' : 'var(--fg-text-2)',
                background: isActive ? 'rgba(14, 165, 233, 0.12)' : 'transparent',
                border: `1px solid ${isActive ? 'rgba(14, 165, 233, 0.28)' : 'transparent'}`,
                transition: 'all 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'var(--fg-bg-3)';
                  e.currentTarget.style.color = 'var(--fg-text-1)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'var(--fg-text-2)';
                }
              }}
            >
              <Icon size={16} color={isActive ? 'var(--fg-cyan-light)' : 'var(--fg-text-3)'} />
              {!collapsed && <span>{item.label}</span>}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Footer: Settings & System Status */}
      <div style={{ padding: collapsed ? '12px 8px' : '14px 14px', borderTop: '1px solid var(--fg-border)', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <NavLink
          to="/settings"
          title={collapsed ? 'Settings' : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            padding: collapsed ? '8px 0' : '7px 10px',
            borderRadius: 7,
            textDecoration: 'none',
            fontSize: 12,
            fontWeight: location.pathname === '/settings' ? 600 : 500,
            color: location.pathname === '/settings' ? 'var(--fg-cyan-light)' : 'var(--fg-text-2)',
            background: location.pathname === '/settings' ? 'rgba(14, 165, 233, 0.10)' : 'transparent',
          }}
        >
          <Settings size={15} color="var(--fg-text-3)" />
          {!collapsed && <span>Settings</span>}
        </NavLink>

        {/* System Status Indicator */}
        {!collapsed ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '6px 10px',
            background: 'var(--fg-bg-2)',
            borderRadius: 6,
            border: '1px solid var(--fg-border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="pulse-dot dot-green" />
              <span style={{ fontSize: 10.5, fontWeight: 600, color: '#34D399' }}>System: Operational</span>
            </div>
            <span style={{ fontSize: 9.5, color: 'var(--fg-text-4)', fontFamily: 'monospace' }}>v1.0</span>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }} title="System: Operational">
            <span className="pulse-dot dot-green" />
          </div>
        )}
      </div>
    </aside>
  );
}

// ── Top Header (Only Title, Search, Status, Actions) ───────────────────────────

function TopHeaderBar({ sidebarWidth }: { sidebarWidth: number }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentWorkflow, verificationResult, apiKey, useMock, setCurrentWorkflow, setIsGenerating } = useFlowGuardStore();
  const [searchOpen, setSearchOpen] = useState(false);

  const pageTitle = PAGE_TITLES[location.pathname] || 'FlowGuard AI';

  const loadPreset = async (policyText: string, name: string) => {
    setSearchOpen(false);
    setIsGenerating(true);
    try {
      const resp = await generateWorkflow({
        policy_text: policyText,
        use_mock: useMock || !apiKey,
        api_key: apiKey || undefined,
        name,
      });
      setCurrentWorkflow(resp.workflow);
      toast.success(`Compiled "${name}" (${resp.workflow.nodes.length} nodes)`);
      navigate('/graph');
    } catch (e: any) {
      toast.error('Failed to compile: ' + e.message);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <>
      <header style={{
        height: 56,
        background: 'var(--fg-bg-1)',
        borderBottom: '1px solid var(--fg-border)',
        position: 'fixed',
        top: 0,
        left: sidebarWidth,
        right: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        transition: 'left 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Breadcrumb Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--fg-text-3)' }}>FlowGuard AI</span>
          <ChevronRight size={13} color="var(--fg-text-4)" />
          <h2 style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg-text-0)', margin: 0 }}>
            {pageTitle}
          </h2>
        </div>

        {/* Right Tools: Search, Active Score, Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Quick Preset Search Button */}
          <button
            className="btn-soc-secondary"
            onClick={() => setSearchOpen(true)}
            style={{ padding: '5px 11px', fontSize: 11.5, height: 30 }}
          >
            <Search size={12} color="var(--fg-text-3)" />
            <span style={{ color: 'var(--fg-text-2)' }}>Quick Presets</span>
            <kbd style={{
              fontSize: 9.5,
              padding: '1px 4px',
              borderRadius: 3,
              background: 'var(--fg-bg-1)',
              border: '1px solid var(--fg-border)',
              color: 'var(--fg-text-3)',
            }}>⌘K</kbd>
          </button>

          {/* Active Safety Score Pill */}
          {verificationResult && (
            <div
              onClick={() => navigate('/verify')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                background: 'var(--fg-bg-2)',
                border: '1px solid var(--fg-border)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              <span style={{ fontSize: 10, color: 'var(--fg-text-3)', textTransform: 'uppercase' }}>SAFETY:</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: getScoreColor(verificationResult.score), fontFamily: 'monospace' }}>
                {verificationResult.score.toFixed(0)}/100
              </span>
              <span style={{
                fontSize: 9.5,
                fontWeight: 700,
                color: verificationResult.status === 'SAFE' ? '#34D399' : verificationResult.status === 'WARNING' ? '#FBBF24' : '#FB7185',
              }}>
                {verificationResult.status === 'SAFE' ? '✓ VERIFIED' : verificationResult.status}
              </span>
            </div>
          )}

          {/* Quick New Policy Button */}
          <button
            className="btn-soc-primary"
            onClick={() => navigate('/')}
            style={{ padding: '5px 12px', fontSize: 11.5, height: 30 }}
          >
            <Plus size={12} />
            <span>New Policy</span>
          </button>
        </div>
      </header>

      {/* Preset Quick-Switcher Modal */}
      {searchOpen && (
        <div
          onClick={() => setSearchOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(4, 7, 17, 0.75)',
            backdropFilter: 'blur(8px)',
            zIndex: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="soc-card-elevated"
            style={{ width: 520, maxWidth: '100%', padding: 20, border: '1px solid var(--fg-border-active)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color="var(--fg-cyan-light)" />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--fg-text-0)' }}>Load Business Policy Preset</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--fg-text-3)' }}>ESC to close</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DEMO_POLICIES.map((demo) => (
                <div
                  key={demo.key}
                  onClick={() => loadPreset(demo.policy, demo.label + ' Workflow')}
                  className="soc-card-interactive"
                  style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
                >
                  <span style={{ fontSize: 20 }}>{demo.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--fg-text-1)' }}>{demo.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--fg-text-3)', marginTop: 2 }}>{demo.description}</div>
                  </div>
                  <ArrowUpRight size={15} color="var(--fg-text-3)" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Main Layout Assembly ──────────────────────────────────────────────────────

function AppShell() {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? 68 : 250;

  return (
    <div style={{ minHeight: '100vh', display: 'flex', background: 'var(--fg-bg-0)' }}>
      {/* 1. Fixed Left Vertical Sidebar */}
      <LeftVerticalSidebar
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((c) => !c)}
      />

      {/* 2. Main Right Container */}
      <div style={{
        marginLeft: sidebarWidth,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        width: `calc(100% - ${sidebarWidth}px)`,
        transition: 'margin-left 0.2s cubic-bezier(0.16, 1, 0.3, 1), width 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>
        {/* Top Header */}
        <TopHeaderBar sidebarWidth={sidebarWidth} />

        {/* Routed Page Content */}
        <main style={{ marginTop: 56, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create" element={<CreateWorkflow />} />
            <Route path="/graph" element={<WorkflowGraph />} />
            <Route path="/ir" element={<IRInspector />} />
            <Route path="/verify" element={<VerificationCenter />} />
            <Route path="/attack" element={<AttackMode />} />
            <Route path="/repair" element={<AutoRepair />} />
            <Route path="/whatif" element={<WhatIfSimulator />} />
            <Route path="/stress" element={<StressTesting />} />
            <Route path="/3d" element={<DigitalTwin3D />} />
            <Route path="/execute" element={<SafeExecution />} />
            <Route path="/monitor" element={<LiveMonitoring />} />
            <Route path="/audit" element={<AuditTrail />} />
            <Route path="/history" element={<WorkflowHistory />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--fg-bg-2)',
              border: '1px solid var(--fg-border)',
              color: 'var(--fg-text-1)',
              borderRadius: 8,
              fontSize: 12.5,
            },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
