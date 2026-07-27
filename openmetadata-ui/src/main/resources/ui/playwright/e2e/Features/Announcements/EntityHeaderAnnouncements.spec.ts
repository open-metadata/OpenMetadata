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

import test, { expect } from '@playwright/test';
import { TableClass } from '../../../support/entity/TableClass';
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import { createAnnouncementViaApi } from '../../../utils/dataMarketplace';

test.use({ storageState: 'playwright/.auth/admin.json' });

const tableEntityLink = (table: TableClass) =>
  `<#E::table::${table.entityResponseData.fullyQualifiedName}>`;

test.describe('Entity header announcements (data asset)', () => {
  test('shows announcements one at a time and pages through them with the counter', async ({
    page,
  }) => {
    test.setTimeout(150000);
    const table = new TableClass();
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);

    try {
      await table.create(apiContext);
      const entityLink = tableEntityLink(table);
      await createAnnouncementViaApi(
        apiContext,
        entityLink,
        'Carousel Announcement One',
        'First carousel announcement description'
      );
      await createAnnouncementViaApi(
        apiContext,
        entityLink,
        'Carousel Announcement Two',
        'Second carousel announcement description'
      );
      await createAnnouncementViaApi(
        apiContext,
        entityLink,
        'Carousel Announcement Three',
        'Third carousel announcement description'
      );
      await table.visitEntityPage(page);

      const widget = page.getByTestId('entity-header-announcements');
      const prevButton = page.getByTestId('announcement-prev-btn');
      const nextButton = page.getByTestId('announcement-next-btn');
      const currentItem = widget.locator('[data-testid^="announcement-item-"]');

      await expect(widget).toBeVisible();
      await expect(currentItem).toHaveCount(1);
      await expect(widget).toContainText('1/3');
      await expect(prevButton).toBeDisabled();
      await expect(nextButton).toBeEnabled();

      const firstAnnouncementId = await currentItem.getAttribute('data-testid');

      await nextButton.click();

      await expect(widget).toContainText('2/3');
      await expect(prevButton).toBeEnabled();
      await expect(nextButton).toBeEnabled();

      await nextButton.click();

      await expect(widget).toContainText('3/3');
      await expect(nextButton).toBeDisabled();
      await expect(prevButton).toBeEnabled();
      await expect(currentItem).not.toHaveAttribute(
        'data-testid',
        firstAnnouncementId ?? ''
      );

      await prevButton.click();

      await expect(widget).toContainText('2/3');
    } finally {
      await table.delete(apiContext);
      await afterAction();
    }
  });

  test('hides the counter when a single announcement is active', async ({
    page,
  }) => {
    test.setTimeout(150000);
    const table = new TableClass();
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);

    try {
      await table.create(apiContext);
      await createAnnouncementViaApi(
        apiContext,
        tableEntityLink(table),
        'Single Header Announcement',
        'Single header announcement description'
      );
      await table.visitEntityPage(page);

      const widget = page.getByTestId('entity-header-announcements');

      await expect(widget).toBeVisible();
      await expect(widget).toContainText('Single Header Announcement');
      await expect(page.getByTestId('announcement-prev-btn')).toHaveCount(0);
      await expect(page.getByTestId('announcement-next-btn')).toHaveCount(0);
    } finally {
      await table.delete(apiContext);
      await afterAction();
    }
  });

  test('opens the announcement drawer from the View all button', async ({
    page,
  }) => {
    test.setTimeout(150000);
    const table = new TableClass();
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);

    try {
      await table.create(apiContext);
      const entityLink = tableEntityLink(table);
      await createAnnouncementViaApi(
        apiContext,
        entityLink,
        'Drawer Announcement One',
        'First drawer announcement description'
      );
      await createAnnouncementViaApi(
        apiContext,
        entityLink,
        'Drawer Announcement Two',
        'Second drawer announcement description'
      );
      await table.visitEntityPage(page);

      const widget = page.getByTestId('entity-header-announcements');

      await expect(widget).toBeVisible();

      await widget.getByTestId('view-all-btn').click();

      await expect(page.getByTestId('announcement-drawer')).toBeVisible();
    } finally {
      await table.delete(apiContext);
      await afterAction();
    }
  });
});
