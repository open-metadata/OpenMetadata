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

import { expect, type Page } from '@playwright/test';
import {
  LOGS_VIEWER_PIPELINE_STATUS_MAX_WAIT_MS,
  LOGS_VIEWER_PIPELINE_STATUS_RETRY_INTERVAL_MS,
} from '../constant/logsViewer';
import { waitForAllLoadersToDisappear } from './entity';

export const navigateToBundleSuiteWithPagination = async (
  page: Page,
  bundleSuiteFqn: string,
  maxPages = 15
) => {
  const encodedBundleSuiteFqn = encodeURIComponent(bundleSuiteFqn);

  for (let currentPage = 0; currentPage < maxPages; currentPage++) {
    await waitForAllLoadersToDisappear(page);

    const bundleSuiteLink = page
      .getByTestId('test-suite-table')
      .locator(`a[href*="${encodedBundleSuiteFqn}"]`)
      .first();

    if (await bundleSuiteLink.isVisible()) {
      await bundleSuiteLink.click();
      await waitForAllLoadersToDisappear(page);

      return;
    }

    const nextBtn = page.locator('[data-testid="next"]');

    if (!(await nextBtn.isVisible()) || !(await nextBtn.isEnabled())) {
      break;
    }

    const listResponse = page.waitForResponse(
      (r) =>
        r.url().includes('/api/v1/dataQuality/testSuites/search/list')
    );
    await nextBtn.click();
    await listResponse;
  }

  throw new Error(
    `Bundle suite ${bundleSuiteFqn} was not found after checking ${maxPages} page(s)`
  );
};

export async function waitForFirstPipelineStatusNotQueued(page: Page) {
  await expect(async () => {
    await page.reload();
    await waitForAllLoadersToDisappear(page);

    await page.getByTestId('pipeline').click();
    await waitForAllLoadersToDisappear(page);

    const row = page
      .getByRole('row')
      .filter({ has: page.getByTestId('logs-button') })
      .first();
    await expect(row).toBeVisible();
    const statusBadge = row.getByTestId('pipeline-status').last();
    const text = ((await statusBadge.textContent()) ?? '').trim();
    expect(text.length).toBeGreaterThan(0);
    expect(text).not.toMatch(/^queued$/i);
  }).toPass({
    timeout: LOGS_VIEWER_PIPELINE_STATUS_MAX_WAIT_MS,
    intervals: [LOGS_VIEWER_PIPELINE_STATUS_RETRY_INTERVAL_MS],
  });
}
