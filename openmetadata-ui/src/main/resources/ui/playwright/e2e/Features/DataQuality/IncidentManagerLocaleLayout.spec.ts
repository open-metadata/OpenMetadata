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
import { type Page } from '@playwright/test';
import { expect, test } from '../../../support/fixtures/base';

/**
 * Issue #30522 — a long Russian "No Severity" placeholder made the nowrap chip
 * the Severity column's intrinsic-width floor and pushed the Assignee column
 * off screen. The Russian translation is now generic, but its rendered text
 * still exceeds the label's budget after the pill padding and edit chevron are
 * accounted for, so it remains a real truncation case for the column bound.
 *
 * These assertions are geometric on purpose. Asserting a truncation class name
 * would pass just as happily with the layout still broken.
 *
 * The left nav is pinned explicitly in every case. It is persisted per user in
 * localStorage (`user-preferences-store`), so it rides along in the saved
 * storageState and differs between machines — and it moves the table's container
 * from 1178px (expanded) to 1334px (collapsed). At 1334px the pre-fix layout
 * happens to fit, so without pinning the headline test below passes against the
 * unfixed code.
 */
const RU_LOCALE = 'ru-RU';
const EN_LOCALE = 'en-US';
const RU_NO_SEVERITY = 'Серьёзность отсутствует';
const VIEWPORT = { width: 1440, height: 900 };
const INCIDENT_LIST_URL =
  '**/api/v1/dataQuality/testCases/testCaseIncidentStatus**';
const INCIDENT_TABLE_TEST_ID = 'test-case-incident-manager-table';
const SEVERITY_CHIP_TEST_ID = 'severity-chip';
const SEVERITY_CHIP_LABEL_TEST_ID = 'severity-chip-label';

/**
 * Width of the table's scroll container with the nav expanded at VIEWPORT. Not a
 * bound under test — a precondition, so that a layout change which moves the
 * container fails loudly here instead of quietly changing what the geometry
 * assertions mean.
 */
const EXPANDED_NAV_CONTAINER_WIDTH = 1178;

/** The two widths LeftSidebar declares (`width` / `collapsedWidth`). */
const EXPANDED_NAV_WIDTH = 228;
const COLLAPSED_NAV_WIDTH = 72;

/**
 * The chip button measures 258px unbounded and 180px capped, in *both* nav
 * states — unlike the column, whose width depends on how auto-layout hands out
 * surplus container space (228px expanded vs 266px collapsed for the same 176px
 * pill). This is the bound the fix actually establishes.
 */
const CHIP_MAX_WIDTH = 182;

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

/**
 * The fixture row every severity assertion below is made against: index 0 is
 * built without a `severity`, so it renders the "No Severity" placeholder this
 * spec is about. Addressing it by name keeps each locator resolving to exactly
 * one element — a positional locator would quietly pick whichever chip the DOM
 * happened to order first, and would keep passing if the row under test stopped
 * rendering one at all.
 */
const NO_SEVERITY_ROW = 'pw_locale_incident_0';

const getIncidentRow = (page: Page, name: string) =>
  page
    .getByTestId(INCIDENT_TABLE_TEST_ID)
    .locator('tbody tr')
    .filter({ hasText: name });

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

/**
 * Opens the Incident Manager on fixture rows. The rows keep the geometry
 * deterministic: these assertions are about string length driving layout, not
 * about what the environment ingested — so nothing here creates an entity.
 */
const openIncidentManager = async (
  page: Page,
  locale: string,
  incidents: typeof REPORTED_INCIDENTS = REPORTED_INCIDENTS
) => {
  await page.route(INCIDENT_LIST_URL, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(incidents),
    })
  );

  await page.goto(`/incident-manager?lng=${locale}`);

  await expect(page.getByTestId(INCIDENT_TABLE_TEST_ID)).toBeVisible();
  await expect(
    getIncidentRow(page, NO_SEVERITY_ROW).getByTestId(SEVERITY_CHIP_TEST_ID)
  ).toBeVisible();

  // Every assertion here is a text measurement, so the web fonts have to be
  // resolved first — fallback metrics shift column widths by a few px.
  await page.evaluate(() => document.fonts.ready);
};

const pinNav = async (page: Page, navExpanded: boolean) => {
  const sidebar = page.getByTestId('left-sidebar');

  await expect(sidebar).toBeVisible();

  const isExpanded = await sidebar.evaluate((element) =>
    element.classList.contains('sidebar-open')
  );

  if (isExpanded !== navExpanded) {
    await page.getByTestId('sidebar-toggle').click();
  }

  // Poll the settled *width*, not the `sidebar-open` class: the class flips
  // synchronously with the preference while the Sider animates between its two
  // widths, so a class-based wait returns mid-transition and every measurement
  // below lands on a container that is still moving.
  await expect
    .poll(() =>
      sidebar.evaluate((element) => (element as HTMLElement).offsetWidth)
    )
    .toBe(navExpanded ? EXPANDED_NAV_WIDTH : COLLAPSED_NAV_WIDTH);
};

/**
 * The chip button, addressed by its own testid. Deliberately not `chip > span`:
 * react-aria's Button wraps children in an unstyled
 * `span.transition-inherit-all`, so a positional locator resolves to that
 * wrapper — which shrink-wraps to the same width today, and would silently keep
 * passing while measuring the wrong box if it ever gained padding.
 */
const getSeverityChip = (page: Page) =>
  getIncidentRow(page, NO_SEVERITY_ROW).getByTestId(SEVERITY_CHIP_TEST_ID);

const getTableContainerWidth = (page: Page) =>
  page
    .getByTestId(INCIDENT_TABLE_TEST_ID)
    .evaluate((element) => (element.parentElement as HTMLElement).clientWidth);

// Admin sees the chevron affordance on the chip, so the pill renders at the
// width the issue describes.
test.use({ storageState: 'playwright/.auth/admin.json', viewport: VIEWPORT });

test.describe('Incident Manager table in a long-string locale', () => {
  test.use({ locale: RU_LOCALE });

  test.beforeEach(async ({ page }) => {
    await openIncidentManager(page, RU_LOCALE);
  });

  // Scoped to the reported scenario with the nav expanded. It is not a claim
  // that ru-RU fits at 1440px for every dataset: an incident in the "Assigned"
  // state adds ~98px of Status column in ru-RU and puts this edge back outside
  // the viewport. That is a separate string, not the severity chip.
  test('keeps the Assignee column on screen when the Russian severity placeholder is rendered', async ({
    page,
  }) => {
    await pinNav(page, true);

    // Guard: the page really is rendering the long Russian placeholder.
    await expect(getSeverityChip(page)).toContainText(RU_NO_SEVERITY);

    // Precondition, not the bug: fixes the width this assertion is measured at.
    expect(await getTableContainerWidth(page)).toBe(
      EXPANDED_NAV_CONTAINER_WIDTH
    );

    const assigneeCell = getIncidentRow(page, NO_SEVERITY_ROW)
      .locator('td')
      .filter({ has: page.getByTestId('assignee') });

    const assigneeBox = await assigneeCell.boundingBox();

    expect(assigneeBox).not.toBeNull();
    expect(
      Math.round((assigneeBox?.x ?? 0) + (assigneeBox?.width ?? 0))
    ).toBeLessThanOrEqual(VIEWPORT.width);
  });

  // Run against both nav states because the bound is a property of the chip, not
  // of how much room the table happens to have.
  for (const navExpanded of [true, false]) {
    const navLabel = navExpanded ? 'expanded' : 'collapsed';

    test(`bounds the Russian severity chip regardless of its column, with the nav ${navLabel}`, async ({
      page,
    }) => {
      await pinNav(page, navExpanded);

      const severityChip = getSeverityChip(page);

      await expect(severityChip).toContainText(RU_NO_SEVERITY);

      const severityChipBox = await severityChip.boundingBox();

      expect(Math.round(severityChipBox?.width ?? 0)).toBeLessThanOrEqual(
        CHIP_MAX_WIDTH
      );
    });
  }

  test('keeps the full Russian severity label reachable when the chip is truncated', async ({
    page,
  }) => {
    await pinNav(page, true);

    const severityChip = getSeverityChip(page);
    const severityLabel = severityChip.getByTestId(SEVERITY_CHIP_LABEL_TEST_ID);

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
});

// Regression guard, not a reproduction: status chips are unbounded, so nothing
// here can fail for the reason the issue describes. It exists because the
// severity bound lives on a *shared* chip component, and the band that would
// satisfy both columns is only [173, 184] — one Tailwind step wide. Anyone
// moving the bound onto the shared pill breaks this.
test.describe('Incident Manager status chips in a long-string locale', () => {
  test.use({ locale: RU_LOCALE });

  test.beforeEach(async ({ page }) => {
    await openIncidentManager(page, RU_LOCALE, ALL_STATUS_INCIDENTS);
  });

  test('never truncates a status chip, whose labels are longest in Russian', async ({
    page,
  }) => {
    await pinNav(page, true);

    const statusLabels = page.locator('[data-testid$="-status-label"]');

    await expect(statusLabels).toHaveCount(4);

    // `toHaveCount` waits for attachment, not for layout. A label that never
    // laid out measures 0/0, which reads as "not clipped" below, so establish
    // that all four rendered before drawing conclusions from their widths.
    const widths = await statusLabels.evaluateAll((elements) =>
      elements.map((element) => element.clientWidth)
    );

    expect(widths.filter((width) => width === 0)).toEqual([]);

    const clipped = await statusLabels.evaluateAll((elements) =>
      elements
        .filter((element) => element.scrollWidth > element.clientWidth)
        .map((element) => element.textContent)
    );

    expect(clipped).toEqual([]);

    // An unbounded chip must not advertise a tooltip it has no need for.
    const titles = await statusLabels.evaluateAll((elements) =>
      elements.map((element) => element.getAttribute('title'))
    );

    expect(titles).toEqual([null, null, null, null]);
  });
});

test.describe('Incident Manager table in a short-string locale', () => {
  test.use({ locale: EN_LOCALE });

  test.beforeEach(async ({ page }) => {
    await openIncidentManager(page, EN_LOCALE);
  });

  // The cap may not start clipping labels that already fit, in either nav state.
  for (const navExpanded of [true, false]) {
    const navLabel = navExpanded ? 'expanded' : 'collapsed';

    test(`leaves a short severity label sized to its content, with the nav ${navLabel}`, async ({
      page,
    }) => {
      await pinNav(page, navExpanded);

      const severityLabel = getIncidentRow(page, NO_SEVERITY_ROW).getByTestId(
        SEVERITY_CHIP_LABEL_TEST_ID
      );

      await expect(severityLabel).toBeVisible();

      const labelOverflow = await severityLabel.evaluate(
        (element) => element.scrollWidth - element.clientWidth
      );

      expect(labelOverflow).toBe(0);
    });
  }
});
