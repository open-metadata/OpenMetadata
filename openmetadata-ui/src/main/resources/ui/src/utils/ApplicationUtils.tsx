/*
 *  Copyright 2023 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import { upperFirst } from 'lodash';
import { StatusType } from '../components/common/StatusBadge/StatusBadge.interface';
import { EntityStatsData } from '../components/Settings/Applications/AppLogsViewer/AppLogsViewer.interface';
import {
  Status,
  StepStats,
} from '../generated/entity/applications/appRunRecord';

export const getStatusTypeForApplication = (status: Status) => {
  switch (status) {
    case Status.Failed:
      return StatusType.Failure;

    case Status.Success:
    case Status.Active:
    case Status.Completed:
      return StatusType.Success;

    case Status.Running:
      return StatusType.Running;

    case Status.Started:
      return StatusType.Started;

    case Status.Pending:
      return StatusType.Pending;

    case Status.ActiveError:
      return StatusType.ActiveError;

    default:
      return StatusType.Stopped;
  }
};
const VECTOR_INDEXABLE_ENTITIES = new Set([
  'table',
  'glossary',
  'glossaryterm',
  'chart',
  'dashboard',
  'dashboarddatamodel',
  'database',
  'databaseschema',
  'dataproduct',
  'pipeline',
  'mlmodel',
  'metric',
  'apiendpoint',
  'apicollection',
  'page',
  'storedprocedure',
  'searchindex',
  'topic',
]);

export const getEntityStatsData = (data: {
  [key: string]: StepStats;
}): EntityStatsData[] => {
  const filteredRow = ['failedRecords', 'totalRecords', 'successRecords'];

  const result = Object.entries(data).reduce<EntityStatsData[]>(
    (acc, [key, stats]) => {
      if (filteredRow.includes(key)) {
        return acc;
      }

      if (
        !stats ||
        typeof stats.totalRecords !== 'number' ||
        typeof stats.successRecords !== 'number' ||
        typeof stats.failedRecords !== 'number'
      ) {
        return acc;
      }

      const isVectorIndexable = VECTOR_INDEXABLE_ENTITIES.has(
        key.toLowerCase()
      );

      return [
        ...acc,
        {
          name: upperFirst(key),
          totalRecords: stats.totalRecords,
          successRecords: stats.successRecords,
          failedRecords: stats.failedRecords,
          vectorEmbeddings: isVectorIndexable
            ? stats.vectorSuccessRecords ?? 0
            : null,
          // Sink time per entity — populated by the backend's per-entity step stats so
          // the per-entity table can show OS-side latency for each entity. Other stage
          // timings live on the top-level reader/process/sink/vector stats cards.
          sinkAvgMs: formatLatencyAverage(
            stats.totalTimeMs,
            stats.successRecords
          ),
          sinkThroughput: formatThroughput(
            stats.totalTimeMs,
            stats.successRecords
          ),
        },
      ];
    },
    []
  );

  return result.sort((a: EntityStatsData, b: EntityStatsData) =>
    a.name.localeCompare(b.name)
  );
};

/**
 * Format avg stage latency as a short human string. Returns "—" when no records or no time
 * has been recorded yet (e.g. fresh job, or stages that haven't reported timing because the
 * legacy non-distributed path is in use). Below 1 ms shows "<1 ms" rather than rounding to 0.
 */
export const formatLatencyAverage = (
  totalTimeMs?: number,
  successRecords?: number
): string => {
  if (
    totalTimeMs === undefined ||
    successRecords === undefined ||
    !totalTimeMs ||
    !successRecords
  ) {
    return '—';
  }
  const avgMs = totalTimeMs / successRecords;
  if (avgMs < 1) {
    return '<1 ms';
  }
  if (avgMs < 1000) {
    return `${avgMs.toFixed(1)} ms`;
  }
  return `${(avgMs / 1000).toFixed(2)} s`;
};

/**
 * Format throughput in records per second derived from the same total-time / success-records
 * pair. Useful as a secondary signal next to avg latency when comparing entities or runs.
 */
export const formatThroughput = (
  totalTimeMs?: number,
  successRecords?: number
): string => {
  if (
    totalTimeMs === undefined ||
    successRecords === undefined ||
    !totalTimeMs ||
    !successRecords
  ) {
    return '—';
  }
  const seconds = totalTimeMs / 1000;
  if (seconds <= 0) {
    return '—';
  }
  const rps = successRecords / seconds;
  if (rps >= 1000) {
    return `${(rps / 1000).toFixed(1)}k r/s`;
  }
  if (rps >= 100) {
    return `${rps.toFixed(0)} r/s`;
  }
  return `${rps.toFixed(1)} r/s`;
};
