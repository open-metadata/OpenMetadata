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

import { expect, test } from '@playwright/test';
import { Domain } from '../../../support/domain/Domain';
import { PersonaClass } from '../../../support/persona/PersonaClass';
import {
  createNewPage,
  redirectToExplorePage,
  redirectToHomePage,
} from '../../../utils/common';
import {
  addAndVerifyWidget,
  setUserDefaultPersona,
} from '../../../utils/customizeLandingPage';
import { selectDomainFromNavbar } from '../../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

const domainA = new Domain();
const domainB = new Domain();
const persona = new PersonaClass();

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);

  await domainA.create(apiContext);
  await domainB.create(apiContext);

  const adminResponse = await apiContext.get(
    '/api/v1/users/name/admin?fields=id'
  );
  const adminData = await adminResponse.json();

  await persona.create(apiContext, [adminData.id]);
  await afterAction();
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await createNewPage(browser);
  await domainA.delete(apiContext);
  await domainB.delete(apiContext);
  await persona.delete(apiContext);
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
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

    const domainWidget = page.getByTestId('KnowledgePanel.Domains');
    await expect(domainWidget).toBeVisible();

    await expect(
      domainWidget.getByTestId(`domain-card-${domainA.responseData.id}`)
    ).toBeVisible();
    await expect(
      domainWidget.getByTestId(`domain-card-${domainB.responseData.id}`)
    ).toBeVisible();

    // Navigate to explore page where domain-dropdown is available in navbar
    await redirectToExplorePage(page);
    await waitForAllLoadersToDisappear(page);

    await selectDomainFromNavbar(page, domainA.responseData);

    // Navigate back to home page to verify widget filtering
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
