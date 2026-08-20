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
 * "Критичность инцидента отсутствует" (218px of rendered text against 67px in
 * English). The chip is nowrap, so its intrinsic width was the Severity column's
 * floor: the chip reached 258px, the column 306px, and the Assignee column was
 * pushed off screen.
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
const RU_NO_SEVERITY = 'Критичность инцидента отсутствует';
const VIEWPORT = { width: 1440, height: 900 };
const INCIDENT_LIST_URL =
  '**/api/v1/dataQuality/testCases/testCaseIncidentStatus**';

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

interface OpenOptions {
  incidents?: typeof REPORTED_INCIDENTS;
  navExpanded?: boolean;
}

type OpenIncidentManager = (
  locale: string,
  options?: OpenOptions
) => Promise<Page>;

const test = base.extend<{ openIncidentManager: OpenIncidentManager }>({
  openIncidentManager: async ({ browser }, use) => {
    const contexts: BrowserContext[] = [];

    await use(
      async (
        locale: string,
        { incidents = REPORTED_INCIDENTS, navExpanded = true }: OpenOptions = {}
      ) => {
        const context = await browser.newContext({
          locale,
          storageState: 'playwright/.auth/admin.json',
          viewport: VIEWPORT,
        });
        contexts.push(context);

        const page = await context.newPage();

        // Fixture rows keep the geometry deterministic: these assertions are
        // about string length driving layout, not about what the environment
        // ingested.
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

        const sidebar = page.getByTestId('left-sidebar');
        await expect(sidebar).toBeVisible();

        const isExpanded = await sidebar.evaluate((element) =>
          element.classList.contains('sidebar-open')
        );

        if (isExpanded !== navExpanded) {
          await page.getByTestId('sidebar-toggle').click();
        }

        // Poll the settled *width*, not the `sidebar-open` class: the class
        // flips synchronously with the preference while the Sider animates
        // between its two widths, so a class-based wait returns mid-transition
        // and every measurement below lands on a container that is still moving.
        await expect
          .poll(() =>
            sidebar.evaluate((element) => (element as HTMLElement).offsetWidth)
          )
          .toBe(navExpanded ? EXPANDED_NAV_WIDTH : COLLAPSED_NAV_WIDTH);

        // Every assertion here is a text measurement, so the web fonts have to
        // be resolved first — fallback metrics shift column widths by a few px.
        await page.evaluate(() => document.fonts.ready);

        return page;
      }
    );

    await Promise.all(contexts.map((context) => context.close()));
  },
});

/**
 * The chip button, addressed by its own testid. Deliberately not `chip > span`:
 * react-aria's Button wraps children in an unstyled
 * `span.transition-inherit-all`, so a positional locator resolves to that
 * wrapper — which shrink-wraps to the same width today, and would silently keep
 * passing while measuring the wrong box if it ever gained padding.
 */
const getSeverityChip = (page: Page) =>
  page.getByTestId('severity-chip').first();

const getTableContainerWidth = (page: Page) =>
  page
    .getByTestId('test-case-incident-manager-table')
    .evaluate((element) => (element.parentElement as HTMLElement).clientWidth);

test.describe('Incident Manager table in a long-string locale', () => {
  // Scoped to the reported scenario with the nav expanded. It is not a claim
  // that ru-RU fits at 1440px for every dataset: an incident in the "Assigned"
  // state adds ~98px of Status column in ru-RU and puts this edge back outside
  // the viewport. That is a separate string, not the severity chip.
  test('keeps the Assignee column on screen when the Russian severity placeholder is rendered', async ({
    openIncidentManager,
  }) => {
    test.slow(true);

    const page = await openIncidentManager(RU_LOCALE);

    // Guard: the page really is rendering the long Russian placeholder.
    await expect(getSeverityChip(page)).toContainText(RU_NO_SEVERITY);

    // Precondition, not the bug: fixes the width this assertion is measured at.
    expect(await getTableContainerWidth(page)).toBe(
      EXPANDED_NAV_CONTAINER_WIDTH
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

  // Run against both nav states because the bound is a property of the chip, not
  // of how much room the table happens to have.
  for (const navExpanded of [true, false]) {
    const navLabel = navExpanded ? 'expanded' : 'collapsed';

    test(`bounds the Russian severity chip regardless of its column, with the nav ${navLabel}`, async ({
      openIncidentManager,
    }) => {
      test.slow(true);

      const russianPage = await openIncidentManager(RU_LOCALE, { navExpanded });
      const russianChip = getSeverityChip(russianPage);

      await expect(russianChip).toContainText(RU_NO_SEVERITY);

      const russianChipBox = await russianChip.boundingBox();

      expect(Math.round(russianChipBox?.width ?? 0)).toBeLessThanOrEqual(
        CHIP_MAX_WIDTH
      );

      // A short label must still size to its content — the cap may not start
      // clipping labels that already fit.
      const englishPage = await openIncidentManager(EN_LOCALE, { navExpanded });
      const englishLabel = englishPage
        .getByTestId('severity-chip-label')
        .first();

      await expect(englishLabel).toBeVisible();

      const englishOverflow = await englishLabel.evaluate(
        (element) => element.scrollWidth - element.clientWidth
      );

      expect(englishOverflow).toBe(0);
    });
  }

  test('keeps the full Russian severity label reachable when the chip is truncated', async ({
    openIncidentManager,
  }) => {
    test.slow(true);

    const page = await openIncidentManager(RU_LOCALE);
    const severityChip = getSeverityChip(page);
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

  // Regression guard, not a reproduction: status chips are unbounded, so nothing
  // here can fail for the reason the issue describes. It exists because the
  // severity bound lives on a *shared* chip component, and the band that would
  // satisfy both columns is only [173, 184] — one Tailwind step wide. Anyone
  // moving the bound onto the shared pill breaks this.
  test('never truncates a status chip, whose labels are longest in Russian', async ({
    openIncidentManager,
  }) => {
    test.slow(true);

    const page = await openIncidentManager(RU_LOCALE, {
      incidents: ALL_STATUS_INCIDENTS,
    });
    const statusLabels = page.locator('[data-testid$="-status-label"]');

    await expect(statusLabels.first()).toBeVisible();
    await expect(statusLabels).toHaveCount(4);

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
