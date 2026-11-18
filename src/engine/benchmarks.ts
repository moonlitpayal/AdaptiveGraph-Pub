/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  AdjacencyListGraph,
  AdjacencyMatrixGraph,
  CSRGraph,
  DynamicCSRGraph,
  HybridHubGraph,
  IGraphRepresentation,
} from './AdaptiveGraph';
import { BenchmarkMetrics, GraphEdge } from './types';

function measureBfsSweep(rep: IGraphRepresentation, vertexCount: number, rounds: number): number {
  let visitedCount = 0;
  const t0 = performance.now();
  for (let r = 0; r < rounds; r++) {
    const start = (r * 17) % Math.max(1, vertexCount);
    const visited = new Uint8Array(vertexCount);
    const queue = [start];
    visited[start] = 1;
    let head = 0;
    while (head < queue.length) {
      const u = queue[head++];
      visitedCount++;
      const neighbors = rep.getNeighbors(u);
      for (let i = 0; i < neighbors.length; i++) {
        const v = neighbors[i].v;
        if (v < vertexCount && !visited[v]) {
          visited[v] = 1;
          queue.push(v);
        }
      }
    }
  }
  const elapsed = Math.max(0.01, performance.now() - t0);
  if (visitedCount === -1) console.log(visitedCount);
  return elapsed;
}

export class BenchmarkSuite {
  public static runFullComparison(
    vertexCount: number = 250,
    edgeDensity: number = 0.15,
    queryLookups: number = 35000,
    neighborSweeps: number = 15000,
    insertBatchSize: number = 200
  ): BenchmarkMetrics[] {
    const maxPossible = (vertexCount * (vertexCount - 1)) / 2;
    const targetEdges = Math.floor(maxPossible * edgeDensity);
    const edges: GraphEdge[] = [];
    const edgeSet = new Set<string>();

    while (edges.length < targetEdges * 2) {
      const u = Math.floor(Math.random() * vertexCount);
      const v = Math.floor(Math.random() * vertexCount);
      if (u !== v) {
        const key = `${Math.min(u, v)}-${Math.max(u, v)}`;
        if (!edgeSet.has(key)) {
          edgeSet.add(key);
          edges.push({ u, v, weight: 1.0 });
          edges.push({ u: v, v: u, weight: 1.0 });
        }
      }
    }

    const lookupProbes: [number, number][] = [];
    for (let i = 0; i < queryLookups; i++) {
      lookupProbes.push([
        Math.floor(Math.random() * vertexCount),
        Math.floor(Math.random() * vertexCount),
      ]);
    }

    const insertProbes: [number, number][] = [];
    for (let i = 0; i < insertBatchSize; i++) {
      const u = Math.floor(Math.random() * vertexCount);
      const v = (u + 1 + Math.floor(Math.random() * Math.max(1, vertexCount - 2))) % vertexCount;
      insertProbes.push([u, v]);
    }

    const bfsRounds = Math.max(4, Math.min(20, Math.round(2500 / Math.max(40, vertexCount))));

    const profileRep = (
      label: string,
      createRep: () => IGraphRepresentation
    ): BenchmarkMetrics => {
      const rep = createRep();
      let sink = 0;

      const tLook0 = performance.now();
      for (let i = 0; i < queryLookups; i++) {
        if (rep.hasEdge(lookupProbes[i][0], lookupProbes[i][1])) sink++;
      }
      const lookupMs = Math.max(0.01, performance.now() - tLook0);

      const tTrav0 = performance.now();
      for (let i = 0; i < neighborSweeps; i++) {
        sink += rep.getNeighbors(i % vertexCount).length;
      }
      const travMs = Math.max(0.01, performance.now() - tTrav0);

      const algoMs = measureBfsSweep(rep, vertexCount, bfsRounds);
      const memBytes = rep.getMemoryFootprint(vertexCount);

      // Measure actual dynamic batch edge insertions on a fresh clone
      const mutRep = rep.clone(vertexCount);
      const tIns0 = performance.now();
      for (let i = 0; i < insertBatchSize; i++) {
        mutRep.addEdge(insertProbes[i][0], insertProbes[i][1], 1.0);
      }
      const insMs = Math.max(0.01, performance.now() - tIns0);

      if (sink === -1) console.log(sink);

      const totalOps = queryLookups + neighborSweeps + insertBatchSize;
      const totalSec = (lookupMs + travMs + insMs) / 1000;
      const throughputKopsSec = Math.round(totalOps / Math.max(0.0001, totalSec) / 1000);

      return {
        representation: label,
        edgeLookupTimeMs: Number(lookupMs.toFixed(2)),
        neighborTraversalTimeMs: Number(travMs.toFixed(2)),
        edgeInsertionTimeMs: Number(insMs.toFixed(2)),
        algorithmRunTimeMs: Number(algoMs.toFixed(2)),
        memoryBytes: memBytes,
        throughputKopsSec,
      };
    };

    const listMetrics = profileRep('Adjacency List', () => new AdjacencyListGraph(edges, vertexCount));
    const matrixMetrics = profileRep('Adjacency Matrix', () => new AdjacencyMatrixGraph(edges, vertexCount));
    const csrMetrics = profileRep('Static CSR', () => new CSRGraph(edges, vertexCount));
    const dynMetrics = profileRep('Dynamic CSR (LSM)', () => new DynamicCSRGraph(edges, vertexCount));
    const hybridMetrics = profileRep('Hybrid Hub-Partition', () => new HybridHubGraph(edges, vertexCount));

    // AdaptiveGraph selects Matrix for high density, Dynamic CSR / List for sparse
    const adaptiveRepFactory =
      edgeDensity >= 0.16
        ? () => new AdjacencyMatrixGraph(edges, vertexCount)
        : () => new DynamicCSRGraph(edges, vertexCount);

    const adaptiveMetrics = profileRep('AdaptiveGraph (Policy)', adaptiveRepFactory);

    return [
      listMetrics,
      matrixMetrics,
      csrMetrics,
      dynMetrics,
      hybridMetrics,
      adaptiveMetrics,
    ];
  }
}
