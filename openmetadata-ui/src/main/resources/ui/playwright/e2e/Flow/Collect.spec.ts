/*
 *  Copyright 2024 Collate.
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
import { SidebarItem } from '../../constant/sidebar';
import { redirectToHomePage } from '../../utils/common';
import { settingClick, SettingOptionsType } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Collect end point should work properly', () => {
  const PAGES = {
    setting: {
      name: 'Settings',
      menuId: SidebarItem.SETTINGS,
    },
    explore: {
      name: 'Explore',
      menuId: SidebarItem.EXPLORE,
    },
    dataQuality: {
      name: 'Quality',
      menuId: SidebarItem.DATA_QUALITY,
    },
    incidentManager: {
      name: 'Incident Manager',
      menuId: SidebarItem.INCIDENT_MANAGER,
    },
    insight: {
      name: 'Insights',
      menuId: SidebarItem.DATA_INSIGHT,
    },
    glossary: {
      name: 'Glossary',
      menuId: SidebarItem.GLOSSARY,
    },
    tag: {
      name: 'Tags',
      menuId: SidebarItem.TAGS,
    },
  };

  test.beforeEach('Visit entity details page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  for (const key of Object.keys(PAGES)) {
    const pageDetails = PAGES[key as keyof typeof PAGES];

    test(`Visit ${pageDetails.name} page should trigger collect API`, async ({
      page,
    }) => {
      // Wait for the request and response after the click action
      const collectResponsePromise = page.waitForResponse(
        '/api/v1/analytics/web/events/collect'
      );

      await settingClick(
        page,
        pageDetails.menuId as unknown as SettingOptionsType
      );

      const collectResponse = await collectResponsePromise;
      const requestPayload = JSON.parse(
        collectResponse.request().postData() ?? '{}'
      );
      const collectJsonResponse = await collectResponse.json();

      // omit the eventId from the response
      delete collectJsonResponse.eventId;

      expect(collectJsonResponse).toStrictEqual(requestPayload);
    });
  }
});
