/*
 *  Copyright 2025 Collate.
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

import {
  Agent,
  AgentRun,
  RunAttention,
  RunStep,
} from '../AgentsPage.interface';

const defaultSteps = (recs: number, opts: Partial<RunStep> = {}): RunStep[] => [
  {
    name: 'Source Ingestion',
    status: 'success',
    records: recs,
    filtered: opts.filtered ?? 0,
    updated: Math.round(recs * 0.18),
    warnings: opts.warnings ?? 0,
    errors: 0,
  },
  {
    name: 'Sink to OpenMetadata',
    status: 'success',
    records: Math.round(recs * 0.62),
    filtered: 0,
    updated: 0,
    warnings: 0,
    errors: 0,
  },
  {
    name: 'Exit Handler Diagnostics',
    status: 'success',
    records: 0,
    filtered: 0,
    updated: 0,
    warnings: 0,
    errors: 0,
  },
];

const partialSteps = (): RunStep[] => [
  {
    name: 'BigQuery',
    status: 'partial',
    records: 4587,
    filtered: 1,
    updated: 0,
    warnings: 0,
    errors: 1,
    attention: {
      severity: 'error',
      title: 'run_metadata',
      message:
        'Unable to get the table life cycle data for table run_metadata:' +
        ' (google.cloud.bigquery.dbapi.exceptions.DatabaseError) 404 POST' +
        ' https://bigquery.googleapis.com/bigquery/v2/projects/gcp-data-catalog-dev/queries:' +
        ' Not found: Dataset gcp-sc-demand-plan-analytics:simulation_results' +
        ' was not found in location US.',
      hint:
        'The dataset was dropped or the service account lacks access in this' +
        ' region. Re-grant BigQuery Data Viewer on simulation_results, or' +
        ' exclude it in filters.',
    },
  },
  {
    name: 'OpenMetadata',
    status: 'success',
    records: 2844,
    filtered: 0,
    updated: 0,
    warnings: 0,
    errors: 0,
  },
  {
    name: 'Exit Handler Diagnostics',
    status: 'success',
    records: 0,
    filtered: 0,
    updated: 0,
    warnings: 0,
    errors: 0,
  },
];

const failedSteps = (): RunStep[] => [
  {
    name: 'BigQuery',
    status: 'failed',
    records: 0,
    filtered: 0,
    updated: 0,
    warnings: 0,
    errors: 1,
    attention: {
      severity: 'error',
      title: 'Authentication',
      message:
        '(google.auth.exceptions.RefreshError) invalid_grant: Invalid JWT' +
        ' Signature. The service-account key used for this connection has been' +
        ' revoked or rotated.',
      hint:
        'Update the service-account key in the connection configuration,' +
        ' then re-deploy.',
    },
  },
  {
    name: 'OpenMetadata',
    status: 'skipped',
    records: 0,
    filtered: 0,
    updated: 0,
    warnings: 0,
    errors: 0,
  },
];

export const buildAttentionLogLines = (att: RunAttention): string[] => [
  '[08:10:02] INFO  Starting BigQuery metadata workflow',
  '[08:10:44] INFO  Scanned 18 datasets, 4587 tables',
  `[08:11:03] ERROR ${att.message.slice(0, 90)}…`,
  '[08:11:03] INFO  Continuing with remaining datasets',
  '[08:13:20] INFO  Sink complete · 2844 entities written',
];

export const seedRuns = (_agent: Agent): AgentRun[] => {
  const mk = (
    id: string,
    status: AgentRun['status'],
    startedAt: string,
    duration: number,
    recs: number,
    opts: {
      filtered?: number;
      updated?: number;
      warnings?: number;
      errors?: number;
      steps?: RunStep[];
    } = {}
  ): AgentRun => ({
    id,
    status,
    startedAt,
    duration,
    totals: {
      records: recs,
      filtered: opts.filtered ?? 0,
      updated: opts.updated ?? 0,
      warnings: opts.warnings ?? 0,
      errors: opts.errors ?? 0,
    },
    steps: opts.steps ?? defaultSteps(recs, opts),
  });

  return [
    mk('r1', 'partial', 'May 27, 2026 · 08:10', 4.2, 7431, {
      filtered: 1,
      errors: 1,
      warnings: 0,
      steps: partialSteps(),
    }),
    mk('r2', 'success', 'May 26, 2026 · 08:10', 3.8, 7402, {}),
    mk('r3', 'success', 'May 25, 2026 · 08:10', 3.9, 7388, {
      warnings: 2,
      steps: defaultSteps(7388, { warnings: 2 }),
    }),
    mk('r4', 'failed', 'May 24, 2026 · 08:10', 0.7, 0, {
      errors: 1,
      steps: failedSteps(),
    }),
    mk('r5', 'success', 'May 23, 2026 · 08:10', 3.7, 7355, {}),
    mk('r6', 'success', 'May 22, 2026 · 08:10', 3.6, 7340, {}),
    mk('r7', 'success', 'May 21, 2026 · 08:10', 3.8, 7301, {}),
  ];
};
