/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BenchmarkSuite } from './benchmarks';
import { BenchmarkMetrics } from './types';

export interface BenchmarkWorkerRequest {
  vertexCount: number;
  density: number;
  queryLookups: number;
  neighborSweeps: number;
  insertBatchSize: number;
}

export interface BenchmarkWorkerResponse {
  results: BenchmarkMetrics[];
}

self.onmessage = (e: MessageEvent<BenchmarkWorkerRequest>) => {
  const { vertexCount, density, queryLookups, neighborSweeps, insertBatchSize } = e.data;
  const results = BenchmarkSuite.runFullComparison(
    vertexCount,
    density,
    queryLookups,
    neighborSweeps,
    insertBatchSize
  );
  const response: BenchmarkWorkerResponse = { results };
  self.postMessage(response);
};
