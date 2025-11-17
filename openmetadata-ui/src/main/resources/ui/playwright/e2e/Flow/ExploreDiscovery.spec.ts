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
import test, { expect } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import {
  getEncodedFqn,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import { getJsonTreeObject } from '../../utils/exploreDiscovery';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const table = new TableClass();
const table1 = new TableClass();
const user = new UserClass();
const domain = new Domain();

test.describe('Explore Assets Discovery', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await user.create(apiContext);
    await domain.create(apiContext);
    await table.create(apiContext);
    await table1.create(apiContext);
    await table.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          value: {
            type: 'user',
            id: user.responseData.id,
          },
          path: '/owners/0',
        },
        {
          op: 'add',
          path: '/domains/0',
          value: {
            id: domain.responseData.id,
            type: 'domain',
            name: domain.responseData.name,
            displayName: domain.responseData.displayName,
          },
        },
      ],
    });
    await table.delete(apiContext, false);

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Should not display deleted assets when showDeleted is not checked and deleted is not present in queryFilter', async ({
    page,
  }) => {
    const queryFilter = getJsonTreeObject(
      table.entityResponseData.name,
      table.schemaResponseData.name,
      false
    );
    await page.goto(
      `/explore?page=1&size=10&queryFilter=${JSON.stringify(queryFilter)}`
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(
      page.locator(
        `[data-testid="table-data-card_${table.entityResponseData.fullyQualifiedName}"]`
      )
    ).not.toBeAttached();
  });

  test('Should display deleted assets when showDeleted is not checked but deleted is true in queryFilter', async ({
    page,
  }) => {
    const queryFilter = getJsonTreeObject(
      table.entityResponseData.name,
      table.schemaResponseData.name,
      true,
      true
    );
    await page.goto(
      `/explore?page=1&size=10&queryFilter=${JSON.stringify(queryFilter)}`
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(
      page.locator(
        `[data-testid="table-data-card_${table.entityResponseData.fullyQualifiedName}"]`
      )
    ).toBeAttached();
  });

  test('Should not display deleted assets when showDeleted is not checked but deleted is false in queryFilter', async ({
    page,
  }) => {
    const queryFilter = getJsonTreeObject(
      table.entityResponseData.name,
      table.schemaResponseData.name,
      true,
      false
    );
    await page.goto(
      `/explore?page=1&size=10&queryFilter=${JSON.stringify(queryFilter)}`
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(
      page.locator(
        `[data-testid="table-data-card_${table.entityResponseData.fullyQualifiedName}"]`
      )
    ).not.toBeAttached();
  });

  test('Should display deleted assets when showDeleted is checked and deleted is not present in queryFilter', async ({
    page,
  }) => {
    const queryFilter = getJsonTreeObject(
      table.entityResponseData.name,
      table.schemaResponseData.name,
      false
    );
    await page.goto(
      `/explore?page=1&size=10&showDeleted=true&queryFilter=${JSON.stringify(
        queryFilter
      )}`
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(
      page.locator(
        `[data-testid="table-data-card_${table.entityResponseData.fullyQualifiedName}"]`
      )
    ).toBeAttached();
  });

  test('Should display deleted assets when showDeleted is checked and deleted is true in queryFilter', async ({
    page,
  }) => {
    const queryFilter = getJsonTreeObject(
      table.entityResponseData.name,
      table.schemaResponseData.name,
      true,
      true
    );
    await page.goto(
      `/explore?page=1&size=10&showDeleted=true&queryFilter=${JSON.stringify(
        queryFilter
      )}`
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(
      page.locator(
        `[data-testid="table-data-card_${table.entityResponseData.fullyQualifiedName}"]`
      )
    ).toBeAttached();
  });

  test('Should not display deleted assets when showDeleted is checked but deleted is false in queryFilter', async ({
    page,
  }) => {
    const queryFilter = getJsonTreeObject(
      table.entityResponseData.name,
      table.schemaResponseData.name,
      true,
      false
    );
    await page.goto(
      `/explore?page=1&size=10&showDeleted=true&queryFilter=${JSON.stringify(
        queryFilter
      )}`
    );

    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(
      page.locator(
        `[data-testid="table-data-card_${table.entityResponseData.fullyQualifiedName}"]`
      )
    ).not.toBeAttached();
  });

  test('Should not display soft deleted assets in search suggestions', async ({
    page,
  }) => {
    await table1.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('manage-button').click();
    await page.getByTestId('delete-button').click();

    await expect(
      page
        .locator('.ant-modal-title')
        .getByText(
          `Delete table "${
            table1.entityResponseData.displayName ??
            table1.entityResponseData.name
          }"`
        )
    ).toBeVisible();

    await page.getByTestId('confirmation-text-input').click();
    await page.getByTestId('confirmation-text-input').fill('DELETE');

    await expect(page.getByTestId('confirm-button')).toBeEnabled();

    await page.getByTestId('confirm-button').click();

    await page.reload();
    await page.waitForLoadState('networkidle');

    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await expect(page.getByTestId('deleted-badge')).toBeVisible();

    await redirectToHomePage(page);
    await page.waitForLoadState('networkidle');

    await page.getByTestId('searchBox').click();
    await page.getByTestId('searchBox').fill(table1.entityResponseData.name);

    expect(
      page.locator('.ant-popover-inner-content').textContent()
    ).not.toContain(table1.entityResponseData.name);
  });

  test('Should not display domain and owner of deleted asset in suggestions when showDeleted is off', async ({
    page,
  }) => {
    await sidebarClick(page, SidebarItem.EXPLORE);
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // The user should not be visible in the owners filter when the deleted switch is off
    await page.click('[data-testid="search-dropdown-Owners"]');
    const searchResOwner = page.waitForResponse(
      `/api/v1/search/aggregate?index=dataAsset&field=owners.displayName.keyword*deleted=false*`
    );

    await page.fill(
      '[data-testid="search-input"]',
      user.responseData.displayName
    );
    await searchResOwner;

    await waitForAllLoadersToDisappear(page);

    await expect(
      page
        .getByTestId('drop-down-menu')
        .getByTestId(user.responseData.displayName)
    ).not.toBeAttached();

    await page.getByTestId('close-btn').click();

    // The domain should not be visible in the domains filter when the deleted switch is off
    await page.click('[data-testid="search-dropdown-Domains"]');

    const searchResDomain = page.waitForResponse(
      `/api/v1/search/aggregate?index=dataAsset&field=domains.displayName.keyword*deleted=false*`
    );

    await page.fill(
      '[data-testid="search-input"]',
      domain.responseData.displayName
    );
    await searchResDomain;

    await waitForAllLoadersToDisappear(page);

    await expect(
      page
        .getByTestId('drop-down-menu')
        .getByTestId(domain.responseData.displayName)
    ).not.toBeAttached();

    await page.getByTestId('close-btn').click();
  });

  test('Should display domain and owner of deleted asset in suggestions when showDeleted is on', async ({
    page,
  }) => {
    await sidebarClick(page, SidebarItem.EXPLORE);
    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // Click on the show deleted toggle button
    await page.getByTestId('show-deleted').click();

    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // The user should be visible in the owners filter when the deleted switch is on
    const ownerSearchText = user.responseData.displayName.toLowerCase();
    await page.click('[data-testid="search-dropdown-Owners"]');

    const searchResOwner = page.waitForResponse(
      `/api/v1/search/aggregate?index=dataAsset&field=owners.displayName.keyword*deleted=true*`
    );

    await page.fill('[data-testid="search-input"]', ownerSearchText);
    await searchResOwner;

    await waitForAllLoadersToDisappear(page);

    await expect(
      page.getByTestId('drop-down-menu').getByTestId(ownerSearchText)
    ).toBeAttached();

    await page
      .getByTestId('drop-down-menu')
      .getByTestId(ownerSearchText)
      .click();

    const fetchWithOwner = page.waitForResponse(
      `/api/v1/search/query?*deleted=true*owners.displayName.keyword*${ownerSearchText}*`
    );
    await page.getByTestId('update-btn').click();
    await fetchWithOwner;

    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // The domain should be visible in the domains filter when the deleted switch is on
    const domainSearchText = domain.responseData.displayName.toLowerCase();
    await page.click('[data-testid="search-dropdown-Domains"]');

    const searchResDomain = page.waitForResponse(
      `/api/v1/search/aggregate?index=dataAsset&field=domains.displayName.keyword*deleted=true*`
    );

    await page.fill('[data-testid="search-input"]', domainSearchText);
    await searchResDomain;

    await waitForAllLoadersToDisappear(page);

    await expect(
      page.getByTestId('drop-down-menu').getByTestId(domainSearchText)
    ).toBeAttached();

    await page
      .getByTestId('drop-down-menu')
      .getByTestId(domainSearchText)
      .click();

    const fetchWithDomain = page.waitForResponse(
      `/api/v1/search/query?*deleted=true*domains.displayName.keyword*${getEncodedFqn(
        domainSearchText,
        true
      )}*`
    );
    await page.getByTestId('update-btn').click();
    await fetchWithDomain;

    await page.waitForLoadState('networkidle');
    await waitForAllLoadersToDisappear(page);

    // Only the table option should be visible for the data assets filter when the deleted switch is on
    // with the owner and domain filter applied
    await page.click('[data-testid="search-dropdown-Data Assets"]');

    await expect(
      page.getByTestId('drop-down-menu').getByTestId('table')
    ).toBeAttached();
  });
});
