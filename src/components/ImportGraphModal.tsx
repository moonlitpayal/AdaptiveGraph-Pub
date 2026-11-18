/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState } from 'react';
import { X, Upload, Play, AlertCircle } from 'lucide-react';
import { AdaptiveGraph } from '../engine/AdaptiveGraph';

interface ImportGraphModalProps {
  isOpen: boolean;
  onClose: () => void;
  graph: AdaptiveGraph;
  onImported: () => void;
}

const SAMPLE_DATASETS: {
  id: string;
  name: string;
  subtitle: string;
  format: 'csv' | 'json';
  data: string;
}[] = [
  {
    id: 'air_routes',
    name: 'Global Air Routes',
    subtitle: '10 hubs · distance (mi)',
    format: 'csv',
    data: `JFK,LHR,3450
JFK,HND,6740
LHR,CDG,215
LHR,DXB,3400
DXB,SIN,3650
SIN,HND,3300
FRA,LHR,400
FRA,JFK,3850
SYD,SIN,3900
SYD,LAX,7490
LAX,JFK,2475
LAX,HND,5480
ORD,JFK,740
ORD,LAX,1740`,
  },
  {
    id: 'lightning',
    name: 'Lightning P2P Channels',
    subtitle: '9 nodes · BTC capacity',
    format: 'csv',
    data: `Alice,Kraken,0.85
Bob,Kraken,1.20
Charlie,Bitfinex,0.40
Kraken,Bitfinex,5.50
Dave,Bitfinex,0.90
Eve,Strike,1.10
Strike,Kraken,3.80
Frank,Strike,0.75
Bitfinex,Binance,4.20
Binance,Grace,1.50`,
  },
  {
    id: 'service_mesh',
    name: 'Cloud RPC Mesh',
    subtitle: '10 services · p99 latency ms',
    format: 'csv',
    data: `Edge,Gateway,1.2
Gateway,Auth,3.4
Gateway,Orders,4.1
Gateway,Search,8.2
Auth,UserDB,2.1
Orders,Payment,5.5
Orders,Redis,0.8
Payment,LedgerDB,3.9
Search,Elastic,2.4
Gateway,Billing,4.8
Billing,LedgerDB,2.6`,
  },
  {
    id: 'json_cluster',
    name: 'Dense Core-Periphery (JSON)',
    subtitle: '8 vertices · dense core',
    format: 'json',
    data: JSON.stringify(
      {
        nodes: [
          { id: 0, label: 'Core_A' },
          { id: 1, label: 'Core_B' },
          { id: 2, label: 'Core_C' },
          { id: 3, label: 'Core_D' },
          { id: 4, label: 'Edge_1' },
          { id: 5, label: 'Edge_2' },
          { id: 6, label: 'Edge_3' },
          { id: 7, label: 'Edge_4' },
        ],
        edges: [
          { u: 0, v: 1, weight: 2 },
          { u: 0, v: 2, weight: 3 },
          { u: 0, v: 3, weight: 1 },
          { u: 1, v: 2, weight: 2 },
          { u: 1, v: 3, weight: 4 },
          { u: 2, v: 3, weight: 2 },
          { u: 0, v: 4, weight: 5 },
          { u: 1, v: 5, weight: 6 },
          { u: 2, v: 6, weight: 4 },
          { u: 3, v: 7, weight: 7 },
        ],
      },
      null,
      2
    ),
  },
];

export const ImportGraphModal: React.FC<ImportGraphModalProps> = ({
  isOpen,
  onClose,
  graph,
  onImported,
}) => {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [rawText, setRawText] = useState<string>(SAMPLE_DATASETS[0].data);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleLoadPreset = (preset: (typeof SAMPLE_DATASETS)[number]) => {
    setFormat(preset.format);
    setRawText(preset.data);
    setError(null);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const content = String(ev.target?.result || '');
      if (file.name.endsWith('.json')) {
        setFormat('json');
      } else {
        setFormat('csv');
      }
      setRawText(content);
      setError(null);
    };
    reader.readAsText(file);
  };

  const handleIngest = () => {
    setError(null);
    try {
      if (format === 'csv') {
        const lines = rawText
          .split('\n')
          .map(l => l.trim())
          .filter(l => l.length > 0 && !l.startsWith('#'));

        if (lines.length === 0) {
          throw new Error('Provide at least one edge row (source, target, weight).');
        }

        const labelToId = new Map<string, number>();
        const customNodes: { id: number; label: string }[] = [];
        const customEdges: { u: number; v: number; weight: number }[] = [];

        const getOrCreateId = (label: string): number => {
          const clean = label.trim();
          if (!labelToId.has(clean)) {
            const id = customNodes.length;
            labelToId.set(clean, id);
            customNodes.push({ id, label: clean });
          }
          return labelToId.get(clean)!;
        };

        lines.forEach((line, idx) => {
          const parts = line.split(/[,\t;]+/).map(s => s.trim());
          if (idx === 0 && parts[0].toLowerCase() === 'source' && parts[1]?.toLowerCase() === 'target') {
            return;
          }
          if (parts.length < 2) {
            throw new Error(`Row ${idx + 1}: expected "source, target" (optional weight).`);
          }
          const u = getOrCreateId(parts[0]);
          const v = getOrCreateId(parts[1]);
          const weight = parts[2] ? Number(parts[2]) : 1.0;
          if (Number.isNaN(weight)) {
            throw new Error(`Row ${idx + 1}: invalid numeric weight "${parts[2]}".`);
          }
          customEdges.push({ u, v, weight });
        });

        if (customNodes.length === 0) {
          throw new Error('No vertices parsed from input.');
        }

        graph.importCustomGraph(customNodes, customEdges);
      } else {
        const parsed = JSON.parse(rawText);
        if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
          throw new Error('JSON must contain "nodes" and "edges" arrays.');
        }

        const idRemap = new Map<number, number>();
        const customNodes = parsed.nodes.map((n: { id: number | string; label?: string }, i: number) => {
          const origId = typeof n.id === 'number' ? n.id : i;
          idRemap.set(origId, i);
          return { id: i, label: String(n.label ?? `N${origId}`) };
        });

        const customEdges = parsed.edges.map((e: { u: number; v: number; weight?: number }) => ({
          u: idRemap.get(e.u) ?? e.u,
          v: idRemap.get(e.v) ?? e.v,
          weight: typeof e.weight === 'number' ? e.weight : 1.0,
        }));

        graph.importCustomGraph(customNodes, customEdges);
      }

      onImported();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to parse network input.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-graph-title"
    >
      <div className="w-full max-w-2xl bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="import-graph-title" className="text-base font-semibold text-slate-900">
              Import Network Dataset
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Load a curated dataset, paste edge lists, or upload CSV / JSON from disk.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close import dialog"
            className="p-2 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Curated Presets */}
          <div>
            <div className="text-xs font-medium text-slate-700 mb-2.5">Sample Datasets</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {SAMPLE_DATASETS.map(preset => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleLoadPreset(preset)}
                  className="text-left p-2.5 rounded-lg border border-slate-200 bg-slate-50 hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
                >
                  <div className="text-xs font-semibold text-slate-900 truncate">{preset.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">{preset.subtitle}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Format + File Upload */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setFormat('csv')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  format === 'csv'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                CSV Edge List
              </button>
              <button
                type="button"
                onClick={() => setFormat('json')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  format === 'json'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                JSON Schema
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt,.json"
              onChange={handleFileUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload File</span>
            </button>
          </div>

          {/* Code Editor Textarea */}
          <div>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              rows={9}
              spellCheck={false}
              aria-label="Graph data input"
              className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:bg-white rounded-lg p-3.5 text-xs font-mono text-slate-800 leading-relaxed focus:outline-none resize-y"
              placeholder={
                format === 'csv'
                  ? 'Source, Target, Weight\nJFK, LHR, 3450'
                  : '{\n  "nodes": [{"id": 0, "label": "A"}],\n  "edges": [{"u": 0, "v": 1, "weight": 1}]\n}'
              }
            />
            <div className="text-[11px] text-slate-500 mt-1.5 font-mono">
              {format === 'csv'
                ? 'Format: source, target, weight (header optional, weight defaults to 1.0)'
                : 'Format: { "nodes": [{ "id", "label" }], "edges": [{ "u", "v", "weight" }] }'}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleIngest}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Load Network</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
