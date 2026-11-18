import { describe, expect, it } from 'vitest';
import {
  AdaptiveGraph,
  AdjacencyListGraph,
  AdjacencyMatrixGraph,
  CSRGraph,
  DynamicCSRGraph,
  HybridHubGraph,
  IGraphRepresentation,
} from '../AdaptiveGraph';
import { GraphAlgorithms } from '../algorithms';
import { BenchmarkSuite } from '../benchmarks';
import { GraphEdge } from '../types';

function sortNeighbors(list: { v: number; weight: number }[]) {
  return [...list].sort((a, b) => a.v - b.v);
}

describe('AdaptiveGraph 5-Representation Equivalence & Invariants', () => {
  const V = 14;
  const seedEdges: GraphEdge[] = [
    { u: 0, v: 1, weight: 2.5 },
    { u: 0, v: 2, weight: 1.0 },
    { u: 0, v: 3, weight: 4.0 },
    { u: 0, v: 4, weight: 3.2 },
    { u: 0, v: 5, weight: 5.5 }, // Node 0 is a hub (deg >= 4)
    { u: 1, v: 2, weight: 1.5 },
    { u: 2, v: 3, weight: 2.0 },
    { u: 6, v: 7, weight: 7.0 },
    { u: 8, v: 9, weight: 2.2 },
  ];

  it('maintains identical query, weight, and neighbor results across all 5 representations', () => {
    const reps: IGraphRepresentation[] = [
      new AdjacencyListGraph(seedEdges, V),
      new AdjacencyMatrixGraph(seedEdges, V),
      new CSRGraph(seedEdges, V),
      new DynamicCSRGraph(seedEdges, V),
      new HybridHubGraph(seedEdges, V),
    ];

    // Apply identical dynamic mutations
    for (const rep of reps) {
      rep.addEdge(3, 10, 6.5);
      rep.addEdge(0, 11, 4.4);
      rep.removeEdge(6, 7);
      rep.addEdge(1, 5, 3.0);
    }

    const expectedHasEdge = (u: number, v: number) => reps[0].hasEdge(u, v);
    const expectedWeight = (u: number, v: number) => reps[0].getWeight(u, v);
    const expectedNeighbors = (u: number) => sortNeighbors(reps[0].getNeighbors(u));

    for (const rep of reps.slice(1)) {
      for (let u = 0; u < V; u++) {
        const actualNbrs = sortNeighbors(rep.getNeighbors(u));
        const expectedNbrs = expectedNeighbors(u);
        expect(actualNbrs.map(n => n.v)).toEqual(expectedNbrs.map(n => n.v));
        actualNbrs.forEach((nbr, idx) => {
          expect(nbr.weight).toBeCloseTo(expectedNbrs[idx].weight, 5);
        });
        for (let v = 0; v < V; v++) {
          expect(rep.hasEdge(u, v)).toBe(expectedHasEdge(u, v));
          const expW = expectedWeight(u, v);
          const actW = rep.getWeight(u, v);
          if (expW === null) {
            expect(actW).toBeNull();
          } else {
            expect(actW).not.toBeNull();
            expect(actW!).toBeCloseTo(expW, 5);
          }
        }
      }
    }
  });

  it('handles DynamicCSRGraph delta buffer, tombstones, and lossless flushMerge', () => {
    const dyn = new DynamicCSRGraph(seedEdges, V);
    dyn.addEdge(4, 9, 8.25);
    dyn.removeEdge(0, 2);

    expect(dyn.hasEdge(4, 9)).toBe(true);
    expect(dyn.getWeight(4, 9)).toBe(8.25);
    expect(dyn.hasEdge(0, 2)).toBe(false);
    expect(dyn.getWeight(0, 2)).toBeNull();
    expect(dyn.lsmStats.bufferedEdgesCount).toBe(1);

    dyn.flushMerge();
    expect(dyn.lsmStats.bufferedEdgesCount).toBe(0);
    expect(dyn.lsmStats.totalMergesCount).toBe(1);
    expect(dyn.hasEdge(4, 9)).toBe(true);
    expect(dyn.hasEdge(0, 2)).toBe(false);
  });

  it('preserves edges losslessly across autonomous hysteresis transitions and forced migrations', () => {
    const g = new AdaptiveGraph(false);
    for (let i = 0; i < 8; i++) {
      g.addVertex(i, `V${i}`);
    }
    g.addEdge(0, 1, 2);
    g.addEdge(1, 2, 3);
    expect(g.getActiveRepresentationType()).toBe('ADJACENCY_LIST');

    // Push density past 18% upper threshold (max edges = 28 -> need >= 6 edges)
    g.addEdge(0, 2, 1);
    g.addEdge(2, 3, 4);
    g.addEdge(3, 4, 5);
    g.addEdge(4, 5, 2);
    expect(g.getActiveRepresentationType()).toBe('ADJACENCY_MATRIX');

    // Hysteresis deadband: remove 1 edge (5/28 = 17.8%) -> stays Matrix (no ping-pong)
    g.removeEdge(4, 5);
    expect(g.getActiveRepresentationType()).toBe('ADJACENCY_MATRIX');

    // Drop below 12% lower threshold (3/28 = 10.7%) -> reverts to List
    g.removeEdge(3, 4);
    g.removeEdge(2, 3);
    expect(g.getActiveRepresentationType()).toBe('ADJACENCY_LIST');

    // Force migrate through CSR, LSM, and Hybrid verifying edge preservation
    const beforeEdges = g.getEdges().length;
    g.forceSwitch('CSR');
    expect(g.getEdges().length).toBe(beforeEdges);
    expect(g.hasEdge(0, 1)).toBe(true);

    g.forceSwitch('DYNAMIC_CSR_LSM');
    expect(g.getEdges().length).toBe(beforeEdges);
    expect(g.hasEdge(1, 2)).toBe(true);

    g.forceSwitch('HYBRID_HUB');
    expect(g.getEdges().length).toBe(beforeEdges);
    expect(g.hasEdge(0, 2)).toBe(true);
  });

  it('supports directed/undirected toggling, vertex compaction, and snapshot round-trip', () => {
    const g = new AdaptiveGraph(false);
    g.addEdge(0, 1, 5);
    g.addEdge(1, 2, 7);
    expect(g.hasEdge(1, 0)).toBe(true);

    g.setDirected(true);
    expect(g.getIsDirected()).toBe(true);
    expect(g.hasEdge(0, 1)).toBe(true);
    expect(g.hasEdge(1, 0)).toBe(false);

    // Delete vertex 0 and compact remaining IDs to 0..1
    g.removeVertex(0);
    g.compactVertexIds();
    const nodes = g.getNodes();
    expect(nodes.map(n => n.id)).toEqual([0, 1]);
    expect(g.hasEdge(0, 1)).toBe(true);

    const snap = g.serializeSnapshot();
    const g2 = new AdaptiveGraph();
    g2.loadSnapshot(snap);
    expect(g2.getIsDirected()).toBe(true);
    expect(g2.getEdges().length).toBe(1);
    expect(g2.hasEdge(0, 1)).toBe(true);
  });

  it('computes accurate algorithm invariants (Dijkstra, PageRank sum, K4 Triangles, Prim MST)', () => {
    const g = new AdaptiveGraph(false);
    // Build K4 clique with uniform weights
    for (let u = 0; u < 4; u++) {
      for (let v = u + 1; v < 4; v++) {
        g.addEdge(u, v, u + v + 1);
      }
    }

    const tri = GraphAlgorithms.runTriangleCounting(g);
    expect(tri.details?.triangleCount).toBe(4); // K4 has C(4,3) = 4 triangles

    const pr = GraphAlgorithms.runPageRank(g);
    const ranks = pr.details?.ranks as Record<number, number>;
    const rankSum = Object.values(ranks).reduce((a, b) => a + b, 0);
    expect(rankSum).toBeCloseTo(1.0, 4);

    const mst = GraphAlgorithms.runPrimMST(g);
    expect(mst.visitedEdges?.length).toBe(3);

    const dij = GraphAlgorithms.runDijkstra(g, 0);
    expect(dij.traversalOrder?.length).toBe(4);
  });

  it('calibrates policy thresholds empirically and runs full empirical benchmark suite', () => {
    const g = new AdaptiveGraph(false);
    const cal = g.calibratePolicyFromHardware();
    expect(cal.lowerThreshold).toBeGreaterThanOrEqual(0.05);
    expect(cal.upperThreshold).toBeGreaterThan(cal.lowerThreshold);

    const metrics = BenchmarkSuite.runFullComparison(60, 0.15, 2000, 1000, 50);
    expect(metrics.length).toBe(6);
    for (const m of metrics) {
      expect(m.edgeLookupTimeMs).toBeGreaterThan(0);
      expect(m.neighborTraversalTimeMs).toBeGreaterThan(0);
      expect(m.edgeInsertionTimeMs).toBeGreaterThan(0);
      expect(m.algorithmRunTimeMs).toBeGreaterThan(0);
      expect(m.throughputKopsSec).toBeGreaterThan(0);
    }
  });
});
