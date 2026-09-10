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
import { waitForResponseWithStatus } from '../utils/waitHelpers';

for (const [firstStatus, expectedStatus] of [
  [200, 200],
  [503, 200],
  [201, 'ok'],
  [503, 'ok'],
  [201, [200, 201]],
] as Array<[number, number | number[] | 'ok']>) {
  test(`response wait preserves first HTTP ${firstStatus} with expected ${expectedStatus}`, async ({
    page,
  }) => {
    let requests = 0;
    const server = createServer((request, response) => {
      if (request.url === '/api/resource') {
        requests++;
        response.writeHead(requests === 1 ? firstStatus : 200, {
          'Content-Type': 'application/json',
        });
        response.end('{}');
      } else response.end('<html></html>');
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    try {
      await page.goto(
        'http://127.0.0.1:' + (server.address() as AddressInfo).port
      );
      const outcome = waitForResponseWithStatus(
        page,
        (response) => new URL(response.url()).pathname === '/api/resource',
        expectedStatus
      ).then(
        (response) => response.status(),
        (error) => error
      );
      await page.evaluate(async () => {
        await fetch('/api/resource');
        await fetch('/api/resource');
      });
      const result = await outcome;
      if (firstStatus < 300) expect(result).toBe(firstStatus);
      else {
        expect(result).toBeInstanceOf(Error);
        expect(String(result)).toContain('503');
      }
      expect(requests).toBe(2);
    } finally {
      await page.close();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
}
