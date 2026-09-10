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
import { expect, test } from '@playwright/test';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { fetchCompletedCsvAsyncJobResult } from './common';

for (const scenario of [
  'complete',
  'FAILED',
  'CANCELLED',
  'wrong-job',
  'invalid-status',
  'missing-result',
] as const) {
  test(`CSV export polling: ${scenario}`, async ({ playwright }) => {
    let statusRequests = 0;
    let resultRequests = 0;
    const server = createServer((request, response) => {
      if (request.url === '/api/v1/csvAsyncJobs/job/result') {
        resultRequests++;
        response.writeHead(scenario === 'missing-result' ? 404 : 200);
        response.end('name\ncustomer\n');

        return;
      }
      statusRequests++;
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          jobId: scenario === 'wrong-job' ? 'another-job' : 'job',
          status: ['FAILED', 'CANCELLED'].includes(scenario)
            ? scenario
            : scenario === 'invalid-status'
            ? 'UNKNOWN'
            : scenario === 'complete' && statusRequests === 1
            ? 'RUNNING'
            : 'COMPLETED',
        })
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    const context = await playwright.request.newContext({
      baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    });
    try {
      const result = fetchCompletedCsvAsyncJobResult(context, 'job');
      if (scenario === 'complete') {
        expect(await result).toBe('name\ncustomer\n');
        expect(statusRequests).toBe(2);
        expect(resultRequests).toBe(1);
      } else {
        const error = await result.then(
          () => undefined,
          (reason) => String(reason)
        );
        expect(error).toMatch(
          new RegExp(
            scenario === 'missing-result'
              ? '404'
              : scenario === 'wrong-job'
              ? 'another-job'
              : scenario === 'invalid-status'
              ? 'UNKNOWN'
              : scenario
          )
        );
        expect(statusRequests).toBe(1);
        expect(resultRequests).toBe(scenario === 'missing-result' ? 1 : 0);
      }
    } finally {
      await context.dispose();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
}
