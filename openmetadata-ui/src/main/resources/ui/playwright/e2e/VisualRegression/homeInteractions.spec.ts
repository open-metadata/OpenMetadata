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
import {
  Announcement,
  AnnouncementColor,
  AnnouncementType,
} from '../../../src/generated/entity/feed/announcement';
import { expect, test } from '../../support/fixtures/base';
import { installVisualData } from '../../utils/visualData';
import {
  expectVisualScreenshot,
  gotoForScreenshot,
  prepareVisualTheme,
  VISUAL_THEMES,
} from '../../utils/visualRegression';

const announcements: Announcement[] = Object.values(AnnouncementType).map(
  (type, index) => ({
    id: `b0408200-5412-4bd8-8000-${String(index + 1).padStart(12, '0')}`,
    name: `visual_announcement_${type.toLowerCase()}`,
    displayName: `${type} — Finance reporting update`,
    description:
      'The finance reporting warehouse is being refreshed. Review the validation results before using the daily revenue dashboard.',
    type,
    ...(type === AnnouncementType.Custom
      ? { color: AnnouncementColor.Purple, customTypeName: 'Maintenance' }
      : {}),
    entityLink: '<#E::table::visual_warehouse.finance.public.orders>',
    startTime: Date.parse('2026-01-10T00:00:00Z'),
    endTime: Date.parse('2026-01-20T00:00:00Z'),
    createdAt: Date.parse('2026-01-14T10:00:00Z'),
    createdBy: 'admin',
  })
);

const openHome = async (page: Page, items = announcements) => {
  await installVisualData(page);
  // Limit 100 feeds the rail; the dialog requests pages of 50. Keep pagination
  // separate so its loaded count and load-more state are observable.
  await page.route('**/api/v1/announcements?*', async (route) => {
    const url = new URL(route.request().url());
    if (route.request().method() !== 'GET') return route.fallback();
    // The system banner queries the same endpoint; entity announcements
    // belong only in the rail and its dialog.
    if (url.searchParams.get('system') === 'true') {
      await route.fulfill({ json: { data: [], paging: { total: 0 } } });

      return;
    }
    const isRail = url.searchParams.get('limit') === '100';
    const secondPage = url.searchParams.has('after');
    await route.fulfill({
      json: {
        data: isRail ? items : secondPage ? items.slice(2) : items.slice(0, 2),
        paging: {
          total: items.length,
          ...(!isRail && !secondPage && items.length > 2
            ? { after: 'visual-page-2' }
            : {}),
        },
      },
    });
  });
  await gotoForScreenshot(page, '/', { readyTestId: 'home-landing-page' });
  await expect(page.getByTestId('announcement-rail')).toBeVisible();
};

for (const theme of VISUAL_THEMES) {
  test.describe(`Home interactions ${theme}`, { tag: '@Platform' }, () => {
    for (const item of announcements) {
      test(`announcement-card-${item.type}`, async ({ page }) => {
        await prepareVisualTheme(page, theme);
        await openHome(page);
        const card = page.getByTestId(`announcement-card-${item.id}`);
        await card.scrollIntoViewIfNeeded();
        await expect(card).toBeInViewport({ ratio: 1 });
        await expect(card).toContainText(item.displayName ?? item.name);
        await expectVisualScreenshot(
          page,
          `announcement-card-${item.type}`,
          theme,
          {
            target: card,
            maxDiffPixelRatio: 0,
          }
        );
      });
    }

    // The light "blue-dark" name must differ from the dark "blue" name.
    // Put a noun after the color so "-dark" remains the theme suffix.
    for (const color of Object.values(AnnouncementColor)) {
      test(`announcement-palette-${color}-card`, async ({ page }) => {
        await prepareVisualTheme(page, theme);
        const item = {
          ...announcements[0],
          type: AnnouncementType.Custom,
          color,
          customTypeName: 'Maintenance',
        };
        await openHome(page, [item]);
        const card = page.getByTestId(`announcement-card-${item.id}`);
        await expect(card).toContainText('Maintenance');
        await expectVisualScreenshot(
          page,
          `announcement-palette-${color}-card`,
          theme,
          {
            target: card,
            maxDiffPixelRatio: 0,
          }
        );
      });
    }

    test('announcement-all-dialog', async ({ page }) => {
      await prepareVisualTheme(page, theme);
      await openHome(page);
      await page.getByTestId('announcement-view-all').click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.getByTestId('all-announcements-count')).toHaveText(
        '5'
      );
      await expect(
        dialog.getByTestId('all-announcements-list').getByRole('listitem')
      ).toHaveCount(2);
      await expect(
        page.getByTestId('all-announcements-load-more')
      ).toBeInViewport({ ratio: 1 });
      await expectVisualScreenshot(page, 'announcement-all-dialog', theme, {
        target: dialog,
        maxDiffPixelRatio: 0,
      });
    });

    test('announcement-all-next-page', async ({ page }) => {
      await prepareVisualTheme(page, theme);
      await openHome(page);
      await page.getByTestId('announcement-view-all').click();
      await page.getByTestId('all-announcements-load-more').click();
      const list = page.getByTestId('all-announcements-list');
      await expect(list.getByRole('listitem')).toHaveCount(5);
      await expect(page.getByTestId('all-announcements-load-more')).toHaveCount(
        0
      );
      await list
        .getByTestId(
          `announcement-card-${announcements[announcements.length - 1].id}`
        )
        .scrollIntoViewIfNeeded();
      await expectVisualScreenshot(page, 'announcement-all-next-page', theme, {
        target: page.getByRole('dialog'),
        maxDiffPixelRatio: 0,
      });
    });

    test('announcement-dismiss-last', async ({ page }) => {
      await prepareVisualTheme(page, theme);
      await openHome(page, [announcements[0]]);
      await page.getByTestId('announcement-view-all').click();
      const dialog = page.getByRole('dialog');
      await dialog
        .getByTestId(`announcement-card-${announcements[0].id}`)
        .getByRole('button', { name: 'Close', exact: true })
        .click();
      await expect(dialog).toContainText('No Active Announcements');
      await expect(dialog.getByTestId('all-announcements-count')).toHaveText(
        '0'
      );
      await expect(page.getByTestId('announcements-section')).toHaveCount(0);
      await expectVisualScreenshot(page, 'announcement-dismiss-last', theme, {
        target: dialog,
        maxDiffPixelRatio: 0,
      });
    });
  });
}
