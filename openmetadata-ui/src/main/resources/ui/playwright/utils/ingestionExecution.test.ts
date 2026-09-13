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
import {
  triggerIngestionPipeline,
  waitForIngestionResult,
} from './ingestionExecution';

for (const scenario of [
  'success',
  'failed',
  'partialSuccess',
  'stopped',
  'http-error',
  'invalid-body',
  'stale',
  'changed-execution',
] as const) {
  test(`ingestion execution: ${scenario}`, async ({ playwright }) => {
    const startedAfter = Date.now();
    let requests = 0;
    const server = createServer((_request, response) => {
      requests++;
      response.writeHead(scenario === 'http-error' ? 503 : 200, {
        'Content-Type': 'application/json',
      });
      response.end(
        JSON.stringify(
          scenario === 'invalid-body'
            ? {}
            : {
                data: [
                  {
                    runId:
                      scenario === 'changed-execution' && requests > 1
                        ? 'newer'
                        : 'execution',
                    startDate:
                      scenario === 'stale' ? startedAfter - 1 : startedAfter,
                    pipelineState: [
                      'failed',
                      'partialSuccess',
                      'stopped',
                    ].includes(scenario)
                      ? scenario
                      : requests === 1
                      ? 'running'
                      : 'success',
                  },
                ],
              }
        )
      );
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    const apiContext = await playwright.request.newContext({
      baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    });
    try {
      const result = waitForIngestionResult(
        apiContext,
        'service.pipeline',
        startedAfter,
        { timeout: scenario === 'stale' ? 100 : 2_000, intervals: [10] }
      );
      if (scenario === 'success') {
        expect(await result).toMatchObject({
          runId: 'execution',
          pipelineState: 'success',
        });
        expect(requests).toBe(2);
      } else {
        await expect(result).rejects.toThrow(
          scenario === 'http-error'
            ? /503/
            : scenario === 'invalid-body'
            ? /Invalid/
            : scenario === 'stale'
            ? /no execution/
            : scenario === 'changed-execution'
            ? /disappeared/
            : new RegExp(scenario)
        );
        if (!['stale', 'changed-execution'].includes(scenario)) {
          expect(requests).toBe(1);
        }
      }
    } finally {
      await apiContext.dispose();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
}

for (const status of [200, 404, 503]) {
  test(
    'pipeline trigger makes one request on HTTP ' + status,
    async ({ playwright }) => {
      let requests = 0;
      const server = createServer((_request, response) => {
        requests++;
        response.writeHead(requests === 1 ? status : 200, {
          'Content-Type': 'application/json',
        });
        response.end('{}');
      });
      await new Promise<void>((resolve) =>
        server.listen(0, '127.0.0.1', resolve)
      );
      const apiContext = await playwright.request.newContext({
        baseURL: 'http://127.0.0.1:' + (server.address() as AddressInfo).port,
      });
      try {
        const startedAt = Date.now();
        const result = triggerIngestionPipeline(apiContext, 'pipeline');
        if (status === 200) {
          expect(await result).toBeGreaterThanOrEqual(startedAt);
        } else {
          await expect(result).rejects.toThrow(String(status));
        }
        expect(requests).toBe(1);
      } finally {
        await apiContext.dispose();
        await new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        );
      }
    }
  );
}
