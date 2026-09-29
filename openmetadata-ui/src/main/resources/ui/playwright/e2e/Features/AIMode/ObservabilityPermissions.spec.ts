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

import { expect, Page, test as base } from '@playwright/test';
import { PolicyClass } from '../../../support/access-control/PoliciesClass';
import { RolesClass } from '../../../support/access-control/RolesClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { setupUserWithPolicy } from '../../../utils/permission';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import {
  expandAiSubPanel,
  redirectToAiModeHomePage,
} from '../../Utils/appMode';

const ADD_BUNDLE_SUITE = 'ask-sub-panel-item-add-bundle-suite';
const ADD_TEST_CASE = 'ask-sub-panel-item-add-test-case';

/**
 * ViewAll on everything, Create on nothing — the shape of a read-only
 * analyst. The backend already answers 403 to `POST /dataQuality/testSuites`
 * for this user; these tests assert the AI-mode sub-nav agrees.
 */
const VIEW_ONLY_RULES = [
  {
    name: 'ViewAll-Rule',
    resources: ['All'],
    operations: ['ViewAll'],
    effect: 'allow',
  },
];

const viewOnlyUser = new UserClass();
const viewOnlyPolicy = new PolicyClass();
const viewOnlyRole = new RolesClass();

const test = base.extend<{ viewOnlyPage: Page }>({
  viewOnlyPage: async ({ browser }, use) => {
    // `storageState: undefined` is load-bearing: browser.newContext()
    // otherwise inherits the spec-level admin storageState (test.use), so
    // /signin would treat this context as already authenticated, never
    // render the login form, and hang on input#email.
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    try {
      // `SubPanel` filters a gated item on
      // `Boolean(permissions?.[resource]?.[operation])`, which is equally false
      // when access is denied and while `permissions` is still the empty
      // initial value. Settling the boot-time fetch here means the absence
      // assertions below cannot pass merely because permissions had not landed
      // yet — a permission-loading regression fails the suite instead.
      //
      // Hoisted above `login()`, which is the navigation that boots the app and
      // issues the fetch; a listener registered afterwards would miss it.
      const permissionsResolved = waitForResponseWithStatus(
        page,
        (response) =>
          new URL(response.url()).pathname.endsWith('/api/v1/permissions'),
        'ok'
      );

      // Log in BEFORE seeding AI mode — enableAiAppMode installs an init
      // script on every navigation, and the signin page rendered in AI mode
      // doesn't expose the email input the login helper looks for.
      await viewOnlyUser.login(page);
      await permissionsResolved;

      await use(page);
    } finally {
      await context.close();
    }
  },
});

// Applies to the default `page` fixture only; `viewOnlyPage` builds its own.
test.use({ storageState: 'playwright/.auth/admin.json' });

test.beforeAll('Create the view-only user', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await setupUserWithPolicy(
    apiContext,
    viewOnlyUser,
    viewOnlyPolicy,
    viewOnlyRole,
    VIEW_ONLY_RULES
  );
  await afterAction();
});

test.afterAll('Remove the view-only user', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await viewOnlyUser.delete(apiContext);
  await viewOnlyRole.delete(apiContext);
  await viewOnlyPolicy.delete(apiContext);
  await afterAction();
});

const openObservability = async (page: Page) => {
  // Land on the AI home first. Seeding app-mode storage alone isn't enough
  // for a freshly-logged-in non-admin — the classic shell can win the boot
  // race — so wait for the AI shell to actually render before navigating on.
  await redirectToAiModeHomePage(page);
  await expect(page.getByTestId('ask-sidebar')).toBeVisible({ timeout: 30000 });
  await page.goto('/observability/data-quality', {
    waitUntil: 'domcontentloaded',
  });
  await expandAiSubPanel(page);
  await expect(page.getByTestId('ask-sub-panel')).toBeVisible({
    timeout: 30000,
  });
};

test.describe('AI mode Observability sub-nav quick actions', () => {
  test('hides Add Bundle Suite from a user who cannot create a test suite', async ({
    viewOnlyPage,
  }) => {
    await openObservability(viewOnlyPage);

    await expect(viewOnlyPage.getByTestId(ADD_BUNDLE_SUITE)).toHaveCount(0);
  });

  test('still offers Add Test Case to that same user', async ({
    viewOnlyPage,
  }) => {
    // Deliberately ungated: test-case permission is resolved per-table when
    // the user picks the table, so a global Create denial must not hide it.
    await openObservability(viewOnlyPage);

    await expect(viewOnlyPage.getByTestId(ADD_TEST_CASE)).toBeVisible();
  });

  test('shows both quick actions to an admin', async ({ page }) => {
    await openObservability(page);

    await expect(page.getByTestId(ADD_TEST_CASE)).toBeVisible();
    await expect(page.getByTestId(ADD_BUNDLE_SUITE)).toBeVisible();
  });
});
