/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Plus,
  Play,
  Pause,
  RefreshCw,
  Trash2,
  Download,
  SkipBack,
  SkipForward,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { AdaptiveGraph } from '../engine/AdaptiveGraph';
import { GraphGenerators } from '../engine/generators';
import { REP_STYLES } from './repStyles';

interface GraphCanvasProps {
  graph: AdaptiveGraph;
  visitedNodes?: Set<number>;
  visitedEdges?: { u: number; v: number }[];
  currentAlgorithm?: string | null;
  traversalOrder?: number[];
  onClearAlgorithm?: () => void;
  compactHeader?: boolean;
}

type PresetKey = 'small_world' | 'scale_free' | 'dense' | 'grid';

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  graph,
  visitedNodes = new Set(),
  visitedEdges = [],
  currentAlgorithm = null,
  traversalOrder = [],
  onClearAlgorithm,
  compactHeader = false,
}) => {
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [hoveredNode, setHoveredNode] = useState<number | null>(null);
  const [activePreset, setActivePreset] = useState<PresetKey>('small_world');
  const [isStreaming, setIsStreaming] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [, setDragTick] = useState(0);

  const [stepIndex, setStepIndex] = useState<number>(-1);
  const [isPlayingSteps, setIsPlayingSteps] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const draggingNodeRef = useRef<number | null>(null);
  const isDragMoveRef = useRef<boolean>(false);

  const nodes = graph.getNodes();
  const edges = graph.getEdges();
  const stats = graph.getStats();
  const repStyle = REP_STYLES[stats.activeRepresentation];

  useEffect(() => {
    if (traversalOrder.length > 0) {
      setStepIndex(traversalOrder.length - 1);
      setIsPlayingSteps(false);
    } else {
      setStepIndex(-1);
      setIsPlayingSteps(false);
    }
  }, [traversalOrder]);

  useEffect(() => {
    if (!isPlayingSteps || traversalOrder.length === 0) return;
    const timer = setInterval(() => {
      setStepIndex(prev => {
        if (prev >= traversalOrder.length - 1) {
          setIsPlayingSteps(false);
          return prev;
        }
        return prev + 1;
      });
    }, 450);
    return () => clearInterval(timer);
  }, [isPlayingSteps, traversalOrder.length]);

  useEffect(() => {
    if (!isStreaming) return;
    const timer = setInterval(() => {
      const currentNodes = graph.getNodes();
      if (currentNodes.length < 2) return;
      const a = currentNodes[Math.floor(Math.random() * currentNodes.length)].id;
      const b = currentNodes[Math.floor(Math.random() * currentNodes.length)].id;
      if (a === b) return;
      if (Math.random() < 0.72) {
        graph.addEdge(a, b, Math.round((Math.random() * 8 + 1) * 10) / 10);
      } else {
        const currentEdges = graph.getEdges();
        if (currentEdges.length > 4) {
          const edge = currentEdges[Math.floor(Math.random() * currentEdges.length)];
          graph.removeEdge(edge.u, edge.v);
        }
      }
    }, 320);
    return () => clearInterval(timer);
  }, [isStreaming, graph]);

  const showToast = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 2400);
  };

  const handlePreset = (preset: PresetKey) => {
    setIsStreaming(false);
    setSelectedNode(null);
    setActivePreset(preset);
    if (preset === 'small_world') GraphGenerators.generateSmallWorld(graph, 16, 4, 0.2);
    if (preset === 'scale_free') GraphGenerators.generateScaleFree(graph, 20, 2);
    if (preset === 'dense') GraphGenerators.generateDenseFinancialNetwork(graph, 14, 0.42);
    if (preset === 'grid') GraphGenerators.generateGridTopology(graph, 4, 5);
    onClearAlgorithm?.();
  };

  const handleAddNode = () => {
    const existingIds = new Set(nodes.map(n => n.id));
    let nextId = 0;
    while (existingIds.has(nextId)) nextId++;
    const x = 140 + Math.round(Math.random() * 440);
    const y = 90 + Math.round(Math.random() * 300);
    graph.addVertex(nextId, `N${nextId}`, x, y);
    setSelectedNode(nextId);
    showToast(`Added vertex N${nextId}`);
  };

  const handleDeleteSelected = () => {
    if (selectedNode === null) return;
    const label = nodes.find(n => n.id === selectedNode)?.label ?? `N${selectedNode}`;
    graph.removeVertex(selectedNode);
    graph.compactVertexIds();
    setSelectedNode(null);
    showToast(`Removed ${label}`);
  };

  const toSvgCoords = (clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 360, y: 240 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = ((clientX - rect.left) / rect.width) * 720;
    const y = ((clientY - rect.top) / rect.height) * 480;
    return {
      x: Math.max(28, Math.min(692, x)),
      y: Math.max(28, Math.min(452, y)),
    };
  };

  const handleNodePointerDown = (e: React.PointerEvent, id: number) => {
    e.stopPropagation();
    draggingNodeRef.current = id;
    isDragMoveRef.current = false;
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const handleSvgPointerMove = (e: React.PointerEvent) => {
    if (draggingNodeRef.current === null) return;
    isDragMoveRef.current = true;
    const { x, y } = toSvgCoords(e.clientX, e.clientY);
    const node = graph.getNodes().find(n => n.id === draggingNodeRef.current);
    if (node) {
      node.x = Math.round(x);
      node.y = Math.round(y);
      setDragTick(t => t + 1);
    }
  };

  const handleSvgPointerUp = (e: React.PointerEvent) => {
    if (draggingNodeRef.current !== null && !isDragMoveRef.current) {
      const clickedId = draggingNodeRef.current;
      if (selectedNode === null) {
        setSelectedNode(clickedId);
      } else if (selectedNode === clickedId) {
        setSelectedNode(null);
      } else {
        if (graph.hasEdge(selectedNode, clickedId)) {
          graph.removeEdge(selectedNode, clickedId);
          showToast(`Removed edge N${selectedNode} — N${clickedId}`);
        } else {
          const weight = Number((Math.random() * 6 + 1).toFixed(1));
          graph.addEdge(selectedNode, clickedId, weight);
          showToast(`Connected N${selectedNode} ${stats.isDirected ? '→' : '—'} N${clickedId}`);
        }
        setSelectedNode(null);
      }
    }
    draggingNodeRef.current = null;
    isDragMoveRef.current = false;
    if ((e.target as Element).hasPointerCapture?.(e.pointerId)) {
      (e.target as Element).releasePointerCapture(e.pointerId);
    }
  };

  const downloadFile = (content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
    showToast(`Exported ${filename}`);
  };

  const handleExportSvg = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgRef.current);
    downloadFile(svgStr, 'adaptive-graph.svg', 'image/svg+xml');
  };

  const activeStepNodes =
    traversalOrder.length > 0 && stepIndex >= 0
      ? new Set(traversalOrder.slice(0, stepIndex + 1))
      : visitedNodes;

  const activeHeadNode =
    traversalOrder.length > 0 && stepIndex >= 0 ? traversalOrder[stepIndex] : null;

  const isEdgeHighlighted = (u: number, v: number) =>
    visitedEdges.some(e =>
      stats.isDirected ? e.u === u && e.v === v : (e.u === u && e.v === v) || (e.u === v && e.v === u)
    ) && (traversalOrder.length === 0 || (activeStepNodes.has(u) && activeStepNodes.has(v)));

  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const degreeMap = new Map<number, number>();
  for (const e of edges) {
    degreeMap.set(e.u, (degreeMap.get(e.u) || 0) + 1);
    degreeMap.set(e.v, (degreeMap.get(e.v) || 0) + 1);
  }

  const inspectedId = hoveredNode ?? selectedNode;
  const inspectedNode = inspectedId !== null ? nodeMap.get(inspectedId) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
        {!compactHeader ? (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  { id: 'small_world', label: 'Small-World' },
                  { id: 'scale_free', label: 'Scale-Free' },
                  { id: 'dense', label: 'Dense Mesh' },
                  { id: 'grid', label: 'Grid' },
                ] as { id: PresetKey; label: string }[]
              ).map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePreset(preset.id)}
                  className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activePreset === preset.id
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => graph.setDirected(false)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  !stats.isDirected
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Undirected
              </button>
              <button
                type="button"
                onClick={() => graph.setDirected(true)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  stats.isDirected
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Directed
              </button>
            </div>
          </div>
        ) : (
          <div className="text-xs font-semibold text-slate-900">Live Network Canvas</div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleAddNode}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 text-blue-600" />
            <span>Add Node</span>
          </button>

          <button
            type="button"
            onClick={() => setIsStreaming(s => !s)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
              isStreaming
                ? 'bg-amber-50 text-amber-800 border-amber-300'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            {isStreaming ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5 text-emerald-600" />
            )}
            <span>{isStreaming ? 'Pause Stream' : 'Stream Edges'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              graph.applyForceLayout(60);
              showToast('Applied force-directed layout');
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5 text-slate-500" />
            <span>Auto Layout</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsStreaming(false);
              setSelectedNode(null);
              graph.clear();
              onClearAlgorithm?.();
            }}
            aria-label="Clear graph"
            className="p-1.5 text-slate-500 hover:text-rose-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowExportMenu(m => !m)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export</span>
            </button>
            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-36 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30">
                <button
                  type="button"
                  onClick={() =>
                    downloadFile(graph.exportJSON(), 'adaptive-graph.json', 'application/json')
                  }
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  JSON Graph
                </button>
                <button
                  type="button"
                  onClick={() => downloadFile(graph.exportCSV(), 'adaptive-graph.csv', 'text/csv')}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  CSV Edge List
                </button>
                <button
                  type="button"
                  onClick={handleExportSvg}
                  className="w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                >
                  SVG Vector
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Interactive SVG Stage */}
      <div className="relative bg-white select-none">
        <svg
          ref={svgRef}
          viewBox="0 0 720 480"
          className="w-full h-[460px] block cursor-crosshair touch-none"
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          onClick={() => setSelectedNode(null)}
        >
          <defs>
            <pattern id="grid-dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill="#E2E8F0" />
            </pattern>
            <marker
              id="arrow-default"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#94A3B8" />
            </marker>
            <marker
              id="arrow-active"
              viewBox="0 0 10 10"
              refX="18"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 10 5 L 0 9 z" fill="#2563EB" />
            </marker>
          </defs>
          <rect width="720" height="480" fill="#FFFFFF" />
          <rect width="720" height="480" fill="url(#grid-dots)" />

          {/* Edges */}
          {edges.map(edge => {
            const uNode = nodeMap.get(edge.u);
            const vNode = nodeMap.get(edge.v);
            if (!uNode || !vNode) return null;
            const x1 = uNode.x ?? 360;
            const y1 = uNode.y ?? 240;
            const x2 = vNode.x ?? 360;
            const y2 = vNode.y ?? 240;
            const highlighted = isEdgeHighlighted(edge.u, edge.v);
            const connectedToHover =
              hoveredNode !== null && (edge.u === hoveredNode || edge.v === hoveredNode);

            return (
              <g key={`${edge.u}-${edge.v}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={
                    highlighted
                      ? '#2563EB'
                      : connectedToHover
                        ? '#475569'
                        : '#CBD5E1'
                  }
                  strokeWidth={highlighted ? 2.6 : connectedToHover ? 1.8 : 1.35}
                  strokeOpacity={highlighted ? 0.95 : connectedToHover ? 0.9 : 0.85}
                  markerEnd={
                    stats.isDirected
                      ? highlighted
                        ? 'url(#arrow-active)'
                        : 'url(#arrow-default)'
                      : undefined
                  }
                />
                {(edges.length <= 36 || connectedToHover || highlighted) && (
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 4}
                    textAnchor="middle"
                    paintOrder="stroke"
                    stroke="#FFFFFF"
                    strokeWidth="3"
                    className="fill-slate-500 text-[9px] font-mono pointer-events-none"
                  >
                    {edge.weight}
                  </text>
                )}
              </g>
            );
          })}

          {/* Vertices */}
          {nodes.map(node => {
            const x = node.x ?? 360;
            const y = node.y ?? 240;
            const deg = degreeMap.get(node.id) ?? 0;
            const isSelected = selectedNode === node.id;
            const isHead = activeHeadNode === node.id;
            const isVisited = activeStepNodes.has(node.id);
            const isHub = deg >= 4;
            const r = isHub ? 17 : 13;

            return (
              <g
                key={node.id}
                transform={`translate(${x}, ${y})`}
                onPointerDown={e => handleNodePointerDown(e, node.id)}
                onPointerEnter={() => setHoveredNode(node.id)}
                onPointerLeave={() => setHoveredNode(null)}
                onClick={e => e.stopPropagation()}
                className="cursor-grab active:cursor-grabbing"
              >
                {(isSelected || isHead) && (
                  <circle
                    r={r + 5}
                    fill="none"
                    stroke={isHead ? '#D97706' : '#2563EB'}
                    strokeWidth={1.75}
                    strokeDasharray={isSelected ? '3 2' : undefined}
                  />
                )}
                <circle
                  r={r}
                  fill={
                    isHead
                      ? '#D97706'
                      : isVisited
                        ? '#2563EB'
                        : isSelected
                          ? '#DBEAFE'
                          : isHub
                            ? '#EFF6FF'
                            : '#FFFFFF'
                  }
                  stroke={
                    isHead
                      ? '#B45309'
                      : isVisited
                        ? '#1D4ED8'
                        : isSelected
                          ? '#2563EB'
                          : isHub
                            ? '#2563EB'
                            : '#64748B'
                  }
                  strokeWidth={1.75}
                />
                <text
                  y={3.5}
                  textAnchor="middle"
                  className={`text-[10px] font-mono font-semibold pointer-events-none ${
                    isHead || isVisited ? 'fill-white' : 'fill-slate-800'
                  }`}
                >
                  {node.label.length > 6 ? node.label.slice(0, 6) : node.label}
                </text>
              </g>
            );
          })}

          {nodes.length === 0 && (
            <text
              x="360"
              y="240"
              textAnchor="middle"
              className="fill-slate-400 text-sm font-sans"
            >
              Graph is empty — add nodes or choose a preset topology above.
            </text>
          )}
        </svg>

        {/* Bottom-left Live Readout HUD */}
        <div className="pointer-events-none absolute bottom-3 left-3.5 flex flex-wrap items-center gap-2.5 text-xs font-mono tabular-nums text-slate-600 bg-white/90 px-2.5 py-1 rounded border border-slate-200">
          <span className="text-slate-900 font-medium">V: {stats.vertexCount}</span>
          <span aria-hidden="true">·</span>
          <span className="text-slate-900 font-medium">E: {stats.edgeCount}</span>
          <span aria-hidden="true">·</span>
          <span>δ: {(stats.density * 100).toFixed(1)}%</span>
          <span aria-hidden="true">·</span>
          <span>{stats.isDirected ? 'Directed' : 'Undirected'}</span>
          <span aria-hidden="true">·</span>
          <span className={`font-semibold ${repStyle.textClass}`}>{repStyle.shortLabel}</span>
        </div>

        {/* Bottom-right Interaction Hint or Selected Node Action */}
        <div className="absolute bottom-3 right-3.5 flex items-center gap-2">
          {feedback && (
            <span className="text-xs font-mono text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded">
              {feedback}
            </span>
          )}
          {inspectedNode && (
            <div className="flex items-center gap-2.5 text-xs font-mono tabular-nums text-slate-700 bg-white/95 border border-slate-200 px-3 py-1 rounded shadow-xs">
              <span className="font-semibold text-slate-900">{inspectedNode.label}</span>
              <span className="text-slate-500">deg {degreeMap.get(inspectedNode.id) ?? 0}</span>
              {selectedNode === inspectedNode.id && (
                <>
                  <span className="text-slate-300">|</span>
                  <span className="text-blue-700 font-sans text-[11px]">
                    Click another node to toggle edge
                  </span>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    aria-label="Delete selected node"
                    className="text-rose-600 hover:text-rose-700 ml-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Optional Algorithm Step Playback Strip */}
      {traversalOrder.length > 0 && (
        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-mono tabular-nums">
            <span className="text-blue-700 font-semibold">{currentAlgorithm}</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-700">
              Step {Math.max(1, stepIndex + 1)} / {traversalOrder.length}
            </span>
            {activeHeadNode !== null && (
              <>
                <span className="text-slate-300">·</span>
                <span className="text-amber-700 font-medium">
                  Active: {nodeMap.get(activeHeadNode)?.label ?? `N${activeHeadNode}`}
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setIsPlayingSteps(false);
                setStepIndex(0);
              }}
              aria-label="Reset playback"
              className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPlayingSteps(false);
                setStepIndex(s => Math.max(0, s - 1));
              }}
              aria-label="Previous step"
              className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                if (stepIndex >= traversalOrder.length - 1) setStepIndex(0);
                setIsPlayingSteps(p => !p);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded"
            >
              {isPlayingSteps ? (
                <Pause className="w-3 h-3" />
              ) : (
                <Play className="w-3 h-3 fill-current" />
              )}
              <span>{isPlayingSteps ? 'Pause' : 'Play'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setIsPlayingSteps(false);
                setStepIndex(s => Math.min(traversalOrder.length - 1, s + 1));
              }}
              aria-label="Next step"
              className="p-1.5 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded"
            >
              <SkipForward className="w-3.5 h-3.5" />
            </button>
            {onClearAlgorithm && (
              <button
                type="button"
                onClick={onClearAlgorithm}
                className="ml-2 text-slate-500 hover:text-slate-800 px-2 py-1"
              >
                Clear Overlay
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
