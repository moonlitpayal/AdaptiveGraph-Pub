/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AdaptiveGraph } from './AdaptiveGraph';

export class GraphGenerators {
  public static generateSmallWorld(
    graph: AdaptiveGraph,
    n: number = 16,
    k: number = 4,
    rewireProb: number = 0.2
  ): void {
    graph.clear();
    const centerX = 360;
    const centerY = 240;
    const radius = 175;

    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      const x = Math.round(centerX + radius * Math.cos(angle));
      const y = Math.round(centerY + radius * Math.sin(angle));
      graph.addVertex(i, `N${i}`, x, y);
    }

    const halfK = Math.floor(k / 2);
    for (let i = 0; i < n; i++) {
      for (let j = 1; j <= halfK; j++) {
        let target = (i + j) % n;
        if (Math.random() < rewireProb) {
          target = Math.floor(Math.random() * n);
          if (target === i) target = (i + 1) % n;
        }
        const weight = Math.round((Math.random() * 8 + 1) * 10) / 10;
        graph.addEdge(i, target, weight);
      }
    }
    graph.resetTelemetryCounters();
  }

  public static generateScaleFree(graph: AdaptiveGraph, n: number = 20, m: number = 2): void {
    graph.clear();
    const centerX = 360;
    const centerY = 240;
    const nodeDegrees: number[] = [];

    for (let i = 0; i < m + 1; i++) {
      const angle = (2 * Math.PI * i) / (m + 1);
      graph.addVertex(
        i,
        `H${i}`,
        Math.round(centerX + 55 * Math.cos(angle)),
        Math.round(centerY + 55 * Math.sin(angle))
      );
      const node = graph.getNodes().find(nd => nd.id === i);
      if (node) node.isHub = true;
    }

    for (let i = 0; i < m + 1; i++) {
      for (let j = i + 1; j < m + 1; j++) {
        graph.addEdge(i, j, 1.5);
        nodeDegrees.push(i, j);
      }
    }

    for (let i = m + 1; i < n; i++) {
      const angle = (2 * Math.PI * (i - m - 1)) / Math.max(1, n - m - 1);
      const r = 165;
      graph.addVertex(
        i,
        `N${i}`,
        Math.round(centerX + r * Math.cos(angle)),
        Math.round(centerY + r * Math.sin(angle))
      );

      const targets = new Set<number>();
      while (targets.size < Math.min(m, nodeDegrees.length)) {
        const chosen = nodeDegrees[Math.floor(Math.random() * nodeDegrees.length)];
        if (chosen !== i) targets.add(chosen);
      }

      for (const t of targets) {
        graph.addEdge(i, t, Math.round((Math.random() * 9 + 1) * 10) / 10);
        nodeDegrees.push(i, t);
      }
    }
    graph.applyForceLayout(50);
    graph.resetTelemetryCounters();
  }

  public static generateDenseFinancialNetwork(
    graph: AdaptiveGraph,
    n: number = 14,
    edgeProb: number = 0.42
  ): void {
    graph.clear();
    const centerX = 360;
    const centerY = 240;
    const radius = 175;

    for (let i = 0; i < n; i++) {
      const angle = (2 * Math.PI * i) / n - Math.PI / 2;
      graph.addVertex(
        i,
        `B${i}`,
        Math.round(centerX + radius * Math.cos(angle)),
        Math.round(centerY + radius * Math.sin(angle))
      );
    }

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.random() < edgeProb) {
          const weight = Math.round((Math.random() * 20 + 5) * 10) / 10;
          graph.addEdge(i, j, weight);
        }
      }
    }
    graph.resetTelemetryCounters();
  }

  public static generateGridTopology(
    graph: AdaptiveGraph,
    rows: number = 4,
    cols: number = 5
  ): void {
    graph.clear();
    const startX = 140;
    const startY = 85;
    const spacingX = 110;
    const spacingY = 100;

    let id = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        graph.addVertex(id, `G${id}`, startX + c * spacingX, startY + r * spacingY);
        if (c > 0) {
          graph.addEdge(id, id - 1, Math.round((Math.random() * 4 + 2) * 10) / 10);
        }
        if (r > 0) {
          graph.addEdge(id, id - cols, Math.round((Math.random() * 4 + 2) * 10) / 10);
        }
        id++;
      }
    }
    graph.resetTelemetryCounters();
  }
}
