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
import { APIRequestContext, expect, Page, test } from '@playwright/test';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { waitForRecentEventsToFinishExecution } from '../utils/alert';
import { verifyTaskCreated } from '../utils/glossary';
import { verifyTaskStatus } from '../utils/reviewerWorkflow.utils';

const checks: Array<{
  name: string;
  run: (page: Page, api: APIRequestContext) => Promise<unknown>;
}> = [
  {
    name: 'approval task creation',
    run: (page) => verifyTaskCreated(page, 'owned-glossary.term', 'term'),
  },
  {
    name: 'reviewer status',
    run: (page, api) =>
      verifyTaskStatus(
        page,
        'approved',
        { fullyQualifiedName: 'owned-article' },
        'Approved',
        api,
        'contextCenter'
      ),
  },
  {
    name: 'subscription event execution',
    run: (page) => waitForRecentEventsToFinishExecution(page, 'owned-alert', 1),
  },
];

for (const { name, run } of checks) {
  test(`${name} preserves the first HTTP error`, async ({
    page,
    playwright,
  }) => {
    test.setTimeout(4_000);
    let requests = 0;
    const server = createServer((_request, response) => {
      requests++;
      response.writeHead(503, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ message: 'Service unavailable' }));
    });
    await new Promise<void>((resolve) =>
      server.listen(0, '127.0.0.1', resolve)
    );
    const baseURL = `http://127.0.0.1:${
      (server.address() as AddressInfo).port
    }`;
    const previousBaseURL = process.env.PLAYWRIGHT_TEST_BASE_URL;
    process.env.PLAYWRIGHT_TEST_BASE_URL = baseURL;
    const api = await playwright.request.newContext({ baseURL });
    try {
      await expect(run(page, api)).rejects.toThrow(/503/);
      expect(requests).toBe(1);
    } finally {
      if (previousBaseURL === undefined) {
        delete process.env.PLAYWRIGHT_TEST_BASE_URL;
      } else {
        process.env.PLAYWRIGHT_TEST_BASE_URL = previousBaseURL;
      }
      await api.dispose();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
}
