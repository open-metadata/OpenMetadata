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
import { Domain } from '../../../support/domain/Domain';
import { PersonaClass } from '../../../support/persona/PersonaClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import {
  addAndVerifyWidget,
  setUserDefaultPersona,
} from '../../../utils/customizeLandingPage';
import { selectDomainFromNavbar } from '../../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

const adminUser = new UserClass();
const persona = new PersonaClass();
const domainA = new Domain();
const domainB = new Domain();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await adminUser.login(page);
    await use(page);
    await page.close();
  },
});

base.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await persona.create(apiContext, [adminUser.responseData.id]);
  await domainA.create(apiContext);
  await domainB.create(apiContext);
  await afterAction();
});

base.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await domainA.delete(apiContext);
  await domainB.delete(apiContext);
  await persona.delete(apiContext);
  await adminUser.delete(apiContext);
  await afterAction();
});

test.describe.serial('Domain Widget Filter', () => {
  test('Setup Domains widget on landing page', async ({ page }) => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);

    await setUserDefaultPersona(page, persona.responseData.displayName);
    await addAndVerifyWidget(
      page,
      'KnowledgePanel.Domains',
      persona.responseData.name
    );
  });

  test('Domains widget should show only selected domain when domain filter is active', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);

    const domainWidget = page.getByTestId('KnowledgePanel.Domains');
    await expect(domainWidget).toBeVisible();

    await expect(
      domainWidget.getByTestId(`domain-card-${domainA.responseData.id}`)
    ).toBeVisible();
    await expect(
      domainWidget.getByTestId(`domain-card-${domainB.responseData.id}`)
    ).toBeVisible();

    await selectDomainFromNavbar(page, domainA.responseData);

    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

    await expect(
      domainWidget.getByTestId(`domain-card-${domainA.responseData.id}`)
    ).toBeVisible();
    await expect(
      domainWidget.getByTestId(`domain-card-${domainB.responseData.id}`)
    ).not.toBeVisible();
  });
});
