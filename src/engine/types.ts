/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type RepresentationType =
  | 'ADJACENCY_LIST'
  | 'ADJACENCY_MATRIX'
  | 'CSR'
  | 'DYNAMIC_CSR_LSM'
  | 'HYBRID_HUB';

export type DomainProfileType =
  | 'AUTONOMOUS'
  | 'FINTECH_FRAUD'
  | 'CLOUD_MESH'
  | 'SMART_CITY_ROUTING';

export interface GraphNode {
  id: number;
  label: string;
  x?: number;
  y?: number;
  isHub?: boolean;
  degree?: number;
}

export interface GraphEdge {
  u: number;
  v: number;
  weight: number;
}

export interface CSRData {
  rowPtr: Int32Array;
  colIdx: Int32Array;
  weights: Float32Array;
}

export interface LSMDeltaBufferStats {
  bufferedEdgesCount: number;
  bufferCapacity: number;
  totalMergesCount: number;
  lastMergeLatencyMs: number;
  totalReadsFromBuffer: number;
  totalReadsFromBase: number;
}

export interface HybridPartitionStats {
  hotHubCount: number;
  coldTailCount: number;
  hubThresholdDegree: number;
  hubLookupsHandledO1: number;
  coldLookupsHandledList: number;
  memorySavedVsFullMatrixPercent: number;
}

export interface RepresentationMemoryFootprint {
  type: RepresentationType;
  label: string;
  bytes: number;
  isActive: boolean;
}

export interface CalibrationResult {
  crossoverDensity: number;
  lowerThreshold: number;
  upperThreshold: number;
  probeTimeMs: number;
  listWinRatioLowDensity: number;
  matrixWinRatioHighDensity: number;
  summary: string;
}

export interface GraphSnapshot {
  isDirected: boolean;
  autoSwitchEnabled: boolean;
  activeProfile: DomainProfileType;
  hysteresisLowerThreshold: number;
  hysteresisUpperThreshold: number;
  nodes: { id: number; label: string; x?: number; y?: number }[];
  edges: GraphEdge[];
}

export interface GraphStats {
  vertexCount: number;
  edgeCount: number;
  maxPossibleEdges: number;
  density: number;
  isDirected: boolean;
  activeRepresentation: RepresentationType;
  activeProfile: DomainProfileType;
  memoryBytes: number;
  lsmStats?: LSMDeltaBufferStats;
  hybridStats?: HybridPartitionStats;
  theoreticalComplexity: {
    edgeLookup: string;
    neighborIteration: string;
    edgeInsert: string;
    edgeDelete: string;
    memorySpace: string;
  };
  telemetry: {
    totalLookups: number;
    totalInserts: number;
    totalDeletes: number;
    totalTraversals: number;
    queryToUpdateRatio: number;
    representationSwitchesCount: number;
    lastSwitchReason: string;
    hysteresisLowerThreshold: number;
    hysteresisUpperThreshold: number;
  };
}

export interface RepresentationSwitchEvent {
  id: string;
  timestamp: number;
  from: RepresentationType;
  to: RepresentationType;
  density: number;
  reason: string;
  migrationTimeMs: number;
  memoryDeltaBytes: number;
}

export type AlgorithmType =
  | 'DIJKSTRA'
  | 'BFS'
  | 'DFS'
  | 'PAGERANK'
  | 'TRIANGLES'
  | 'PRIM_MST';

export interface AlgorithmResult {
  algorithm: AlgorithmType;
  runtimeMs: number;
  representationUsed: RepresentationType;
  operationsCount: number;
  summary: string;
  details?: Record<string, unknown>;
  traversalOrder?: number[];
  visitedEdges?: { u: number; v: number }[];
}

export interface BenchmarkMetrics {
  representation: string;
  edgeLookupTimeMs: number;
  neighborTraversalTimeMs: number;
  edgeInsertionTimeMs: number;
  algorithmRunTimeMs: number;
  memoryBytes: number;
  throughputKopsSec: number;
}

export const REPRESENTATION_META: Record<
  RepresentationType,
  { label: string; shortLabel: string; description: string }
> = {
  ADJACENCY_LIST: {
    label: 'Adjacency List',
    shortLabel: 'Adj List',
    description: 'Hash-bucketed linked adjacency maps optimal for sparse topologies.',
  },
  ADJACENCY_MATRIX: {
    label: 'Adjacency Matrix',
    shortLabel: 'Matrix',
    description: 'Contiguous 2D typed float matrix delivering constant O(1) edge checks.',
  },
  CSR: {
    label: 'Compressed Sparse Row',
    shortLabel: 'Static CSR',
    description: 'Packed row_ptr and col_idx typed arrays optimized for CPU L1/L2 prefetching.',
  },
  DYNAMIC_CSR_LSM: {
    label: 'Dynamic CSR (LSM)',
    shortLabel: 'LSM-CSR',
    description: 'Packed CSR base paired with an O(1) write-ahead delta buffer and micro-merges.',
  },
  HYBRID_HUB: {
    label: 'Hybrid Hub-Partition',
    shortLabel: 'Hybrid Hub',
    description: 'Routes high-degree hubs to an O(1) flat matrix while keeping sparse tails in lists.',
  },
};
