/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Upload } from 'lucide-react';

export type AppTab = 'explorer' | 'memory' | 'workloads' | 'benchmarks';

interface TopBarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  onOpenImport: () => void;
}

const NAV_ITEMS: { id: AppTab; label: string }[] = [
  { id: 'explorer', label: 'Explorer' },
  { id: 'memory', label: 'Memory Layout' },
  { id: 'workloads', label: 'Workloads' },
  { id: 'benchmarks', label: 'Benchmarks' },
];

export const TopBar: React.FC<TopBarProps> = ({ activeTab, setActiveTab, onOpenImport }) => {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => setActiveTab('explorer')}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 hover:text-blue-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          AdaptiveGraph
        </button>

        {/* Zone 2: Primary Navigation Links */}
        <nav className="flex items-center gap-5 sm:gap-7 overflow-x-auto" aria-label="Primary">
          {NAV_ITEMS.map(item => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`relative py-4 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:text-blue-600 ${
                  active
                    ? 'text-slate-900 font-semibold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {item.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-600"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Single Primary Action */}
        <div className="shrink-0">
          <button
            type="button"
            onClick={onOpenImport}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Import Graph</span>
          </button>
        </div>
      </div>
    </header>
  );
};
