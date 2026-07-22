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

import { expect, test } from '@playwright/test';

test('mounts the built application without bootstrap errors', async ({
  page,
}) => {
  const pageErrors: string[] = [];
  const staticRequests: string[] = [];
  page.on('pageerror', (error) => {
    pageErrors.push(error.stack ?? error.message);
  });
  page.on('request', (request) => {
    const pathname = new URL(request.url()).pathname;
    if (!pathname.startsWith('/api/')) {
      staticRequests.push(pathname);
    }
  });

  await page.goto('/my-data', { waitUntil: 'domcontentloaded' });
  await expect(
    page.locator('#email, [data-testid="left-sidebar"]').first()
  ).toBeVisible({ timeout: 30_000 });

  await expect(page.locator('.om-boot-shell')).toHaveCount(0);
  expect(pageErrors, pageErrors.join('\n')).toEqual([]);
  test.info().annotations.push({
    type: 'static-requests',
    description: String(staticRequests.length),
  });

  if (process.env.PW_E2E_BUNDLE === 'true') {
    expect(staticRequests.length, staticRequests.join('\n')).toBeLessThan(100);
  }
});
