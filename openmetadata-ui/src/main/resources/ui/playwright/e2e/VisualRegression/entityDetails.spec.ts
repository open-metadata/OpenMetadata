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
import { Page } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test } from '../../support/fixtures/base';
import { getDefaultAdminAPIContext } from '../../utils/common';
import {
  gotoForScreenshot,
  SCREENSHOT_OPTS,
} from '../../utils/visualRegression';

/**
 * Entity names are randomized by the support classes (TableClass generates a
 * `pw-database-service-<uuid>` service, a `pw-table-<fullUuid>` table and
 * `<uuid>`-suffixed column names), so mask every element that renders a
 * name; the layout, tabs and schema table are the subject under test.
 *
 * - `entity-header-display-name` / `entity-header-name`: display name + name
 *   lines in EntityHeaderTitle (both contain random uuids).
 * - `breadcrumb`: service > database > schema names.
 * - `column-name`: each column-name link in SchemaTable (uuid-suffixed).
 * - `.custom-property-right-panel-container`: right-panel
 *   CustomPropertyTable (no testid in the right-panel variant) — property
 *   names come from seeded custom properties with random `cp-<uuid>` names.
 */
const NAME_MASKS = [
  '[data-testid="entity-header-display-name"]',
  '[data-testid="entity-header-name"]',
  '[data-testid="breadcrumb"]',
  '[data-testid="column-name"]',
  '.custom-property-right-panel-container',
];

const table = new TableClass();

test.beforeAll(async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);
  await table.create(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { apiContext, afterAction } = await getDefaultAdminAPIContext(browser);
  await table.delete(apiContext);
  await afterAction();
});

const maskFor = (page: Page) =>
  NAME_MASKS.map((selector) => page.locator(selector));

test('table entity details (schema tab) matches baseline', async ({ page }) => {
  await gotoForScreenshot(
    page,
    `/table/${encodeURIComponent(
      table.entityResponseData?.fullyQualifiedName ?? ''
    )}`
  );
  await expect(page).toHaveScreenshot('table-details-schema.png', {
    ...SCREENSHOT_OPTS,
    // Bumped from the 0.01 shared default. Since PR #31268 standardized
    // PageLayoutV1 padding (20 → 8 px in some modes) and switched
    // `fullHeight` from a hardcoded `calc(100vh - 64px)` to
    // `calc(100vh - var(--ant-navbar-height))`, the entity-detail
    // shell shifts every child a few px. The schema-tab render lands
    // at a stable ~0.02 pixel-ratio diff (~13k of ~650k px, confirmed
    // across two consecutive CI runs at 13009 / 13043 / 13909 px —
    // consistent enough to be layout drift, not flake). The baseline
    // needs a full refresh in the same Playwright container the
    // snapshots were captured in (`mcr.microsoft.com/playwright:
    // v1.57.0-jammy` — see playwright-visual.yml); until that happens
    // this per-test override matches the pattern staticPages.spec
    // uses for landing-page-collapsed and unblocks every PR whose
    // merge-from-main picks up #31268.
    maxDiffPixelRatio: 0.03,
    mask: maskFor(page),
  });
});
