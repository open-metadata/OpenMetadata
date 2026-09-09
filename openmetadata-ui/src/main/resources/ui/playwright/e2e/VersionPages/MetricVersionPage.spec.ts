/*
 *  Copyright 2025 Collate.
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
import { expect, Page, test } from '@playwright/test';
import {
  DOMAIN_TAGS,
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
} from '../../constant/config';
import { MetricClass } from '../../support/entity/MetricClass';
import { createAdminApiContext } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const metric = new MetricClass();

const CUSTOM_UNIT = 'Leads';
const CHANGED_UNIT = 'DOLLARS';

// The error boundary renders this title when a render throws. Asserting on the
// text the user actually sees keeps the check off brittle CSS classes.
const ERROR_BOUNDARY_TITLE = 'Something went wrong';

// Versions are read back from the API rather than hardcoded. The backend
// consolidates successive PATCHes by the same user inside the 10 minute session
// window (EntityRepository.consolidateChanges), so a second patch here would
// fold into the first version instead of creating a new one. The fixture below
// therefore needs exactly one patch, and still reads the numbers back so a
// change in version numbering cannot silently break these tests.
let initialVersion: string;
let unitChangedVersion: string;

const toVersionLabel = (version: unknown) =>
  `v${Number.parseFloat(String(version)).toFixed(1)}`;

/**
 * Opens the version history panel and selects the given version.
 *
 * Regression guard for #32564: the metric branch of the version header read
 * `UnitOfMeasurement` from a type-only import, so the binding was erased at
 * build time and evaluating `UnitOfMeasurement.Other` threw
 * `ReferenceError: UnitOfMeasurement is not defined`, collapsing the whole
 * version page into the error boundary.
 */
const openMetricVersion = async (page: Page, versionLabel: string) => {
  const versionButton = page.getByTestId('version-button');

  await expect(versionButton).toBeVisible();
  await expect(versionButton).toBeEnabled();

  const versionResponse = page.waitForResponse((response) =>
    response
      .url()
      .includes(`/api/v1/metrics/${metric.entityResponseData.id}/versions`)
  );

  await versionButton.click();

  expect((await versionResponse).status()).toBe(200);

  const versionSelector = page.getByTestId(`version-selector-${versionLabel}`);

  await expect(versionSelector).toBeVisible();
  await versionSelector.click();

  await waitForAllLoadersToDisappear(page);
};

test.describe(
  'Metric version page',
  { tag: [DOMAIN_TAGS.GOVERNANCE, PLAYWRIGHT_BASIC_TEST_TAG_OBJ.tag] },
  () => {
    // createAdminApiContext, not performAdminLogin: on 1.13 the latter drives a
    // real browser login (browser.newPage -> admin.login -> getToken), which
    // does not fit in the 60s hook budget on a loaded shard. main and 2.0 both
    // default performAdminLogin to an API-only login, which is what this is.
    test.beforeAll('Setup metric versions', async () => {
      const { apiContext, afterAction } = await createAdminApiContext();

      // Created already carrying the custom unit, so the initial version has no
      // change description and the header falls back to the entity values. That
      // is the version shape from the issue report, and the one where the
      // customUnitOfMeasurement substitution branch actually evaluates.
      metric.entity.unitOfMeasurement = 'OTHER';
      metric.entity.customUnitOfMeasurement = CUSTOM_UNIT;

      await metric.create(apiContext);
      initialVersion = toVersionLabel(metric.entityResponseData.version);

      // The single patch this fixture can rely on: moves the unit off OTHER so
      // the next version renders a unitOfMeasurement diff.
      await metric.patch({
        apiContext,
        patchData: [
          { op: 'replace', path: '/unitOfMeasurement', value: CHANGED_UNIT },
        ],
      });
      unitChangedVersion = toVersionLabel(metric.entityResponseData.version);

      // Fail loudly if consolidation ever folds the patch into the initial
      // version — otherwise both tests would silently target the same version.
      expect(unitChangedVersion).not.toBe(initialVersion);

      await afterAction();
    });

    test.afterAll('Cleanup metric', async () => {
      const { apiContext, afterAction } = await createAdminApiContext();

      await metric.delete(apiContext);

      await afterAction();
    });

    test.beforeEach('Visit metric details page', async ({ page }) => {
      await redirectToHomePage(page);
      await metric.visitEntityPage(page);
      await waitForAllLoadersToDisappear(page);
    });

    test('should show the custom unit on the version that carries it', async ({
      page,
    }) => {
      await test.step('Open the initial version', async () => {
        await openMetricVersion(page, initialVersion);
      });

      await test.step('Version header renders instead of the error boundary', async () => {
        // The bug surfaced as the error boundary replacing the page, so check
        // this first — it fails with a clearer message than a locator timeout.
        await expect(page.getByText(ERROR_BOUNDARY_TITLE)).toBeHidden();

        await expect(
          page.getByTestId('unit-of-measurement-version-info')
        ).toContainText(CUSTOM_UNIT);
        await expect(
          page.getByTestId('metric-type-version-info')
        ).toContainText(metric.entity.metricType);
        await expect(
          page.getByTestId('granularity-version-info')
        ).toContainText(metric.entity.granularity);
      });
    });

    test('should show both sides of the diff on the version that changes the unit', async ({
      page,
    }) => {
      await test.step('Open the version that changed the unit', async () => {
        await openMetricVersion(page, unitChangedVersion);
      });

      await test.step('Unit of measurement shows the old and new value', async () => {
        await expect(page.getByText(ERROR_BOUNDARY_TITLE)).toBeHidden();

        // On the diffing version the header renders the old/new unit markup
        // rather than the custom unit, so assert on both sides of the diff.
        const unitInfo = page.getByTestId('unit-of-measurement-version-info');

        await expect(unitInfo).toContainText('OTHER');
        await expect(unitInfo).toContainText(CHANGED_UNIT);
      });
    });
  }
);
