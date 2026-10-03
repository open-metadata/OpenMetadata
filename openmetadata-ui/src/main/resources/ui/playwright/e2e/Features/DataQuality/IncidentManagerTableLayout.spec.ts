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
import { DatabaseServiceClass } from '../../../support/entity/service/DatabaseServiceClass';
import { TableClass } from '../../../support/entity/TableClass';
import { performAdminLogin } from '../../../utils/admin';
import { uuid } from '../../../utils/common';
import { getCurrentMillis } from '../../../utils/dateTime';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

// The app-mode Incident Manager lists incidents in groups, so the one-by-one
// incident table these guards measure is checked on the classic page. Both
// defects come from the table's own cells, not from the page around it.

test.use({
  storageState: 'playwright/.auth/admin.json',
});

/** `w-72` — the width the incident name cell declares for itself. */
const NAME_COLUMN_WIDTH = 288;

/**
 * Two independent column-sizing defects in the incident table, both caused by
 * `overflow-wrap` changing a cell's min-content contribution: a long test
 * case name stretched the name column across the table, and — once every row
 * was unassigned — the Assignee column collapsed until "No Assignee" stacked
 * one letter per line.
 */
test.describe('Incident Manager — table column widths', () => {
  test.describe.configure({ mode: 'serial' });

  // Own service, although nothing here touches the parents: with the table
  // under the shard's shared chain the incident reached the DB API but never
  // the incident search index this page reads (seen on every run). Cause not
  // yet traced; this keeps the layout check independent of it.
  const table = new TableClass({ service: new DatabaseServiceClass() });
  // Long enough to stretch the column well past its declared width, and made
  // of one unbroken token so `overflow-wrap` is the only thing that can wrap
  // it — which is precisely what regressed.
  const longTestCaseName = `pw_ai_accepted_values_fct_delinquency_delinquency_bucket__current__dpd_1_29__dpd_30_59__dpd_60_89__dpd_90_plus__charge_off_${uuid()}`;

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(3 * 60 * 1000);

    const { apiContext, afterAction } = await performAdminLogin(browser);
    const failedAt = getCurrentMillis();

    const testCase = await table.createTestCase(apiContext, {
      name: longTestCaseName,
    });
    await table.addTestCaseResult(apiContext, testCase['fullyQualifiedName'], {
      result: 'Seeded failing result to create an incident.',
      testResultValue: [{ name: 'seeded', value: '0' }],
      testCaseStatus: 'Failed',
      timestamp: failedAt,
    });

    // The incident list is search-backed, so the row is not visible until the
    // failed result has been indexed.
    await expect
      .poll(
        async () => {
          const response = await apiContext.get(
            `/api/v1/dataQuality/testCases/testCaseIncidentStatus?latest=true` +
              `&startTs=${failedAt - 60_000}&endTs=${
                failedAt + 120_000
              }&limit=100`
          );

          if (!response.ok()) {
            return false;
          }

          const body = await response.json();

          return (body.data ?? []).some(
            (incident: {
              testCaseReference?: { fullyQualifiedName?: string };
            }) =>
              incident.testCaseReference?.fullyQualifiedName ===
              testCase['fullyQualifiedName']
          );
        },
        { timeout: 90_000, intervals: [2_000, 3_000, 5_000] }
      )
      .toBe(true);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test('a long test case name wraps instead of widening the column', async ({
    page,
  }) => {
    await page.goto('/incident-manager', {
      waitUntil: 'domcontentloaded',
    });
    await waitForAllLoadersToDisappear(page);

    const nameLink = page.getByTestId(`test-case-${longTestCaseName}`);

    await expect(nameLink).toBeVisible();

    // eslint-disable-next-line om-playwright/no-positional-locator -- the name column IS the first column; its width is the measurement under test
    const nameColumnWidth = await page
      .getByTestId('test-case-incident-manager-table')
      .locator('thead th')
      .first()
      .evaluate((element) => Math.round(element.getBoundingClientRect().width));

    // Before the fix this column grew to the full width of the longest name
    // (~900px on a 1033px container). A little slack absorbs sub-pixel
    // rounding; the point is that the name no longer sets the width.
    expect(nameColumnWidth).toBeLessThanOrEqual(NAME_COLUMN_WIDTH + 24);

    // Wrapping is the intended behaviour — the name must still be fully
    // readable, so the cell grows in height rather than in width.
    const linkBox = await nameLink.boundingBox();

    expect(linkBox?.height).toBeGreaterThan(20);
  });

  test('the Assignee column stays on one line when every row is unassigned', async ({
    page,
  }) => {
    // Filtering to New leaves only unassigned incidents, so nothing else in
    // the column holds it open — the condition the collapse needed.
    await page.goto('/incident-manager?testCaseResolutionStatusType=New', {
      waitUntil: 'domcontentloaded',
    });
    await waitForAllLoadersToDisappear(page);

    const incidentTable = page.getByTestId('test-case-incident-manager-table');

    await expect(incidentTable).toBeVisible();

    // An unassigned cell renders the unified <Owner> inline empty state: the
    // `owner-label` row holds a no-owner icon, the "No Assignee" placeholder
    // <span>, and the inline edit selector (itself a <span>) — all on one
    // line. The placeholder is the first direct-child <span>. The
    // `owner-link` element does not exist when there is no owner to link to.
    // eslint-disable-next-line om-playwright/no-positional-locator -- every row is unassigned by construction here, so any assignee cell exercises the same wrapping rule
    const placeholder = incidentTable
      .getByTestId('assignee')
      .first()
      .getByTestId('owner-label')
      .locator('> span')
      .first();

    await expect(placeholder).toBeVisible();

    const placeholderBox = await placeholder.boundingBox();

    // One line of `text-xs` is ~18px tall. The regression stacked "No
    // Assignee" one character per line, six lines deep (~108px).
    expect(placeholderBox?.height).toBeLessThan(30);

    // The height check above only bites when every row on the page is
    // unassigned — a single assigned row elsewhere in a shared environment
    // holds the column open and the assertion passes for the wrong reason.
    // The cell's own `white-space` is what actually prevents the collapse,
    // and it holds whatever the seeded data looks like.
    await expect(
      // eslint-disable-next-line om-playwright/no-positional-locator -- as above: all rows share the unassigned shape, so the first cell is representative
      incidentTable.getByTestId('assignee').first().locator('xpath=..')
    ).toHaveCSS('white-space', 'nowrap');
  });
});
