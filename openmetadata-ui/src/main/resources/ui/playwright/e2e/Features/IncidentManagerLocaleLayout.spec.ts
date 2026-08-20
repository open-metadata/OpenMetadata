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
import {
  expect,
  test as base,
  type BrowserContext,
  type Page,
} from '@playwright/test';

/**
 * Issue #30522 — Russian composes the "No Severity" placeholder as
 * "Критичность инцидента отсутствует" (218px of text against 67px in English).
 * The chip that renders it is nowrap, so its intrinsic width was the Severity
 * column's floor: the column grew to 306px, the table outgrew its container and
 * the Assignee column was pushed off screen.
 *
 * These assertions are geometric on purpose. Asserting a truncation class name
 * would pass just as happily with the layout still broken.
 */
const RU_LOCALE = 'ru-RU';
const EN_LOCALE = 'en-US';
const RU_NO_SEVERITY = 'Критичность инцидента отсутствует';
const VIEWPORT = { width: 1440, height: 900 };
const INCIDENT_LIST_URL =
  '**/api/v1/dataQuality/testCases/testCaseIncidentStatus**';

/** Mirrors `max-w-44` on CHIP_PILL_CLASS; +2px absorbs sub-pixel rounding. */
const CHIP_MAX_WIDTH = 178;

const buildIncidentRow = (index: number, severity?: string) => {
  const name = `pw_locale_incident_${index}`;

  return {
    id: `00000000-0000-4000-8000-00000000000${index}`,
    stateId: `10000000-0000-4000-8000-00000000000${index}`,
    timestamp: Date.now() - index * 3_600_000,
    testCaseResolutionStatusType: 'New',
    ...(severity ? { severity } : {}),
    testCaseReference: {
      id: `20000000-0000-4000-8000-00000000000${index}`,
      type: 'testCase',
      name,
      fullyQualifiedName: `pw_svc.pw_db.pw_schema.pw_table.${name}`,
      displayName: name,
      deleted: false,
    },
  };
};

// Every row is unassigned and all but one carry no severity — the state the
// issue reports, and the one that renders both placeholders at full length.
const INCIDENT_LIST_BODY = {
  data: [
    buildIncidentRow(0),
    buildIncidentRow(1),
    buildIncidentRow(2, 'Severity3'),
    buildIncidentRow(3),
  ],
  paging: { total: 4 },
};

type OpenIncidentManager = (locale: string) => Promise<Page>;

const test = base.extend<{ openIncidentManager: OpenIncidentManager }>({
  openIncidentManager: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];

    await use(async (locale: string) => {
      const context = await browser.newContext({
        locale,
        storageState: 'playwright/.auth/admin.json',
        viewport: VIEWPORT,
      });
      contexts.push(context);

      const page = await context.newPage();

      // Fixture rows keep the geometry deterministic: these assertions are about
      // string length driving layout, not about what the environment ingested.
      await page.route(INCIDENT_LIST_URL, (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(INCIDENT_LIST_BODY),
        })
      );

      await page.goto(`/incident-manager?lng=${locale}`);

      await expect(
        page.getByTestId('test-case-incident-manager-table')
      ).toBeVisible();
      await expect(page.getByTestId('severity-chip').first()).toBeVisible();

      // Every assertion here is a text measurement, so the web fonts have to be
      // resolved first — fallback metrics shift column widths by a few px.
      await page.evaluate(() => document.fonts.ready);

      return page;
    });

    await Promise.all(contexts.map((context) => context.close()));
  },
});

/** The pill span inside the chip button — the box that carries the width. */
const getSeverityPill = (page: Page) =>
  page.getByTestId('severity-chip').first().locator('span').first();

test.describe('Incident Manager table in a long-string locale', () => {
  test('keeps the Assignee column on screen when the Russian severity placeholder is rendered', async ({
    openIncidentManager,
  }) => {
    test.slow(true);

    const page = await openIncidentManager(RU_LOCALE);

    // Guard: the page really is rendering the long Russian placeholder.
    await expect(page.getByTestId('severity-chip').first()).toContainText(
      RU_NO_SEVERITY
    );

    const assigneeCell = page
      .getByTestId('test-case-incident-manager-table')
      .locator('tbody tr')
      .first()
      .locator('td')
      .filter({ has: page.getByTestId('assignee') });

    const assigneeBox = await assigneeCell.boundingBox();

    expect(assigneeBox).not.toBeNull();
    expect(
      Math.round((assigneeBox?.x ?? 0) + (assigneeBox?.width ?? 0))
    ).toBeLessThanOrEqual(VIEWPORT.width);
  });

  test('bounds the Russian severity chip instead of letting it widen its column', async ({
    openIncidentManager,
  }) => {
    test.slow(true);

    const russianPage = await openIncidentManager(RU_LOCALE);
    const russianPill = getSeverityPill(russianPage);

    await expect(russianPill).toContainText(RU_NO_SEVERITY);

    const russianPillBox = await russianPill.boundingBox();

    expect(Math.round(russianPillBox?.width ?? 0)).toBeLessThanOrEqual(
      CHIP_MAX_WIDTH
    );

    // A short label must still size to its content — the cap may not start
    // clipping labels that already fit.
    const englishPage = await openIncidentManager(EN_LOCALE);
    const englishLabel = englishPage.getByTestId('severity-chip-label').first();

    const englishOverflow = await englishLabel.evaluate(
      (element) => element.scrollWidth - element.clientWidth
    );

    expect(englishOverflow).toBe(0);
  });

  test('keeps the full Russian severity label reachable when the chip is truncated', async ({
    openIncidentManager,
  }) => {
    test.slow(true);

    const page = await openIncidentManager(RU_LOCALE);
    const severityChip = page.getByTestId('severity-chip').first();
    const severityLabel = severityChip.getByTestId('severity-chip-label');

    // The label is genuinely clipped, so the hover affordance is load-bearing.
    const labelOverflow = await severityLabel.evaluate(
      (element) => element.scrollWidth - element.clientWidth
    );

    expect(labelOverflow).toBeGreaterThan(0);
    await expect(severityLabel).toHaveAttribute('title', RU_NO_SEVERITY);

    // Truncation is visual only — the button's accessible name still carries
    // the whole string.
    await expect(severityChip).toContainText(RU_NO_SEVERITY);
  });
});
