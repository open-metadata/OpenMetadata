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
import { waitForSearchIndexed } from './polling';

for (const scenario of [
  'wrong-entity',
  'indexed',
  'old-version',
  'display-name',
  'http-error',
  'invalid-body',
] as const) {
  test(`search indexing readiness: ${scenario}`, async ({ playwright }) => {
    const fqn = 'service.database.schema.target';
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
                hits: {
                  total: { value: 1 },
                  hits: [
                    {
                      _source: {
                        fullyQualifiedName:
                          (scenario === 'indexed' && requests > 1) ||
                          scenario === 'old-version'
                            ? fqn
                            : `${fqn}_unrelated`,
                        version: requests === 1 ? 0.1 : 0.2,
                        displayName:
                          scenario === 'display-name' && requests > 1
                            ? fqn
                            : 'Unrelated',
                      },
                    },
                  ],
                },
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
      const result = waitForSearchIndexed(apiContext, fqn, 'table', {
        timeout: scenario === 'wrong-entity' ? 100 : 2_000,
        intervals: [10],
        minVersion: scenario === 'old-version' ? 0.2 : undefined,
        matchBy: scenario === 'display-name' ? 'nameOrDisplayName' : undefined,
      });
      if (
        scenario === 'indexed' ||
        scenario === 'old-version' ||
        scenario === 'display-name'
      ) {
        await result;
        expect(requests).toBe(2);
      } else {
        await expect(result).rejects.toThrow(
          scenario === 'http-error'
            ? /503/
            : scenario === 'invalid-body'
            ? /invalid|malformed/i
            : /target/
        );
        if (scenario !== 'wrong-entity') {
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
