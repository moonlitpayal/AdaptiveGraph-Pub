/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState } from 'react';
import { Layers } from 'lucide-react';
import {
  AdaptiveGraph,
  AdjacencyListGraph,
  AdjacencyMatrixGraph,
  CSRGraph,
  DynamicCSRGraph,
  HybridHubGraph,
} from '../engine/AdaptiveGraph';
import { REPRESENTATION_META, RepresentationType } from '../engine/types';
import { formatBytes, REP_STYLES } from './repStyles';

interface MemoryInspectorProps {
  graph: AdaptiveGraph;
}

const REP_TABS: RepresentationType[] = [
  'ADJACENCY_LIST',
  'ADJACENCY_MATRIX',
  'CSR',
  'DYNAMIC_CSR_LSM',
  'HYBRID_HUB',
];

export const MemoryInspector: React.FC<MemoryInspectorProps> = ({ graph }) => {
  const stats = graph.getStats();
  const [selectedRep, setSelectedRep] = useState<RepresentationType>(stats.activeRepresentation);
  const [selectedCsrVertex, setSelectedCsrVertex] = useState<number>(0);
  const [hoveredCell, setHoveredCell] = useState<{ r: number; c: number; w: number } | null>(null);

  const nodes = graph.getNodes();
  const edges = graph.getEdges();
  const comparison = graph.getRepresentationComparison();

  const repEdges = useMemo(() => {
    const out = [...edges];
    if (!stats.isDirected) {
      for (const e of edges) {
        out.push({ u: e.v, v: e.u, weight: e.weight });
      }
    }
    return out;
  }, [edges, stats.isDirected]);

  const V = Math.max(1, nodes.length);

  const activeRepInstance = graph.getActiveRepresentation();
  const listView = useMemo(
    () =>
      activeRepInstance instanceof AdjacencyListGraph
        ? activeRepInstance
        : new AdjacencyListGraph(repEdges, V),
    [activeRepInstance, repEdges, V]
  );

  const matrixView = useMemo(
    () =>
      activeRepInstance instanceof AdjacencyMatrixGraph
        ? activeRepInstance
        : new AdjacencyMatrixGraph(repEdges, V),
    [activeRepInstance, repEdges, V]
  );

  const csrView = useMemo(
    () => (activeRepInstance instanceof CSRGraph ? activeRepInstance : new CSRGraph(repEdges, V)),
    [activeRepInstance, repEdges, V]
  );

  const lsmView = useMemo(
    () =>
      activeRepInstance instanceof DynamicCSRGraph
        ? activeRepInstance
        : new DynamicCSRGraph(repEdges, V),
    [activeRepInstance, repEdges, V]
  );

  const hybridView = useMemo(
    () =>
      activeRepInstance instanceof HybridHubGraph
        ? activeRepInstance
        : new HybridHubGraph(repEdges, V),
    [activeRepInstance, repEdges, V]
  );

  const csrData = csrView.getCSRData();
  const safeCsrVertex = Math.min(selectedCsrVertex, Math.max(0, csrData.rowPtr.length - 2));
  const sliceStart = csrData.rowPtr[safeCsrVertex] ?? 0;
  const sliceEnd = csrData.rowPtr[safeCsrVertex + 1] ?? 0;

  const matrixDim = Math.min(18, V);
  const rawMatrix = matrixView.getRawMatrix(matrixDim);

  const maxBytes = Math.max(1, ...comparison.map(c => c.bytes));

  return (
    <div className="space-y-6">
      {/* Memory Comparison Strip */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-base font-semibold text-slate-900">Live Memory Layout Inspector</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Inspect how the active graph ({stats.vertexCount} vertices · {stats.edgeCount} edges)
              is stored across all five representations.
            </p>
          </div>
          <div className="text-xs font-mono tabular-nums text-slate-600">
            Active:{' '}
            <span className={`font-semibold ${REP_STYLES[stats.activeRepresentation].textClass}`}>
              {REP_STYLES[stats.activeRepresentation].label}
            </span>{' '}
            ({formatBytes(stats.memoryBytes)})
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {comparison.map(item => {
            const style = REP_STYLES[item.type];
            const widthPct = Math.max(8, Math.round((item.bytes / maxBytes) * 100));
            const selected = selectedRep === item.type;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => setSelectedRep(item.type)}
                className={`text-left p-3 rounded-lg border transition-colors ${
                  selected
                    ? 'bg-blue-50/50 border-blue-400'
                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className={`font-semibold truncate ${style.textClass}`}>
                    {style.shortLabel}
                  </span>
                  {item.isActive && (
                    <span className="text-[10px] font-mono font-semibold text-blue-700">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-sm font-mono tabular-nums font-bold text-slate-900 mt-1">
                  {formatBytes(item.bytes)}
                </div>
                <div className="h-1 bg-slate-200 rounded-full mt-2 overflow-hidden">
                  <div className={`h-full ${style.barClass}`} style={{ width: `${widthPct}%` }} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Representation Inspector */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
            {REP_TABS.map(rep => {
              const active = selectedRep === rep;
              return (
                <button
                  key={rep}
                  type="button"
                  onClick={() => setSelectedRep(rep)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {REP_STYLES[rep].shortLabel}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-3">
            {selectedRep !== stats.activeRepresentation && (
              <button
                type="button"
                onClick={() =>
                  graph.forceSwitch(
                    selectedRep,
                    `Pinned ${REP_STYLES[selectedRep].label} from Memory Layout`
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Activate This Engine</span>
              </button>
            )}
          </div>
        </div>

        <div className="p-5">
          <div className="mb-4 text-xs text-slate-600">
            {REPRESENTATION_META[selectedRep].description}
          </div>

          {/* 1. ADJACENCY LIST */}
          {selectedRep === 'ADJACENCY_LIST' && (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {nodes.slice(0, 24).map(node => {
                const nbrs = listView.getNeighbors(node.id);
                return (
                  <div
                    key={node.id}
                    className="flex flex-wrap items-center gap-2 py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono"
                  >
                    <span className="w-20 text-emerald-700 font-semibold shrink-0 truncate">
                      [{node.id}] {node.label}
                    </span>
                    <span className="text-slate-400">→</span>
                    {nbrs.length === 0 ? (
                      <span className="text-slate-400">null</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-1.5">
                        {nbrs.map(n => (
                          <span
                            key={n.v}
                            className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-800 tabular-nums"
                          >
                            {n.v} <span className="text-slate-500">w={n.weight}</span>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
              {nodes.length > 24 && (
                <div className="text-xs text-slate-500 pt-1">
                  Showing first 24 of {nodes.length} vertex buckets.
                </div>
              )}
            </div>
          )}

          {/* 2. ADJACENCY MATRIX */}
          {selectedRep === 'ADJACENCY_MATRIX' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-600 font-mono tabular-nums">
                <span>
                  Typed Float32Array ({matrixDim} × {matrixDim} visible of {V} × {V})
                </span>
                <span>
                  {hoveredCell
                    ? `M[${hoveredCell.r}][${hoveredCell.c}] = ${hoveredCell.w === 0 ? '0 (no edge)' : hoveredCell.w}`
                    : 'Hover a cell to inspect weight'}
                </span>
              </div>
              <div className="overflow-x-auto">
                <div
                  className="inline-grid gap-1 p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono text-[10px] tabular-nums"
                  style={{
                    gridTemplateColumns: `36px repeat(${matrixDim}, minmax(26px, 28px))`,
                  }}
                >
                  <div />
                  {Array.from({ length: matrixDim }).map((_, c) => (
                    <div key={`h-${c}`} className="text-center text-slate-500 font-semibold py-1">
                      {c}
                    </div>
                  ))}
                  {rawMatrix.map((row, r) => (
                    <React.Fragment key={`r-${r}`}>
                      <div className="flex items-center justify-end pr-2 text-slate-500 font-semibold">
                        {r}
                      </div>
                      {row.map((w, c) => (
                        <div
                          key={`${r}-${c}`}
                          onMouseEnter={() => setHoveredCell({ r, c, w })}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={`h-7 flex items-center justify-center rounded border transition-colors ${
                            w !== 0
                              ? 'bg-amber-100 border-amber-300 text-amber-900 font-semibold'
                              : 'bg-white border-slate-200 text-slate-300'
                          }`}
                        >
                          {w !== 0 ? w.toFixed(0) : '0'}
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. STATIC CSR */}
          {selectedRep === 'CSR' && (
            <div className="space-y-5 font-mono text-xs tabular-nums">
              <div>
                <div className="text-slate-600 font-sans mb-2">
                  Click any vertex index in <code className="text-blue-700 font-mono">row_ptr</code>{' '}
                  to highlight its packed neighbor slice{' '}
                  <span className="text-slate-900 font-semibold">
                    [{sliceStart} .. {sliceEnd})
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  {Array.from(csrData.rowPtr).map((ptr, idx) => {
                    const isVertex = idx < csrData.rowPtr.length - 1;
                    const active = isVertex && idx === safeCsrVertex;
                    return (
                      <button
                        key={`rp-${idx}`}
                        type="button"
                        disabled={!isVertex}
                        onClick={() => isVertex && setSelectedCsrVertex(idx)}
                        className={`px-2.5 py-1.5 rounded border text-center min-w-[44px] transition-colors ${
                          active
                            ? 'bg-blue-600 border-blue-600 text-white font-bold'
                            : isVertex
                              ? 'bg-white border-slate-200 text-slate-800 hover:border-slate-400'
                              : 'bg-slate-100 border-slate-200 text-slate-400 cursor-default'
                        }`}
                      >
                        <div className={`text-[9px] ${active ? 'text-blue-100' : 'text-slate-400'}`}>
                          [{idx}]
                        </div>
                        <div>{ptr}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="text-slate-600 font-sans mb-2">
                  Packed <code className="text-blue-700 font-mono">col_idx[]</code> &amp;{' '}
                  <code className="text-blue-700 font-mono">weights[]</code> (length{' '}
                  {csrData.colIdx.length})
                </div>
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 border border-slate-200 rounded-lg max-h-60 overflow-y-auto">
                  {csrData.colIdx.length === 0 ? (
                    <span className="text-slate-500 font-sans">No edges stored.</span>
                  ) : (
                    Array.from(csrData.colIdx).map((col, idx) => {
                      const inSlice = idx >= sliceStart && idx < sliceEnd;
                      return (
                        <div
                          key={`ci-${idx}`}
                          className={`px-2.5 py-1.5 rounded border min-w-[54px] text-center ${
                            inSlice
                              ? 'bg-blue-50 border-blue-400 text-blue-900 font-semibold'
                              : 'bg-white border-slate-200 text-slate-500'
                          }`}
                        >
                          <div className="text-[9px] opacity-70">@{idx}</div>
                          <div>v={col}</div>
                          <div className="text-[10px] opacity-75">
                            w={csrData.weights[idx]?.toFixed(1)}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 4. DYNAMIC CSR (LSM DELTA) */}
          {selectedRep === 'DYNAMIC_CSR_LSM' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[11px] font-sans text-slate-500">Delta Buffer</div>
                  <div className="text-base font-bold text-violet-700 mt-0.5">
                    {lsmView.lsmStats.bufferedEdgesCount} / {lsmView.lsmStats.bufferCapacity}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[11px] font-sans text-slate-500">Micro-Merges</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {lsmView.lsmStats.totalMergesCount}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[11px] font-sans text-slate-500">Last Merge</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {lsmView.lsmStats.lastMergeLatencyMs} ms
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-sans text-slate-500">Base Edges</div>
                    <div className="text-base font-bold text-slate-900 mt-0.5">
                      {lsmView.getBaseCSR().getAllEdges().length}
                    </div>
                  </div>
                  {stats.activeRepresentation === 'DYNAMIC_CSR_LSM' && (
                    <button
                      type="button"
                      onClick={() => graph.flushLSMBuffer()}
                      className="px-2.5 py-1.5 text-xs font-sans font-medium bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
                    >
                      Flush Merge
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs font-medium text-slate-800 mb-2">
                  Write-Ahead Delta Buffer Entries
                </div>
                {lsmView.getBufferedEdges().length === 0 ? (
                  <p className="text-xs text-slate-500">
                    Delta buffer is empty. Activate Dynamic CSR (LSM) and add or stream edges to watch O(1) writes stage before compaction.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 font-mono text-xs tabular-nums">
                    {lsmView.getBufferedEdges().map((e, i) => (
                      <span
                        key={`${e.u}-${e.v}-${i}`}
                        className="px-2.5 py-1 bg-violet-50 border border-violet-200 rounded text-violet-900"
                      >
                        {e.u} → {e.v} (w={e.weight})
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 5. HYBRID HUB */}
          {selectedRep === 'HYBRID_HUB' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono tabular-nums">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[11px] font-sans text-slate-500">
                    Hot Hubs (deg ≥ {hybridView.hybridStats.hubThresholdDegree})
                  </div>
                  <div className="text-base font-bold text-teal-700 mt-0.5">
                    {hybridView.hybridStats.hotHubCount}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[11px] font-sans text-slate-500">Cold Tail Nodes</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {hybridView.hybridStats.coldTailCount}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[11px] font-sans text-slate-500">O(1) Hub Lookups</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {hybridView.hybridStats.hubLookupsHandledO1}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <div className="text-[11px] font-sans text-slate-500">Saved vs Full Matrix</div>
                  <div className="text-base font-bold text-emerald-700 mt-0.5">
                    {hybridView.hybridStats.memorySavedVsFullMatrixPercent}%
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-xs font-medium text-slate-800 mb-2">
                  Hot-Hub Partitioned Vertices
                </div>
                {hybridView.getHotHubs().length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No vertices currently meet the hub degree threshold ({hybridView.hybridStats.hubThresholdDegree}). Try the Scale-Free preset to observe hub partitioning.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2 font-mono text-xs tabular-nums">
                    {hybridView.getHotHubs().map(id => {
                      const label = nodes.find(n => n.id === id)?.label ?? `N${id}`;
                      return (
                        <span
                          key={id}
                          className="px-2.5 py-1 bg-teal-50 border border-teal-200 rounded text-teal-900"
                        >
                          [{id}] {label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
