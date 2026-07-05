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
import {
  closeTierDropdown,
  openTierDropdown,
  setTagDisabled,
} from '../../utils/tier';

test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();

test.describe('Tier Dropdown', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await table.delete(apiContext);
    await afterAction();
  });

  test('should show enabled tier tag in dropdown', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    const tag = new TagClass({ classification: 'Tier' });
    await tag.create(apiContext);

    try {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openTierDropdown(page);

      await expect(
        page.getByTestId(`radio-btn-${tag.responseData.displayName}`)
      ).toBeVisible();

      await closeTierDropdown(page);
    } finally {
      await tag.delete(apiContext);
      await afterAction();
    }
  });

  test('should NOT show disabled tier tag in dropdown', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    const enabledTag = new TagClass({ classification: 'Tier' });
    const disabledTag = new TagClass({ classification: 'Tier' });

    await enabledTag.create(apiContext);
    await disabledTag.create(apiContext);
    await setTagDisabled(apiContext, disabledTag.responseData.id, true);

    try {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openTierDropdown(page);

      await expect(
        page.getByTestId(`radio-btn-${disabledTag.responseData.displayName}`)
      ).not.toBeVisible();

      await expect(
        page.getByTestId(`radio-btn-${enabledTag.responseData.displayName}`)
      ).toBeVisible();

      await closeTierDropdown(page);
    } finally {
      await enabledTag.delete(apiContext);
      await disabledTag.delete(apiContext);
      await afterAction();
    }
  });

  test('should show tier again after re-enabling disabled tag', async ({
    page,
    browser,
  }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    const tag = new TagClass({ classification: 'Tier' });
    await tag.create(apiContext);
    await setTagDisabled(apiContext, tag.responseData.id, true);

    try {
      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openTierDropdown(page);

      await expect(
        page.getByTestId(`radio-btn-${tag.responseData.displayName}`)
      ).not.toBeVisible();

      await closeTierDropdown(page);

      await setTagDisabled(apiContext, tag.responseData.id, false);

      await redirectToHomePage(page);
      await table.visitEntityPage(page);
      await openTierDropdown(page);

      await expect(
        page.getByTestId(`radio-btn-${tag.responseData.displayName}`)
      ).toBeVisible();

      await closeTierDropdown(page);
    } finally {
      await tag.delete(apiContext);
      await afterAction();
    }
  });
});
