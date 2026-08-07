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
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage } from '../../utils/common';
import { selectDomainFromNavbar } from '../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

// The Classifications list on the Tags page (GET /api/v1/classifications) did not
// honour the `domain` query param that the global (navbar) domain filter appends, so
// classifications from every domain were listed regardless of the selected domain.
// Same gap as the reported glossary case.
const domainA = new Domain();
const domainB = new Domain();
const classificationA = new ClassificationClass();
const classificationB = new ClassificationClass();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const { page, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    await use(page);
    await afterAction();
  },
});

const assignDomainToClassification = async (
  apiContext: Parameters<ClassificationClass['patch']>[0],
  classification: ClassificationClass,
  domain: Domain
) => {
  await classification.patch(apiContext, [
    {
      op: 'add',
      path: '/domains/0',
      value: { id: domain.responseData.id, type: 'domain' },
    },
  ]);
};

const waitForClassificationList = (page: Page) =>
  page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().includes('/api/v1/classifications?') &&
      response.status() === 200
  );

const openClassificationList = async (page: Page) => {
  const listResponse = waitForClassificationList(page);
  await sidebarClick(page, SidebarItem.TAGS);
  await listResponse;
  await waitForAllLoadersToDisappear(page);
};

const classificationItem = (page: Page, classification: ClassificationClass) =>
  page
    .getByTestId('side-panel-classification')
    .filter({ hasText: classification.data.displayName });

test.describe('Classification global domain filter', () => {
  test.slow(true);

  test.beforeAll('Setup domains and classifications', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await domainA.create(apiContext);
    await domainB.create(apiContext);
    await classificationA.create(apiContext);
    await classificationB.create(apiContext);

    await assignDomainToClassification(apiContext, classificationA, domainA);
    await assignDomainToClassification(apiContext, classificationB, domainB);

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await classificationA.delete(apiContext);
    await classificationB.delete(apiContext);
    await domainA.delete(apiContext);
    await domainB.delete(apiContext);

    await afterAction();
  });

  test('Admin: navbar domain selector filters the classifications list', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await openClassificationList(page);

    await test.step('Domain A lists only the Domain A classification', async () => {
      await selectDomainFromNavbar(page, domainA.responseData);
      const listResponse = waitForClassificationList(page);
      await page.reload();
      await listResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(classificationItem(page, classificationA)).toBeVisible();
      await expect(classificationItem(page, classificationB)).toHaveCount(0);
    });

    await test.step('Domain B lists only the Domain B classification', async () => {
      await selectDomainFromNavbar(page, domainB.responseData);
      const listResponse = waitForClassificationList(page);
      await page.reload();
      await listResponse;
      await waitForAllLoadersToDisappear(page);

      await expect(classificationItem(page, classificationB)).toBeVisible();
      await expect(classificationItem(page, classificationA)).toHaveCount(0);
    });
  });
});
