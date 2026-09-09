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
import { waitForContractResult } from './contractExecution';

for (const scenario of [
  'complete',
  'http-error',
  'wrong-execution',
  'queued',
  'malformed',
] as const) {
  test(`contract polling: ${scenario}`, async ({ playwright }) => {
    let requests = 0;
    const server = createServer((request, response) => {
      expect(request.url).toBe(
        '/api/v1/dataContracts/contract/results/execution'
      );
      requests++;
      response.writeHead(scenario === 'http-error' ? 503 : 200, {
        'Content-Type': 'application/json',
      });
      response.end(
        JSON.stringify({
          id:
            scenario === 'wrong-execution' ? 'previous-execution' : 'execution',
          contractExecutionStatus:
            scenario === 'malformed'
              ? undefined
              : scenario === 'queued'
              ? 'Queued'
              : requests === 1
              ? 'Running'
              : 'Success',
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
      const result = waitForContractResult(
        context,
        'contract',
        'execution',
        scenario === 'queued' ? 200 : 3_000
      );
      if (scenario === 'complete') {
        await result;
        expect(requests).toBe(2);
      } else {
        const message =
          scenario === 'http-error'
            ? /HTTP 503/
            : scenario === 'wrong-execution'
            ? /different execution ID/
            : scenario === 'malformed'
            ? /invalid status/
            : /terminal result/;
        await expect(result).rejects.toThrow(message);
        if (scenario !== 'queued') {
          expect(requests).toBe(1);
        }
      }
    } finally {
      await context.dispose();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
}
