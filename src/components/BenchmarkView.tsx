/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import { Play, Download } from 'lucide-react';
import { BenchmarkSuite } from '../engine/benchmarks';
import { BenchmarkMetrics } from '../engine/types';
import type { BenchmarkWorkerResponse } from '../engine/benchmark.worker';
import { formatBytes } from './repStyles';

export const BenchmarkView: React.FC = () => {
  const [vertexCount, setVertexCount] = useState(250);
  const [density, setDensity] = useState(0.15);
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<BenchmarkMetrics[]>(() =>
    BenchmarkSuite.runFullComparison(250, 0.15, 25000, 12000, 150)
  );
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const handleRun = () => {
    setIsRunning(true);
    const queryLookups = Math.max(25000, vertexCount * 140);
    const neighborSweeps = Math.max(10000, vertexCount * 60);
    const insertBatchSize = 200;

    try {
      workerRef.current?.terminate();
      const worker = new Worker(new URL('../engine/benchmark.worker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent<BenchmarkWorkerResponse>) => {
        setResults(e.data.results);
        setIsRunning(false);
        worker.terminate();
      };

      worker.onerror = () => {
        const fallback = BenchmarkSuite.runFullComparison(
          vertexCount,
          density,
          queryLookups,
          neighborSweeps,
          insertBatchSize
        );
        setResults(fallback);
        setIsRunning(false);
        worker.terminate();
      };

      worker.postMessage({
        vertexCount,
        density,
        queryLookups,
        neighborSweeps,
        insertBatchSize,
      });
    } catch {
      const fallback = BenchmarkSuite.runFullComparison(
        vertexCount,
        density,
        queryLookups,
        neighborSweeps,
        insertBatchSize
      );
      setResults(fallback);
      setIsRunning(false);
    }
  };

  const handleExportCsv = () => {
    const header =
      'representation,lookup_ms,traversal_ms,insert_batch_ms,bfs_sweep_ms,memory_bytes,throughput_kops_sec';
    const rows = results.map(
      r =>
        `"${r.representation}",${r.edgeLookupTimeMs},${r.neighborTraversalTimeMs},${r.edgeInsertionTimeMs},${r.algorithmRunTimeMs},${r.memoryBytes},${r.throughputKopsSec}`
    );
    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `adaptivegraph-benchmark-v${vertexCount}-d${Math.round(density * 100)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const maxTotalLatency = Math.max(
    0.1,
    ...results.map(r => r.edgeLookupTimeMs + r.neighborTraversalTimeMs)
  );
  const maxMemory = Math.max(1, ...results.map(r => r.memoryBytes));

  return (
    <div className="space-y-6">
      {/* Control Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-base font-semibold text-slate-900">
              Empirical Microsecond Profiler
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Executes off-thread in a Web Worker: measures live edge probes, neighbor scans, 200-edge batch inserts, and BFS traversals.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Export CSV</span>
            </button>
            <button
              type="button"
              onClick={handleRun}
              disabled={isRunning}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunning ? 'Profiling in Worker...' : 'Run Benchmark'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
          <label className="block space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700 font-medium">Vertex Count (V)</span>
              <span className="font-mono tabular-nums text-slate-900 font-semibold">
                {vertexCount}
              </span>
            </div>
            <input
              type="range"
              min={50}
              max={800}
              step={25}
              value={vertexCount}
              onChange={e => setVertexCount(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </label>

          <label className="block space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-slate-700 font-medium">Graph Density (δ)</span>
              <span className="font-mono tabular-nums text-slate-900 font-semibold">
                {(density * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={2}
              max={60}
              step={1}
              value={Math.round(density * 100)}
              onChange={e => setDensity(Number(e.target.value) / 100)}
              className="w-full accent-blue-600 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* Results Data Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600 bg-slate-50">
                <th className="py-3 px-4 font-semibold">Representation</th>
                <th className="py-3 px-4 font-semibold text-right">Lookup (ms)</th>
                <th className="py-3 px-4 font-semibold text-right">Scan (ms)</th>
                <th className="py-3 px-4 font-semibold text-right">200 Inserts (ms)</th>
                <th className="py-3 px-4 font-semibold text-right">BFS Sweep (ms)</th>
                <th className="py-3 px-4 font-semibold text-right">Memory</th>
                <th className="py-3 px-4 font-semibold text-right">Throughput</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {results.map(row => {
                const isAdaptive = row.representation.startsWith('AdaptiveGraph');
                return (
                  <tr
                    key={row.representation}
                    className={
                      isAdaptive
                        ? 'bg-blue-50/70 text-blue-950'
                        : 'hover:bg-slate-50 text-slate-800'
                    }
                  >
                    <td className="py-3 px-4 font-sans font-semibold">{row.representation}</td>
                    <td className="py-3 px-4 text-right">{row.edgeLookupTimeMs.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right">
                      {row.neighborTraversalTimeMs.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">{row.edgeInsertionTimeMs.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right">{row.algorithmRunTimeMs.toFixed(2)}</td>
                    <td className="py-3 px-4 text-right">{formatBytes(row.memoryBytes)}</td>
                    <td className="py-3 px-4 text-right">{row.throughputKopsSec} kOps/s</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Visual Trade-Off Comparison */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
          <div className="text-xs font-semibold text-slate-900">
            Combined Query + Scan Latency (lower is faster)
          </div>
          <div className="space-y-3">
            {results.map(row => {
              const total = row.edgeLookupTimeMs + row.neighborTraversalTimeMs;
              const pct = Math.max(4, Math.round((total / maxTotalLatency) * 100));
              const isAdaptive = row.representation.startsWith('AdaptiveGraph');
              return (
                <div key={`lat-${row.representation}`} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span
                      className={isAdaptive ? 'text-blue-700 font-semibold' : 'text-slate-700'}
                    >
                      {row.representation}
                    </span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {total.toFixed(2)} ms
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${isAdaptive ? 'bg-blue-600' : 'bg-slate-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
          <div className="text-xs font-semibold text-slate-900">
            Memory Footprint (lower is leaner)
          </div>
          <div className="space-y-3">
            {results.map(row => {
              const pct = Math.max(4, Math.round((row.memoryBytes / maxMemory) * 100));
              const isAdaptive = row.representation.startsWith('AdaptiveGraph');
              return (
                <div key={`mem-${row.representation}`} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span
                      className={isAdaptive ? 'text-blue-700 font-semibold' : 'text-slate-700'}
                    >
                      {row.representation}
                    </span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {formatBytes(row.memoryBytes)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${isAdaptive ? 'bg-emerald-600' : 'bg-slate-400'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
