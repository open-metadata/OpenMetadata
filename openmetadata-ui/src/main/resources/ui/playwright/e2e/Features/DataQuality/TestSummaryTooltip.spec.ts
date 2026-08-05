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

import test, { expect } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage } from '../../../utils/common';
import { waitForIncidentToBeIndexed } from '../../../utils/dataQuality';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { waitForTestCaseDetailsResponse } from '../../../utils/testCases';

test.use({ storageState: 'playwright/.auth/admin.json' });

test('Test result tooltip stays fixed while the pointer enters its incident link', async ({
  browser,
  page,
}) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  const table = new TableClass();

  try {
    await table.create(apiContext);
    const testCase = await table.createTestCase(apiContext);
    const testCaseFqn = testCase.fullyQualifiedName as string;
    const failedAt = Date.now();

    await table.addTestCaseResult(apiContext, testCaseFqn, {
      result: 'Row count was outside the expected range.',
      testCaseStatus: 'Failed',
      testResultValue: [{ name: 'rowCount', value: '10' }],
      timestamp: failedAt,
    });
    await waitForIncidentToBeIndexed(apiContext, testCaseFqn, failedAt);

    const detailsResponse = waitForTestCaseDetailsResponse(page);
    const resultsResponse = page.waitForResponse(
      (response) =>
        response
          .url()
          .includes('/api/v1/dataQuality/testCases/testCaseResults/') &&
        response.status() === 200
    );

    await page.goto(
      `/test-case/${encodeURIComponent(testCaseFqn)}/test-case-results`
    );
    await Promise.all([detailsResponse, resultsResponse]);
    await waitForAllLoadersToDisappear(page);

    const point = page.locator('[data-testid^="test-summary-point-"]').first();
    const tooltip = page.getByTestId('test-summary-tooltip');

    await expect(point).toBeVisible();
    await point.scrollIntoViewIfNeeded();
    const pointBox = await point.boundingBox();

    if (!pointBox) {
      throw new Error('Expected the test result point to have a bounding box');
    }

    // A nearby chart position must not inherit the dot's tooltip activation.
    await page.mouse.move(
      pointBox.x + pointBox.width + 3,
      pointBox.y + pointBox.height / 2
    );
    await expect(tooltip).toBeHidden();

    await point.hover();
    await expect(tooltip).toBeVisible();

    const incidentLink = tooltip.locator('a.tooltip-incident-link');

    await expect(incidentLink).toBeVisible();
    // Recharts used to move the tooltip during this browser-level pointer
    // transition, preventing Playwright (and users) from reaching the link.
    await incidentLink.hover();
    await expect(incidentLink).toBeVisible();
    await expect
      .poll(() => incidentLink.evaluate((element) => element.matches(':hover')))
      .toBe(true);

    const incidentHref = await incidentLink.getAttribute('href');

    if (!incidentHref) {
      throw new Error('Expected the incident link to have a destination');
    }

    await Promise.all([
      page.waitForURL((url) => url.pathname === incidentHref),
      incidentLink.click(),
    ]);
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});
