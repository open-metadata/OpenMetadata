/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { expect, test, type Request } from '@playwright/test';

const STATIC_RESOURCE_TYPES = new Set([
  'document',
  'font',
  'image',
  'script',
  'stylesheet',
]);
const MAX_STATIC_TRANSFER_BYTES = 7 * 1024 * 1024;
const MAX_BUNDLE_BOOT_MS = 15_000;

test('mounts the built application without bootstrap errors', async ({
  page,
}, testInfo) => {
  const appOrigin = new URL(
    testInfo.project.use.baseURL ?? 'http://localhost:3000'
  ).origin;
  const pageErrors: string[] = [];
  const staticRequests: string[] = [];
  const inFlightStaticRequests = new Set<Request>();
  const bootStartedAt = Date.now();
  let lastStaticActivityAt = bootStartedAt;

  const isStaticAppRequest = (request: Request) => {
    const url = new URL(request.url());

    return (
      url.origin === appOrigin &&
      !url.pathname.startsWith('/api/') &&
      STATIC_RESOURCE_TYPES.has(request.resourceType())
    );
  };

  const settleStaticRequest = (request: Request) => {
    if (inFlightStaticRequests.delete(request)) {
      lastStaticActivityAt = Date.now();
    }
  };

  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });
  page.on('request', (request) => {
    if (isStaticAppRequest(request)) {
      staticRequests.push(new URL(request.url()).pathname);
      inFlightStaticRequests.add(request);
      lastStaticActivityAt = Date.now();
    }
  });
  page.on('requestfailed', settleStaticRequest);
  page.on('requestfinished', settleStaticRequest);

  await page.goto('/my-data', { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('left-sidebar')).toBeVisible({
    timeout: 30_000,
  });
  await expect
    .poll(
      () =>
        inFlightStaticRequests.size === 0 &&
        Date.now() - lastStaticActivityAt >= 1_000,
      { timeout: 15_000 }
    )
    .toBe(true);

  await expect(page.locator('.om-boot-shell')).toHaveCount(0);
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  const bootDurationMs = Date.now() - bootStartedAt;
  const staticTransferBytes = await page.evaluate((origin) => {
    const navigationEntries = performance.getEntriesByType('navigation');
    const resourceEntries = performance.getEntriesByType('resource');

    return [...navigationEntries, ...resourceEntries]
      .filter((entry) => {
        const url = new URL(entry.name);

        return url.origin === origin && !url.pathname.startsWith('/api/');
      })
      .reduce(
        (total, entry) =>
          total +
          ('transferSize' in entry && typeof entry.transferSize === 'number'
            ? entry.transferSize
            : 0),
        0
      );
  }, appOrigin);

  test.info().annotations.push({
    type: 'static-requests',
    description: String(staticRequests.length),
  });
  test.info().annotations.push({
    type: 'static-transfer-bytes',
    description: String(staticTransferBytes),
  });
  test.info().annotations.push({
    type: 'bundle-boot-ms',
    description: String(bootDurationMs),
  });

  if (process.env.PW_E2E_BUNDLE === 'true') {
    expect(staticRequests.length, staticRequests.join('\n')).toBeLessThan(100);
    expect(staticTransferBytes).toBeLessThan(MAX_STATIC_TRANSFER_BYTES);
    expect(bootDurationMs).toBeLessThan(MAX_BUNDLE_BOOT_MS);
  }
});
