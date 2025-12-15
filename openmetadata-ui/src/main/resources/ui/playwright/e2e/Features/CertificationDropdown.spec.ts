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
import { TagClass } from '../../support/tag/TagClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { visitClassificationPage } from '../../utils/tag';

// Use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();

// Create certification tags for testing
const certificationTag1 = new TagClass({
  classification: 'Certification',
});
const certificationTag2 = new TagClass({
  classification: 'Certification',
});

test.describe('Certification Dropdown - Disabled Certification Filtering', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    // Setup: Create test entities via API
    await table.create(apiContext);
    await certificationTag1.create(apiContext);
    await certificationTag2.create(apiContext);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    // Cleanup: Delete test entities
    await table.delete(apiContext);
    await certificationTag1.delete(apiContext);
    await certificationTag2.delete(apiContext);

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Enabled certification tags should be visible in the dropdown', async ({
    page,
  }) => {
    await table.visitEntityPage(page);

    const certificationResponse = page.waitForResponse(
      '/api/v1/tags?*parent=Certification*'
    );
    await page.getByTestId('edit-certification').click();
    await certificationResponse;

    await page.waitForSelector('.certification-card-popover', {
      state: 'visible',
    });
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(
      page.getByTestId(
        `radio-btn-${certificationTag1.responseData.fullyQualifiedName}`
      )
    ).toBeVisible();

    await expect(
      page.getByTestId(
        `radio-btn-${certificationTag2.responseData.fullyQualifiedName}`
      )
    ).toBeVisible();

    await page.getByTestId('close-certification').click();
  });

  test('Disabled Certification classification should hide all certifications in dropdown', async ({
    page,
  }) => {
    await visitClassificationPage(page, 'Certification', 'Certification');

    await page.click('[data-testid="manage-button"]');
    const disableClassificationResponse = page.waitForResponse(
      '/api/v1/classifications/*'
    );
    await page.click('[data-testid="enable-disable"]');
    await disableClassificationResponse;

    await expect(
      page.locator(
        '[data-testid="classification-Certification"] [data-testid="disabled"]'
      )
    ).toBeVisible();

    await redirectToHomePage(page);
    await table.visitEntityPage(page);

    const certificationResponse = page.waitForResponse(
      '/api/v1/tags?*parent=Certification*'
    );
    await page.getByTestId('edit-certification').click();
    await certificationResponse;

    await page.waitForSelector('.certification-card-popover', {
      state: 'visible',
    });
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(
      page.getByTestId(
        `radio-btn-${certificationTag1.responseData.fullyQualifiedName}`
      )
    ).not.toBeVisible();

    await expect(
      page.getByTestId(
        `radio-btn-${certificationTag2.responseData.fullyQualifiedName}`
      )
    ).not.toBeVisible();

    await expect(
      page.getByTestId('radio-btn-Certification.Gold')
    ).not.toBeVisible();

    await expect(
      page.getByTestId('radio-btn-Certification.Silver')
    ).not.toBeVisible();

    await expect(
      page.getByTestId('radio-btn-Certification.Bronze')
    ).not.toBeVisible();
  });
});

