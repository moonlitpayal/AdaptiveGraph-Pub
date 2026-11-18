/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AdaptiveGraph } from './AdaptiveGraph';
import { AlgorithmResult } from './types';

export class GraphAlgorithms {
  public static runDijkstra(graph: AdaptiveGraph, startNode: number): AlgorithmResult {
    const startTime = performance.now();
    const nodes = graph.getNodes();
    if (nodes.length === 0) {
      return {
        algorithm: 'DIJKSTRA',
        runtimeMs: 0,
        representationUsed: graph.getActiveRepresentationType(),
        operationsCount: 0,
        summary: 'Graph is empty.',
      };
    }

    const dist: Record<number, number> = {};
    const prev: Record<number, number | null> = {};
    const unvisited = new Set<number>();
    let ops = 0;

    for (const node of nodes) {
      dist[node.id] = node.id === startNode ? 0 : Infinity;
      prev[node.id] = null;
      unvisited.add(node.id);
    }

    const visitedOrder: number[] = [];
    const visitedEdges: { u: number; v: number }[] = [];

    while (unvisited.size > 0) {
      ops++;
      let current: number | null = null;
      let minDist = Infinity;

      for (const u of unvisited) {
        if (dist[u] < minDist) {
          minDist = dist[u];
          current = u;
        }
      }

      if (current === null || minDist === Infinity) break;

      unvisited.delete(current);
      visitedOrder.push(current);

      const neighbors = graph.getNeighbors(current);
      for (const { v, weight } of neighbors) {
        ops++;
        if (unvisited.has(v)) {
          const alt = dist[current] + weight;
          if (alt < dist[v]) {
            dist[v] = alt;
            prev[v] = current;
            visitedEdges.push({ u: current, v });
          }
        }
      }
    }

    const elapsed = performance.now() - startTime;
    return {
      algorithm: 'DIJKSTRA',
      runtimeMs: Number(elapsed.toFixed(3)),
      representationUsed: graph.getActiveRepresentationType(),
      operationsCount: ops,
      traversalOrder: visitedOrder,
      visitedEdges,
      summary: `Shortest paths from N${startNode} reached ${visitedOrder.length} vertices in ${elapsed.toFixed(3)} ms (${ops} relaxations).`,
      details: { dist, prev },
    };
  }

  public static runBFS(graph: AdaptiveGraph, startNode: number): AlgorithmResult {
    const startTime = performance.now();
    const visited = new Set<number>();
    const queue: number[] = [startNode];
    const order: number[] = [];
    const edges: { u: number; v: number }[] = [];
    let ops = 0;

    visited.add(startNode);

    while (queue.length > 0) {
      ops++;
      const u = queue.shift()!;
      order.push(u);

      const neighbors = graph.getNeighbors(u);
      for (const { v } of neighbors) {
        ops++;
        if (!visited.has(v)) {
          visited.add(v);
          queue.push(v);
          edges.push({ u, v });
        }
      }
    }

    const elapsed = performance.now() - startTime;
    return {
      algorithm: 'BFS',
      runtimeMs: Number(elapsed.toFixed(3)),
      representationUsed: graph.getActiveRepresentationType(),
      operationsCount: ops,
      traversalOrder: order,
      visitedEdges: edges,
      summary: `BFS discovered ${order.length} reachable vertices in ${elapsed.toFixed(3)} ms (${ops} checks).`,
    };
  }

  public static runDFS(graph: AdaptiveGraph, startNode: number): AlgorithmResult {
    const startTime = performance.now();
    const visited = new Set<number>();
    const order: number[] = [];
    const edges: { u: number; v: number }[] = [];
    let ops = 0;

    const dfs = (u: number) => {
      visited.add(u);
      order.push(u);
      ops++;

      const neighbors = graph.getNeighbors(u);
      for (const { v } of neighbors) {
        ops++;
        if (!visited.has(v)) {
          edges.push({ u, v });
          dfs(v);
        }
      }
    };

    dfs(startNode);
    const elapsed = performance.now() - startTime;
    return {
      algorithm: 'DFS',
      runtimeMs: Number(elapsed.toFixed(3)),
      representationUsed: graph.getActiveRepresentationType(),
      operationsCount: ops,
      traversalOrder: order,
      visitedEdges: edges,
      summary: `DFS traversed ${order.length} vertices depth-first in ${elapsed.toFixed(3)} ms (${ops} checks).`,
    };
  }

  public static runPageRank(
    graph: AdaptiveGraph,
    iterations: number = 20,
    damping: number = 0.85
  ): AlgorithmResult {
    const startTime = performance.now();
    const nodes = graph.getNodes();
    const N = nodes.length;
    if (N === 0) {
      return {
        algorithm: 'PAGERANK',
        runtimeMs: 0,
        representationUsed: graph.getActiveRepresentationType(),
        operationsCount: 0,
        summary: 'Graph is empty.',
      };
    }

    const ranks: Record<number, number> = {};
    const newRanks: Record<number, number> = {};
    const nodeIds = nodes.map(n => n.id);
    const initialRank = 1.0 / N;
    let ops = 0;

    for (const id of nodeIds) {
      ranks[id] = initialRank;
    }

    for (let iter = 0; iter < iterations; iter++) {
      const baseRank = (1 - damping) / N;
      for (const id of nodeIds) {
        newRanks[id] = baseRank;
      }

      for (const u of nodeIds) {
        const neighbors = graph.getNeighbors(u);
        const outDeg = neighbors.length;
        ops += outDeg;

        if (outDeg > 0) {
          const share = (damping * ranks[u]) / outDeg;
          for (const { v } of neighbors) {
            newRanks[v] = (newRanks[v] || 0) + share;
          }
        } else {
          const share = (damping * ranks[u]) / N;
          for (const v of nodeIds) {
            newRanks[v] = (newRanks[v] || 0) + share;
          }
        }
      }

      for (const id of nodeIds) {
        ranks[id] = newRanks[id];
      }
    }

    const elapsed = performance.now() - startTime;
    const sorted = [...nodeIds].sort((a, b) => (ranks[b] || 0) - (ranks[a] || 0));
    const topNode = sorted[0];
    const topRank = ranks[topNode] || 0;

    return {
      algorithm: 'PAGERANK',
      runtimeMs: Number(elapsed.toFixed(3)),
      representationUsed: graph.getActiveRepresentationType(),
      operationsCount: ops,
      traversalOrder: sorted.slice(0, 6),
      summary: `PageRank converged in ${iterations} iterations (${ops} transfers). Top node: N${topNode} (${(topRank * 100).toFixed(1)}%).`,
      details: { ranks },
    };
  }

  public static runTriangleCounting(graph: AdaptiveGraph): AlgorithmResult {
    const startTime = performance.now();
    const nodes = graph.getNodes();
    const N = nodes.length;
    let triangleCount = 0;
    let ops = 0;
    const triangleNodes = new Set<number>();

    for (let i = 0; i < N; i++) {
      const u = nodes[i].id;
      const uNeighbors = new Set(graph.getNeighbors(u).map(n => n.v));
      ops += uNeighbors.size;

      for (let j = i + 1; j < N; j++) {
        const v = nodes[j].id;
        if (uNeighbors.has(v)) {
          const vNeighbors = graph.getNeighbors(v);
          for (const { v: w } of vNeighbors) {
            ops++;
            if (w > v && uNeighbors.has(w)) {
              triangleCount++;
              triangleNodes.add(u);
              triangleNodes.add(v);
              triangleNodes.add(w);
            }
          }
        }
      }
    }

    const elapsed = performance.now() - startTime;
    return {
      algorithm: 'TRIANGLES',
      runtimeMs: Number(elapsed.toFixed(3)),
      representationUsed: graph.getActiveRepresentationType(),
      operationsCount: ops,
      traversalOrder: Array.from(triangleNodes),
      summary: `Found ${triangleCount} closed triangles in ${elapsed.toFixed(3)} ms (${ops} intersections).`,
      details: { triangleCount },
    };
  }

  public static runPrimMST(graph: AdaptiveGraph): AlgorithmResult {
    const startTime = performance.now();
    const nodes = graph.getNodes();
    if (nodes.length === 0) {
      return {
        algorithm: 'PRIM_MST',
        runtimeMs: 0,
        representationUsed: graph.getActiveRepresentationType(),
        operationsCount: 0,
        summary: 'Graph is empty.',
      };
    }

    const inMST = new Set<number>();
    const start = nodes[0].id;
    inMST.add(start);

    const mstEdges: { u: number; v: number }[] = [];
    const order: number[] = [start];
    let totalWeight = 0;
    let ops = 0;

    while (inMST.size < nodes.length) {
      let minWeight = Infinity;
      let bestEdge: { u: number; v: number; weight: number } | null = null;

      for (const u of inMST) {
        const neighbors = graph.getNeighbors(u);
        for (const { v, weight } of neighbors) {
          ops++;
          if (!inMST.has(v) && weight < minWeight) {
            minWeight = weight;
            bestEdge = { u, v, weight };
          }
        }
      }

      if (!bestEdge) break;
      inMST.add(bestEdge.v);
      order.push(bestEdge.v);
      mstEdges.push({ u: bestEdge.u, v: bestEdge.v });
      totalWeight += bestEdge.weight;
    }

    const elapsed = performance.now() - startTime;
    return {
      algorithm: 'PRIM_MST',
      runtimeMs: Number(elapsed.toFixed(3)),
      representationUsed: graph.getActiveRepresentationType(),
      operationsCount: ops,
      traversalOrder: order,
      visitedEdges: mstEdges,
      summary: `Prim's MST spanned ${inMST.size} vertices with ${mstEdges.length} edges (weight: ${totalWeight.toFixed(1)}) in ${elapsed.toFixed(3)} ms.`,
      details: { totalWeight },
    };
  }

  public static computeTopologyAnalytics(graph: AdaptiveGraph): {
    connectedComponents: number;
    averageDegree: number;
    maxDegree: { id: number; label: string; degree: number };
    clusteringCoefficient: number;
    trianglesCount: number;
  } {
    const nodes = graph.getNodes();
    const V = nodes.length;
    if (V === 0) {
      return {
        connectedComponents: 0,
        averageDegree: 0,
        maxDegree: { id: 0, label: 'None', degree: 0 },
        clusteringCoefficient: 0,
        trianglesCount: 0,
      };
    }

    const visited = new Set<number>();
    let components = 0;
    const adjMap = new Map<number, number[]>();
    const rep = graph.getActiveRepresentation();

    for (const node of nodes) {
      adjMap.set(
        node.id,
        rep.getNeighbors(node.id).map(n => n.v)
      );
    }

    for (const node of nodes) {
      if (!visited.has(node.id)) {
        components++;
        const queue: number[] = [node.id];
        visited.add(node.id);
        while (queue.length > 0) {
          const curr = queue.shift()!;
          for (const v of adjMap.get(curr) || []) {
            if (!visited.has(v)) {
              visited.add(v);
              queue.push(v);
            }
          }
        }
      }
    }

    let totalDeg = 0;
    let maxDegNode = { id: nodes[0].id, label: nodes[0].label, degree: 0 };
    for (const node of nodes) {
      const deg = (adjMap.get(node.id) || []).length;
      totalDeg += deg;
      if (deg > maxDegNode.degree) {
        maxDegNode = { id: node.id, label: node.label, degree: deg };
      }
    }
    const averageDegree = Number((totalDeg / V).toFixed(2));

    let triangles = 0;
    let triads = 0;
    for (let i = 0; i < V; i++) {
      const u = nodes[i].id;
      const uNbrs = new Set(adjMap.get(u) || []);
      const k = uNbrs.size;
      if (k >= 2) triads += (k * (k - 1)) / 2;
      for (let j = i + 1; j < V; j++) {
        const v = nodes[j].id;
        if (uNbrs.has(v)) {
          for (const w of adjMap.get(v) || []) {
            if (w > v && uNbrs.has(w)) {
              triangles++;
            }
          }
        }
      }
    }

    const clusteringCoefficient = triads > 0 ? Number(((3 * triangles) / triads).toFixed(3)) : 0;

    return {
      connectedComponents: components,
      averageDegree,
      maxDegree: maxDegNode,
      clusteringCoefficient,
      trianglesCount: triangles,
    };
  }
}
