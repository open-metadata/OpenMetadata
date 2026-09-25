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

import { Browser, expect, Page, test } from '@playwright/test';
import { Domain } from '../../../support/domain/Domain';
import { AlertClass } from '../../../support/entity/AlertClass';
import { TableClass } from '../../../support/entity/TableClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { commonCleanup, commonPrerequisites } from '../../../utils/alert';
import { uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { enableAiAppMode } from '../../Utils/appMode';

// Same policies as the classic Flow suites: user1 may Create/EditAll/ViewAll/Delete
// alerts, user2 may only ViewAll.
const userWithPermissions = new UserClass();
const userWithoutPermissions = new UserClass();
const table = new TableClass();
const domain = new Domain();

const ALERT_KINDS = [
  {
    alertType: 'Observability',
    listPath: '/observability/alerts',
    detailsPath: (fqn: string) =>
      `/observability/alert/${encodeURIComponent(fqn)}`,
  },
  {
    alertType: 'Notification',
    listPath: '/settings/notifications/alerts',
    detailsPath: (fqn: string) =>
      `/settings/notifications/alerts/${encodeURIComponent(fqn)}/configuration`,
  },
] as const;

// The list is name-sorted and cursor-paged; this prefix keeps the alerts on page 1.
const alerts = {
  Observability: new AlertClass({
    alertType: 'Observability',
    name: `0%0-pw-ai-perm-${uuid()}`,
  }),
  Notification: new AlertClass({
    alertType: 'Notification',
    name: `0%0-pw-ai-perm-${uuid()}`,
  }),
};

const openAiPageAs = async (browser: Browser, user: UserClass) => {
  const page = await browser.newPage();
  await enableAiAppMode(page);
  await user.login(page);

  return page;
};

const gotoAndSettle = async (page: Page, path: string) => {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await waitForAllLoadersToDisappear(page);
};

test.describe('AI mode — alert permissions match the classic alert pages', () => {
  test.beforeAll(async ({ browser }) => {
    test.slow();
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await commonPrerequisites({
      apiContext,
      table,
      user1: userWithPermissions,
      user2: userWithoutPermissions,
      domain,
    });
    await alerts.Observability.create(apiContext);
    await alerts.Notification.create(apiContext);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await alerts.Observability.delete(apiContext);
    await alerts.Notification.delete(apiContext);
    await commonCleanup({
      apiContext,
      table,
      user1: userWithPermissions,
      user2: userWithoutPermissions,
      domain,
    });

    await afterAction();
  });

  for (const kind of ALERT_KINDS) {
    test(`${kind.alertType}: a view-only user cannot create, edit, or delete`, async ({
      browser,
    }) => {
      const alert = alerts[kind.alertType].responseData;
      const page = await openAiPageAs(browser, userWithoutPermissions);

      await test.step('list hides create and row actions', async () => {
        await gotoAndSettle(page, kind.listPath);

        await expect(
          page.getByTestId('observability-page-shell')
        ).toBeVisible();
        await expect(
          page.getByRole('link', { name: alert.displayName })
        ).toBeVisible();
        await expect(page.getByTestId('add-alert-button')).not.toBeAttached();
        await expect(
          page.getByTestId(`alert-edit-${alert.name}`)
        ).not.toBeAttached();
        await expect(
          page.getByTestId(`alert-delete-${alert.name}`)
        ).not.toBeAttached();
      });

      await test.step('details hide edit, delete, owner, and description edits', async () => {
        await gotoAndSettle(page, kind.detailsPath(alert.fullyQualifiedName));

        await expect(page.getByTestId('alert-details-ai-page')).toBeVisible();
        await expect(page.getByTestId('edit-button')).not.toBeAttached();
        await expect(page.getByTestId('delete-button')).not.toBeAttached();
        await expect(page.getByTestId('edit-owner')).not.toBeAttached();
        await expect(page.getByTestId('edit-description')).not.toBeAttached();
        // Sync stays available to viewers, as in classic.
        await expect(page.getByTestId('sync-button')).toBeVisible();
      });

      await page.close();
    });

    test(`${kind.alertType}: a user with alert permissions can create, edit, and delete`, async ({
      browser,
    }) => {
      const alert = alerts[kind.alertType].responseData;
      const page = await openAiPageAs(browser, userWithPermissions);

      await test.step('list shows create and row actions', async () => {
        await gotoAndSettle(page, kind.listPath);

        await expect(page.getByTestId('add-alert-button')).toBeVisible();
        await expect(
          page.getByTestId(`alert-edit-${alert.name}`)
        ).toBeEnabled();
        await expect(
          page.getByTestId(`alert-delete-${alert.name}`)
        ).toBeEnabled();
      });

      await test.step('details show edit and delete', async () => {
        await gotoAndSettle(page, kind.detailsPath(alert.fullyQualifiedName));

        await expect(page.getByTestId('edit-button')).toBeVisible();
        await expect(page.getByTestId('delete-button')).toBeVisible();
      });

      await page.close();
    });
  }
});
