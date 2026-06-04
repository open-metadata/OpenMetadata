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

/**
 * HTTP/2 + brotli smoke test. Opt-in: set PW_PROTOCOL=h2 and start the server
 * with conf/openmetadata-h2-test.yaml. Skipped otherwise so the default
 * Playwright run is unaffected.
 *
 * What this verifies on the wire — the two things this PR makes possible:
 *   1. `type: h2` connector negotiates HTTP/2 with Chromium via ALPN.
 *   2. OpenMetadataAssetServlet serves brotli-precompressed JS chunks when
 *      Accept-Encoding includes `br`.
 *
 * Both signals come from a single page load; we capture asset responses via
 * a CDP session (Playwright's request/response API doesn't surface the wire
 * protocol directly).
 */
import { CDPSession, expect, test } from '@playwright/test';

type ResponseRecord = {
  url: string;
  mimeType: string;
  protocol: string;
  contentEncoding: string | undefined;
};

test.skip(
  process.env.PW_PROTOCOL !== 'h2',
  'Opt-in: requires PW_PROTOCOL=h2 and the h2 server config.'
);

test('serves JS assets over HTTP/2 with brotli encoding', async ({ page }) => {
  const responses: ResponseRecord[] = [];
  const cdp: CDPSession = await page.context().newCDPSession(page);

  await cdp.send('Network.enable');
  cdp.on('Network.responseReceived', (event) => {
    const { response } = event;
    const headers = response.headers ?? {};
    const headersLower: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      headersLower[key.toLowerCase()] = value as string;
    }

    responses.push({
      url: response.url,
      mimeType: response.mimeType,
      protocol: response.protocol ?? '',
      contentEncoding: headersLower['content-encoding'],
    });
  });

  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  await expect(() => expect(responses.length).toBeGreaterThan(0)).toPass({
    timeout: 15_000,
  });

  const jsAssets = responses.filter(
    (r) =>
      r.mimeType === 'application/javascript' ||
      r.mimeType === 'text/javascript' ||
      r.url.endsWith('.js')
  );

  expect(
    jsAssets.length,
    'expected at least one JS asset response from the index page'
  ).toBeGreaterThan(0);

  const allOverH2 = jsAssets.every((r) => r.protocol === 'h2');
  expect(
    allOverH2,
    `expected all JS assets to be served via h2, got: ${jsAssets
      .map((r) => `${r.url} → ${r.protocol}`)
      .join(', ')}`
  ).toBe(true);

  const brotliAsset = jsAssets.find((r) => r.contentEncoding === 'br');
  expect(
    brotliAsset,
    `expected at least one JS asset with content-encoding: br, got encodings: ${jsAssets
      .map((r) => r.contentEncoding ?? 'none')
      .join(', ')}`
  ).toBeDefined();

  await cdp.detach();
});
