/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useRef, useState } from 'react';
import { AdaptiveGraph } from './engine/AdaptiveGraph';
import { GraphGenerators } from './engine/generators';
import { GraphAlgorithms } from './engine/algorithms';
import { GraphSnapshot } from './engine/types';
import { AppTab, TopBar } from './components/TopBar';
import { GraphCanvas } from './components/GraphCanvas';
import { EngineInspector } from './components/EngineInspector';
import { MemoryInspector } from './components/MemoryInspector';
import { WorkloadsAndAlgos } from './components/WorkloadsAndAlgos';
import { BenchmarkView } from './components/BenchmarkView';
import { ImportGraphModal } from './components/ImportGraphModal';

const STORAGE_KEY = 'adaptivegraph_workspace_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>('explorer');
  const [isImportOpen, setIsImportOpen] = useState(false);

  const graphRef = useRef<AdaptiveGraph>(new AdaptiveGraph(false));
  const graph = graphRef.current;

  const [, setTick] = useState(0);

  useEffect(() => {
    let restored = false;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as GraphSnapshot;
        if (Array.isArray(parsed.nodes) && parsed.nodes.length > 0) {
          graph.loadSnapshot(parsed);
          restored = true;
        }
      }
    } catch {
      restored = false;
    }

    if (!restored) {
      GraphGenerators.generateSmallWorld(graph, 16, 4, 0.2);
    }

    const unsubscribe = graph.subscribe(() => {
      setTick(t => t + 1);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(graph.serializeSnapshot()));
      } catch {
        // Ignore storage quota errors
      }
    });
    return () => unsubscribe();
  }, [graph]);

  const stats = graph.getStats();
  const topology = GraphAlgorithms.computeTopologyAnalytics(graph);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <TopBar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenImport={() => setIsImportOpen(true)}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {activeTab === 'explorer' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              <div className="lg:col-span-8 space-y-4">
                <GraphCanvas graph={graph} />

                <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-3 bg-white border border-slate-200 rounded-xl text-xs">
                  <div className="flex flex-wrap items-center gap-4 text-slate-500 font-mono tabular-nums">
                    <span>
                      Components:{' '}
                      <strong className="text-slate-900">{topology.connectedComponents}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Avg Degree: <strong className="text-slate-900">{topology.averageDegree}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Clustering:{' '}
                      <strong className="text-slate-900">{topology.clusteringCoefficient}</strong>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Triangles: <strong className="text-slate-900">{topology.trianglesCount}</strong>
                    </span>
                  </div>
                  <div className="text-slate-500 font-mono tabular-nums">
                    Top Hub:{' '}
                    <strong className="text-blue-700">
                      {topology.maxDegree.label} (deg {topology.maxDegree.degree})
                    </strong>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4">
                <EngineInspector graph={graph} />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'memory' && <MemoryInspector graph={graph} />}

        {activeTab === 'workloads' && <WorkloadsAndAlgos graph={graph} />}

        {activeTab === 'benchmarks' && <BenchmarkView />}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 px-6 text-xs text-slate-500">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900">AdaptiveGraph</span>
            <span aria-hidden="true">·</span>
            <span>Autonomous Multi-Representation Graph Engine</span>
          </div>
          <div className="font-mono tabular-nums text-slate-600">
            Active: {stats.activeRepresentation} · {stats.vertexCount}V / {stats.edgeCount}E
          </div>
        </div>
      </footer>

      <ImportGraphModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        graph={graph}
        onImported={() => setActiveTab('explorer')}
      />
    </div>
  );
}
