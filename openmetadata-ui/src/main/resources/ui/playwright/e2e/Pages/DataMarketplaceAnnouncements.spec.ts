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
import { expect } from '@playwright/test';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { performAdminLogin } from '../../utils/admin';
import {
  createAnnouncementViaApi,
  deleteAnnouncementViaApi,
  navigateToMarketplace,
} from '../../utils/dataMarketplace';
import { test } from '../fixtures/pages';

const domain = new Domain();
const dp = new DataProduct([domain]);

let domainAnnouncementId: string;
let dpAnnouncementId: string;

test.describe(
  'Data Marketplace - Announcements',
  { tag: ['@Pages', '@Discovery'] },
  () => {
    test.beforeAll('Setup entities and announcements', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await domain.create(apiContext);
      await dp.create(apiContext);

      const domainAnnouncement = await createAnnouncementViaApi(
        apiContext,
        `<#E::domain::${domain.responseData.fullyQualifiedName}>`,
        'Domain Announcement',
        'Test domain announcement description'
      );
      domainAnnouncementId = domainAnnouncement.id;

      const dpAnnouncement = await createAnnouncementViaApi(
        apiContext,
        `<#E::dataProduct::${dp.responseData.fullyQualifiedName}>`,
        'Data Product Announcement',
        'Test data product announcement description'
      );
      dpAnnouncementId = dpAnnouncement.id;

      await afterAction();
    });

    test.afterAll('Cleanup entities', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await deleteAnnouncementViaApi(apiContext, dpAnnouncementId);
      await deleteAnnouncementViaApi(apiContext, domainAnnouncementId);
      await dp.delete(apiContext);
      await domain.delete(apiContext);

      await afterAction();
    });

    test('Announcements widget renders with active announcements', async ({
      page,
    }) => {
      test.slow();

      await test.step('Navigate to marketplace', async () => {
        await navigateToMarketplace(page);
      });

      await test.step('Verify announcements widget is visible', async () => {
        await expect(page.getByTestId('announcements-widget-v2')).toBeVisible();
      });

      await test.step('Verify announcement items are displayed', async () => {
        await expect(
          page.getByTestId(`announcement-item-${domainAnnouncementId}`)
        ).toBeVisible();
        await expect(
          page.getByTestId(`announcement-item-${dpAnnouncementId}`)
        ).toBeVisible();
      });
    });

    test('Clicking announcement navigates to entity page', async ({ page }) => {
      test.slow();

      await test.step('Navigate to marketplace', async () => {
        await navigateToMarketplace(page);
      });

      await test.step('Click domain announcement and verify navigation', async () => {
        const announcementItem = page.getByTestId(
          `announcement-item-${domainAnnouncementId}`
        );
        await expect(announcementItem).toBeVisible();
        await announcementItem.click();
        await page.waitForURL('**/data-marketplace/domains/**');
      });

      await test.step('Navigate back and click data product announcement', async () => {
        await navigateToMarketplace(page);
        const announcementItem = page.getByTestId(
          `announcement-item-${dpAnnouncementId}`
        );
        await expect(announcementItem).toBeVisible();
        await announcementItem.click();
        await page.waitForURL('**/data-marketplace/data-products/**');
      });
    });
  }
);
