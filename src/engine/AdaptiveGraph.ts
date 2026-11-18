/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  CalibrationResult,
  CSRData,
  DomainProfileType,
  GraphEdge,
  GraphNode,
  GraphSnapshot,
  GraphStats,
  HybridPartitionStats,
  LSMDeltaBufferStats,
  REPRESENTATION_META,
  RepresentationMemoryFootprint,
  RepresentationSwitchEvent,
  RepresentationType,
} from './types';

export interface IGraphRepresentation {
  type: RepresentationType;
  addVertex(id: number): void;
  removeVertex(id: number): void;
  addEdge(u: number, v: number, weight?: number): void;
  removeEdge(u: number, v: number): void;
  hasEdge(u: number, v: number): boolean;
  getNeighbors(u: number): { v: number; weight: number }[];
  getWeight(u: number, v: number): number | null;
  getAllEdges(): GraphEdge[];
  getMemoryFootprint(vertexCount: number): number;
  clone(vertexCount: number): IGraphRepresentation;
}

export class AdjacencyListGraph implements IGraphRepresentation {
  public type: RepresentationType = 'ADJACENCY_LIST';
  private adj: Map<number, Map<number, number>> = new Map();

  constructor(initialEdges: GraphEdge[] = [], vertexCount: number = 0) {
    for (let i = 0; i < vertexCount; i++) {
      this.addVertex(i);
    }
    for (const e of initialEdges) {
      this.addEdge(e.u, e.v, e.weight);
    }
  }

  addVertex(id: number): void {
    if (!this.adj.has(id)) {
      this.adj.set(id, new Map());
    }
  }

  removeVertex(id: number): void {
    this.adj.delete(id);
    for (const neighbors of this.adj.values()) {
      neighbors.delete(id);
    }
  }

  addEdge(u: number, v: number, weight: number = 1.0): void {
    this.addVertex(u);
    this.addVertex(v);
    this.adj.get(u)!.set(v, weight);
  }

  removeEdge(u: number, v: number): void {
    this.adj.get(u)?.delete(v);
  }

  hasEdge(u: number, v: number): boolean {
    return this.adj.get(u)?.has(v) ?? false;
  }

  getNeighbors(u: number): { v: number; weight: number }[] {
    const map = this.adj.get(u);
    if (!map) return [];
    const result: { v: number; weight: number }[] = [];
    for (const [v, weight] of map.entries()) {
      result.push({ v, weight });
    }
    return result;
  }

  getWeight(u: number, v: number): number | null {
    return this.adj.get(u)?.get(v) ?? null;
  }

  getAllEdges(): GraphEdge[] {
    const edges: GraphEdge[] = [];
    for (const [u, map] of this.adj.entries()) {
      for (const [v, weight] of map.entries()) {
        edges.push({ u, v, weight });
      }
    }
    return edges;
  }

  getMemoryFootprint(vertexCount: number): number {
    let edgesCount = 0;
    for (const map of this.adj.values()) {
      edgesCount += map.size;
    }
    return Math.max(vertexCount, this.adj.size) * 48 + edgesCount * 32;
  }

  clone(vertexCount: number): AdjacencyListGraph {
    return new AdjacencyListGraph(this.getAllEdges(), vertexCount);
  }
}

export class AdjacencyMatrixGraph implements IGraphRepresentation {
  public type: RepresentationType = 'ADJACENCY_MATRIX';
  private matrix: Float32Array;
  private capacity: number;

  constructor(initialEdges: GraphEdge[] = [], vertexCount: number = 0) {
    let maxIdx = vertexCount - 1;
    for (const e of initialEdges) {
      maxIdx = Math.max(maxIdx, e.u, e.v);
    }
    this.capacity = Math.max(4, maxIdx + 1);
    this.matrix = new Float32Array(this.capacity * this.capacity);
    for (const e of initialEdges) {
      this.addEdge(e.u, e.v, e.weight);
    }
  }

  private ensureCapacity(id: number): void {
    if (id < this.capacity) return;
    const newCap = Math.max(id + 1, this.capacity * 2);
    const nextMatrix = new Float32Array(newCap * newCap);
    for (let r = 0; r < this.capacity; r++) {
      const oldStart = r * this.capacity;
      const newStart = r * newCap;
      nextMatrix.set(this.matrix.subarray(oldStart, oldStart + this.capacity), newStart);
    }
    this.matrix = nextMatrix;
    this.capacity = newCap;
  }

  addVertex(id: number): void {
    this.ensureCapacity(id);
  }

  removeVertex(id: number): void {
    if (id >= this.capacity) return;
    for (let i = 0; i < this.capacity; i++) {
      this.matrix[id * this.capacity + i] = 0;
      this.matrix[i * this.capacity + id] = 0;
    }
  }

  addEdge(u: number, v: number, weight: number = 1.0): void {
    this.ensureCapacity(Math.max(u, v));
    this.matrix[u * this.capacity + v] = weight === 0 ? 0.0001 : weight;
  }

  removeEdge(u: number, v: number): void {
    if (u < this.capacity && v < this.capacity) {
      this.matrix[u * this.capacity + v] = 0;
    }
  }

  hasEdge(u: number, v: number): boolean {
    if (u >= this.capacity || v >= this.capacity) return false;
    return this.matrix[u * this.capacity + v] !== 0;
  }

  getNeighbors(u: number): { v: number; weight: number }[] {
    if (u >= this.capacity) return [];
    const neighbors: { v: number; weight: number }[] = [];
    const rowOffset = u * this.capacity;
    for (let v = 0; v < this.capacity; v++) {
      const w = this.matrix[rowOffset + v];
      if (w !== 0) {
        neighbors.push({ v, weight: w });
      }
    }
    return neighbors;
  }

  getWeight(u: number, v: number): number | null {
    if (u >= this.capacity || v >= this.capacity) return null;
    const w = this.matrix[u * this.capacity + v];
    return w !== 0 ? w : null;
  }

  getAllEdges(): GraphEdge[] {
    const edges: GraphEdge[] = [];
    for (let u = 0; u < this.capacity; u++) {
      const rowOffset = u * this.capacity;
      for (let v = 0; v < this.capacity; v++) {
        const w = this.matrix[rowOffset + v];
        if (w !== 0) {
          edges.push({ u, v, weight: w });
        }
      }
    }
    return edges;
  }

  getRawMatrix(vCount: number): number[][] {
    const out: number[][] = [];
    const limit = Math.min(this.capacity, vCount);
    for (let r = 0; r < limit; r++) {
      const row: number[] = [];
      for (let c = 0; c < limit; c++) {
        row.push(this.matrix[r * this.capacity + c]);
      }
      out.push(row);
    }
    return out;
  }

  getMemoryFootprint(vertexCount: number): number {
    const dim = Math.max(vertexCount, this.capacity);
    return dim * dim * 4;
  }

  clone(vertexCount: number): AdjacencyMatrixGraph {
    return new AdjacencyMatrixGraph(this.getAllEdges(), vertexCount);
  }
}

export class CSRGraph implements IGraphRepresentation {
  public type: RepresentationType = 'CSR';
  protected rowPtr: Int32Array;
  protected colIdx: Int32Array;
  protected weights: Float32Array;
  protected vertexCount: number;
  protected edgeCount: number;

  constructor(edges: GraphEdge[] = [], vertexCount: number = 0) {
    this.vertexCount = vertexCount;
    for (const e of edges) {
      this.vertexCount = Math.max(this.vertexCount, e.u + 1, e.v + 1);
    }
    const sortedEdges = [...edges].sort((a, b) => (a.u !== b.u ? a.u - b.u : a.v - b.v));
    this.edgeCount = sortedEdges.length;

    const degrees = new Int32Array(this.vertexCount);
    for (const e of sortedEdges) {
      if (e.u < this.vertexCount) {
        degrees[e.u]++;
      }
    }

    this.rowPtr = new Int32Array(this.vertexCount + 1);
    this.rowPtr[0] = 0;
    for (let i = 0; i < this.vertexCount; i++) {
      this.rowPtr[i + 1] = this.rowPtr[i] + degrees[i];
    }

    this.colIdx = new Int32Array(this.edgeCount);
    this.weights = new Float32Array(this.edgeCount);
    const currentOffsets = new Int32Array(this.rowPtr);

    for (const e of sortedEdges) {
      const idx = currentOffsets[e.u]++;
      this.colIdx[idx] = e.v;
      this.weights[idx] = e.weight;
    }
  }

  addVertex(id: number): void {
    if (id >= this.vertexCount) {
      const edges = this.getAllEdges();
      const newG = new CSRGraph(edges, id + 1);
      this.rowPtr = newG.rowPtr;
      this.colIdx = newG.colIdx;
      this.weights = newG.weights;
      this.vertexCount = newG.vertexCount;
      this.edgeCount = newG.edgeCount;
    }
  }

  removeVertex(id: number): void {
    const edges = this.getAllEdges().filter(e => e.u !== id && e.v !== id);
    const newG = new CSRGraph(edges, this.vertexCount);
    this.rowPtr = newG.rowPtr;
    this.colIdx = newG.colIdx;
    this.weights = newG.weights;
    this.vertexCount = newG.vertexCount;
    this.edgeCount = newG.edgeCount;
  }

  addEdge(u: number, v: number, weight: number = 1.0): void {
    const edges = this.getAllEdges().filter(e => !(e.u === u && e.v === v));
    edges.push({ u, v, weight });
    const newG = new CSRGraph(edges, Math.max(this.vertexCount, u + 1, v + 1));
    this.rowPtr = newG.rowPtr;
    this.colIdx = newG.colIdx;
    this.weights = newG.weights;
    this.vertexCount = newG.vertexCount;
    this.edgeCount = newG.edgeCount;
  }

  removeEdge(u: number, v: number): void {
    const edges = this.getAllEdges().filter(e => !(e.u === u && e.v === v));
    const newG = new CSRGraph(edges, this.vertexCount);
    this.rowPtr = newG.rowPtr;
    this.colIdx = newG.colIdx;
    this.weights = newG.weights;
    this.vertexCount = newG.vertexCount;
    this.edgeCount = newG.edgeCount;
  }

  hasEdge(u: number, v: number): boolean {
    if (u >= this.vertexCount) return false;
    const start = this.rowPtr[u];
    const end = this.rowPtr[u + 1];
    let low = start;
    let high = end - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const target = this.colIdx[mid];
      if (target === v) return true;
      if (target < v) low = mid + 1;
      else high = mid - 1;
    }
    return false;
  }

  getNeighbors(u: number): { v: number; weight: number }[] {
    if (u >= this.vertexCount) return [];
    const start = this.rowPtr[u];
    const end = this.rowPtr[u + 1];
    const neighbors: { v: number; weight: number }[] = [];
    for (let i = start; i < end; i++) {
      neighbors.push({ v: this.colIdx[i], weight: this.weights[i] });
    }
    return neighbors;
  }

  getWeight(u: number, v: number): number | null {
    if (u >= this.vertexCount) return null;
    const start = this.rowPtr[u];
    const end = this.rowPtr[u + 1];
    let low = start;
    let high = end - 1;
    while (low <= high) {
      const mid = (low + high) >> 1;
      const target = this.colIdx[mid];
      if (target === v) return this.weights[mid];
      if (target < v) low = mid + 1;
      else high = mid - 1;
    }
    return null;
  }

  getAllEdges(): GraphEdge[] {
    const edges: GraphEdge[] = [];
    for (let u = 0; u < this.vertexCount; u++) {
      const start = this.rowPtr[u];
      const end = this.rowPtr[u + 1];
      for (let i = start; i < end; i++) {
        edges.push({ u, v: this.colIdx[i], weight: this.weights[i] });
      }
    }
    return edges;
  }

  getCSRData(): CSRData {
    return {
      rowPtr: this.rowPtr,
      colIdx: this.colIdx,
      weights: this.weights,
    };
  }

  getMemoryFootprint(_vertexCount: number): number {
    return (this.vertexCount + 1) * 4 + this.edgeCount * 8;
  }

  clone(vertexCount: number): CSRGraph {
    return new CSRGraph(this.getAllEdges(), Math.max(this.vertexCount, vertexCount));
  }
}

export class DynamicCSRGraph implements IGraphRepresentation {
  public type: RepresentationType = 'DYNAMIC_CSR_LSM';
  private baseCSR: CSRGraph;
  private deltaBuffer: Map<string, GraphEdge> = new Map();
  private tombstoneSet: Set<string> = new Set();
  private bufferCapacity: number = 24;
  private vertexCount: number = 0;

  public lsmStats: LSMDeltaBufferStats = {
    bufferedEdgesCount: 0,
    bufferCapacity: 24,
    totalMergesCount: 0,
    lastMergeLatencyMs: 0,
    totalReadsFromBuffer: 0,
    totalReadsFromBase: 0,
  };

  constructor(initialEdges: GraphEdge[] = [], vertexCount: number = 0) {
    let maxIdx = vertexCount - 1;
    for (const e of initialEdges) {
      maxIdx = Math.max(maxIdx, e.u, e.v);
    }
    this.vertexCount = Math.max(0, maxIdx + 1);
    this.baseCSR = new CSRGraph(initialEdges, this.vertexCount);
  }

  public getBufferedEdges(): GraphEdge[] {
    return Array.from(this.deltaBuffer.values());
  }

  public getTombstones(): string[] {
    return Array.from(this.tombstoneSet);
  }

  public getBaseCSR(): CSRGraph {
    return this.baseCSR;
  }

  private edgeKey(u: number, v: number): string {
    return `${u}->${v}`;
  }

  addVertex(id: number): void {
    this.vertexCount = Math.max(this.vertexCount, id + 1);
  }

  removeVertex(id: number): void {
    this.flushMerge();
    this.baseCSR.removeVertex(id);
  }

  addEdge(u: number, v: number, weight: number = 1.0): void {
    this.addVertex(Math.max(u, v));
    const key = this.edgeKey(u, v);
    this.tombstoneSet.delete(key);
    this.deltaBuffer.set(key, { u, v, weight });
    this.lsmStats.bufferedEdgesCount = this.deltaBuffer.size;

    if (this.deltaBuffer.size >= this.bufferCapacity) {
      this.flushMerge();
    }
  }

  removeEdge(u: number, v: number): void {
    const key = this.edgeKey(u, v);
    this.deltaBuffer.delete(key);
    this.tombstoneSet.add(key);
    this.lsmStats.bufferedEdgesCount = this.deltaBuffer.size;
  }

  hasEdge(u: number, v: number): boolean {
    const key = this.edgeKey(u, v);
    if (this.tombstoneSet.has(key)) return false;
    if (this.deltaBuffer.has(key)) {
      this.lsmStats.totalReadsFromBuffer++;
      return true;
    }
    this.lsmStats.totalReadsFromBase++;
    return this.baseCSR.hasEdge(u, v);
  }

  getNeighbors(u: number): { v: number; weight: number }[] {
    const map = new Map<number, number>();
    const baseNeighbors = this.baseCSR.getNeighbors(u);
    for (const n of baseNeighbors) {
      const key = this.edgeKey(u, n.v);
      if (!this.tombstoneSet.has(key)) {
        map.set(n.v, n.weight);
      }
    }
    for (const e of this.deltaBuffer.values()) {
      if (e.u === u) {
        map.set(e.v, e.weight);
      }
    }
    const result: { v: number; weight: number }[] = [];
    for (const [v, weight] of map.entries()) {
      result.push({ v, weight });
    }
    return result;
  }

  getWeight(u: number, v: number): number | null {
    const key = this.edgeKey(u, v);
    if (this.tombstoneSet.has(key)) return null;
    if (this.deltaBuffer.has(key)) {
      return this.deltaBuffer.get(key)!.weight;
    }
    return this.baseCSR.getWeight(u, v);
  }

  public flushMerge(): void {
    if (this.deltaBuffer.size === 0 && this.tombstoneSet.size === 0) return;
    const start = performance.now();
    const all = this.getAllEdges();
    this.baseCSR = new CSRGraph(all, this.vertexCount);
    this.deltaBuffer.clear();
    this.tombstoneSet.clear();
    const elapsed = performance.now() - start;

    this.lsmStats.totalMergesCount++;
    this.lsmStats.bufferedEdgesCount = 0;
    this.lsmStats.lastMergeLatencyMs = Number(elapsed.toFixed(3));
  }

  getAllEdges(): GraphEdge[] {
    const edgeMap = new Map<string, GraphEdge>();
    for (const e of this.baseCSR.getAllEdges()) {
      const key = this.edgeKey(e.u, e.v);
      if (!this.tombstoneSet.has(key)) {
        edgeMap.set(key, e);
      }
    }
    for (const e of this.deltaBuffer.values()) {
      edgeMap.set(this.edgeKey(e.u, e.v), e);
    }
    return Array.from(edgeMap.values());
  }

  getMemoryFootprint(vertexCount: number): number {
    const baseMem = this.baseCSR.getMemoryFootprint(vertexCount);
    const bufferMem = this.deltaBuffer.size * 32 + this.tombstoneSet.size * 24;
    return baseMem + bufferMem;
  }

  clone(vertexCount: number): DynamicCSRGraph {
    return new DynamicCSRGraph(this.getAllEdges(), Math.max(this.vertexCount, vertexCount));
  }
}

export class HybridHubGraph implements IGraphRepresentation {
  public type: RepresentationType = 'HYBRID_HUB';
  private hubSet: Set<number> = new Set();
  private hubMatrix: Float32Array;
  private hubCapacity: number;
  private coldList: AdjacencyListGraph;
  private hubThresholdDegree: number = 4;
  private vertexCount: number = 0;

  public hybridStats: HybridPartitionStats = {
    hotHubCount: 0,
    coldTailCount: 0,
    hubThresholdDegree: 4,
    hubLookupsHandledO1: 0,
    coldLookupsHandledList: 0,
    memorySavedVsFullMatrixPercent: 0,
  };

  constructor(initialEdges: GraphEdge[] = [], vertexCount: number = 0) {
    let maxIdx = vertexCount - 1;
    for (const e of initialEdges) {
      maxIdx = Math.max(maxIdx, e.u, e.v);
    }
    this.vertexCount = Math.max(0, maxIdx + 1);
    this.hubCapacity = Math.max(16, this.vertexCount);
    this.coldList = new AdjacencyListGraph([], this.vertexCount);
    this.hubMatrix = new Float32Array(this.hubCapacity * this.hubCapacity);

    const degrees: Record<number, number> = {};
    for (const e of initialEdges) {
      degrees[e.u] = (degrees[e.u] || 0) + 1;
      degrees[e.v] = (degrees[e.v] || 0) + 1;
    }

    for (const [idStr, deg] of Object.entries(degrees)) {
      const id = Number(idStr);
      if (deg >= this.hubThresholdDegree) {
        this.hubSet.add(id);
      }
    }

    for (const e of initialEdges) {
      this.addEdge(e.u, e.v, e.weight);
    }
    this.updateStats();
  }

  private ensureHubCapacity(id: number): void {
    if (id < this.hubCapacity) return;
    const newCap = Math.max(id + 1, this.hubCapacity * 2);
    const next = new Float32Array(newCap * newCap);
    for (let r = 0; r < this.hubCapacity; r++) {
      const oldStart = r * this.hubCapacity;
      next.set(this.hubMatrix.subarray(oldStart, oldStart + this.hubCapacity), r * newCap);
    }
    this.hubMatrix = next;
    this.hubCapacity = newCap;
  }

  public getHotHubs(): number[] {
    return Array.from(this.hubSet);
  }

  private updateStats(): void {
    const totalV = Math.max(1, this.vertexCount);
    const hubs = this.hubSet.size;
    this.hybridStats.hotHubCount = hubs;
    this.hybridStats.coldTailCount = Math.max(0, totalV - hubs);
    this.hybridStats.hubThresholdDegree = this.hubThresholdDegree;

    const fullMatrixMem = totalV * totalV * 4;
    const actualMem = this.getMemoryFootprint(totalV);
    this.hybridStats.memorySavedVsFullMatrixPercent = Math.max(
      0,
      Math.round(((fullMatrixMem - actualMem) / Math.max(1, fullMatrixMem)) * 100)
    );
  }

  addVertex(id: number): void {
    this.vertexCount = Math.max(this.vertexCount, id + 1);
    this.ensureHubCapacity(id);
    this.coldList.addVertex(id);
    this.updateStats();
  }

  removeVertex(id: number): void {
    this.hubSet.delete(id);
    if (id < this.hubCapacity) {
      for (let i = 0; i < this.hubCapacity; i++) {
        this.hubMatrix[id * this.hubCapacity + i] = 0;
        this.hubMatrix[i * this.hubCapacity + id] = 0;
      }
    }
    this.coldList.removeVertex(id);
    this.updateStats();
  }

  addEdge(u: number, v: number, weight: number = 1.0): void {
    this.ensureHubCapacity(Math.max(u, v));
    this.vertexCount = Math.max(this.vertexCount, u + 1, v + 1);
    this.coldList.addEdge(u, v, weight);
    if (this.coldList.getNeighbors(u).length >= this.hubThresholdDegree && !this.hubSet.has(u)) {
      this.hubSet.add(u);
      // Backfill existing edges for newly promoted hub u into hubMatrix
      for (const nbr of this.coldList.getNeighbors(u)) {
        this.hubMatrix[u * this.hubCapacity + nbr.v] = nbr.weight === 0 ? 0.0001 : nbr.weight;
      }
    }
    if (this.hubSet.has(u) || this.hubSet.has(v)) {
      this.hubMatrix[u * this.hubCapacity + v] = weight === 0 ? 0.0001 : weight;
    }
    this.updateStats();
  }

  removeEdge(u: number, v: number): void {
    if (u < this.hubCapacity && v < this.hubCapacity) {
      this.hubMatrix[u * this.hubCapacity + v] = 0;
    }
    this.coldList.removeEdge(u, v);
    this.updateStats();
  }

  hasEdge(u: number, v: number): boolean {
    if (this.hubSet.has(u) || this.hubSet.has(v)) {
      this.hybridStats.hubLookupsHandledO1++;
      if (u < this.hubCapacity && v < this.hubCapacity) {
        return this.hubMatrix[u * this.hubCapacity + v] !== 0;
      }
    }
    this.hybridStats.coldLookupsHandledList++;
    return this.coldList.hasEdge(u, v);
  }

  getNeighbors(u: number): { v: number; weight: number }[] {
    return this.coldList.getNeighbors(u);
  }

  getWeight(u: number, v: number): number | null {
    if (this.hubSet.has(u) || this.hubSet.has(v)) {
      if (u < this.hubCapacity && v < this.hubCapacity) {
        const w = this.hubMatrix[u * this.hubCapacity + v];
        if (w !== 0) return w;
      }
    }
    return this.coldList.getWeight(u, v);
  }

  getAllEdges(): GraphEdge[] {
    return this.coldList.getAllEdges();
  }

  getMemoryFootprint(vertexCount: number): number {
    const listMem = this.coldList.getMemoryFootprint(vertexCount);
    const hubDim = Math.max(1, this.hubSet.size);
    const hubMatrixMem = hubDim * Math.max(1, vertexCount) * 4;
    return listMem + hubMatrixMem;
  }

  clone(vertexCount: number): HybridHubGraph {
    return new HybridHubGraph(this.getAllEdges(), Math.max(this.vertexCount, vertexCount));
  }
}

export class AdaptiveGraph {
  private activeRep: IGraphRepresentation;
  private nodes: Map<number, GraphNode> = new Map();
  private edgeSet: Map<string, GraphEdge> = new Map();
  private isDirected: boolean = false;
  public activeProfile: DomainProfileType = 'AUTONOMOUS';

  public autoSwitchEnabled: boolean = true;
  public hysteresisLowerThreshold: number = 0.12;
  public hysteresisUpperThreshold: number = 0.18;

  private telemetry = {
    totalLookups: 0,
    totalInserts: 0,
    totalDeletes: 0,
    totalTraversals: 0,
    representationSwitchesCount: 0,
    lastSwitchReason: 'Initialized in sparse Adjacency List mode',
  };

  private switchHistory: RepresentationSwitchEvent[] = [];
  private onStateChangeListeners: Array<() => void> = [];

  constructor(isDirected: boolean = false) {
    this.isDirected = isDirected;
    this.activeRep = new AdjacencyListGraph();
  }

  public subscribe(listener: () => void): () => void {
    this.onStateChangeListeners.push(listener);
    return () => {
      this.onStateChangeListeners = this.onStateChangeListeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    for (const listener of this.onStateChangeListeners) {
      listener();
    }
  }

  public getIsDirected(): boolean {
    return this.isDirected;
  }

  public setDirected(directed: boolean): void {
    if (this.isDirected === directed) return;
    this.isDirected = directed;

    if (!directed) {
      const deduped = new Map<string, GraphEdge>();
      for (const e of this.edgeSet.values()) {
        const key = `${Math.min(e.u, e.v)}-${Math.max(e.u, e.v)}`;
        if (!deduped.has(key)) {
          deduped.set(key, { u: Math.min(e.u, e.v), v: Math.max(e.u, e.v), weight: e.weight });
        }
      }
      this.edgeSet = deduped;
    } else {
      const dirMap = new Map<string, GraphEdge>();
      for (const e of this.edgeSet.values()) {
        dirMap.set(`${e.u}->${e.v}`, e);
      }
      this.edgeSet = dirMap;
    }

    this.rebuildActiveRepresentation();
    this.evaluateAdaptiveSwitch();
    this.notify();
  }

  private rebuildActiveRepresentation(): void {
    const V = this.maxVertexIndex() + 1;
    const repEdges = this.getRepEdges();
    switch (this.activeRep.type) {
      case 'ADJACENCY_MATRIX':
        this.activeRep = new AdjacencyMatrixGraph(repEdges, V);
        break;
      case 'CSR':
        this.activeRep = new CSRGraph(repEdges, V);
        break;
      case 'DYNAMIC_CSR_LSM':
        this.activeRep = new DynamicCSRGraph(repEdges, V);
        break;
      case 'HYBRID_HUB':
        this.activeRep = new HybridHubGraph(repEdges, V);
        break;
      case 'ADJACENCY_LIST':
      default:
        this.activeRep = new AdjacencyListGraph(repEdges, V);
        break;
    }
  }

  private maxVertexIndex(): number {
    let maxId = -1;
    for (const id of this.nodes.keys()) {
      if (id > maxId) maxId = id;
    }
    return maxId;
  }

  public compactVertexIds(): void {
    const sortedNodes = Array.from(this.nodes.values()).sort((a, b) => a.id - b.id);
    const idMap = new Map<number, number>();
    const nextNodes = new Map<number, GraphNode>();

    sortedNodes.forEach((node, idx) => {
      idMap.set(node.id, idx);
      nextNodes.set(idx, { ...node, id: idx });
    });

    const nextEdges = new Map<string, GraphEdge>();
    for (const e of this.edgeSet.values()) {
      const u = idMap.get(e.u);
      const v = idMap.get(e.v);
      if (u !== undefined && v !== undefined && u !== v) {
        const key = this.isDirected ? `${u}->${v}` : `${Math.min(u, v)}-${Math.max(u, v)}`;
        nextEdges.set(key, { u, v, weight: e.weight });
      }
    }

    this.nodes = nextNodes;
    this.edgeSet = nextEdges;
    this.rebuildActiveRepresentation();
    this.notify();
  }

  /**
   * Empirically calibrates hysteresis thresholds (θ_low, θ_high) on the active JS runtime
   * by sweeping synthetic graph densities from 5% to 40% and finding where Matrix
   * query + scan performance crosses over List memory/lookup trade-offs.
   */
  public calibratePolicyFromHardware(): CalibrationResult {
    const start = performance.now();
    const n = 120;
    const densities = [0.05, 0.1, 0.14, 0.18, 0.24, 0.32];
    const probes: [number, number][] = [];
    for (let i = 0; i < 4000; i++) {
      probes.push([Math.floor(Math.random() * n), Math.floor(Math.random() * n)]);
    }

    let crossover = 0.16;
    let lowListWinRatio = 1;
    let highMatrixWinRatio = 1;

    for (const d of densities) {
      const maxE = (n * (n - 1)) / 2;
      const target = Math.floor(maxE * d);
      const edges: GraphEdge[] = [];
      const seen = new Set<string>();
      while (edges.length < target) {
        const u = Math.floor(Math.random() * n);
        const v = Math.floor(Math.random() * n);
        if (u !== v) {
          const k = `${Math.min(u, v)}-${Math.max(u, v)}`;
          if (!seen.has(k)) {
            seen.add(k);
            edges.push({ u, v, weight: 1 });
            edges.push({ u: v, v: u, weight: 1 });
          }
        }
      }

      const list = new AdjacencyListGraph(edges, n);
      const matrix = new AdjacencyMatrixGraph(edges, n);

      let sink = 0;
      const tL0 = performance.now();
      for (const [u, v] of probes) {
        if (list.hasEdge(u, v)) sink++;
      }
      const tList = Math.max(0.01, performance.now() - tL0);

      const tM0 = performance.now();
      for (const [u, v] of probes) {
        if (matrix.hasEdge(u, v)) sink++;
      }
      const tMatrix = Math.max(0.01, performance.now() - tM0);
      if (sink === -1) console.log(sink);

      const memPenalty = matrix.getMemoryFootprint(n) / Math.max(1, list.getMemoryFootprint(n));
      const listCost = tList * 1.0;
      const matrixCost = tMatrix * Math.min(2.2, 0.7 + memPenalty * 0.08);

      if (d <= 0.06) lowListWinRatio = Number((matrixCost / listCost).toFixed(2));
      if (d >= 0.3) highMatrixWinRatio = Number((listCost / matrixCost).toFixed(2));

      if (matrixCost < listCost && crossover === 0.16) {
        crossover = d;
      }
    }

    const lower = Number(Math.max(0.06, crossover - 0.04).toFixed(2));
    const upper = Number(Math.min(0.45, crossover + 0.04).toFixed(2));
    this.activeProfile = 'AUTONOMOUS';
    this.setHysteresisThresholds(lower, upper);

    const probeTimeMs = Number((performance.now() - start).toFixed(2));
    return {
      crossoverDensity: crossover,
      lowerThreshold: lower,
      upperThreshold: upper,
      probeTimeMs,
      listWinRatioLowDensity: lowListWinRatio,
      matrixWinRatioHighDensity: highMatrixWinRatio,
      summary: `Calibrated crossover at ${(crossover * 100).toFixed(0)}% density in ${probeTimeMs} ms (band ${(lower * 100).toFixed(0)}%–${(upper * 100).toFixed(0)}%).`,
    };
  }

  public setAutoSwitch(enabled: boolean): void {
    this.autoSwitchEnabled = enabled;
    if (enabled) {
      this.evaluateAdaptiveSwitch();
    }
    this.notify();
  }

  public setHysteresisThresholds(lower: number, upper: number): void {
    const clampedLower = Math.max(0.02, Math.min(0.85, lower));
    const clampedUpper = Math.max(clampedLower + 0.02, Math.min(0.95, upper));
    this.hysteresisLowerThreshold = Number(clampedLower.toFixed(2));
    this.hysteresisUpperThreshold = Number(clampedUpper.toFixed(2));
    this.evaluateAdaptiveSwitch();
    this.notify();
  }

  public setDomainProfile(profile: DomainProfileType): void {
    this.activeProfile = profile;
    switch (profile) {
      case 'FINTECH_FRAUD':
        this.hysteresisLowerThreshold = 0.08;
        this.hysteresisUpperThreshold = 0.14;
        this.migrateRepresentation(
          'HYBRID_HUB',
          'FinTech AML profile: prioritizes Hot-Hub Bitset for rapid circular fraud checks'
        );
        break;
      case 'CLOUD_MESH':
        this.hysteresisLowerThreshold = 0.1;
        this.hysteresisUpperThreshold = 0.16;
        this.migrateRepresentation(
          'DYNAMIC_CSR_LSM',
          'Cloud Mesh profile: activates LSM Delta-Buffer for concurrent packet streaming'
        );
        break;
      case 'SMART_CITY_ROUTING':
        this.hysteresisLowerThreshold = 0.06;
        this.hysteresisUpperThreshold = 0.2;
        this.migrateRepresentation(
          'ADJACENCY_LIST',
          'Smart City profile: preserves O(V) planar memory footprint'
        );
        break;
      case 'AUTONOMOUS':
      default:
        this.hysteresisLowerThreshold = 0.12;
        this.hysteresisUpperThreshold = 0.18;
        this.evaluateAdaptiveSwitch();
        break;
    }
    this.notify();
  }

  public getActiveRepresentationType(): RepresentationType {
    return this.activeRep.type;
  }

  public getActiveRepresentation(): IGraphRepresentation {
    return this.activeRep;
  }

  public getNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  public getEdges(): GraphEdge[] {
    return Array.from(this.edgeSet.values());
  }

  public getSwitchHistory(): RepresentationSwitchEvent[] {
    return [...this.switchHistory];
  }

  public getRepresentationComparison(): RepresentationMemoryFootprint[] {
    const V = Math.max(this.nodes.size, this.maxVertexIndex() + 1);
    const edges = this.getRepEdges();
    const activeType = this.activeRep.type;

    const reps: IGraphRepresentation[] = [
      activeType === 'ADJACENCY_LIST' ? this.activeRep : new AdjacencyListGraph(edges, V),
      activeType === 'ADJACENCY_MATRIX' ? this.activeRep : new AdjacencyMatrixGraph(edges, V),
      activeType === 'CSR' ? this.activeRep : new CSRGraph(edges, V),
      activeType === 'DYNAMIC_CSR_LSM' ? this.activeRep : new DynamicCSRGraph(edges, V),
      activeType === 'HYBRID_HUB' ? this.activeRep : new HybridHubGraph(edges, V),
    ];

    return reps.map(r => ({
      type: r.type,
      label: REPRESENTATION_META[r.type].shortLabel,
      bytes: r.getMemoryFootprint(V),
      isActive: r.type === activeType,
    }));
  }

  private getRepEdges(): GraphEdge[] {
    const out: GraphEdge[] = [];
    for (const e of this.edgeSet.values()) {
      out.push(e);
      if (!this.isDirected) {
        out.push({ u: e.v, v: e.u, weight: e.weight });
      }
    }
    return out;
  }

  public getStats(): GraphStats {
    const V = this.nodes.size;
    const E = this.edgeSet.size;
    const maxEdges = this.isDirected ? V * (V - 1) : (V * (V - 1)) / 2;
    const density = maxEdges > 0 ? Math.min(1.0, E / maxEdges) : 0;
    const memory = this.activeRep.getMemoryFootprint(Math.max(V, this.maxVertexIndex() + 1));

    const queryCount = this.telemetry.totalLookups + this.telemetry.totalTraversals;
    const updateCount = Math.max(1, this.telemetry.totalInserts + this.telemetry.totalDeletes);
    const queryToUpdateRatio = queryCount / updateCount;

    let theoreticalComplexity = {
      edgeLookup: 'O(deg(u))',
      neighborIteration: 'O(deg(u))',
      edgeInsert: 'O(1) amortized',
      edgeDelete: 'O(deg(u))',
      memorySpace: 'O(V + E)',
    };

    if (this.activeRep.type === 'ADJACENCY_MATRIX') {
      theoreticalComplexity = {
        edgeLookup: 'O(1)',
        neighborIteration: 'O(V)',
        edgeInsert: 'O(1)',
        edgeDelete: 'O(1)',
        memorySpace: 'O(V²)',
      };
    } else if (this.activeRep.type === 'CSR') {
      theoreticalComplexity = {
        edgeLookup: 'O(log deg(u))',
        neighborIteration: 'O(deg(u)) packed',
        edgeInsert: 'O(E) rebuild',
        edgeDelete: 'O(E) rebuild',
        memorySpace: 'O(V + E) contiguous',
      };
    } else if (this.activeRep.type === 'DYNAMIC_CSR_LSM') {
      theoreticalComplexity = {
        edgeLookup: 'O(1) buf / O(log d)',
        neighborIteration: 'O(deg(u)) merged',
        edgeInsert: 'O(1) LSM buffer',
        edgeDelete: 'O(1) tombstone',
        memorySpace: 'O(V + E + Δ)',
      };
    } else if (this.activeRep.type === 'HYBRID_HUB') {
      theoreticalComplexity = {
        edgeLookup: 'O(1) hub / O(deg) tail',
        neighborIteration: 'O(deg(u))',
        edgeInsert: 'O(1) amortized',
        edgeDelete: 'O(1) hub / O(deg) tail',
        memorySpace: 'O(V + E + H·V)',
      };
    }

    const lsmStats =
      this.activeRep instanceof DynamicCSRGraph ? { ...this.activeRep.lsmStats } : undefined;
    const hybridStats =
      this.activeRep instanceof HybridHubGraph ? { ...this.activeRep.hybridStats } : undefined;

    return {
      vertexCount: V,
      edgeCount: E,
      maxPossibleEdges: maxEdges,
      density,
      isDirected: this.isDirected,
      activeRepresentation: this.activeRep.type,
      activeProfile: this.activeProfile,
      memoryBytes: memory,
      lsmStats,
      hybridStats,
      theoreticalComplexity,
      telemetry: {
        ...this.telemetry,
        queryToUpdateRatio,
        hysteresisLowerThreshold: this.hysteresisLowerThreshold,
        hysteresisUpperThreshold: this.hysteresisUpperThreshold,
      },
    };
  }

  public evaluateAdaptiveSwitch(): void {
    if (!this.autoSwitchEnabled || this.activeProfile !== 'AUTONOMOUS') return;
    if (this.nodes.size < 2) return;

    const stats = this.getStats();
    const currentType = this.activeRep.type;
    let targetType: RepresentationType = currentType;
    let reason = '';

    const qRatio = stats.telemetry.queryToUpdateRatio;

    if (this.telemetry.totalTraversals > 45 && qRatio >= 2.2) {
      if (currentType !== 'CSR') {
        targetType = 'CSR';
        reason = `High traversal burst (Q/U=${qRatio.toFixed(1)}): Static CSR accelerates sequential neighbor prefetching`;
      }
    } else if (this.telemetry.totalTraversals > 35 && this.telemetry.totalInserts > 12) {
      if (currentType !== 'DYNAMIC_CSR_LSM') {
        targetType = 'DYNAMIC_CSR_LSM';
        reason = 'Concurrent read traversals and write stream: Dynamic LSM-CSR buffers O(1) mutations';
      }
    } else if (stats.density >= this.hysteresisUpperThreshold) {
      if (currentType !== 'ADJACENCY_MATRIX') {
        targetType = 'ADJACENCY_MATRIX';
        reason = `Density (${(stats.density * 100).toFixed(1)}%) crossed upper bound (${(this.hysteresisUpperThreshold * 100).toFixed(0)}%): Matrix unlocks O(1) edge checks`;
      }
    } else if (stats.density <= this.hysteresisLowerThreshold) {
      if (currentType !== 'ADJACENCY_LIST') {
        targetType = 'ADJACENCY_LIST';
        reason = `Density (${(stats.density * 100).toFixed(1)}%) fell below lower bound (${(this.hysteresisLowerThreshold * 100).toFixed(0)}%): List reclaims sparse memory`;
      }
    }

    if (targetType !== currentType) {
      this.migrateRepresentation(targetType, reason);
    }
  }

  public migrateRepresentation(target: RepresentationType, reason: string): void {
    if (this.activeRep.type === target) return;

    const startTime = performance.now();
    const fromType = this.activeRep.type;
    const repEdges = this.getRepEdges();
    const V = Math.max(this.nodes.size, this.maxVertexIndex() + 1);
    const oldMemory = this.activeRep.getMemoryFootprint(V);

    let newRep: IGraphRepresentation;
    switch (target) {
      case 'ADJACENCY_MATRIX':
        newRep = new AdjacencyMatrixGraph(repEdges, V);
        break;
      case 'CSR':
        newRep = new CSRGraph(repEdges, V);
        break;
      case 'DYNAMIC_CSR_LSM':
        newRep = new DynamicCSRGraph(repEdges, V);
        break;
      case 'HYBRID_HUB':
        newRep = new HybridHubGraph(repEdges, V);
        break;
      case 'ADJACENCY_LIST':
      default:
        newRep = new AdjacencyListGraph(repEdges, V);
        break;
    }

    const elapsed = performance.now() - startTime;
    const newMemory = newRep.getMemoryFootprint(V);

    this.activeRep = newRep;
    this.telemetry.representationSwitchesCount++;
    this.telemetry.lastSwitchReason = reason;

    const switchEvent: RepresentationSwitchEvent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      from: fromType,
      to: target,
      density: this.getStats().density,
      reason,
      migrationTimeMs: Number(elapsed.toFixed(3)),
      memoryDeltaBytes: newMemory - oldMemory,
    };

    this.switchHistory.unshift(switchEvent);
    if (this.switchHistory.length > 25) {
      this.switchHistory.pop();
    }

    this.notify();
  }

  public forceSwitch(target: RepresentationType, manualReason: string = 'Manual engineer override'): void {
    this.autoSwitchEnabled = false;
    this.migrateRepresentation(target, manualReason);
    this.notify();
  }

  public flushLSMBuffer(): void {
    if (this.activeRep instanceof DynamicCSRGraph) {
      this.activeRep.flushMerge();
      this.notify();
    }
  }

  public resetTelemetryCounters(): void {
    this.telemetry.totalLookups = 0;
    this.telemetry.totalInserts = 0;
    this.telemetry.totalDeletes = 0;
    this.telemetry.totalTraversals = 0;
    this.notify();
  }

  public addVertex(id: number, label?: string, x?: number, y?: number): void {
    if (this.nodes.has(id)) return;
    this.nodes.set(id, {
      id,
      label: label ?? `N${id}`,
      x: x ?? 120 + Math.random() * 480,
      y: y ?? 90 + Math.random() * 300,
    });
    this.activeRep.addVertex(id);
    this.telemetry.totalInserts++;
    this.evaluateAdaptiveSwitch();
    this.notify();
  }

  public removeVertex(id: number): void {
    if (!this.nodes.has(id)) return;
    this.nodes.delete(id);
    for (const [key, edge] of this.edgeSet.entries()) {
      if (edge.u === id || edge.v === id) {
        this.edgeSet.delete(key);
      }
    }
    this.activeRep.removeVertex(id);
    this.telemetry.totalDeletes++;
    this.evaluateAdaptiveSwitch();
    this.notify();
  }

  public addEdge(u: number, v: number, weight: number = 1.0): void {
    if (u === v) return;
    this.addVertex(u);
    this.addVertex(v);
    const edgeKey = this.isDirected ? `${u}->${v}` : `${Math.min(u, v)}-${Math.max(u, v)}`;
    this.edgeSet.set(edgeKey, { u, v, weight });

    this.activeRep.addEdge(u, v, weight);
    if (!this.isDirected) {
      this.activeRep.addEdge(v, u, weight);
    }

    this.telemetry.totalInserts++;
    this.evaluateAdaptiveSwitch();
    this.notify();
  }

  public removeEdge(u: number, v: number): void {
    const edgeKey = this.isDirected ? `${u}->${v}` : `${Math.min(u, v)}-${Math.max(u, v)}`;
    if (this.edgeSet.has(edgeKey)) {
      this.edgeSet.delete(edgeKey);
      this.activeRep.removeEdge(u, v);
      if (!this.isDirected) {
        this.activeRep.removeEdge(v, u);
      }
      this.telemetry.totalDeletes++;
      this.evaluateAdaptiveSwitch();
      this.notify();
    }
  }

  public hasEdge(u: number, v: number): boolean {
    this.telemetry.totalLookups++;
    return this.activeRep.hasEdge(u, v);
  }

  public getNeighbors(u: number): { v: number; weight: number }[] {
    this.telemetry.totalTraversals++;
    return this.activeRep.getNeighbors(u);
  }

  public applyForceLayout(iterations: number = 60, width: number = 720, height: number = 480): void {
    const nodes = this.getNodes();
    if (nodes.length < 2) return;

    const edges = this.getEdges();
    const area = width * height;
    const k = Math.sqrt(area / nodes.length) * 0.72;
    const pad = 56;

    const pos = new Map<number, { x: number; y: number }>();
    nodes.forEach((n, idx) => {
      const angle = (2 * Math.PI * idx) / nodes.length;
      pos.set(n.id, {
        x: n.x ?? width / 2 + 160 * Math.cos(angle),
        y: n.y ?? height / 2 + 140 * Math.sin(angle),
      });
    });

    for (let iter = 0; iter < iterations; iter++) {
      const disp = new Map<number, { dx: number; dy: number }>();
      for (const n of nodes) disp.set(n.id, { dx: 0, dy: 0 });

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const u = nodes[i].id;
          const v = nodes[j].id;
          const pu = pos.get(u)!;
          const pv = pos.get(v)!;
          const dx = pu.x - pv.x;
          const dy = pu.y - pv.y;
          const dist = Math.max(1, Math.hypot(dx, dy));
          const repulse = (k * k) / dist;
          const fx = (dx / dist) * repulse;
          const fy = (dy / dist) * repulse;
          disp.get(u)!.dx += fx;
          disp.get(u)!.dy += fy;
          disp.get(v)!.dx -= fx;
          disp.get(v)!.dy -= fy;
        }
      }

      for (const e of edges) {
        const pu = pos.get(e.u);
        const pv = pos.get(e.v);
        if (!pu || !pv) continue;
        const dx = pu.x - pv.x;
        const dy = pu.y - pv.y;
        const dist = Math.max(1, Math.hypot(dx, dy));
        const attract = (dist * dist) / k;
        const fx = (dx / dist) * attract * 0.45;
        const fy = (dy / dist) * attract * 0.45;
        disp.get(e.u)!.dx -= fx;
        disp.get(e.u)!.dy -= fy;
        disp.get(e.v)!.dx += fx;
        disp.get(e.v)!.dy += fy;
      }

      const temp = Math.max(4, 38 * (1 - iter / iterations));
      for (const n of nodes) {
        const p = pos.get(n.id)!;
        const d = disp.get(n.id)!;
        const len = Math.max(1, Math.hypot(d.dx, d.dy));
        p.x = Math.min(width - pad, Math.max(pad, p.x + (d.dx / len) * Math.min(len, temp)));
        p.y = Math.min(height - pad, Math.max(pad, p.y + (d.dy / len) * Math.min(len, temp)));
      }
    }

    for (const n of nodes) {
      const p = pos.get(n.id)!;
      n.x = Math.round(p.x);
      n.y = Math.round(p.y);
    }
    this.notify();
  }

  public clear(): void {
    this.nodes.clear();
    this.edgeSet.clear();
    this.activeRep = new AdjacencyListGraph();
    this.telemetry = {
      totalLookups: 0,
      totalInserts: 0,
      totalDeletes: 0,
      totalTraversals: 0,
      representationSwitchesCount: 0,
      lastSwitchReason: 'Graph cleared — initialized in sparse Adjacency List mode',
    };
    this.switchHistory = [];
    this.notify();
  }

  public importCustomGraph(
    customNodes: { id: number; label: string; x?: number; y?: number }[],
    customEdges: { u: number; v: number; weight: number }[]
  ): void {
    this.clear();
    const n = customNodes.length;
    const centerX = 360;
    const centerY = 240;
    const radius = Math.min(185, Math.max(95, n * 9));

    for (let i = 0; i < n; i++) {
      const node = customNodes[i];
      const angle = (2 * Math.PI * i) / Math.max(1, n) - Math.PI / 2;
      const x = node.x ?? centerX + radius * Math.cos(angle);
      const y = node.y ?? centerY + radius * Math.sin(angle);
      this.nodes.set(node.id, {
        id: node.id,
        label: node.label || `N${node.id}`,
        x,
        y,
      });
      this.activeRep.addVertex(node.id);
    }

    for (const e of customEdges) {
      if (e.u === e.v) continue;
      const edgeKey = this.isDirected ? `${e.u}->${e.v}` : `${Math.min(e.u, e.v)}-${Math.max(e.u, e.v)}`;
      this.edgeSet.set(edgeKey, { u: e.u, v: e.v, weight: e.weight });
      this.activeRep.addEdge(e.u, e.v, e.weight);
      if (!this.isDirected) {
        this.activeRep.addEdge(e.v, e.u, e.weight);
      }
    }

    this.applyForceLayout(45);
    this.telemetry.lastSwitchReason = `Imported network (${customNodes.length} nodes, ${customEdges.length} edges)`;
    this.evaluateAdaptiveSwitch();
    this.notify();
  }

  public serializeSnapshot(): GraphSnapshot {
    return {
      isDirected: this.isDirected,
      autoSwitchEnabled: this.autoSwitchEnabled,
      activeProfile: this.activeProfile,
      hysteresisLowerThreshold: this.hysteresisLowerThreshold,
      hysteresisUpperThreshold: this.hysteresisUpperThreshold,
      nodes: this.getNodes().map(({ id, label, x, y }) => ({ id, label, x, y })),
      edges: this.getEdges(),
    };
  }

  public loadSnapshot(snapshot: GraphSnapshot): void {
    this.clear();
    this.isDirected = Boolean(snapshot.isDirected);
    this.autoSwitchEnabled = Boolean(snapshot.autoSwitchEnabled);
    this.activeProfile = snapshot.activeProfile || 'AUTONOMOUS';
    this.hysteresisLowerThreshold = snapshot.hysteresisLowerThreshold ?? 0.12;
    this.hysteresisUpperThreshold = snapshot.hysteresisUpperThreshold ?? 0.18;

    for (const n of snapshot.nodes) {
      this.nodes.set(n.id, { id: n.id, label: n.label, x: n.x, y: n.y });
      this.activeRep.addVertex(n.id);
    }

    for (const e of snapshot.edges) {
      if (e.u === e.v) continue;
      const edgeKey = this.isDirected ? `${e.u}->${e.v}` : `${Math.min(e.u, e.v)}-${Math.max(e.u, e.v)}`;
      this.edgeSet.set(edgeKey, { u: e.u, v: e.v, weight: e.weight });
      this.activeRep.addEdge(e.u, e.v, e.weight);
      if (!this.isDirected) {
        this.activeRep.addEdge(e.v, e.u, e.weight);
      }
    }

    this.resetTelemetryCounters();
    this.evaluateAdaptiveSwitch();
    this.notify();
  }

  public exportJSON(): string {
    return JSON.stringify(
      {
        stats: this.getStats(),
        nodes: this.getNodes().map(({ id, label, x, y }) => ({ id, label, x, y })),
        edges: this.getEdges(),
      },
      null,
      2
    );
  }

  public exportCSV(): string {
    const labelMap = new Map<number, string>();
    for (const n of this.nodes.values()) {
      labelMap.set(n.id, n.label);
    }
    const header = 'source,target,weight';
    const rows = this.getEdges().map(
      e => `${labelMap.get(e.u) ?? e.u},${labelMap.get(e.v) ?? e.v},${e.weight}`
    );
    return [header, ...rows].join('\n');
  }
}
