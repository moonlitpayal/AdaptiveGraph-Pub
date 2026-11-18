/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { REPRESENTATION_META, RepresentationType } from '../engine/types';

export interface RepVisualStyle {
  label: string;
  shortLabel: string;
  textClass: string;
  dotClass: string;
  barClass: string;
  borderClass: string;
}

export const REP_STYLES: Record<RepresentationType, RepVisualStyle> = {
  ADJACENCY_LIST: {
    label: REPRESENTATION_META.ADJACENCY_LIST.label,
    shortLabel: REPRESENTATION_META.ADJACENCY_LIST.shortLabel,
    textClass: 'text-emerald-700',
    dotClass: 'bg-emerald-600',
    barClass: 'bg-emerald-600',
    borderClass: 'border-emerald-200',
  },
  ADJACENCY_MATRIX: {
    label: REPRESENTATION_META.ADJACENCY_MATRIX.label,
    shortLabel: REPRESENTATION_META.ADJACENCY_MATRIX.shortLabel,
    textClass: 'text-amber-700',
    dotClass: 'bg-amber-600',
    barClass: 'bg-amber-600',
    borderClass: 'border-amber-200',
  },
  CSR: {
    label: REPRESENTATION_META.CSR.label,
    shortLabel: REPRESENTATION_META.CSR.shortLabel,
    textClass: 'text-blue-700',
    dotClass: 'bg-blue-600',
    barClass: 'bg-blue-600',
    borderClass: 'border-blue-200',
  },
  DYNAMIC_CSR_LSM: {
    label: REPRESENTATION_META.DYNAMIC_CSR_LSM.label,
    shortLabel: REPRESENTATION_META.DYNAMIC_CSR_LSM.shortLabel,
    textClass: 'text-violet-700',
    dotClass: 'bg-violet-600',
    barClass: 'bg-violet-600',
    borderClass: 'border-violet-200',
  },
  HYBRID_HUB: {
    label: REPRESENTATION_META.HYBRID_HUB.label,
    shortLabel: REPRESENTATION_META.HYBRID_HUB.shortLabel,
    textClass: 'text-teal-700',
    dotClass: 'bg-teal-600',
    barClass: 'bg-teal-600',
    borderClass: 'border-teal-200',
  },
};

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
