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
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const metric = new MetricClass();

const CUSTOM_UNIT = 'Leads';

// The error boundary renders this title when a render throws. Asserting on the
// text the user actually sees keeps the check off brittle CSS classes.
const ERROR_BOUNDARY_TITLE = 'Something went wrong';

/**
 * Opens the version history panel and selects the given version.
 *
 * Regression guard for #32564: the metric branch of the version header read
 * `UnitOfMeasurement` from a type-only import, so the binding was erased at
 * build time and evaluating `UnitOfMeasurement.Other` threw
 * `ReferenceError: UnitOfMeasurement is not defined`, collapsing the whole
 * version page into the error boundary.
 */
const openMetricVersion = async (page: Page, version: string) => {
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

  const versionSelector = page.getByTestId(`version-selector-v${version}`);

  await expect(versionSelector).toBeVisible();
  await versionSelector.click();

  await waitForAllLoadersToDisappear(page);
};

test.describe(
  'Metric version page',
  { tag: [DOMAIN_TAGS.GOVERNANCE, PLAYWRIGHT_BASIC_TEST_TAG_OBJ.tag] },
  () => {
    test.beforeAll('Setup metric versions', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await metric.create(apiContext);

      // v0.2 — switches the unit to OTHER and supplies the custom unit. This is
      // the version whose diff touches unitOfMeasurement/customUnitOfMeasurement.
      await metric.patch({
        apiContext,
        patchData: [
          { op: 'replace', path: '/unitOfMeasurement', value: 'OTHER' },
          { op: 'add', path: '/customUnitOfMeasurement', value: CUSTOM_UNIT },
        ],
      });

      // v0.3 — an unrelated change, so the unit fields are carried over rather
      // than diffed. This is the version shape from the issue report, where the
      // custom-unit substitution branch is the one that actually evaluates.
      await metric.patch({
        apiContext,
        patchData: [
          {
            op: 'replace',
            path: '/description',
            value: 'Updated description for the metric version page test',
          },
        ],
      });

      await afterAction();
    });

    test.afterAll('Cleanup metric', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await metric.delete(apiContext);

      await afterAction();
    });

    test.beforeEach('Visit metric details page', async ({ page }) => {
      await redirectToHomePage(page);
      await metric.visitEntityPage(page);
      await waitForAllLoadersToDisappear(page);
    });

    test('should show the custom unit on a version that carries it over', async ({
      page,
    }) => {
      test.slow();

      await test.step('Open version 0.3', async () => {
        await openMetricVersion(page, '0.3');
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
      test.slow();

      await test.step('Open version 0.2', async () => {
        await openMetricVersion(page, '0.2');
      });

      await test.step('Unit of measurement shows the old and new value', async () => {
        await expect(page.getByText(ERROR_BOUNDARY_TITLE)).toBeHidden();

        // On the diffing version the header renders the old/new unit markup
        // rather than the custom unit, so assert on both sides of the diff.
        const unitInfo = page.getByTestId('unit-of-measurement-version-info');

        await expect(unitInfo).toContainText(metric.entity.unitOfMeasurement);
        await expect(unitInfo).toContainText('OTHER');
      });
    });

    test('should show the standard unit on the initial version', async ({
      page,
    }) => {
      test.slow();

      await test.step('Open version 0.1', async () => {
        await openMetricVersion(page, '0.1');
      });

      await test.step('Unit of measurement falls back to the entity value', async () => {
        await expect(page.getByText(ERROR_BOUNDARY_TITLE)).toBeHidden();

        await expect(
          page.getByTestId('unit-of-measurement-version-info')
        ).toContainText(metric.entity.unitOfMeasurement);
      });
    });
  }
);
