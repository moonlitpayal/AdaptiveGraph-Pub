/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowRight, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { AdaptiveGraph } from '../engine/AdaptiveGraph';
import {
  CalibrationResult,
  DomainProfileType,
  REPRESENTATION_META,
  RepresentationType,
} from '../engine/types';
import { formatBytes, REP_STYLES } from './repStyles';

interface EngineInspectorProps {
  graph: AdaptiveGraph;
}

const PROFILES: { id: DomainProfileType; label: string }[] = [
  { id: 'AUTONOMOUS', label: 'Autonomous' },
  { id: 'FINTECH_FRAUD', label: 'FinTech AML' },
  { id: 'CLOUD_MESH', label: 'Cloud Mesh' },
  { id: 'SMART_CITY_ROUTING', label: 'Smart City' },
];

export const EngineInspector: React.FC<EngineInspectorProps> = ({ graph }) => {
  const [calibration, setCalibration] = useState<CalibrationResult | null>(null);
  const stats = graph.getStats();
  const comparison = graph.getRepresentationComparison();
  const switchHistory = graph.getSwitchHistory();
  const repStyle = REP_STYLES[stats.activeRepresentation];
  const repMeta = REPRESENTATION_META[stats.activeRepresentation];

  const densityPct = Math.min(100, stats.density * 100);
  const lowPct = stats.telemetry.hysteresisLowerThreshold * 100;
  const highPct = stats.telemetry.hysteresisUpperThreshold * 100;

  const scalePos = (pct: number) => Math.min(100, Math.max(0, (pct / 50) * 100));
  const maxBytes = Math.max(1, ...comparison.map(c => c.bytes));

  const handleCalibrate = () => {
    const res = graph.calibratePolicyFromHardware();
    setCalibration(res);
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-200">
      {/* 1. Active Representation & Mode */}
      <div className="p-5 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-medium text-slate-500">Active Storage Engine</div>
            <div className={`text-lg font-bold tracking-tight mt-0.5 ${repStyle.textClass}`}>
              {repStyle.label}
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{repMeta.description}</p>
          </div>
          <button
            type="button"
            onClick={() => graph.setAutoSwitch(!graph.autoSwitchEnabled)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              graph.autoSwitchEnabled
                ? 'bg-blue-50 text-blue-700 border-blue-200'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900'
            }`}
          >
            {graph.autoSwitchEnabled ? 'Auto: On' : 'Auto: Paused'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-2 text-xs font-mono tabular-nums">
          <div className="flex items-baseline justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500 font-sans">Lookup</span>
            <span className="text-slate-900 font-medium">{stats.theoreticalComplexity.edgeLookup}</span>
          </div>
          <div className="flex items-baseline justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500 font-sans">Scan</span>
            <span className="text-slate-900 font-medium">{stats.theoreticalComplexity.neighborIteration}</span>
          </div>
          <div className="flex items-baseline justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500 font-sans">Insert</span>
            <span className="text-slate-900 font-medium">{stats.theoreticalComplexity.edgeInsert}</span>
          </div>
          <div className="flex items-baseline justify-between border-b border-slate-100 pb-1.5">
            <span className="text-slate-500 font-sans">Memory</span>
            <span className="text-slate-900 font-medium">{formatBytes(stats.memoryBytes)}</span>
          </div>
        </div>
      </div>

      {/* 2. Hysteresis Density Controller & Hardware Calibration */}
      <div className="p-5 space-y-3.5">
        <div className="flex items-center justify-between text-xs gap-2">
          <span className="font-medium text-slate-800">Hysteresis Density Band</span>
          <div className="flex items-center gap-2">
            <span className="font-mono tabular-nums text-slate-900 font-semibold">
              δ = {densityPct.toFixed(1)}%
            </span>
            <button
              type="button"
              onClick={handleCalibrate}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded transition-colors whitespace-nowrap"
              title="Empirically measure crossover density on this CPU/runtime"
            >
              <SlidersHorizontal className="w-3 h-3" />
              <span>Calibrate</span>
            </button>
          </div>
        </div>

        {/* Gauge Bar (0% to 50% scale) */}
        <div className="relative h-5 bg-slate-100 border border-slate-200 rounded overflow-hidden">
          <div
            className="absolute inset-y-0 bg-slate-200/80 border-x border-slate-300"
            style={{
              left: `${scalePos(lowPct)}%`,
              width: `${Math.max(2, scalePos(highPct) - scalePos(lowPct))}%`,
            }}
          />
          <div
            className={`absolute inset-y-0 left-0 opacity-25 transition-all duration-150 ${repStyle.barClass}`}
            style={{ width: `${scalePos(densityPct)}%` }}
          />
          <div
            className="absolute inset-y-0 w-0.5 bg-slate-900 transition-all duration-150"
            style={{ left: `${scalePos(densityPct)}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-slate-500">
          <span>0%</span>
          <span>θ_low {lowPct.toFixed(0)}%</span>
          <span>θ_high {highPct.toFixed(0)}%</span>
          <span>50%+</span>
        </div>

        {calibration && (
          <p className="text-[11px] text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-2 leading-relaxed">
            {calibration.summary}
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 pt-1">
          <label className="block space-y-1">
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>Lower Bound</span>
              <span className="font-mono tabular-nums text-slate-900 font-medium">
                {lowPct.toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={4}
              max={30}
              value={Math.round(lowPct)}
              onChange={e =>
                graph.setHysteresisThresholds(
                  Number(e.target.value) / 100,
                  Math.max(
                    Number(e.target.value) / 100 + 0.04,
                    stats.telemetry.hysteresisUpperThreshold
                  )
                )
              }
              className="w-full accent-blue-600 cursor-pointer"
            />
          </label>
          <label className="block space-y-1">
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>Upper Bound</span>
              <span className="font-mono tabular-nums text-slate-900 font-medium">
                {highPct.toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={8}
              max={45}
              value={Math.round(highPct)}
              onChange={e =>
                graph.setHysteresisThresholds(
                  Math.min(
                    stats.telemetry.hysteresisLowerThreshold,
                    Number(e.target.value) / 100 - 0.04
                  ),
                  Number(e.target.value) / 100
                )
              }
              className="w-full accent-blue-600 cursor-pointer"
            />
          </label>
        </div>
      </div>

      {/* 3. Domain Profile & Manual Storage Pinning */}
      <div className="p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-800">Policy Profile</span>
          <span className="text-[11px] font-mono tabular-nums text-slate-500">
            Q/U: {stats.telemetry.queryToUpdateRatio.toFixed(1)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {PROFILES.map(profile => (
            <button
              key={profile.id}
              type="button"
              onClick={() => graph.setDomainProfile(profile.id)}
              className={`px-2.5 py-1.5 text-xs font-medium rounded-lg border text-left transition-colors truncate ${
                stats.activeProfile === profile.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              {profile.label}
            </button>
          ))}
        </div>

        <div className="pt-2 space-y-2">
          <div className="text-xs font-medium text-slate-800">Live Footprint & Manual Pin</div>
          <div className="space-y-1.5">
            {comparison.map(item => {
              const style = REP_STYLES[item.type as RepresentationType];
              const pct = Math.max(6, Math.round((item.bytes / maxBytes) * 100));
              return (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => graph.forceSwitch(item.type)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg border transition-colors ${
                    item.isActive
                      ? 'bg-blue-50/60 border-blue-300'
                      : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span
                      className={
                        item.isActive ? `font-semibold ${style.textClass}` : 'text-slate-700'
                      }
                    >
                      {style.shortLabel}
                    </span>
                    <span className="font-mono tabular-nums text-slate-600">
                      {formatBytes(item.bytes)}
                    </span>
                  </div>
                  <div className="h-1 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${style.barClass} ${
                        item.isActive ? 'opacity-90' : 'opacity-45'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Migration Log */}
      <div className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-slate-800">
            Migration History ({switchHistory.length})
          </span>
          {stats.telemetry.representationSwitchesCount > 0 && (
            <button
              type="button"
              onClick={() => graph.resetTelemetryCounters()}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Counters</span>
            </button>
          )}
        </div>

        {switchHistory.length === 0 ? (
          <p className="text-xs text-slate-500 leading-relaxed">
            No migrations triggered yet. Stream edges or load a dense mesh to observe autonomous switching.
          </p>
        ) : (
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {switchHistory.slice(0, 8).map(ev => (
              <div
                key={ev.id}
                className="py-2 border-b border-slate-100 last:border-b-0 text-xs space-y-1"
              >
                <div className="flex items-center justify-between font-mono tabular-nums">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-medium ${REP_STYLES[ev.from].textClass}`}>
                      {REP_STYLES[ev.from].shortLabel}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                    <span className={`font-medium ${REP_STYLES[ev.to].textClass}`}>
                      {REP_STYLES[ev.to].shortLabel}
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    {ev.migrationTimeMs}ms · {ev.memoryDeltaBytes >= 0 ? '+' : ''}
                    {formatBytes(ev.memoryDeltaBytes)}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-snug">{ev.reason}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
