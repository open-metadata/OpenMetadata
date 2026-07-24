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
import { expect, test, type Request } from '@playwright/test';
import { mkdir, writeFile } from 'fs/promises';
import { dirname } from 'path';

const STATIC_RESOURCE_TYPES = new Set([
  'document',
  'font',
  'image',
  'script',
  'stylesheet',
]);
const MAX_STATIC_TRANSFER_BYTES = 7 * 1024 * 1024;
const MAX_BUNDLE_BOOT_MS = 15_000;

type ResourceTimingObservation = {
  entryType: string;
  name: string;
  nextHopProtocol: string;
  transferSize: number;
};

test('mounts the built application without bootstrap errors', async ({
  page,
}, testInfo) => {
  const appOrigin = new URL(
    testInfo.project.use.baseURL ?? 'http://localhost:3000'
  ).origin;
  const pageErrors: string[] = [];
  const staticRequestUrls: string[] = [];
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
      staticRequestUrls.push(request.url());
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
  const performanceMetrics = await page.evaluate(
    ({ origin, requestUrls }) => {
      const navigationEntries = performance.getEntriesByType(
        'navigation'
      ) as PerformanceNavigationTiming[];
      const resourceEntries = performance.getEntriesByType(
        'resource'
      ) as PerformanceResourceTiming[];
      const staticRequestUrlSet = new Set(requestUrls);
      const entries = [...navigationEntries, ...resourceEntries];
      const staticTransferBytes = entries
        .filter((entry) => {
          const url = new URL(entry.name);

          return url.origin === origin && !url.pathname.startsWith('/api/');
        })
        .reduce((total, entry) => total + entry.transferSize, 0);
      const resourceTimings = entries
        .filter((entry) => {
          const url = new URL(entry.name);

          return (
            url.origin === origin &&
            staticRequestUrlSet.has(entry.name) &&
            !url.pathname.startsWith('/api/')
          );
        })
        .map<ResourceTimingObservation>((entry) => ({
          entryType: entry.entryType,
          name: entry.name,
          nextHopProtocol: entry.nextHopProtocol,
          transferSize: entry.transferSize,
        }));
      const navigationEntry = navigationEntries[0];

      return {
        domContentLoadedMs: navigationEntry?.domContentLoadedEventEnd ?? null,
        navigationDurationMs: navigationEntry?.duration ?? null,
        resourceTimings,
        staticTransferBytes,
      };
    },
    { origin: appOrigin, requestUrls: staticRequestUrls }
  );
  const observedNextHopProtocols = performanceMetrics.resourceTimings.reduce<
    Record<string, number>
  >((protocols, entry) => {
    const protocol = entry.nextHopProtocol || 'unknown';
    protocols[protocol] = (protocols[protocol] ?? 0) + 1;

    return protocols;
  }, {});
  const networkBackedResourceTimings =
    performanceMetrics.resourceTimings.filter(
      (entry) => entry.transferSize > 0
    );
  const networkBackedNextHopProtocols = networkBackedResourceTimings.reduce<
    Record<string, number>
  >((protocols, entry) => {
    const protocol = entry.nextHopProtocol || 'unknown';
    protocols[protocol] = (protocols[protocol] ?? 0) + 1;

    return protocols;
  }, {});
  const bundleMetrics = {
    bootDurationMs,
    domContentLoadedMs: performanceMetrics.domContentLoadedMs,
    navigationDurationMs: performanceMetrics.navigationDurationMs,
    networkBackedNextHopProtocols,
    observedNextHopProtocols,
    protocolMode: process.env.PW_PROTOCOL ?? 'http',
    staticRequestCount: staticRequestUrls.length,
    staticTransferBytes: performanceMetrics.staticTransferBytes,
  };

  if (process.env.PW_BUNDLE_METRICS_PATH) {
    await mkdir(dirname(process.env.PW_BUNDLE_METRICS_PATH), {
      recursive: true,
    });
    await writeFile(
      process.env.PW_BUNDLE_METRICS_PATH,
      `${JSON.stringify(bundleMetrics, null, 2)}\n`
    );
  }

  test.info().annotations.push({
    type: 'static-requests',
    description: String(staticRequestUrls.length),
  });
  test.info().annotations.push({
    type: 'static-transfer-bytes',
    description: String(performanceMetrics.staticTransferBytes),
  });
  test.info().annotations.push({
    type: 'bundle-boot-ms',
    description: String(bootDurationMs),
  });
  test.info().annotations.push({
    type: 'bundle-dom-content-loaded-ms',
    description: String(performanceMetrics.domContentLoadedMs),
  });
  test.info().annotations.push({
    type: 'bundle-navigation-ms',
    description: String(performanceMetrics.navigationDurationMs),
  });
  test.info().annotations.push({
    type: 'bundle-next-hop-protocols',
    description: JSON.stringify(observedNextHopProtocols),
  });

  if (process.env.PW_PROTOCOL === 'h2') {
    expect(
      networkBackedResourceTimings.length,
      'expected at least one network-backed navigation or static resource'
    ).toBeGreaterThan(0);

    const nonHttp2Resources = networkBackedResourceTimings.filter(
      (entry) => entry.nextHopProtocol !== 'h2'
    );

    expect(
      nonHttp2Resources,
      `expected all network-backed navigation and static resources to use h2:\n${nonHttp2Resources
        .map(
          (entry) =>
            `${new URL(entry.name).pathname} -> ${
              entry.nextHopProtocol || 'unknown'
            }`
        )
        .join('\n')}`
    ).toEqual([]);
  }

  if (process.env.PW_E2E_BUNDLE === 'true') {
    expect(
      staticRequestUrls.length,
      staticRequestUrls.map((url) => new URL(url).pathname).join('\n')
    ).toBeLessThan(100);
    expect(performanceMetrics.staticTransferBytes).toBeLessThan(
      MAX_STATIC_TRANSFER_BYTES
    );
    expect(bootDurationMs).toBeLessThan(MAX_BUNDLE_BOOT_MS);
  }
});
