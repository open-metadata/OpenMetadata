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
import { expect, test } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import {
  closeCertificationDropdown,
  openCertificationDropdown,
  setAllSystemCertificationTagsDisabled,
  setCertificationClassificationDisabled,
  setTagDisabledByFqn,
  SYSTEM_CERTIFICATION_TAGS,
} from '../../utils/certification';
import { createNewPage, redirectToHomePage } from '../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();

/**
 * These tests modify global system-level certification tags (Gold, Silver, Bronze)
 * and the Certification classification. They MUST run in isolation to avoid
 * flakiness when other tests depend on these system resources.
 *
 * This file is configured to run as a separate project with fullyParallel: false
 * to ensure these tests don't interfere with other parallel test execution.
 */
test.describe.serial('System Level Certification Tags', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.create(apiContext);
    await setCertificationClassificationDisabled(apiContext, false);
    await setAllSystemCertificationTagsDisabled(apiContext, false);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await setCertificationClassificationDisabled(apiContext, false);
    await setAllSystemCertificationTagsDisabled(apiContext, false);
    await table.delete(apiContext);
    await afterAction();
  });

  test('should NOT show disabled system certification tag in dropdown', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    const disabledTagFqn = 'Certification.Gold';
    await setTagDisabledByFqn(apiContext, disabledTagFqn, true);

    try {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openCertificationDropdown(page);

      // Disabled Gold tag should NOT be visible
      await expect(
        page.getByTestId(`radio-btn-${disabledTagFqn}`)
      ).not.toBeVisible();

      // Other system tags should still be visible
      await expect(
        page.getByTestId('radio-btn-Certification.Silver')
      ).toBeVisible();
      await expect(
        page.getByTestId('radio-btn-Certification.Bronze')
      ).toBeVisible();

      await closeCertificationDropdown(page);
    } finally {
      await setTagDisabledByFqn(apiContext, disabledTagFqn, false);
      await afterAction();
    }
  });

  test('should NOT show any system certification tags when classification is disabled', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await setCertificationClassificationDisabled(apiContext, true);

    try {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openCertificationDropdown(page);

      // All system certification tags should NOT be visible
      for (const tagFqn of SYSTEM_CERTIFICATION_TAGS) {
        await expect(page.getByTestId(`radio-btn-${tagFqn}`)).not.toBeVisible();
      }

      await closeCertificationDropdown(page);
    } finally {
      await setCertificationClassificationDisabled(apiContext, false);
      await afterAction();
    }
  });
});

