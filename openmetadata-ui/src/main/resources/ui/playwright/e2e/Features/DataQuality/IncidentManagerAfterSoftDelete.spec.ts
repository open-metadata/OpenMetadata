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
 * Regression for the soft-delete propagation bug. SearchRepository's
 * SOFT_DELETE_RESTORE_SCRIPT was stamping `deleted` onto child docs of every
 * alias in the parent's IndexMapping. For testCase that included
 * `testCaseResolutionStatus` and `testCaseResult` — both time-series indexes
 * whose Java schemas declare no `deleted` field. The poisoned doc broke
 * Jackson on read and the Incident Manager page surfaced an
 * "Unrecognized field 'deleted'" toast on load.
 *
 * This test reproduces the failing user path: soft-delete a test case that
 * has an incident, then navigate to Incident Manager and confirm the page
 * renders without an error toast.
 */

import test, { expect } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { TableClass } from '../../../support/entity/TableClass';
import { createNewPage, redirectToHomePage } from '../../../utils/common';
import { sidebarClick } from '../../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

test('Incident Manager renders without Jackson error after a test case is soft-deleted', async ({
  browser,
  page,
}) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  const table = new TableClass();

  try {
    await table.create(apiContext);
    const testCase = await table.createTestCase(apiContext);
    const testCaseFqn = testCase.fullyQualifiedName as string;
    const testCaseId = testCase.id as string;

    await table.addTestCaseResult(apiContext, testCaseFqn, {
      result: 'soft-delete propagation regression',
      testCaseStatus: 'Failed',
      timestamp: Date.now(),
    });

    // Wait until the incident is actually indexed before we soft-delete —
    // otherwise the script propagation race is meaningless. CI runners can be slow on the
    // first-time test-result + resolution-status indexing pipeline, so allow up to 2 min.
    test.setTimeout(180_000);
    // Match the production UI's call shape — the search endpoint expects offset + latest
    // (matches `getListTestCaseIncidentStatusFromSearch` in
    // openmetadata-ui/src/main/resources/ui/src/rest/incidentManagerAPI.ts). Without them the
    // server rejects with 400.
    await expect
      .poll(
        async () => {
          const res = await apiContext.get(
            `/api/v1/dataQuality/testCases/testCaseIncidentStatus/search/list?testCaseFQN=${encodeURIComponent(
              testCaseFqn
            )}&limit=5&offset=0&latest=true`
          );

          return res.status();
        },
        {
          message:
            'incident status endpoint must serve the test case before soft-delete',
          timeout: 120_000,
        }
      )
      .toBe(200);

    // Soft-delete the test case via the API. This is the path that, before
    // the fix, would stamp `deleted` onto the TCRS docs and break the next read.
    const deleteRes = await apiContext.delete(
      `/api/v1/dataQuality/testCases/${testCaseId}?recursive=true&hardDelete=false`
    );

    expect(deleteRes.status()).toBeLessThan(400);

    // The page-load API call that broke before the fix.
    const incidentListResponse = page.waitForResponse((response) =>
      response
        .url()
        .includes('/api/v1/dataQuality/testCases/testCaseIncidentStatus')
    );

    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);

    const response = await incidentListResponse;

    // The API must return 200 — before the fix this returned 500 with
    // `Unrecognized field "deleted"` in the body.
    expect(response.status()).toBe(200);

    // And the toast bar must not surface a Jackson "Unrecognized field"/"deleted" error.
    // Scope to the toast container so we don't false-positive on legitimate page text
    // (e.g. a table cell that happens to contain the word "deleted").
    const errorToast = page
      .locator('[data-testid="alert-bar"]')
      .filter({ hasText: /Unrecognized field|deleted/i });
    await expect(errorToast).toHaveCount(0);
  } finally {
    await table.delete(apiContext);
    await afterAction();
  }
});
