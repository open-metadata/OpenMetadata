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

import { Agent, LogLine } from '../AgentsPage.interface';

export function genLogLines(agent: Agent): LogLine[] {
  const name = agent.name ?? 'Agent';
  const unit = agent.unit ?? 'assets';
  const lines: LogLine[] = [];
  let t = 0;

  const at = (): string => {
    t += Math.random() * 3 + 0.4;
    const m = String(Math.floor(t / 60)).padStart(2, '0');
    const s = String(Math.floor(t % 60)).padStart(2, '0');

    return `08:${m}:${s}`;
  };

  const push = (level: LogLine['level'], text: string): void => {
    lines.push({ level, text, time: at() });
  };

  push(
    'info',
    `Starting ${name} workflow · pipeline run ${Math.random()
      .toString(16)
      .slice(2, 10)}`
  );
  push('info', 'Loading connection configuration from service banking-redshift');
  push(
    'debug',
    'Resolving credentials via IAM role arn:aws:iam::4417:role/collate-ingest'
  );
  push('info', 'Connection established · driver redshift+psycopg2 (TLS 1.3)');
  push(
    'info',
    'Fetching catalog: 4 databases, 38 schemas in scope after filters'
  );
  for (let i = 1; i <= 8; i++) {
    push(
      'info',
      `Scanning schema sales_${i} · ${Math.floor(Math.random() * 200 + 20)} ${unit}`
    );
  }
  push('warn', 'Skipped 3 transient tables matching exclude pattern ^tmp_');
  push('debug', 'Batch 12/26 flushed to sink (500 entities, 412 ms)');
  push('info', 'Profiler sampled 10,000 rows from sales.fact_orders');
  push(
    'error',
    'Unable to read table life cycle for run_metadata: 404 Dataset not found in location US'
  );
  push('info', 'Continuing with remaining datasets after recoverable error');
  push(
    'info',
    'Sink to OpenMetadata complete · 2,844 entities written, 0 failed'
  );
  push(
    'info',
    'Workflow finished · status PARTIAL_SUCCESS · elapsed 4m 12s'
  );

  return lines;
}
