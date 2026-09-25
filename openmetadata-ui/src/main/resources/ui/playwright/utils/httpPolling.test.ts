/*
 *  Copyright 2026 Collate.
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
import { APIRequestContext, expect, test } from '@playwright/test';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { fetchCompletedCsvAsyncJobResult } from './common';
import { deleteArticleByFqn } from './ContextCenterUtil';
import {
  waitForIncidentToBeIndexed,
  waitForTestCasesToBeIndexed,
} from './dataQuality';
import { getGlossaryApprovalWorkflowSnapshot } from './glossary';
import { waitForRunningPipelineStatus } from './logsViewer';
import { setRemoteRunnerAsDefault } from './serviceIngestion';

const readinessChecks: Array<{
  name: string;
  run: (context: APIRequestContext) => Promise<unknown>;
}> = [
  {
    name: 'test case indexing',
    run: (context) =>
      waitForTestCasesToBeIndexed(context, [
        { name: 'owned-case', searchTerm: 'owned-case' },
      ]),
  },
  {
    name: 'incident indexing',
    run: (context) =>
      waitForIncidentToBeIndexed(context, 'owned-case', Date.now()),
  },
  {
    name: 'pipeline start',
    run: (context) =>
      waitForRunningPipelineStatus(context, 'owned-pipeline', 200),
  },
  {
    name: 'CSV export',
    run: (context) => fetchCompletedCsvAsyncJobResult(context, 'owned-job'),
  },
  {
    name: 'ingestion runner setup',
    run: setRemoteRunnerAsDefault,
  },
  {
    name: 'glossary workflow',
    run: (context) =>
      getGlossaryApprovalWorkflowSnapshot(context, 'owned-term'),
  },
  {
    name: 'article cleanup',
    run: (context) => deleteArticleByFqn(context, 'owned-article'),
  },
];

for (const { name, run } of readinessChecks) {
  test(`${name} reports an HTTP failure without polling again`, async ({
    playwright,
  }) => {
    test.setTimeout(2_000);
    let requests = 0;
    const server = createServer((_request, response) => {
      requests++;
      response.writeHead(503, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ message: 'Service unavailable' }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    const context = await playwright.request.newContext({
      baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    });
    try {
      await expect(run(context)).rejects.toThrow(/503/);
      expect(requests).toBe(1);
    } finally {
      await context.dispose();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
}
