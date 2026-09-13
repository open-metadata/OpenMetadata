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
import { createOrFetch, deleteFixtureEntity, settleAll } from './apiResponse';

test('fixture setup waits for every operation and reports every failure', async () => {
  let finish!: () => void;
  let finished = false;
  let settled = false;
  const remaining = new Promise<void>((resolve) => {
    finish = resolve;
  }).then(() => {
    finished = true;
  });
  const outcome = settleAll([
    Promise.reject(new Error('user failed')),
    remaining,
    Promise.reject(new Error('table failed')),
  ]).then(
    () => undefined,
    (error: unknown) => {
      settled = true;
      return error;
    }
  );
  await Promise.resolve();
  expect(settled).toBe(false);
  finish();
  const error = await outcome;
  expect(finished).toBe(true);
  expect(error).toBeInstanceOf(AggregateError);
  expect(String(error)).toContain('user failed');
  expect(String(error)).toContain('table failed');
});

test('fixture setup accepts a complete successful batch', async () => {
  await expect(
    settleAll([Promise.resolve('entity'), undefined])
  ).resolves.toBeUndefined();
});

for (const status of [200, 204, 404, 403, 503]) {
  test(`fixture cleanup handles HTTP ${status} without repeating the DELETE`, async ({
    playwright,
  }) => {
    let requests = 0;
    const server = createServer((_request, response) => {
      requests++;
      response.writeHead(status);
      response.end();
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    const apiContext = await playwright.request.newContext({
      baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    });
    try {
      const result = deleteFixtureEntity(apiContext, '/api/v1/tables/fixture');
      if (status === 403 || status === 503) {
        await expect(result).rejects.toThrow(`HTTP ${status}`);
      } else {
        expect((await result).status()).toBe(status);
      }
      expect(requests).toBe(1);
    } finally {
      await apiContext.dispose();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
}

for (const status of [404, 500, 503]) {
  test(`fixture creation preserves the first HTTP ${status}`, async ({
    playwright,
  }) => {
    let writes = 0;
    const server = createServer((_request, response) => {
      writes++;
      response.writeHead(writes === 1 ? status : 201, {
        'Content-Type': 'application/json',
      });
      response.end(JSON.stringify({ id: 'entity' }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    const apiContext = await playwright.request.newContext({
      baseURL: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    });
    try {
      await expect(
        createOrFetch(apiContext, {
          label: 'fixture',
          createPath: '/api/v1/tables',
          fqnSegments: ['table'],
          data: { name: 'table' },
        })
      ).rejects.toThrow(String(status));
      expect(writes).toBe(1);
    } finally {
      await apiContext.dispose();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
}
