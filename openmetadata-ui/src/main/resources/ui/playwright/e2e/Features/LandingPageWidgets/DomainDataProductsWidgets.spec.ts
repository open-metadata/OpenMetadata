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
import { SidebarItem } from '../../../constant/sidebar';
import { DataProduct } from '../../../support/domain/DataProduct';
import { Domain } from '../../../support/domain/Domain';
import { SubDomain } from '../../../support/domain/SubDomain';
import { TableClass } from '../../../support/entity/TableClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import { PersonaClass } from '../../../support/persona/PersonaClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  redirectToHomePage,
  removeLandingBanner,
} from '../../../utils/common';
import {
  addAndVerifyWidget,
  setUserDefaultPersona,
  verifyDataProductCountInDataProductWidget,
  verifyDomainCountInDomainWidget,
} from '../../../utils/customizeLandingPage';
import {
  addAssetsToDataProduct,
  addAssetsToDomain,
  checkAssetsCount,
  selectDataProduct,
  selectDomain,
} from '../../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { sidebarClick } from '../../../utils/sidebar';

const adminUser = new UserClass();

const persona = new PersonaClass();
const widgetEntityId = Date.now().toString(36);
const domain = new Domain({
  name: `0000-pw-domain-${widgetEntityId}`,
  displayName: `0000 PW Domain ${widgetEntityId}`,
  description: 'playwright domain description',
  domainType: 'Aggregate',
});
const subDomain = new SubDomain(domain);
const dataProduct = new DataProduct(
  [domain],
  `0000-pw-data-product-${widgetEntityId}`
);
const table = new TableClass();
const topic = new TopicClass();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await adminUser.login(page);
    await use(page);
    await page.close();
  },
});

const waitForEntitySearchable = async (
  page: Page,
  index: string,
  query: string,
  expectedId: string
) => {
  const browser = page.context().browser();
  if (!browser) {
    throw new Error('Browser instance is not available for admin API search');
  }

  const { apiContext, afterAction } = await performAdminLogin(browser);

  try {
    await expect
      .poll(
        async () => {
          const response = await apiContext.get(
            `/api/v1/search/query?q=${encodeURIComponent(query)}`,
            {
              params: {
                index,
                from: 0,
                size: 10,
                deleted: false,
              },
            }
          );

          if (!response.ok()) {
            return false;
          }

          const payload = await response.json();

          return (
            payload?.hits?.hits?.some(
              (hit: { _source?: { id?: string } }) =>
                hit._source?.id === expectedId
            ) ?? false
          );
        },
        {
          timeout: 60_000,
          intervals: [1_000, 2_000, 5_000],
        }
      )
      .toBe(true);
  } finally {
    await afterAction();
  }
};

const setWidgetSortOnCurrentPage = async (
  page: Page,
  widgetKey: string,
  label: string
) => {
  const widget = page.getByTestId(widgetKey);
  await expect(widget).toBeVisible();
  await widget.scrollIntoViewIfNeeded().catch(() => undefined);

  const dropdown = widget.getByTestId('widget-sort-by-dropdown');
  await expect(dropdown).toBeVisible();

  if (((await dropdown.textContent()) ?? '').includes(label)) {
    return;
  }

  await dropdown.click();
  const option = widget.locator('.widget-sort-filter-menu').getByText(label, {
    exact: true,
  });
  await expect(option).toBeVisible();
  await option.click();
  await expect(dropdown).toContainText(label);
};

const verifyWidgetCountOnCurrentPage = async (
  page: Page,
  widgetKey: string,
  selector: string,
  expectedCount: number
) => {
  const widget = page.getByTestId(widgetKey);
  await expect(widget).toBeVisible();
  await widget.scrollIntoViewIfNeeded().catch(() => undefined);

  await expect
    .poll(
      async () => {
        const element = widget.locator(selector).first();
        const isVisible = await element.isVisible().catch(() => false);

        if (!isVisible) {
          return null;
        }

        return (await element.textContent())?.trim() ?? null;
      },
      { timeout: 60_000, intervals: [1_000, 2_000, 5_000] }
    )
    .toContain(expectedCount.toString());
};

base.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await persona.create(apiContext, [adminUser.responseData.id]);
  await domain.create(apiContext);
  await subDomain.create(apiContext);
  await dataProduct.create(apiContext);
  await table.create(apiContext);
  await topic.create(apiContext);
  await afterAction();
});

base.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await table.delete(apiContext);
  await topic.delete(apiContext);
  await dataProduct.delete(apiContext);
  await domain.delete(apiContext);
  await persona.delete(apiContext);
  await adminUser.delete(apiContext);

  await afterAction();
});

test.describe.serial('Domain and Data Product Asset Counts', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await redirectToHomePage(page, false);
    await removeLandingBanner(page);
    await waitForAllLoadersToDisappear(page).catch(() => undefined);

    if (testInfo.title !== 'Assign Widgets') {
      await waitForEntitySearchable(
        page,
        'domain',
        domain.responseData.name ?? domain.data.name,
        domain.responseData.id ?? ''
      );
      await waitForEntitySearchable(
        page,
        'dataProduct',
        dataProduct.responseData.name ?? dataProduct.data.name,
        dataProduct.responseData.id ?? ''
      );
      await redirectToHomePage(page, false);
      await removeLandingBanner(page);
      await waitForAllLoadersToDisappear(page).catch(() => undefined);
    }
  });

  test('Assign Widgets', async ({ page }) => {
    test.slow(true);
    await setUserDefaultPersona(page, persona.responseData.displayName);
    await addAndVerifyWidget(
      page,
      'KnowledgePanel.Domains',
      persona.responseData.name
    );
    await addAndVerifyWidget(
      page,
      'KnowledgePanel.DataProducts',
      persona.responseData.name
    );
  });

  test('Verify Widgets are having 0 count initially', async ({ page }) => {
    await redirectToHomePage(page, false);
    await removeLandingBanner(page);
    await waitForAllLoadersToDisappear(page).catch(() => undefined);

    await verifyWidgetCountOnCurrentPage(
      page,
      'KnowledgePanel.Domains',
      [
        `[data-testid="domain-card-${domain.responseData.id ?? ''}"] .domain-card-count`,
        `[data-testid="domain-card-${domain.responseData.id ?? ''}"] .domain-card-full-count`,
      ].join(', '),
      0
    );
    await verifyWidgetCountOnCurrentPage(
      page,
      'KnowledgePanel.DataProducts',
      `[data-testid="data-product-card-${dataProduct.responseData.id ?? ''}"] [data-testid="data-product-asset-count"]`,
      0
    );
  });

  test('Domain asset count should update when assets are added', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await sidebarClick(page, SidebarItem.DOMAIN);

    await addAssetsToDomain(page, domain, [table, topic]);
    await checkAssetsCount(page, 2);

    await redirectToHomePage(page);
    await verifyDomainCountInDomainWidget(
      page,
      domain.responseData.id ?? '',
      2
    );
  });

  test('Data Product asset count should update when assets are added', async ({
    page,
  }) => {
    test.slow(true);
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await sidebarClick(page, SidebarItem.DATA_PRODUCT);
    await selectDataProduct(page, dataProduct.data);

    await addAssetsToDataProduct(
      page,
      dataProduct.responseData.fullyQualifiedName ?? '',
      [table, topic]
    );

    await redirectToHomePage(page);
    await verifyDataProductCountInDataProductWidget(
      page,
      dataProduct.responseData.id ?? '',
      2
    );
  });

  test('Domain asset count should update when assets are removed', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await sidebarClick(page, SidebarItem.DOMAIN);
    await selectDomain(page, domain.data);

    await page.getByTestId('assets').click();
    await checkAssetsCount(page, 2);

    const topicFqn = topic.entityResponseData.fullyQualifiedName;
    await page
      .locator(`[data-testid="table-data-card_${topicFqn}"] input`)
      .check();

    const removeRes = page.waitForResponse('**/assets/remove');
    await page.getByTestId('delete-all-button').click();
    await removeRes;

    await page.reload();
    await checkAssetsCount(page, 1);

    await redirectToHomePage(page);
    await verifyDomainCountInDomainWidget(
      page,
      domain.responseData.id ?? '',
      1
    );
  });

  test('Data Product asset count should update when assets are removed', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await sidebarClick(page, SidebarItem.DATA_PRODUCT);
    await selectDataProduct(page, dataProduct.data);

    await page.getByTestId('assets').click();

    await page
      .waitForSelector('[data-testid="loader"]', {
        state: 'detached',
        timeout: 10000,
      })
      .catch(() => {
        /* ignore if loader not found */
      });

    let hasAssets = true;
    while (hasAssets) {
      const checkboxes = page.locator(
        '[data-testid^="table-data-card_"] input[type="checkbox"]'
      );
      const count = await checkboxes.count();

      if (count === 0) {
        hasAssets = false;
        break;
      }

      const selectAll = page.getByRole('checkbox', { name: 'Select All' });
      if (await selectAll.isVisible()) {
        await selectAll.check();
      } else {
        for (let i = 0; i < count; i++) {
          await checkboxes.nth(i).check();
        }
      }

      const removeRes = page.waitForResponse('**/assets/remove');
      await page.getByTestId('delete-all-button').click();
      await removeRes;

      await page.waitForTimeout(500);
    }

    await page.reload();
    await checkAssetsCount(page, 0);

    await redirectToHomePage(page);
    await verifyDataProductCountInDataProductWidget(
      page,
      dataProduct.responseData.id ?? '',
      0
    );
  });
});
