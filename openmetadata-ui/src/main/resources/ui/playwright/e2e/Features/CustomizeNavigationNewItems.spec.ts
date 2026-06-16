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

import { expect, Page, test as base } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { AdminClass } from '../../support/user/AdminClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { clickOutside, redirectToHomePage } from '../../utils/common';
import {
  getEncodedFqn,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';

const persona = new PersonaClass();
const adminUser = new AdminClass();
const user = new UserClass();

const test = base.extend<{
  userPage: Page;
}>({
  userPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await user.login(page);
    await use(page);
    await page.close();
  },
});

test.beforeAll('Setup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await user.create(apiContext);
  await user.setAdminRole(apiContext);

  await persona.create(apiContext);

  const personaFqn =
    persona.responseData.fullyQualifiedName ?? persona.responseData.name;

  // Sidebar item keys are route paths (e.g. '/glossary'), not SidebarItem enum
  // values (e.g. 'glossary'). Using the wrong ID causes sidebarMap.get() to
  // return undefined and the item is silently dropped from the rendered nav.
  // governance is the sole exception — its key is the literal string 'governance'.
  const savedNavigation = [
    {
      id: '/explore',
      title: 'Explore',
      isHidden: true,
      pageId: '/explore',
    },
    {
      id: 'governance',
      title: 'Govern',
      isHidden: false,
      pageId: 'governance',
      children: [
        {
          id: '/glossary',
          title: 'Glossary',
          isHidden: false,
          pageId: '/glossary',
        },
        {
          id: '/tags',
          title: 'Classification',
          isHidden: true,
          pageId: '/tags',
        },
        // '/metrics' deliberately absent — tests the bug fix (new child hidden by default)
      ],
    },
    // '/data-insights' deliberately absent — tests top-level hidden by default
  ];

  await apiContext.post('/api/v1/docStore', {
    data: {
      entityType: 'PAGE',
      fullyQualifiedName: `persona.${personaFqn}`,
      name: persona.responseData.name,
      data: {
        pages: [],
        navigation: savedNavigation,
      },
    },
  });

  await user.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/personas/0',
        value: {
          id: persona.responseData.id,
          name: persona.responseData.name,
          displayName: persona.responseData.displayName,
          fullyQualifiedName: persona.responseData.fullyQualifiedName,
          type: 'persona',
        },
      },
    ],
  });

  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await user.delete(apiContext);
  await persona.delete(apiContext);
  await afterAction();
});

test.describe(
  'Persona navigation — new sidebar items hidden by default',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test(
      'sidebar items absent from saved persona nav are hidden, explicitly hidden items are also hidden',
      async ({ userPage }) => {
        test.slow();

        await redirectToHomePage(userPage);

        await test.step('switch to the test persona', async () => {
          await userPage.getByTestId('dropdown-profile').click();

          const personaMenuItem = userPage.getByRole('menuitem', {
            name: persona.responseData.displayName,
          });

          await expect(personaMenuItem).toBeVisible();

          const personaDocStoreResponse = userPage.waitForResponse(
            `/api/v1/docStore/name/persona.${getEncodedFqn(
              persona.responseData.fullyQualifiedName ?? ''
            )}*`
          );

          await personaMenuItem.click();
          await personaDocStoreResponse;
          await waitForAllLoadersToDisappear(userPage);
          await clickOutside(userPage);
        });

        await test.step(
          'top-level item absent from saved nav is hidden',
          async () => {
            await expect(
              userPage.getByTestId(`app-bar-item-${SidebarItem.DATA_INSIGHT}`)
            ).not.toBeVisible();
          }
        );

        await test.step(
          'top-level item explicitly set isHidden is not visible',
          async () => {
            await expect(
              userPage.getByTestId(`app-bar-item-${SidebarItem.EXPLORE}`)
            ).not.toBeVisible();
          }
        );

        await test.step(
          'governance children: present item visible, absent and hidden items not visible',
          async () => {
            await userPage.hover('[data-testid="left-sidebar"]');
            await userPage.click('[data-testid="governance"]');

            // Wait for the governance dropdown to fully expand before checking children
            const anyGovernanceChild = userPage
              .locator('[data-testid="left-sidebar"]')
              .locator('[data-testid^="app-bar-item-"]')
              .first();

            await expect(anyGovernanceChild).toBeVisible();

            // Glossary is in saved nav with isHidden: false — must be visible
            await expect(
              userPage
                .locator(`[data-testid="app-bar-item-${SidebarItem.GLOSSARY}"]`)
                .first()
            ).toBeVisible();

            // Tags is in saved nav with isHidden: true — must not be visible
            const tagsItem = userPage
              .locator(`[data-testid="app-bar-item-${SidebarItem.TAGS}"]`)
              .first();
            const tagsCount = await tagsItem.count();

            if (tagsCount > 0) {
              await expect(tagsItem).not.toBeVisible();
            }

            // Metrics is absent from saved nav's governance children — must not be visible
            const metricsItem = userPage
              .locator(`[data-testid="app-bar-item-${SidebarItem.METRICS}"]`)
              .first();
            const metricsCount = await metricsItem.count();

            if (metricsCount > 0) {
              await expect(metricsItem).not.toBeVisible();
            }

            await userPage.click('[data-testid="governance"]');
          }
        );
      }
    );
  }
);
