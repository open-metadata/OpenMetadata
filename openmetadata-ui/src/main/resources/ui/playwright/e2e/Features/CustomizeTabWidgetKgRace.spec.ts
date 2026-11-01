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
import { expect, test as base } from '../../support/fixtures/isolatedUser';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { EntityTabs } from '../../constant/customizeDetail';
import { GlobalSettingOptions } from '../../constant/settings';
import { settingClick } from '../../utils/sidebar';
import { navigateToPersonaWithPagination } from '../../utils/persona';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';
import { Page } from '@playwright/test';

const persona = new PersonaClass();

const test = base.extend<{ adminPage: Page }>({
  adminPage: async ({ isolatedUserPage }, use) => {
    await redirectToHomePage(isolatedUserPage);
    await use(isolatedUserPage);
  },
});

test.use({ isolatedUserOptions: { isAdmin: true } });

test.beforeAll('Setup KG lost-race persona', async ({ browser }) => {
  const { apiContext } = await performAdminLogin(browser);

  await persona.create(apiContext);
});

test.afterAll('Cleanup KG lost-race persona', async ({ browser }) => {
  const { apiContext } = await performAdminLogin(browser);

  await persona.delete(apiContext);
});

test.describe('Customize UI Knowledge Graph tab — rdfEnabled mount race', () => {
  test('Knowledge Graph tab appears reactively when /system/config/rdf resolves after the editor mounts', async ({
    adminPage: page,
  }) => {
    test.slow();

    // Hold the rdf config response until well after the customize editor
    // mounts, reproducing the bug's losing-mount-race condition: the editor
    // computes its default tabs while rdfEnabled is still false.
    await page.route('**/api/v1/system/config/rdf', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4000));

      await route.continue();
    });

    // A full navigation remounts AppRoot, which re-fires the (now-delayed)
    // fetchApplicationConfig that populates rdfEnabled.
    await page.goto('/');

    await redirectToHomePage(page);

    // Walk to the persona's Table customize editor (Settings → Persona →
    // Customize UI → Data Assets → Table). This is the editor whose
    // systemTabs memo previously baked a stale rdfEnabled===false for the
    // whole session.
    const personaListResponse = waitForResponseWithStatus(
      page,
      (response) => response.url().includes('/api/v1/personas?'),
      200
    );
    await settingClick(page, GlobalSettingOptions.PERSONA);
    await personaListResponse;
    await navigateToPersonaWithPagination(page, persona.data.name, true);
    await page.getByRole('tab', { name: 'Customize UI' }).click();
    await page.getByText('Data Assets').click();
    await page
      .getByTestId('customize-ui-options')
      .getByText('Table', { exact: true })
      .click();

    await waitForAllLoadersToDisappear(page);

    const kgTab = page
      .getByTestId('customize-tab-card')
      .getByTestId(`tab-${EntityTabs.KNOWLEDGE_GRAPH}`);

    // The editor mounted before the 4s rdf response landed, so the tab must
    // be absent at this point — the bug condition.
    await expect(kgTab).toHaveCount(0);

    // Once the delayed rdf response resolves, the reactive subscription
    // recomputes systemTabs and the Knowledge Graph tab appears in the same
    // session with no reload — the fix. (Without the fix it would stay
    // absent for the entire editor session.)
    await expect(kgTab).toBeVisible({ timeout: 10000 });
  });
});
