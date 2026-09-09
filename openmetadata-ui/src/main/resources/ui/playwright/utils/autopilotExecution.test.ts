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
import { waitForAutoPilotResult } from './autopilotExecution';

for (const scenario of [
  'complete',
  'FAILURE',
  'EXCEPTION',
  'SUPERSEDED',
  'http-error',
  'malformed',
  'stale',
  'changed-execution',
  'running',
] as const) {
  test(`AutoPilot polling: ${scenario}`, async ({ playwright }) => {
    const startedAfter = Date.now();
    const entityLink = '<#E::databaseService::pw-mysql-with-%-unique>';
    let requests = 0;
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '', 'http://localhost');
      expect(url.pathname).toBe('/api/v1/governance/workflowInstances');
      expect(url.searchParams.get('entityLink')).toBe(entityLink);
      expect(url.searchParams.get('startTs')).toBe(String(startedAfter));
      requests++;
      response.writeHead(scenario === 'http-error' ? 503 : 200, {
        'Content-Type': 'application/json',
      });
      response.end(
        JSON.stringify({
          data: [
            {
              id:
                scenario === 'changed-execution' && requests > 1
                  ? 'different'
                  : 'execution',
              timestamp: scenario === 'stale' ? startedAfter - 1 : startedAfter,
              status: ['FAILURE', 'EXCEPTION', 'SUPERSEDED'].includes(scenario)
                ? scenario
                : scenario === 'malformed'
                ? 'UNKNOWN'
                : scenario === 'running' ||
                  ((scenario === 'complete' ||
                    scenario === 'changed-execution') &&
                    requests === 1)
                ? 'RUNNING'
                : 'FINISHED',
            },
          ],
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
      const result = waitForAutoPilotResult(
        context,
        entityLink,
        startedAfter,
        scenario === 'complete' || scenario === 'changed-execution'
          ? 10000
          : 200
      );
      if (scenario === 'complete') {
        expect(await result).toEqual(
          expect.objectContaining({ id: 'execution', status: 'FINISHED' })
        );
        expect(requests).toBe(2);
      } else {
        const message =
          scenario === 'http-error'
            ? /HTTP 503/
            : scenario === 'malformed'
            ? /invalid status UNKNOWN/
            : scenario === 'changed-execution'
            ? /execution.*disappeared/
            : scenario === 'stale'
            ? /no execution/
            : scenario === 'running'
            ? /execution.*RUNNING/
            : new RegExp(`execution.*${scenario}`);
        const error = await result.then(
          () => undefined,
          (failure) => String(failure)
        );
        expect(error).toMatch(message);
      }
    } finally {
      await context.dispose();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
}
