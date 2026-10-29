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
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
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
  { tag: ['@Pages', '@Discovery', PLAYWRIGHT_BASIC_TEST_TAG_OBJ.tag] },
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

      await test.step('Verify both announcements are reachable in the carousel', async () => {
        const widget = page.getByTestId('announcements-widget-v2');
        const banner = widget.getByTestId('announcement-banner');
        const nextBtn = widget.getByTestId('announcement-next-btn');
        const seenTitles: string[] = [];

        await expect(banner).toBeVisible();
        seenTitles.push((await banner.getAttribute('aria-label')) ?? '');

        while ((await nextBtn.isVisible()) && (await nextBtn.isEnabled())) {
          const previous = seenTitles[seenTitles.length - 1];
          await nextBtn.click();
          await expect(banner).not.toHaveAttribute('aria-label', previous);
          seenTitles.push((await banner.getAttribute('aria-label')) ?? '');
        }

        expect(seenTitles.join('|')).toContain('Domain Announcement');
        expect(seenTitles.join('|')).toContain('Data Product Announcement');
      });
    });
  }
);
