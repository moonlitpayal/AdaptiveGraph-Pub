/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AdaptiveGraph } from './AdaptiveGraph';
import { RepresentationType } from './types';

export interface ScenarioPhase {
  phaseNumber: number;
  phaseName: string;
  triggerEvent: string;
  actionSummary: string;
  expectedRepresentation: RepresentationType;
  whyOptimal: string;
  execute: (graph: AdaptiveGraph) => void;
}

export interface DynamicScenario {
  id: string;
  title: string;
  domain: string;
  challenge: string;
  adaptiveAdvantage: string;
  initialSetup: (graph: AdaptiveGraph) => void;
  phases: ScenarioPhase[];
}

function placeCircle(
  graph: AdaptiveGraph,
  items: { id: number; label: string }[],
  cx = 360,
  cy = 240,
  r = 175
) {
  items.forEach((item, idx) => {
    const angle = (2 * Math.PI * idx) / items.length - Math.PI / 2;
    graph.addVertex(
      item.id,
      item.label,
      Math.round(cx + r * Math.cos(angle)),
      Math.round(cy + r * Math.sin(angle))
    );
  });
}

export const REAL_TIME_SCENARIOS: DynamicScenario[] = [
  {
    id: 'fintech_aml',
    title: 'FinTech Anti-Money Laundering',
    domain: 'Financial Surveillance',
    challenge:
      'Payment graphs remain sparse during normal hours, then experience sudden circular micro-transfer bursts ("smurfing") across mule accounts before batch risk scoring.',
    adaptiveAdvantage:
      'Holds baseline transactions in Adjacency Lists, migrates to Matrix on density spikes for O(1) cycle checks, and switches to CSR during PageRank risk sweeps.',
    initialSetup: (graph: AdaptiveGraph) => {
      graph.clear();
      graph.setAutoSwitch(true);
      graph.activeProfile = 'AUTONOMOUS';
      const accounts = [
        { id: 0, label: 'User_412' },
        { id: 1, label: 'Payroll_HQ' },
        { id: 2, label: 'Retail_POS' },
        { id: 3, label: 'User_891' },
        { id: 4, label: 'Mule_1' },
        { id: 5, label: 'Mule_2' },
        { id: 6, label: 'Mule_3' },
        { id: 7, label: 'Mule_4' },
        { id: 8, label: 'Shell_Co' },
        { id: 9, label: 'ATM_9' },
        { id: 10, label: 'User_503' },
        { id: 11, label: 'User_607' },
      ];
      placeCircle(graph, accounts);
      graph.addEdge(1, 0, 3200);
      graph.addEdge(0, 2, 85);
      graph.addEdge(1, 3, 2900);
      graph.addEdge(3, 2, 140);
      graph.addEdge(10, 9, 200);
      graph.addEdge(11, 2, 45);
      graph.resetTelemetryCounters();
    },
    phases: [
      {
        phaseNumber: 1,
        phaseName: 'Normal Trading Stream',
        triggerEvent: 'Routine retail & payroll settlement',
        actionSummary: 'Density stays ~10%. Sparse Adjacency List keeps memory minimal.',
        expectedRepresentation: 'ADJACENCY_LIST',
        whyOptimal: 'Allocates only O(V+E) space while handling O(1) amortized edge inserts.',
        execute: (graph: AdaptiveGraph) => {
          graph.addEdge(0, 10, 50);
          graph.addEdge(3, 11, 75);
          graph.evaluateAdaptiveSwitch();
        },
      },
      {
        phaseNumber: 2,
        phaseName: 'Smurfing Attack Burst',
        triggerEvent: 'Mule ring injects dense circular transfers',
        actionSummary: 'Density surges past 18% upper threshold; engine migrates to Adjacency Matrix.',
        expectedRepresentation: 'ADJACENCY_MATRIX',
        whyOptimal: 'Unlocks O(1) constant-time edge verification for rapid cycle detection.',
        execute: (graph: AdaptiveGraph) => {
          const mules = [4, 5, 6, 7, 8];
          for (let i = 0; i < mules.length; i++) {
            for (let j = i + 1; j < mules.length; j++) {
              graph.addEdge(mules[i], mules[j], Math.round(Math.random() * 900 + 100));
            }
          }
          graph.evaluateAdaptiveSwitch();
        },
      },
      {
        phaseNumber: 3,
        phaseName: 'Risk Scoring Sweep',
        triggerEvent: 'Compliance runs batch PageRank & triangle scans',
        actionSummary: 'High Q/U traversal burst triggers migration to packed CSR.',
        expectedRepresentation: 'CSR',
        whyOptimal: 'Contiguous Int32/Float32 arrays maximize CPU L1/L2 cache line utilization.',
        execute: (graph: AdaptiveGraph) => {
          graph.resetTelemetryCounters();
          for (let i = 0; i < 60; i++) {
            graph.getNeighbors(i % 12);
          }
          graph.evaluateAdaptiveSwitch();
        },
      },
      {
        phaseNumber: 4,
        phaseName: 'Ring Frozen & Reclaimed',
        triggerEvent: 'Compliance freezes mule accounts; density drops',
        actionSummary: 'Density drops below 12% lower threshold; reverts to Adjacency List.',
        expectedRepresentation: 'ADJACENCY_LIST',
        whyOptimal: 'Releases O(V²) matrix buffers once the dense fraud cluster is cleared.',
        execute: (graph: AdaptiveGraph) => {
          graph.resetTelemetryCounters();
          const mules = [4, 5, 6, 7, 8];
          for (let i = 0; i < mules.length; i++) {
            for (let j = i + 1; j < mules.length; j++) {
              graph.removeEdge(mules[i], mules[j]);
            }
          }
          graph.evaluateAdaptiveSwitch();
        },
      },
    ],
  },
  {
    id: 'cloud_mesh',
    title: 'Cloud Microservice Traffic Spike',
    domain: 'Distributed Systems',
    challenge:
      'Kubernetes RPC meshes run sparse steady-state links until traffic spikes trigger dense cross-pod retries and shortest-latency failover routing.',
    adaptiveAdvantage:
      'Transitions smoothly from Adjacency List to Matrix during fan-out spikes, then compacts into CSR for failover pathing before reclaiming memory.',
    initialSetup: (graph: AdaptiveGraph) => {
      graph.clear();
      graph.setAutoSwitch(true);
      graph.activeProfile = 'AUTONOMOUS';
      const services = [
        { id: 0, label: 'Gateway' },
        { id: 1, label: 'Auth' },
        { id: 2, label: 'UserDB' },
        { id: 3, label: 'Billing' },
        { id: 4, label: 'Inventory' },
        { id: 5, label: 'Search' },
        { id: 6, label: 'Ingest' },
        { id: 7, label: 'Redis_1' },
        { id: 8, label: 'Redis_2' },
        { id: 9, label: 'Edge_CDN' },
      ];
      placeCircle(graph, services);
      graph.addEdge(9, 0, 1.2);
      graph.addEdge(0, 1, 3.4);
      graph.addEdge(0, 4, 4.1);
      graph.addEdge(0, 5, 8.2);
      graph.addEdge(1, 2, 2.1);
      graph.resetTelemetryCounters();
    },
    phases: [
      {
        phaseNumber: 1,
        phaseName: 'Steady-State Mesh',
        triggerEvent: 'Normal RPC calls across pods',
        actionSummary: 'Low density (~11%) stays in lightweight Adjacency List.',
        expectedRepresentation: 'ADJACENCY_LIST',
        whyOptimal: 'Zero wasted matrix cells for inactive service pairs.',
        execute: (graph: AdaptiveGraph) => {
          graph.addEdge(4, 7, 0.8);
          graph.evaluateAdaptiveSwitch();
        },
      },
      {
        phaseNumber: 2,
        phaseName: 'Flash-Crowd Fan-Out',
        triggerEvent: 'Launch surge opens cross-pod mesh links',
        actionSummary: 'Density jumps past 20%; switches to Adjacency Matrix.',
        expectedRepresentation: 'ADJACENCY_MATRIX',
        whyOptimal: 'Constant O(1) policy and circuit-breaker checks per RPC.',
        execute: (graph: AdaptiveGraph) => {
          for (let u = 0; u < 7; u++) {
            for (let v = u + 1; v < 7; v++) {
              if ((u + v) % 2 === 0 || u < 3) {
                graph.addEdge(u, v, Number((Math.random() * 4 + 1).toFixed(1)));
              }
            }
          }
          graph.evaluateAdaptiveSwitch();
        },
      },
      {
        phaseNumber: 3,
        phaseName: 'Failover Routing Sweep',
        triggerEvent: 'Ingress computes multi-source Dijkstra latency routes',
        actionSummary: 'Sequential traversal burst triggers conversion to CSR.',
        expectedRepresentation: 'CSR',
        whyOptimal: 'Packed neighbor slices accelerate shortest-path relaxations.',
        execute: (graph: AdaptiveGraph) => {
          graph.resetTelemetryCounters();
          for (let i = 0; i < 65; i++) {
            graph.getNeighbors(i % 10);
          }
          graph.evaluateAdaptiveSwitch();
        },
      },
      {
        phaseNumber: 4,
        phaseName: 'Auto-Scale Down',
        triggerEvent: 'Idle retry connections close',
        actionSummary: 'Density drops below 12%; reverts to Adjacency List.',
        expectedRepresentation: 'ADJACENCY_LIST',
        whyOptimal: 'Frees quadratic matrix buffers when traffic normalizes.',
        execute: (graph: AdaptiveGraph) => {
          graph.resetTelemetryCounters();
          for (const e of graph.getEdges()) {
            if (e.u > 1 && e.v > 1) {
              graph.removeEdge(e.u, e.v);
            }
          }
          graph.evaluateAdaptiveSwitch();
        },
      },
    ],
  },
  {
    id: 'traffic_grid',
    title: 'Smart City Incident Rerouting',
    domain: 'Urban Mobility',
    challenge:
      'Planar road networks are sparse until a highway closure forces dense local detours and fleet-wide shortest-path recomputation.',
    adaptiveAdvantage:
      'Preserves planar sparsity in Adjacency List, handles localized detour density in Matrix, and compiles CSR for fleet routing.',
    initialSetup: (graph: AdaptiveGraph) => {
      graph.clear();
      graph.setAutoSwitch(true);
      graph.activeProfile = 'AUTONOMOUS';
      const nodes = [
        { id: 0, label: 'Center' },
        { id: 1, label: 'North_St' },
        { id: 2, label: 'South_St' },
        { id: 3, label: 'Bridge_W' },
        { id: 4, label: 'Bridge_E' },
        { id: 5, label: 'Hwy_101' },
        { id: 6, label: 'Exit_42' },
        { id: 7, label: 'East_Rd' },
        { id: 8, label: 'West_Rd' },
        { id: 9, label: 'Port' },
      ];
      placeCircle(graph, nodes);
      graph.addEdge(0, 1, 5);
      graph.addEdge(0, 2, 4);
      graph.addEdge(1, 3, 8);
      graph.addEdge(4, 5, 6);
      graph.addEdge(7, 8, 11);
      graph.resetTelemetryCounters();
    },
    phases: [
      {
        phaseNumber: 1,
        phaseName: 'Off-Peak Arterial Flow',
        triggerEvent: 'Standard sparse road connectivity',
        actionSummary: 'Maintained in O(V+E) Adjacency List.',
        expectedRepresentation: 'ADJACENCY_LIST',
        whyOptimal: 'Planar grids average degree ≤ 4; Matrix would waste 90%+ space.',
        execute: (graph: AdaptiveGraph) => {
          graph.addEdge(8, 9, 14);
          graph.evaluateAdaptiveSwitch();
        },
      },
      {
        phaseNumber: 2,
        phaseName: 'Bridge Detour Congestion',
        triggerEvent: 'Bridge closure forces dense downtown detour mesh',
        actionSummary: 'Downtown cluster pushes density > 20%, switching to Matrix.',
        expectedRepresentation: 'ADJACENCY_MATRIX',
        whyOptimal: 'Constant-time turn and lane availability checks for GPS agents.',
        execute: (graph: AdaptiveGraph) => {
          for (let i = 0; i < 6; i++) {
            for (let j = i + 1; j < 6; j++) {
              graph.addEdge(i, j, Math.round(Math.random() * 12 + 3));
            }
          }
          graph.evaluateAdaptiveSwitch();
        },
      },
      {
        phaseNumber: 3,
        phaseName: 'Fleet Reroute Computation',
        triggerEvent: 'Dispatch runs Dijkstra across congested corridors',
        actionSummary: 'Traversal surge migrates storage to CSR.',
        expectedRepresentation: 'CSR',
        whyOptimal: 'Eliminates pointer chasing during shortest-path relaxations.',
        execute: (graph: AdaptiveGraph) => {
          graph.resetTelemetryCounters();
          for (let i = 0; i < 60; i++) {
            graph.getNeighbors(i % 10);
          }
          graph.evaluateAdaptiveSwitch();
        },
      },
      {
        phaseNumber: 4,
        phaseName: 'Incident Cleared',
        triggerEvent: 'Detours removed as bridge reopens',
        actionSummary: 'Density returns to baseline; switches back to Adjacency List.',
        expectedRepresentation: 'ADJACENCY_LIST',
        whyOptimal: 'Reclaims memory immediately after detour mesh dissolves.',
        execute: (graph: AdaptiveGraph) => {
          graph.resetTelemetryCounters();
          for (let i = 0; i < 6; i++) {
            for (let j = i + 1; j < 6; j++) {
              if (i > 0 || j > 2) {
                graph.removeEdge(i, j);
              }
            }
          }
          graph.evaluateAdaptiveSwitch();
        },
      },
    ],
  },
];
