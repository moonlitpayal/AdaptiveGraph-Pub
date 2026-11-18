/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Play, RotateCcw, CheckCircle2 } from 'lucide-react';
import { AdaptiveGraph } from '../engine/AdaptiveGraph';
import { GraphAlgorithms } from '../engine/algorithms';
import { REAL_TIME_SCENARIOS } from '../engine/scenarios';
import { AlgorithmResult, AlgorithmType } from '../engine/types';
import { GraphCanvas } from './GraphCanvas';
import { REP_STYLES } from './repStyles';

interface WorkloadsAndAlgosProps {
  graph: AdaptiveGraph;
}

const ALGORITHMS: { id: AlgorithmType; label: string; needsSource: boolean; desc: string }[] = [
  { id: 'DIJKSTRA', label: 'Dijkstra Shortest Path', needsSource: true, desc: 'Weighted single-source shortest paths' },
  { id: 'BFS', label: 'Breadth-First Search', needsSource: true, desc: 'Level-order reachability traversal' },
  { id: 'DFS', label: 'Depth-First Search', needsSource: true, desc: 'Recursive depth-first exploration' },
  { id: 'PAGERANK', label: 'PageRank', needsSource: false, desc: '20-iteration power-method centrality' },
  { id: 'TRIANGLES', label: 'Triangle Counting', needsSource: false, desc: 'Closed 3-clique neighbor intersections' },
  { id: 'PRIM_MST', label: "Prim's MST", needsSource: false, desc: 'Minimum-weight spanning tree' },
];

export const WorkloadsAndAlgos: React.FC<WorkloadsAndAlgosProps> = ({ graph }) => {
  const [mode, setMode] = useState<'scenarios' | 'algorithms'>('scenarios');

  const [scenarioIdx, setScenarioIdx] = useState(0);
  const [phaseIdx, setPhaseIdx] = useState(-1);
  const [isPlayingScenario, setIsPlayingScenario] = useState(false);

  const [selectedAlgo, setSelectedAlgo] = useState<AlgorithmType>('DIJKSTRA');
  const [sourceNode, setSourceNode] = useState<number>(0);
  const [algoResult, setAlgoResult] = useState<AlgorithmResult | null>(null);

  const scenario = REAL_TIME_SCENARIOS[scenarioIdx];
  const nodes = graph.getNodes();
  const stats = graph.getStats();

  useEffect(() => {
    if (nodes.length > 0 && !nodes.some(n => n.id === sourceNode)) {
      setSourceNode(nodes[0].id);
    }
  }, [nodes, sourceNode]);

  useEffect(() => {
    if (!isPlayingScenario) return;
    if (phaseIdx >= scenario.phases.length - 1) {
      setIsPlayingScenario(false);
      return;
    }
    const timer = setTimeout(() => {
      const next = phaseIdx + 1;
      setPhaseIdx(next);
      scenario.phases[next].execute(graph);
    }, 1100);
    return () => clearTimeout(timer);
  }, [isPlayingScenario, phaseIdx, scenario, graph]);

  const handleSelectScenario = (idx: number) => {
    setIsPlayingScenario(false);
    setScenarioIdx(idx);
    setPhaseIdx(-1);
    setAlgoResult(null);
    REAL_TIME_SCENARIOS[idx].initialSetup(graph);
  };

  const handleRunPhase = (idx: number) => {
    setIsPlayingScenario(false);
    setPhaseIdx(idx);
    scenario.phases[idx].execute(graph);
  };

  const handlePlayAll = () => {
    setAlgoResult(null);
    scenario.initialSetup(graph);
    setPhaseIdx(0);
    scenario.phases[0].execute(graph);
    setIsPlayingScenario(true);
  };

  const handleResetScenario = () => {
    setIsPlayingScenario(false);
    setPhaseIdx(-1);
    scenario.initialSetup(graph);
  };

  const handleRunAlgorithm = () => {
    if (nodes.length === 0) return;
    const startId = nodes.some(n => n.id === sourceNode) ? sourceNode : nodes[0].id;
    let res: AlgorithmResult;
    switch (selectedAlgo) {
      case 'DIJKSTRA':
        res = GraphAlgorithms.runDijkstra(graph, startId);
        break;
      case 'BFS':
        res = GraphAlgorithms.runBFS(graph, startId);
        break;
      case 'DFS':
        res = GraphAlgorithms.runDFS(graph, startId);
        break;
      case 'PAGERANK':
        res = GraphAlgorithms.runPageRank(graph);
        break;
      case 'TRIANGLES':
        res = GraphAlgorithms.runTriangleCounting(graph);
        break;
      case 'PRIM_MST':
      default:
        res = GraphAlgorithms.runPrimMST(graph);
        break;
    }
    setAlgoResult(res);
  };

  const visitedSet = new Set(algoResult?.traversalOrder ?? []);
  const visitedEdges = algoResult?.visitedEdges ?? [];
  const activeAlgoMeta = ALGORITHMS.find(a => a.id === selectedAlgo)!;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left Control Column */}
      <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <div className="inline-flex p-1 bg-slate-100 rounded-lg w-full">
            <button
              type="button"
              onClick={() => setMode('scenarios')}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'scenarios'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Workload Scenarios
            </button>
            <button
              type="button"
              onClick={() => setMode('algorithms')}
              className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                mode === 'algorithms'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Graph Algorithms
            </button>
          </div>
        </div>

        {/* MODE 1: REAL-TIME WORKLOAD SCENARIOS */}
        {mode === 'scenarios' && (
          <div className="p-5 space-y-5">
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600">Select Workload</div>
              <div className="grid grid-cols-1 gap-2">
                {REAL_TIME_SCENARIOS.map((sc, idx) => (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => handleSelectScenario(idx)}
                    className={`text-left p-3 rounded-lg border transition-colors ${
                      scenarioIdx === idx
                        ? 'bg-blue-50/50 border-blue-400'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-900">{sc.title}</span>
                      <span className="text-[11px] text-slate-500 shrink-0">{sc.domain}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="text-xs text-slate-600 leading-relaxed border-t border-slate-200 pt-4">
              {scenario.adaptiveAdvantage}
            </div>

            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={handlePlayAll}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>{isPlayingScenario ? 'Running Lifecycle...' : 'Run Full Lifecycle'}</span>
              </button>
              <button
                type="button"
                onClick={handleResetScenario}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset</span>
              </button>
            </div>

            <div className="space-y-2 border-t border-slate-200 pt-4">
              {scenario.phases.map((phase, idx) => {
                const isActive = phaseIdx === idx;
                const isDone = phaseIdx > idx;
                const expStyle = REP_STYLES[phase.expectedRepresentation];
                return (
                  <button
                    key={phase.phaseNumber}
                    type="button"
                    onClick={() => handleRunPhase(idx)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      isActive
                        ? 'bg-blue-50/50 border-blue-400'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-900">
                        {phase.phaseNumber}. {phase.phaseName}
                      </span>
                      <span className={`font-mono font-medium text-[11px] ${expStyle.textClass}`}>
                        {expStyle.shortLabel}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                      {phase.actionSummary}
                    </p>
                    {isDone && (
                      <div className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-medium mt-1.5">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Completed</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* MODE 2: GRAPH ALGORITHMS */}
        {mode === 'algorithms' && (
          <div className="p-5 space-y-5">
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-600">Algorithm</div>
              <div className="grid grid-cols-2 gap-2">
                {ALGORITHMS.map(algo => (
                  <button
                    key={algo.id}
                    type="button"
                    onClick={() => setSelectedAlgo(algo.id)}
                    className={`text-left p-2.5 rounded-lg border transition-colors ${
                      selectedAlgo === algo.id
                        ? 'bg-blue-50/60 border-blue-400 text-slate-900'
                        : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="text-xs font-semibold truncate">{algo.label}</div>
                    <div className="text-[11px] text-slate-500 truncate mt-0.5">{algo.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {activeAlgoMeta.needsSource && nodes.length > 0 && (
              <div className="flex items-center justify-between gap-3 pt-1">
                <label htmlFor="source-node-select" className="text-xs text-slate-700 font-medium">
                  Source Vertex
                </label>
                <select
                  id="source-node-select"
                  value={sourceNode}
                  onChange={e => setSourceNode(Number(e.target.value))}
                  className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-900 focus:outline-none focus:border-blue-500"
                >
                  {nodes.map(n => (
                    <option key={n.id} value={n.id}>
                      [{n.id}] {n.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleRunAlgorithm}
              disabled={nodes.length === 0}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run {activeAlgoMeta.label}</span>
            </button>

            {algoResult && (
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2 font-mono tabular-nums text-xs">
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] font-sans text-slate-500">Runtime</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      {algoResult.runtimeMs} ms
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] font-sans text-slate-500">Operations</div>
                    <div className="text-sm font-bold text-slate-900 mt-0.5">
                      {algoResult.operationsCount}
                    </div>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="text-[10px] font-sans text-slate-500">Engine</div>
                    <div
                      className={`text-xs font-bold mt-1 truncate ${REP_STYLES[algoResult.representationUsed].textClass}`}
                    >
                      {REP_STYLES[algoResult.representationUsed].shortLabel}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">{algoResult.summary}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Right Live Canvas */}
      <div className="lg:col-span-7 space-y-3">
        <GraphCanvas
          graph={graph}
          visitedNodes={visitedSet}
          visitedEdges={visitedEdges}
          currentAlgorithm={algoResult?.algorithm ?? null}
          traversalOrder={algoResult?.traversalOrder ?? []}
          onClearAlgorithm={() => setAlgoResult(null)}
          compactHeader={mode === 'scenarios'}
        />

        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs font-mono tabular-nums text-slate-600">
          <span>
            Engine:{' '}
            <span className={`font-semibold ${REP_STYLES[stats.activeRepresentation].textClass}`}>
              {REP_STYLES[stats.activeRepresentation].label}
            </span>
          </span>
          <span>
            Switches: {stats.telemetry.representationSwitchesCount} · Last:{' '}
            <span className="text-slate-700 font-sans">{stats.telemetry.lastSwitchReason}</span>
          </span>
        </div>
      </div>
    </div>
  );
};
