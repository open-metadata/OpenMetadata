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
import { GlobalSettingOptions } from '../../constant/settings';
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
import { navigateToPersonaWithPagination } from '../../utils/persona';
import { settingClick } from '../../utils/sidebar';

const persona = new PersonaClass();
const adminUser = new AdminClass();
const user = new UserClass();

const test = base.extend<{
  adminPage: Page;
  userPage: Page;
}>({
  adminPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await adminUser.login(page);
    await use(page);
    await page.close();
  },
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
  //
  // This saved nav simulates a persona created before Ontology Explorer and
  // Metrics existed: governance only has Glossary and Tags (Tags is hidden).
  // Ontology Explorer and Metrics are entirely absent — new items shipped later.
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
        // '/metrics' and '/governance/ontology' (Ontology Explorer) are
        // deliberately absent — they simulate new items shipped after this
        // persona's nav snapshot was saved.
      ],
    },
    // '/data-insights' deliberately absent — top-level new item test
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
      'new sidebar items absent from saved persona nav are toggled OFF in admin settings and hidden in sidebar',
      async ({ adminPage, userPage }) => {
        test.slow();

        await test.step(
          'admin: Ontology Explorer toggle is OFF for items absent from saved nav',
          async () => {
            await redirectToHomePage(adminPage);

            const personaListResponse = adminPage.waitForResponse(
              '/api/v1/personas?*'
            );
            await settingClick(adminPage, GlobalSettingOptions.PERSONA);
            await personaListResponse;

            await navigateToPersonaWithPagination(
              adminPage,
              persona.data.name,
              true
            );

            await adminPage.getByRole('tab', { name: 'Customize UI' }).click();
            await adminPage.getByText('Navigation').click();

            // Ontology Explorer was not in the saved nav (shipped after persona
            // was created) — its toggle must be OFF, not ON.
            await expect(
              adminPage
                .getByTestId('page-layout-v1')
                .getByText('Ontology Explorer')
                .first()
                .getByRole('switch')
            ).not.toBeChecked();

            // Metrics was also not in the saved nav — toggle must be OFF.
            await expect(
              adminPage
                .getByTestId('page-layout-v1')
                .getByText('Metrics')
                .first()
                .getByRole('switch')
            ).not.toBeChecked();

            // Glossary IS in the saved nav with isHidden: false — toggle must be ON.
            await expect(
              adminPage
                .getByTestId('page-layout-v1')
                .getByText('Glossary')
                .first()
                .getByRole('switch')
            ).toBeChecked();
          }
        );

        await test.step('user: switch to the test persona', async () => {
          await redirectToHomePage(userPage);

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
          'sidebar: top-level item absent from saved nav is hidden',
          async () => {
            await expect(
              userPage.getByTestId(`app-bar-item-${SidebarItem.DATA_INSIGHT}`)
            ).not.toBeVisible();
          }
        );

        await test.step(
          'sidebar: top-level item explicitly set isHidden is not visible',
          async () => {
            await expect(
              userPage.getByTestId(`app-bar-item-${SidebarItem.EXPLORE}`)
            ).not.toBeVisible();
          }
        );

        await test.step(
          'sidebar: governance children — present item visible, absent and hidden items not visible',
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

            // Ontology Explorer is absent from saved nav's governance children — must not be visible
            const ontologyItem = userPage
              .locator(
                `[data-testid="app-bar-item-${SidebarItem.ONTOLOGY_EXPLORER}"]`
              )
              .first();
            const ontologyCount = await ontologyItem.count();

            if (ontologyCount > 0) {
              await expect(ontologyItem).not.toBeVisible();
            }

            await userPage.click('[data-testid="governance"]');
          }
        );
      }
    );
  }
);
