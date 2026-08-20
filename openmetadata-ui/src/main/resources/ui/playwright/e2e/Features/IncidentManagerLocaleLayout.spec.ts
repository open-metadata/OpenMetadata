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

/** Mirrors CHIP_LABEL_MAX_WIDTH (`max-w-44`); +2px absorbs sub-pixel rounding. */
const CHIP_MAX_WIDTH = 178;

/**
 * The capped pill (176px) plus the cell's own 2 x 24px padding leaves the column
 * at 228px; 240px allows a little slack without admitting the 306px it reached
 * while the chip was unbounded.
 */
const SEVERITY_COLUMN_MAX_WIDTH = 240;

const buildIncidentRow = (
  index: number,
  statusType: string,
  severity?: string
) => {
  const name = `pw_locale_incident_${index}`;

  return {
    id: `00000000-0000-4000-8000-00000000000${index}`,
    stateId: `10000000-0000-4000-8000-00000000000${index}`,
    timestamp: Date.now() - index * 3_600_000,
    testCaseResolutionStatusType: statusType,
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

// The scenario the issue reports: freshly-raised incidents, every row unassigned
// and all but one without a severity, so both placeholders render at full length.
const REPORTED_INCIDENTS = {
  data: [
    buildIncidentRow(0, 'New'),
    buildIncidentRow(1, 'New'),
    buildIncidentRow(2, 'New', 'Severity3'),
    buildIncidentRow(3, 'New'),
  ],
  paging: { total: 4 },
};

// Separate fixture for the status guard so it sees every translated status label
// rather than four copies of "New". Kept apart from REPORTED_INCIDENTS on
// purpose: in ru-RU the "Assigned" label renders a 172.7px pill and widens the
// Status column by ~98px, which is its own width contributor and would confound
// the severity geometry assertions.
const ALL_STATUS_INCIDENTS = {
  data: [
    buildIncidentRow(0, 'New'),
    buildIncidentRow(1, 'Ack'),
    buildIncidentRow(2, 'Assigned', 'Severity3'),
    buildIncidentRow(3, 'Resolved'),
  ],
  paging: { total: 4 },
};

type OpenIncidentManager = (
  locale: string,
  incidents?: typeof REPORTED_INCIDENTS
) => Promise<Page>;

const test = base.extend<{ openIncidentManager: OpenIncidentManager }>({
  openIncidentManager: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];

    await use(async (locale: string, incidents = REPORTED_INCIDENTS) => {
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
          body: JSON.stringify(incidents),
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

/**
 * The pill is addressed by its own testid, not by `chip > span`: react-aria's
 * Button wraps children in an unstyled `span.transition-inherit-all`, so the
 * positional locator resolves to that wrapper — which shrink-wraps to the same
 * width today, and would silently keep passing if it ever gained padding.
 */
const getSeverityPill = (page: Page) =>
  page.getByTestId('severity-chip-pill').first();

test.describe('Incident Manager table in a long-string locale', () => {
  // Scoped to the reported scenario. It is not a claim that ru-RU fits at 1440px
  // for every dataset: an incident in the "Assigned" state adds ~98px of Status
  // column in ru-RU and puts this edge back outside the viewport. That is a
  // separate string, not the severity chip, and is out of scope here.
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

    // Asserted on the <td> first, because that element exists either way: it is
    // the column the chip was inflating, and it reads 306px unbounded.
    const severityCell = russianPage
      .getByTestId('test-case-incident-manager-table')
      .locator('tbody tr')
      .first()
      .locator('td')
      .filter({ has: russianPage.getByTestId('severity-chip') });

    const severityCellBox = await severityCell.boundingBox();

    expect(Math.round(severityCellBox?.width ?? 0)).toBeLessThanOrEqual(
      SEVERITY_COLUMN_MAX_WIDTH
    );

    // Then on the pill itself, to pin which box is doing the bounding.
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

    // Assert presence before measuring: `.evaluate()` on a missing locator hangs
    // until the test timeout instead of failing on the real assertion.
    await expect(severityLabel).toBeVisible();

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

  // Regression guard, not a reproduction: status chips are unbounded today, so
  // this passes before and after the fix. It exists because the severity cap
  // lives on a *shared* chip component, and widening it to the ~192px that
  // status would need re-inflates the severity column by 16px and puts the
  // Assignee column back off screen. Status must stay unbounded; ru-RU is the
  // worst case at 172.7px ("Назначен исполнитель").
  test('never truncates a status chip, whose labels are longest in Russian', async ({
    openIncidentManager,
  }) => {
    test.slow(true);

    const page = await openIncidentManager(RU_LOCALE, ALL_STATUS_INCIDENTS);
    const statusLabels = page.locator('[data-testid$="-status-label"]');

    await expect(statusLabels.first()).toBeVisible();
    await expect(statusLabels).toHaveCount(4);

    const clipped = await statusLabels.evaluateAll((elements) =>
      elements
        .filter((element) => element.scrollWidth > element.clientWidth)
        .map((element) => element.textContent)
    );

    expect(clipped).toEqual([]);
  });
});
