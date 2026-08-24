import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Shield, ShieldCheck, ShieldAlert, Zap, Play, Activity,
  Layers, RotateCw, ZoomIn, ZoomOut, Maximize2, Sparkles,
  ArrowRight, AlertTriangle, XCircle, CheckCircle2, ChevronRight,
  Eye, RefreshCw, Cpu, Server, Database, Key, Check, Info,
  Compass, Flame, Sliders, ExternalLink, ArrowDown
} from 'lucide-react';
import { toast } from 'sonner';
import { useFlowGuardStore } from '../lib/store';
import { getScoreColor } from '../lib/utils';
import type { WorkflowNode, WorkflowEdge, NodeType } from '../types/workflow';

// ── Node Card Geometry Constants ──────────────────────────────────────────────
const CARD_WIDTH = 210;
const CARD_HEIGHT = 76;
const RANK_GAP_Y = 52;
const SIBLING_GAP_X = 40;

// ── Node Icon Resolver ────────────────────────────────────────────────────────
function getNodeIcon(type: NodeType) {
  switch (type) {
    case 'START': return <Compass size={14} color="#38BDF8" />;
    case 'VALIDATION': return <Key size={14} color="#A78BFA" />;
    case 'APPROVAL': return <ShieldCheck size={14} color="#FBBF24" />;
    case 'HUMAN_REVIEW': return <Eye size={14} color="#FBBF24" />;
    case 'ACTION': return <Cpu size={14} color="#34D399" />;
    case 'SERVICE': return <Server size={14} color="#0EA5E9" />;
    case 'CONDITION': return <Activity size={14} color="#F97316" />;
    case 'RECOVERY': return <RotateCw size={14} color="#F43F5E" />;
    case 'FAILURE': return <XCircle size={14} color="#FB7185" />;
    case 'END': return <CheckCircle2 size={14} color="#34D399" />;
    default: return <Box size={14} color="#94A3B8" />;
  }
}

type DemoState = 'HEALTHY' | 'VULNERABLE' | 'REPAIRED' | 'EXECUTING';

export default function DigitalTwin3D() {
  const navigate = useNavigate();
  const {
    currentWorkflow, verificationResult, attackResult, executionRun,
  } = useFlowGuardStore();

  // Mode Selection
  const [viewTab, setViewTab] = useState<'topology' | 'telemetry' | 'attack' | 'demo'>('topology');
  const [demoState, setDemoState] = useState<DemoState>('HEALTHY');

  // Camera & Spatial State
  const [is3DMode, setIs3DMode] = useState<boolean>(true);
  const [isOrbiting, setIsOrbiting] = useState<boolean>(false);
  const [zoom, setZoom] = useState<number>(0.95);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const dragStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Node Selection & Focus
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Live Telemetry Simulation Tick
  const [telemetryTick, setTelemetryTick] = useState<number>(0);
  useEffect(() => {
    if (viewTab !== 'telemetry') return;
    const intv = setInterval(() => setTelemetryTick(t => t + 1), 1200);
    return () => clearInterval(intv);
  }, [viewTab]);

  // Demo Execution Step Simulation
  const [execStep, setExecStep] = useState<number>(0);
  useEffect(() => {
    if (viewTab === 'demo' && demoState === 'EXECUTING') {
      const timer = setInterval(() => {
        setExecStep(s => (s + 1) % (currentWorkflow ? currentWorkflow.nodes.length + 1 : 6));
      }, 1400);
      return () => clearInterval(timer);
    } else {
      setExecStep(0);
    }
  }, [viewTab, demoState, currentWorkflow]);

  // ── Unified Topological Layout Calculation (Single Source of Truth) ─────────
  const { positionedNodes, nodeMap, validEdges, bounds } = useMemo(() => {
    if (!currentWorkflow || currentWorkflow.nodes.length === 0) {
      return { positionedNodes: [], nodeMap: new Map(), validEdges: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0, width: 0, height: 0 } };
    }

    const nodes = currentWorkflow.nodes;
    const rawEdges = currentWorkflow.edges;
    const rawNodeMap = new Map<string, WorkflowNode>();
    nodes.forEach(n => rawNodeMap.set(n.id, n));

    // 1. Filter valid edges (Integrity check)
    const validEdgesList: WorkflowEdge[] = [];
    rawEdges.forEach(e => {
      if (rawNodeMap.has(e.source) && rawNodeMap.has(e.target)) {
        validEdgesList.push(e);
      } else {
        console.warn(`[FlowGuard Topology Error] Disconnected edge removed: ${e.source} -> ${e.target}`);
      }
    });

    // 2. Build adjacency & in-degrees
    const inDegree: Record<string, number> = {};
    const adj: Record<string, string[]> = {};
    nodes.forEach(n => {
      inDegree[n.id] = 0;
      adj[n.id] = [];
    });
    validEdgesList.forEach(e => {
      inDegree[e.target] = (inDegree[e.target] || 0) + 1;
      adj[e.source].push(e.target);
    });

    // 3. Compute topological ranks (Longest Path in DAG)
    const ranks: Record<string, number> = {};
    const roots = nodes.filter(n => (inDegree[n.id] || 0) === 0);
    if (roots.length === 0 && nodes.length > 0) {
      roots.push(nodes[0]);
    }

    const queue: string[] = roots.map(r => r.id);
    roots.forEach(r => { ranks[r.id] = 0; });

    let visitedCount = 0;
    while (queue.length > 0 && visitedCount < nodes.length * 4) {
      visitedCount++;
      const u = queue.shift()!;
      const currentRank = ranks[u] || 0;
      const neighbors = adj[u] || [];
      for (const v of neighbors) {
        const nextRank = currentRank + 1;
        if (ranks[v] === undefined || nextRank > ranks[v]) {
          ranks[v] = nextRank;
          queue.push(v);
        }
      }
    }

    // Fallback for unvisited/disconnected nodes
    nodes.forEach((n, idx) => {
      if (ranks[n.id] === undefined) {
        ranks[n.id] = idx;
      }
    });

    // 4. Group nodes into rank layers
    const maxRank = Math.max(...Object.values(ranks), 0);
    const layers: WorkflowNode[][] = Array.from({ length: maxRank + 1 }, () => []);
    nodes.forEach(n => {
      const r = ranks[n.id] || 0;
      layers[r].push(n);
    });

    // 5. Calculate (x, y, z) coordinates in a 1400x900 world canvas
    const CANVAS_CX = 700;
    const CANVAS_CY = 450;
    const totalHeight = layers.length * CARD_HEIGHT + Math.max(0, layers.length - 1) * RANK_GAP_Y;
    const startY = CANVAS_CY - totalHeight / 2 + CARD_HEIGHT / 2;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const finalNodes: (WorkflowNode & { x: number; y: number; z: number; rank: number })[] = [];
    const resultMap = new Map<string, typeof finalNodes[0]>();

    layers.forEach((layerNodes, rIdx) => {
      const rowY = startY + rIdx * (CARD_HEIGHT + RANK_GAP_Y);
      const totalRowWidth = layerNodes.length * CARD_WIDTH + Math.max(0, layerNodes.length - 1) * SIBLING_GAP_X;
      const startX = CANVAS_CX - totalRowWidth / 2 + CARD_WIDTH / 2;

      // Z-depth stepping for subtle 3D parallax
      const z = (rIdx - layers.length / 2) * -12;

      layerNodes.forEach((node, colIdx) => {
        const x = startX + colIdx * (CARD_WIDTH + SIBLING_GAP_X);
        const y = rowY;

        minX = Math.min(minX, x - CARD_WIDTH / 2);
        maxX = Math.max(maxX, x + CARD_WIDTH / 2);
        minY = Math.min(minY, y - CARD_HEIGHT / 2);
        maxY = Math.max(maxY, y + CARD_HEIGHT / 2);

        const positioned = { ...node, x, y, z, rank: rIdx };
        finalNodes.push(positioned);
        resultMap.set(node.id, positioned);
      });
    });

    return {
      positionedNodes: finalNodes,
      nodeMap: resultMap,
      validEdges: validEdgesList,
      bounds: { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY },
    };
  }, [currentWorkflow]);

  // ── Auto-Fit Camera to Graph ────────────────────────────────────────────────
  const resetCamera = useCallback(() => {
    if (!bounds || bounds.width === 0) {
      setZoom(0.95);
      setPanOffset({ x: 0, y: 0 });
      return;
    }
    // Calculate required zoom to fit comfortably in viewport
    const vpW = window.innerWidth - 300;
    const vpH = window.innerHeight - 180;
    const scaleX = vpW / (bounds.width + 160);
    const scaleY = vpH / (bounds.height + 160);
    const autoZoom = Math.min(1.15, Math.max(0.65, Math.min(scaleX, scaleY)));

    setZoom(autoZoom);
    setPanOffset({ x: 0, y: 0 });
    setSelectedNodeId(null);
    setIsOrbiting(false);
  }, [bounds]);

  useEffect(() => {
    resetCamera();
  }, [currentWorkflow?.id, resetCamera]);

  if (!currentWorkflow) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 'calc(100vh - 120px)', gap: 16 }}>
        <div style={{
          width: 56, height: 56, borderRadius: 12,
          background: 'rgba(14, 165, 233, 0.1)', border: '1px solid var(--fg-cyan-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Box size={24} color="var(--fg-cyan-light)" />
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--fg-text-0)' }}>No Active Workflow Loaded</div>
        <div style={{ fontSize: 13, color: 'var(--fg-text-2)' }}>Compile a policy or select a preset to launch the 3D Security Digital Twin.</div>
        <button className="btn-soc-primary" onClick={() => navigate('/')}>
          <span>Compile Policy First</span>
        </button>
      </div>
    );
  }

  // ── Node Security State Evaluator ───────────────────────────────────────────
  const getNodeSecurityState = (nodeId: string) => {
    const node = currentWorkflow.nodes.find(n => n.id === nodeId);
    if (!node) return { status: 'SAFE', color: '#10B981', label: 'VERIFIED', isVulnerable: false };

    // In Interactive Demo mode
    if (viewTab === 'demo') {
      if (demoState === 'VULNERABLE') {
        if (node.type === 'APPROVAL' || node.name.toLowerCase().includes('approval')) {
          return { status: 'CRITICAL', color: '#FB7185', label: 'BYPASS EXPLOIT', isVulnerable: true };
        }
        if (node.name.toLowerCase().includes('ticket') || node.name.toLowerCase().includes('payment') || node.name.toLowerCase().includes('tier')) {
          return { status: 'WARNING', color: '#FBBF24', label: 'UNGUARDED', isVulnerable: true };
        }
      }
      if (demoState === 'EXECUTING') {
        const nodeIdx = currentWorkflow.nodes.findIndex(n => n.id === nodeId);
        if (nodeIdx === execStep) return { status: 'RUNNING', color: '#0EA5E9', label: 'EXECUTING', isVulnerable: false };
        if (nodeIdx < execStep) return { status: 'SAFE', color: '#10B981', label: 'COMPLETED', isVulnerable: false };
        return { status: 'PENDING', color: '#64748B', label: 'QUEUED', isVulnerable: false };
      }
      if (demoState === 'REPAIRED') {
        return { status: 'SAFE', color: '#10B981', label: 'VERIFIED', isVulnerable: false };
      }
    }

    // In Attack Vector Mode
    if (viewTab === 'attack' && attackResult) {
      const isBreached = attackResult.findings.some(f => f.affected_nodes.includes(nodeId));
      if (isBreached) {
        return { status: 'CRITICAL', color: '#FB7185', label: 'EXPLOIT TARGET', isVulnerable: true };
      }
    }

    // In Runtime Execution Mode
    if (executionRun) {
      const state = executionRun.node_states[nodeId];
      if (state === 'COMPLETED') return { status: 'SAFE', color: '#10B981', label: 'COMPLETED', isVulnerable: false };
      if (state === 'RUNNING') return { status: 'RUNNING', color: '#0EA5E9', label: 'RUNNING', isVulnerable: false };
      if (state === 'FAILED') return { status: 'CRITICAL', color: '#FB7185', label: 'FAILED', isVulnerable: true };
    }

    // In Verification State
    const hasIssue = verificationResult?.issues?.some(i => i.affected_nodes?.includes(nodeId));
    if (hasIssue || node.risk_level === 'CRITICAL') {
      return { status: 'CRITICAL', color: '#FB7185', label: 'CRITICAL RISK', isVulnerable: true };
    }
    const hasWarning = verificationResult?.warnings?.some(w => w.affected_nodes?.includes(nodeId));
    if (hasWarning || node.risk_level === 'HIGH') {
      return { status: 'WARNING', color: '#FBBF24', label: 'WARNING', isVulnerable: false };
    }

    return { status: 'SAFE', color: '#10B981', label: 'VERIFIED', isVulnerable: false };
  };

  // Connected nodes map for hover/focus isolation
  const { connectedNodeIds, connectedEdgeIds } = useMemo(() => {
    const activeId = selectedNodeId || hoveredNodeId;
    if (!activeId) return { connectedNodeIds: new Set<string>(), connectedEdgeIds: new Set<string>() };

    const nodes = new Set<string>([activeId]);
    const edges = new Set<string>();

    validEdges.forEach(e => {
      if (e.source === activeId || e.target === activeId) {
        nodes.add(e.source);
        nodes.add(e.target);
        edges.add(e.id);
      }
    });

    return { connectedNodeIds: nodes, connectedEdgeIds: edges };
  }, [selectedNodeId, hoveredNodeId, validEdges]);

  // Selected Node Details
  const selectedNodeData = selectedNodeId ? currentWorkflow.nodes.find(n => n.id === selectedNodeId) : null;

  // ── Pan and Drag Handlers ───────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.soc-node-card') || (e.target as HTMLElement).closest('.interactive-control')) return;
    setIsDragging(true);
    dragStart.current = { x: e.clientX - panOffset.x, y: e.clientY - panOffset.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPanOffset({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const focusNode = (nodeId: string) => {
    setSelectedNodeId(nodeId);
    const coord = nodeMap.get(nodeId);
    if (coord) {
      setPanOffset({ x: (700 - coord.x) * zoom, y: (450 - coord.y) * zoom });
      setZoom(1.15);
    }
  };

  // ── Calculated Security Score ───────────────────────────────────────────────
  const activeSecurityScore = useMemo(() => {
    if (viewTab === 'demo') {
      if (demoState === 'VULNERABLE') return 42;
      if (demoState === 'REPAIRED') return 98;
      if (demoState === 'EXECUTING') return 100;
    }
    return verificationResult ? verificationResult.score : 85;
  }, [viewTab, demoState, verificationResult]);

  return (
    <div
      style={{
        height: 'calc(100vh - 56px)',
        position: 'relative',
        overflow: 'hidden',
        background: '#040711',
        userSelect: 'none',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
    >
      <style>{`
        @keyframes dash-attack {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }
        @keyframes pulse-critical {
          0%, 100% { box-shadow: 0 0 16px rgba(244, 63, 94, 0.4), inset 0 0 8px rgba(244, 63, 94, 0.2); }
          50% { box-shadow: 0 0 28px rgba(244, 63, 94, 0.75), inset 0 0 14px rgba(244, 63, 94, 0.35); }
        }
        @keyframes pulse-running {
          0%, 100% { border-color: rgba(14, 165, 233, 0.5); }
          50% { border-color: rgba(14, 165, 233, 1.0); box-shadow: 0 0 20px rgba(14, 165, 233, 0.5); }
        }
        @keyframes orbit-slow {
          0% { transform: rotateX(20deg) rotateY(0deg); }
          50% { transform: rotateX(20deg) rotateY(180deg); }
          100% { transform: rotateX(20deg) rotateY(360deg); }
        }
      `}</style>

      {/* ── Background Grid Matrix ──────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(14, 165, 233, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(14, 165, 233, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px',
          pointerEvents: 'none',
        }}
      />

      {/* ── Top-Left: Workflow Security Health Overlay ───────────────────────── */}
      <div
        className="interactive-control soc-glass"
        style={{
          position: 'absolute',
          top: 20,
          left: 24,
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(99, 102, 241, 0.2))',
            border: '1px solid rgba(14, 165, 233, 0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Box size={18} color="var(--fg-cyan-light)" />
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--fg-text-0)', letterSpacing: '0.02em' }}>
              {currentWorkflow.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--fg-text-3)', fontFamily: 'monospace' }}>
              3D SECURITY DIGITAL TWIN · IR v{currentWorkflow.version}
            </div>
          </div>
        </div>

        <div style={{ height: 28, width: 1, background: 'var(--fg-border)' }} />

        {/* Live Safety Metric */}
        <div>
          <div style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fg-text-3)', textTransform: 'uppercase' }}>SECURITY SCORE</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: getScoreColor(activeSecurityScore), fontFamily: 'monospace' }}>
              {activeSecurityScore.toFixed(0)}
            </span>
            <span style={{ fontSize: 10, color: 'var(--fg-text-3)' }}>/ 100</span>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              color: activeSecurityScore >= 80 ? '#34D399' : (activeSecurityScore >= 60 ? '#FBBF24' : '#FB7185'),
              padding: '1px 6px',
              borderRadius: 4,
              background: 'var(--fg-bg-2)',
            }}>
              {activeSecurityScore >= 80 ? 'SAFE' : (activeSecurityScore >= 60 ? 'WARNING' : 'CRITICAL')}
            </span>
          </div>
        </div>

        <div style={{ height: 28, width: 1, background: 'var(--fg-border)' }} />

        {/* Node & Dependency Counts */}
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: 'var(--fg-text-2)' }}>
          <div>
            <span style={{ color: 'var(--fg-text-0)', fontWeight: 700, fontFamily: 'monospace' }}>{positionedNodes.length}</span> Nodes
          </div>
          <div>
            <span style={{ color: 'var(--fg-text-0)', fontWeight: 700, fontFamily: 'monospace' }}>{validEdges.length}</span> Connected Edges
          </div>
        </div>
      </div>

      {/* ── Top-Center: Operation Mode Tabs ─────────────────────────────────── */}
      <div
        className="interactive-control soc-glass"
        style={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: 4,
          display: 'flex',
          gap: 4,
          zIndex: 20,
        }}
      >
        {[
          { key: 'topology', label: 'Topology Twin', icon: Layers },
          { key: 'telemetry', label: 'Live Telemetry', icon: Activity },
          { key: 'attack', label: 'Attack Vector Sync', icon: Zap },
          { key: 'demo', label: 'Interactive Demo', icon: Sparkles },
        ].map((tab) => {
          const isAct = viewTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setViewTab(tab.key as any);
                if (tab.key === 'demo') setDemoState('VULNERABLE');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                border: 'none',
                background: isAct ? 'rgba(14, 165, 233, 0.22)' : 'transparent',
                color: isAct ? 'var(--fg-cyan-light)' : 'var(--fg-text-2)',
                fontSize: 11.5,
                fontWeight: isAct ? 700 : 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={13} color={isAct ? 'var(--fg-cyan-light)' : 'var(--fg-text-3)'} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ── Interactive Demo Controller (When Demo Tab is active) ─────────────── */}
      {viewTab === 'demo' && (
        <div
          className="interactive-control soc-glass"
          style={{
            position: 'absolute',
            top: 76,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            zIndex: 20,
            border: '1px solid rgba(14, 165, 233, 0.4)',
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-cyan-light)', textTransform: 'uppercase' }}>
            DEMO SCENARIOS:
          </span>
          {[
            { state: 'HEALTHY', label: '1. Baseline Verified', desc: 'All nodes clean' },
            { state: 'VULNERABLE', label: '2. Bypass Exploit', desc: 'Critical flaw introduced' },
            { state: 'REPAIRED', label: '3. Auto-Repaired', desc: 'Topology rewiring' },
            { state: 'EXECUTING', label: '4. Safe Execution Flow', desc: 'Deterministic runtime' },
          ].map((sc) => (
            <button
              key={sc.state}
              onClick={() => {
                setDemoState(sc.state as DemoState);
                toast.info(`Demonstration State: ${sc.label}`);
              }}
              style={{
                padding: '4px 10px',
                borderRadius: 5,
                border: demoState === sc.state ? '1px solid var(--fg-cyan-light)' : '1px solid var(--fg-border)',
                background: demoState === sc.state ? 'rgba(14, 165, 233, 0.25)' : 'var(--fg-bg-1)',
                color: demoState === sc.state ? 'var(--fg-text-0)' : 'var(--fg-text-2)',
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {sc.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Simulated Telemetry Banner (When Telemetry Tab is active) ─────────── */}
      {viewTab === 'telemetry' && (
        <div
          className="interactive-control soc-glass"
          style={{
            position: 'absolute',
            top: 76,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '4px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 20,
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.3)',
          }}
        >
          <Activity size={12} color="#FBBF24" />
          <span style={{ fontSize: 10.5, fontWeight: 700, color: '#FBBF24', letterSpacing: '0.04em' }}>
            SIMULATED TELEMETRY STREAM · LATENCY & LOAD BENCHMARKS
          </span>
        </div>
      )}

      {/* ── 3D Viewport Matrix Canvas (Unified Single Coordinate Space) ──────── */}
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          perspective: 1300,
          perspectiveOrigin: '50% 50%',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: 1400,
            height: 900,
            transformStyle: 'preserve-3d',
            transform: `
              translate(${panOffset.x}px, ${panOffset.y}px)
              scale(${zoom})
              ${is3DMode ? 'rotateX(18deg) rotateY(-8deg) rotateZ(0.5deg)' : 'rotateX(0deg) rotateY(0deg)'}
            `,
            transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            animation: isOrbiting ? 'orbit-slow 30s linear infinite' : undefined,
          }}
        >
          {/* ── 1. SVG Edges Layer (Physically connects node card boundaries) ── */}
          <svg
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: 1400,
              height: 900,
              overflow: 'visible',
              pointerEvents: 'none',
              zIndex: 5,
            }}
          >
            <defs>
              <linearGradient id="edge-grad-normal" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#0EA5E9" stopOpacity="0.8" />
                <stop offset="100%" stopColor="#6366F1" stopOpacity="0.9" />
              </linearGradient>
              <linearGradient id="edge-grad-attack" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FB7185" stopOpacity="1" />
                <stop offset="100%" stopColor="#F43F5E" stopOpacity="1" />
              </linearGradient>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#0EA5E9" />
              </marker>
              <marker id="arrowhead-attack" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="#FB7185" />
              </marker>
            </defs>

            {validEdges.map(edge => {
              const src = nodeMap.get(edge.source);
              const tgt = nodeMap.get(edge.target);
              if (!src || !tgt) return null;

              // Compute precise boundary anchors
              const isVertical = tgt.y > src.y + 20;
              let sx: number, sy: number, tx: number, ty: number, pathD: string;

              if (isVertical) {
                // Connect Bottom Anchor of source -> Top Anchor of target
                sx = src.x;
                sy = src.y + CARD_HEIGHT / 2;
                tx = tgt.x;
                ty = tgt.y - CARD_HEIGHT / 2;

                const dy = ty - sy;
                if (Math.abs(tx - sx) < 4) {
                  // Clean straight vertical line
                  pathD = `M ${sx} ${sy} L ${tx} ${ty}`;
                } else {
                  // Smooth vertical Bezier elbow
                  const c1y = sy + dy * 0.5;
                  const c2y = ty - dy * 0.5;
                  pathD = `M ${sx} ${sy} C ${sx} ${c1y}, ${tx} ${c2y}, ${tx} ${ty}`;
                }
              } else {
                // Connect Right Anchor of source -> Left Anchor of target
                sx = src.x + CARD_WIDTH / 2;
                sy = src.y;
                tx = tgt.x - CARD_WIDTH / 2;
                ty = tgt.y;

                const dx = tx - sx;
                const c1x = sx + dx * 0.5;
                const c2x = tx - dx * 0.5;
                pathD = `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`;
              }

              const isConnected = (selectedNodeId || hoveredNodeId)
                ? connectedEdgeIds.has(edge.id)
                : true;
              const isDimmed = (selectedNodeId || hoveredNodeId) && !isConnected;

              // Check attack vector match
              const isAttackPath = (viewTab === 'attack' && edge.is_critical) ||
                (viewTab === 'demo' && demoState === 'VULNERABLE' && (edge.source.includes('approval') || edge.target.includes('ticket') || edge.target.includes('tier') || edge.target.includes('payment')));

              return (
                <g key={edge.id} opacity={isDimmed ? 0.15 : 1} style={{ transition: 'opacity 0.2s ease' }}>
                  {/* Subtle Background Glow Track */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke="#040711"
                    strokeWidth={6}
                  />

                  {/* Main Directed Line */}
                  <path
                    d={pathD}
                    fill="none"
                    stroke={isAttackPath ? 'url(#edge-grad-attack)' : 'url(#edge-grad-normal)'}
                    strokeWidth={isAttackPath ? 2.5 : 2}
                    strokeDasharray={isAttackPath ? '6 4' : (edge.transition_type === 'CONDITIONAL' ? '5 3' : undefined)}
                    markerEnd={isAttackPath ? 'url(#arrowhead-attack)' : 'url(#arrowhead)'}
                    style={{
                      animation: isAttackPath ? 'dash-attack 1s linear infinite' : undefined,
                    }}
                  />

                  {/* Flowing Execution / Data Particle */}
                  {!isDimmed && (
                    <circle r={isAttackPath ? 3.5 : 2.5} fill={isAttackPath ? '#FB7185' : '#38BDF8'}>
                      <animateMotion
                        path={pathD}
                        dur={isAttackPath ? '1.2s' : '2.4s'}
                        repeatCount="indefinite"
                      />
                    </circle>
                  )}

                  {/* Edge Label (if defined) */}
                  {edge.label && (
                    <text
                      x={(sx + tx) / 2 + 8}
                      y={(sy + ty) / 2}
                      fill="var(--fg-text-3)"
                      fontSize={9}
                      fontFamily="'JetBrains Mono', monospace"
                      textAnchor="start"
                      style={{ userSelect: 'none' }}
                    >
                      {edge.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* ── 2. Component Node Cards (Unified positioning with SVG anchors) ─ */}
          {positionedNodes.map((node) => {
            const sec = getNodeSecurityState(node.id);
            const isSelected = selectedNodeId === node.id;
            const isHovered = hoveredNodeId === node.id;
            const isConnected = (selectedNodeId || hoveredNodeId)
              ? connectedNodeIds.has(node.id)
              : true;
            const isDimmed = (selectedNodeId || hoveredNodeId) && !isConnected;

            // Simulated Telemetry Data
            const latencyMs = 65 + (node.id.charCodeAt(0) * 7 + telemetryTick * 13) % 150;
            const cpuPct = 10 + (node.id.charCodeAt(1) * 3 + telemetryTick * 5) % 40;

            return (
              <div
                key={node.id}
                className="soc-node-card"
                onClick={() => focusNode(node.id)}
                onMouseEnter={() => setHoveredNodeId(node.id)}
                onMouseLeave={() => setHoveredNodeId(null)}
                style={{
                  position: 'absolute',
                  left: node.x,
                  top: node.y,
                  width: CARD_WIDTH,
                  height: CARD_HEIGHT,
                  transform: `
                    translate(-50%, -50%)
                    translateZ(${node.z}px)
                    scale(${isSelected ? 1.06 : (isHovered ? 1.03 : 1)})
                  `,
                  background: 'rgba(8, 13, 26, 0.95)',
                  backdropFilter: 'blur(10px)',
                  border: `1.5px solid ${isSelected ? 'var(--fg-cyan-light)' : (sec.status === 'CRITICAL' ? '#FB7185' : (sec.status === 'RUNNING' ? '#0EA5E9' : 'rgba(14, 165, 233, 0.28)'))}`,
                  borderRadius: 8,
                  padding: '8px 12px',
                  boxShadow: isSelected
                    ? '0 0 28px rgba(14, 165, 233, 0.4), inset 0 0 8px rgba(14, 165, 233, 0.2)'
                    : (sec.status === 'CRITICAL' ? '0 0 20px rgba(244, 63, 94, 0.35)' : '0 6px 20px rgba(0, 0, 0, 0.45)'),
                  cursor: 'pointer',
                  opacity: isDimmed ? 0.2 : 1,
                  transition: 'transform 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                  animation: sec.status === 'CRITICAL' ? 'pulse-critical 2s infinite' : (sec.status === 'RUNNING' ? 'pulse-running 1.5s infinite' : undefined),
                  zIndex: isSelected ? 30 : (isHovered ? 25 : 10),
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                }}
              >
                {/* Top Node Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: 'var(--fg-bg-1)',
                      border: '1px solid var(--fg-border)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {getNodeIcon(node.type)}
                    </div>
                    <span style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--fg-text-3)', letterSpacing: '0.04em' }}>
                      {node.type}
                    </span>
                  </div>

                  {/* Status Pill */}
                  <span style={{
                    fontSize: 8.5,
                    fontWeight: 800,
                    color: sec.color,
                    background: `${sec.color}18`,
                    border: `1px solid ${sec.color}40`,
                    padding: '1px 5px',
                    borderRadius: 4,
                    fontFamily: 'monospace',
                  }}>
                    {sec.label}
                  </span>
                </div>

                {/* Node Name */}
                <div style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: 'var(--fg-text-0)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {node.name}
                </div>

                {/* Bottom Actor / Telemetry info */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 9.5, color: 'var(--fg-text-3)' }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 100 }}>
                    {node.actor || 'System'}
                  </span>
                  {viewTab === 'telemetry' ? (
                    <span style={{ fontFamily: 'monospace', color: latencyMs > 160 ? '#FBBF24' : '#34D399' }}>
                      {latencyMs}ms · {cpuPct}%
                    </span>
                  ) : (
                    <span style={{ fontFamily: 'monospace', color: 'var(--fg-cyan-light)' }}>
                      {node.failure_policy}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Slide-Over Node Details Drawer (When Node is Selected) ───────────── */}
      {selectedNodeData && (
        <div
          className="interactive-control soc-card-elevated"
          style={{
            position: 'absolute',
            top: 20,
            right: 24,
            width: 320,
            maxHeight: 'calc(100vh - 96px)',
            overflowY: 'auto',
            padding: 20,
            zIndex: 30,
            border: '1px solid var(--fg-border-active)',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: getNodeSecurityState(selectedNodeData.id).color }} />
              <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--fg-cyan-light)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                COMPONENT INSPECTOR
              </span>
            </div>
            <button
              onClick={() => setSelectedNodeId(null)}
              style={{ background: 'transparent', border: 'none', color: 'var(--fg-text-3)', cursor: 'pointer', fontSize: 14 }}
            >
              ✕
            </button>
          </div>

          <h3 style={{ fontSize: 15, fontWeight: 800, color: 'var(--fg-text-0)', margin: '0 0 8px' }}>
            {selectedNodeData.name}
          </h3>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <div style={{ padding: '8px 10px', background: 'var(--fg-bg-1)', borderRadius: 6, border: '1px solid var(--fg-border)' }}>
              <div style={{ fontSize: 9.5, color: 'var(--fg-text-3)' }}>TYPE</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--fg-text-1)' }}>{selectedNodeData.type}</div>
            </div>
            <div style={{ padding: '8px 10px', background: 'var(--fg-bg-1)', borderRadius: 6, border: '1px solid var(--fg-border)' }}>
              <div style={{ fontSize: 9.5, color: 'var(--fg-text-3)' }}>RISK LEVEL</div>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: selectedNodeData.risk_level === 'CRITICAL' ? '#FB7185' : '#34D399' }}>
                {selectedNodeData.risk_level}
              </div>
            </div>
          </div>

          {/* Actor & Permissions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11.5, color: 'var(--fg-text-2)', marginBottom: 14 }}>
            <div><strong>Designated Actor:</strong> <span style={{ color: 'var(--fg-text-0)' }}>{selectedNodeData.actor || 'None (System)'}</span></div>
            <div><strong>Failure Policy:</strong> <span style={{ color: 'var(--fg-cyan-light)', fontFamily: 'monospace' }}>{selectedNodeData.failure_policy}</span></div>
            <div><strong>Preconditions:</strong> <span style={{ color: 'var(--fg-amber)', fontFamily: 'monospace' }}>{selectedNodeData.preconditions?.join(', ') || 'None'}</span></div>
            <div><strong>Outputs:</strong> <span style={{ color: '#34D399', fontFamily: 'monospace' }}>{selectedNodeData.outputs?.join(', ') || 'None'}</span></div>
          </div>

          {/* Quick Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 10, borderTop: '1px solid var(--fg-border)' }}>
            <button
              className="btn-soc-primary"
              onClick={() => navigate('/verify')}
              style={{ width: '100%', fontSize: 11.5, padding: '7px 12px' }}
            >
              <span>Verify in Engine</span>
              <ShieldCheck size={13} />
            </button>
            <button
              className="btn-soc-secondary"
              onClick={() => navigate('/attack')}
              style={{ width: '100%', fontSize: 11.5, padding: '7px 12px' }}
            >
              <span>Test in Attack Lab</span>
              <Zap size={13} />
            </button>
          </div>
        </div>
      )}

      {/* ── Bottom-Left: Compact Security Legend ─────────────────────────────── */}
      <div
        className="interactive-control soc-glass"
        style={{
          position: 'absolute',
          bottom: 20,
          left: 24,
          padding: '8px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          zIndex: 20,
          fontSize: 11,
          color: 'var(--fg-text-2)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#10B981' }} />
          <span>Safe / Verified</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FBBF24' }} />
          <span>Warning / Unguarded</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#FB7185' }} />
          <span>Critical Risk</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#0EA5E9' }} />
          <span>Active Flow</span>
        </div>
      </div>

      {/* ── Bottom-Right: Camera & Spatial Viewport Controls ─────────────────── */}
      <div
        className="interactive-control soc-glass"
        style={{
          position: 'absolute',
          bottom: 20,
          right: 24,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          zIndex: 20,
        }}
      >
        <button
          className="btn-soc-ghost"
          onClick={() => setZoom(z => Math.min(1.8, z + 0.12))}
          title="Zoom In"
          style={{ padding: '5px 8px' }}
        >
          <ZoomIn size={14} />
        </button>
        <button
          className="btn-soc-ghost"
          onClick={() => setZoom(z => Math.max(0.4, z - 0.12))}
          title="Zoom Out"
          style={{ padding: '5px 8px' }}
        >
          <ZoomOut size={14} />
        </button>
        <button
          className="btn-soc-ghost"
          onClick={resetCamera}
          title="Fit Topology to Viewport"
          style={{ padding: '5px 8px' }}
        >
          <Maximize2 size={13} />
        </button>

        <div style={{ height: 16, width: 1, background: 'var(--fg-border)' }} />

        {/* 3D vs 2.5D Isometric Mode */}
        <button
          className="btn-soc-ghost"
          onClick={() => setIs3DMode(m => !m)}
          style={{ padding: '5px 10px', fontSize: 11, color: is3DMode ? 'var(--fg-cyan-light)' : 'var(--fg-text-3)' }}
        >
          <span>{is3DMode ? '3D Isometric' : '2D Planar'}</span>
        </button>

        {/* Continuous Orbit Toggle */}
        <button
          className="btn-soc-ghost"
          onClick={() => setIsOrbiting(o => !o)}
          style={{ padding: '5px 10px', fontSize: 11, color: isOrbiting ? 'var(--fg-cyan-light)' : 'var(--fg-text-3)' }}
        >
          <RotateCw size={12} className={isOrbiting ? 'animate-spin' : ''} />
          <span>{isOrbiting ? 'Orbit Active' : 'Orbit'}</span>
        </button>
      </div>

    </div>
  );
}
