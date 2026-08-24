import React, { useCallback, useMemo } from 'react';
import {
  ReactFlow, Background, Controls, MiniMap, BackgroundVariant,
  Handle, Position,
  type Node, type Edge, type NodeTypes, useNodesState, useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { ShieldCheck, Zap, AlertTriangle, Play, CheckCircle2, User, Key, ArrowRight } from 'lucide-react';
import type { WorkflowIR, WorkflowNode, WorkflowEdge, NodeExecutionState } from '../types/workflow';
import { NODE_TYPE_CONFIG } from '../lib/utils';
import { useFlowGuardStore } from '../lib/store';

// ── Enterprise SOC Custom Node ────────────────────────────────────────────────

function CustomSOCNode({ data }: {
  data: {
    node: WorkflowNode;
    execState?: NodeExecutionState;
    isHighlighted?: boolean;
    highlightMode?: string;
    executionMode?: boolean;
    selected?: boolean;
  }
}) {
  const { node, execState, isHighlighted, highlightMode, executionMode, selected } = data;
  const config = NODE_TYPE_CONFIG[node.type] || NODE_TYPE_CONFIG.ACTION;

  let borderColor = 'var(--fg-border)';
  let glowStyle = {};
  let statusBadgeColor = config.borderColor;

  if (executionMode && execState) {
    if (execState === 'RUNNING') {
      borderColor = '#0EA5E9';
      glowStyle = { boxShadow: '0 0 20px rgba(14, 165, 233, 0.45)' };
    } else if (execState === 'COMPLETED') {
      borderColor = '#10B981';
      glowStyle = { boxShadow: '0 0 14px rgba(16, 185, 129, 0.35)' };
    } else if (execState === 'FAILED') {
      borderColor = '#EF4444';
      glowStyle = { boxShadow: '0 0 20px rgba(239, 68, 68, 0.45)' };
    } else if (execState === 'RETRYING') {
      borderColor = '#F59E0B';
      glowStyle = { boxShadow: '0 0 16px rgba(245, 158, 11, 0.40)' };
    }
  } else if (isHighlighted) {
    if (highlightMode === 'attack') {
      borderColor = '#F43F5E';
      glowStyle = { boxShadow: '0 0 24px rgba(244, 63, 94, 0.50)' };
    } else if (highlightMode === 'repair') {
      borderColor = '#10B981';
      glowStyle = { boxShadow: '0 0 24px rgba(16, 185, 129, 0.50)' };
    } else if (highlightMode === 'verified') {
      borderColor = '#38BDF8';
      glowStyle = { boxShadow: '0 0 20px rgba(56, 189, 248, 0.45)' };
    }
  } else if (selected) {
    borderColor = 'var(--fg-cyan-light)';
    glowStyle = { boxShadow: '0 0 18px rgba(14, 165, 233, 0.35)' };
  }

  return (
    <div
      className="soc-node"
      style={{
        borderColor,
        background: 'var(--fg-bg-2)',
        ...glowStyle,
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: config.borderColor, width: 8, height: 8, border: '2px solid var(--fg-bg-0)' }} />

      {/* Node Header */}
      <div className="soc-node-header" style={{ background: `${config.borderColor}10` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 13, color: config.color }}>{config.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: config.color, textTransform: 'uppercase' }}>
            {config.label}
          </span>
        </div>

        {node.is_critical && (
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            color: '#FB7185',
            background: 'rgba(244, 63, 94, 0.12)',
            padding: '1px 5px',
            borderRadius: 3,
            border: '1px solid rgba(244, 63, 94, 0.3)',
          }}>
            CRITICAL
          </span>
        )}
      </div>

      {/* Node Body */}
      <div className="soc-node-body">
        <div style={{
          fontSize: 12,
          fontWeight: 700,
          color: 'var(--fg-text-0)',
          lineHeight: 1.3,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {node.name}
        </div>

        {node.actor && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: 'var(--fg-text-2)', marginTop: 2 }}>
            <User size={10} color="var(--fg-text-3)" />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {node.actor}
            </span>
          </div>
        )}

        {node.required_permissions?.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
            <Key size={9} color="var(--fg-cyan)" />
            <span style={{ fontSize: 9.5, color: 'var(--fg-cyan-light)', fontFamily: 'monospace' }}>
              {node.required_permissions[0]}
            </span>
          </div>
        )}

        {/* Live Execution state indicator */}
        {execState && (
          <div style={{
            marginTop: 4,
            padding: '2px 6px',
            borderRadius: 4,
            background: execState === 'COMPLETED' ? 'rgba(16, 185, 129, 0.15)' : execState === 'RUNNING' ? 'rgba(14, 165, 233, 0.15)' : 'rgba(239, 68, 68, 0.15)',
            fontSize: 9.5,
            fontWeight: 700,
            color: execState === 'COMPLETED' ? '#34D399' : execState === 'RUNNING' ? '#38BDF8' : '#FB7185',
            textAlign: 'center',
            letterSpacing: '0.04em',
          }}>
            {execState}
          </div>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: config.borderColor, width: 8, height: 8, border: '2px solid var(--fg-bg-0)' }} />
    </div>
  );
}

const NODE_TYPES: NodeTypes = { custom: CustomSOCNode };

// ── Auto-Layout ───────────────────────────────────────────────────────────────

function layoutWorkflow(workflow: WorkflowIR): { nodes: Node[]; edges: Edge[] } {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();
  workflow.nodes.forEach((n) => { inDegree.set(n.id, 0); adjList.set(n.id, []); });
  workflow.edges.forEach((e) => {
    inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
    adjList.get(e.source)?.push(e.target);
  });

  const nodeLayer = new Map<string, number>();
  const queue = workflow.nodes.filter((n) => (inDegree.get(n.id) || 0) === 0).map((n) => n.id);
  const visited = new Set<string>();

  let layer = 0;
  let current = [...queue];
  while (current.length > 0) {
    current.forEach((id) => { nodeLayer.set(id, layer); visited.add(id); });
    const next: string[] = [];
    current.forEach((id) => {
      (adjList.get(id) || []).forEach((target) => {
        if (!visited.has(target)) {
          const newLayer = (nodeLayer.get(id) || 0) + 1;
          if ((nodeLayer.get(target) || 0) <= newLayer) {
            nodeLayer.set(target, newLayer);
          }
        }
      });
    });
    current = workflow.nodes
      .filter((n) => nodeLayer.get(n.id) === layer + 1 && !visited.has(n.id))
      .map((n) => n.id);
    layer++;
    if (layer > 40) break;
  }

  workflow.nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      nodeLayer.set(n.id, layer);
    }
  });

  const layerMap = new Map<number, string[]>();
  nodeLayer.forEach((l, id) => {
    if (!layerMap.has(l)) layerMap.set(l, []);
    layerMap.get(l)!.push(id);
  });

  const X_SPACING = 270;
  const Y_SPACING = 150;
  const positions = new Map<string, { x: number; y: number }>();

  layerMap.forEach((ids, layerIdx) => {
    const totalH = ids.length * Y_SPACING;
    const startY = -totalH / 2;
    ids.forEach((id, i) => {
      positions.set(id, { x: layerIdx * X_SPACING + 60, y: startY + i * Y_SPACING + 100 });
    });
  });

  const rfNodes: Node[] = workflow.nodes.map((n) => ({
    id: n.id,
    type: 'custom',
    position: positions.get(n.id) || { x: 0, y: 0 },
    data: { node: n },
  }));

  const EDGE_COLORS: Record<string, string> = {
    SEQUENTIAL: '#0EA5E9',
    CONDITIONAL: '#F59E0B',
    PARALLEL: '#8B5CF6',
    FALLBACK: '#F97316',
    ERROR: '#EF4444',
  };

  const rfEdges: Edge[] = workflow.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label || e.required_state || undefined,
    animated: e.transition_type === 'ERROR' || e.transition_type === 'FALLBACK',
    style: {
      stroke: EDGE_COLORS[e.transition_type] || '#0EA5E9',
      strokeWidth: e.is_critical ? 2.5 : 1.75,
      strokeDasharray: e.transition_type === 'ERROR' ? '5 3' : undefined,
    },
    labelStyle: { fill: '#94A3B8', fontSize: 10.5, fontWeight: 500, fontFamily: 'monospace' },
    labelBgStyle: { fill: '#080D1A', fillOpacity: 0.9 },
    markerEnd: { type: 'arrowclosed' as any, color: EDGE_COLORS[e.transition_type] || '#0EA5E9' },
  }));

  return { nodes: rfNodes, edges: rfEdges };
}

// ── Public Component ──────────────────────────────────────────────────────────

interface WorkflowGraphViewProps {
  workflow: WorkflowIR;
  executionMode?: boolean;
  style?: React.CSSProperties;
}

export default function WorkflowGraphView({ workflow, executionMode = false, style }: WorkflowGraphViewProps) {
  const { highlightedNodes, highlightedEdges, highlightMode, selectedNodeId, setSelectedNodeId, executionRun } = useFlowGuardStore();

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => layoutWorkflow(workflow), [workflow]);

  const enrichedNodes = useMemo(() => layoutNodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      execState: executionRun?.node_states?.[n.id],
      isHighlighted: highlightedNodes.has(n.id),
      highlightMode,
      executionMode,
      selected: n.id === selectedNodeId,
    },
  })), [layoutNodes, executionRun, highlightedNodes, highlightMode, selectedNodeId, executionMode]);

  const enrichedEdges = useMemo(() => layoutEdges.map((e) => {
    const isHigh = highlightedEdges.has(e.id);
    return {
      ...e,
      style: {
        ...e.style,
        ...(isHigh && highlightMode === 'attack' ? {
          stroke: '#F43F5E', strokeWidth: 3, strokeDasharray: '6 3',
        } : {}),
        ...(isHigh && highlightMode === 'repair' ? {
          stroke: '#10B981', strokeWidth: 3,
        } : {}),
      },
      animated: isHigh ? true : (e.animated || false),
    };
  }), [layoutEdges, highlightedEdges, highlightMode]);

  const [nodes] = useNodesState(enrichedNodes);
  const [edges] = useEdgesState(enrichedEdges);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id === selectedNodeId ? null : node.id);
  }, [selectedNodeId, setSelectedNodeId]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', ...style }}>
      <ReactFlow
        nodes={enrichedNodes}
        edges={enrichedEdges}
        nodeTypes={NODE_TYPES}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} color="rgba(255,255,255,0.06)" />
        <Controls />
        <MiniMap
          nodeColor={(n) => {
            const node = workflow.nodes.find((wn) => wn.id === n.id);
            return node ? (NODE_TYPE_CONFIG[node.type]?.borderColor || '#0EA5E9') : '#0EA5E9';
          }}
          maskColor="rgba(8, 13, 26, 0.75)"
        />
      </ReactFlow>
    </div>
  );
}
