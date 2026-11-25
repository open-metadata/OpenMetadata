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

import { expect, Page } from '@playwright/test';
import { test } from '../../support/fixtures/base';
import { openAiProfile } from '../../utils/aiProfile';
import { getApiContext, uuid } from '../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

const prompt = (page: Page) => page.getByTestId('unsaved-changes-popover');

// Forms whose unsaved state is computed from a baseline (schema defaults, the
// loaded alert, the intake rows) must read clean until the user edits them.
const leavesWithoutAsking = async (page: Page, landmark: string) => {
  await page.getByTestId('profile-nav-preferences').click();
  await expect(page.getByTestId(landmark)).toBeHidden();
  await expect(prompt(page)).toBeHidden();
};

const openSettingsAt = async (page: Page, hash: string) => {
  await openAiProfile(page);
  await page.evaluate((next) => {
    globalThis.location.hash = next;
  }, hash);
};

test.describe('Settings forms: unsaved-changes baselines', () => {
  test('an untouched Applications config form leaves without asking', async ({
    page,
  }) => {
    await openSettingsAt(page, 'applications/DataInsightsApplication');
    await page.getByRole('tab', { name: /Configuration/ }).click();
    await expect(page.getByTestId('app-config-footer')).toBeVisible();

    await leavesWithoutAsking(page, 'app-config-footer');
  });

  test('an untouched alert edit form leaves without asking', async ({
    page,
  }) => {
    // The API context reads the session token, so the app loads first.
    await openAiProfile(page);
    const { apiContext, afterAction } = await getApiContext(page);
    const name = `pw-unsaved-alert-${uuid()}`;
    const created = await apiContext
      .post('/api/v1/events/subscriptions', {
        data: {
          name,
          alertType: 'Notification',
          resources: ['all'],
          destinations: [{ category: 'Admins', type: 'Email' }],
        },
      })
      .then((response) => response.json());

    try {
      await page.evaluate((next) => {
        globalThis.location.hash = next;
      }, `notification/alerts/edit/${name}`);
      await expect(page.getByTestId('save-btn')).toBeVisible();

      await leavesWithoutAsking(page, 'save-btn');
    } finally {
      await apiContext.delete(
        `/api/v1/events/subscriptions/${created.id}?hardDelete=true`
      );
      await afterAction();
    }
  });

  test('an intake form edit that is undone leaves without asking', async ({
    page,
  }) => {
    await openSettingsAt(page, 'governance/intake-forms/add/domain');
    // A field row toggled and toggled back compares equal to how it started.
    const required = page.getByTestId('require-displayName');
    await required.click();
    await required.click();

    await page.getByTestId('intake-form-cancel').click();
    await expect(prompt(page)).toBeHidden();
    await expect(page.getByTestId('intake-form-cancel')).toBeHidden();
  });
});
