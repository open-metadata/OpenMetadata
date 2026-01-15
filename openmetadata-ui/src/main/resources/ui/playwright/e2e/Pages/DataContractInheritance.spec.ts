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
import { expect, Page } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { selectOption } from '../../utils/advancedSearch';
import { getApiContext, redirectToHomePage, uuid } from '../../utils/common';
import { addAssetsToDataProduct, selectDataProduct } from '../../utils/domain';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

const DATA_PRODUCT_CONTRACT_DETAILS = {
  name: `dp_contract_${uuid()}`,
  description: 'Data Product contract description for inheritance test',
  termsOfService: 'Data Product Terms of Service content for inheritance.',
};

const ASSET_CONTRACT_DETAILS = {
  name: `asset_contract_${uuid()}`,
  description: 'Asset contract description for partial inheritance test',
};

const DATA_PRODUCT_SEMANTICS = {
  name: `dp_semantic_${uuid()}`,
  description: 'Data Product semantic rule',
  rules: [
    {
      field: 'Description',
      operator: 'Is Set',
    },
  ],
};

const ASSET_SEMANTICS = {
  name: `asset_semantic_${uuid()}`,
  description: 'Asset semantic rule',
  rules: [
    {
      field: 'Display Name',
      operator: 'Is Set',
    },
  ],
};

const DATA_PRODUCT_SLA = {
  refreshFrequencyInterval: '5',
  refreshFrequencyUnit: 'Day',
  maxLatencyValue: '10',
  maxLatencyUnit: 'Hour',
  retentionPeriod: '30',
  retentionUnit: 'Day',
  availability: '09:00',
  timezone: 'GMT+00:00 (UTC)',
};

const fillContractDetailsForm = async (
  page: Page,
  contractName: string,
  description: string
) => {
  await page.getByTestId('contract-name').fill(contractName);
  await page.fill('.om-block-editor[contenteditable="true"]', description);

  await page.getByTestId('select-owners').click();
  await page.locator('.rc-virtual-list-holder-inner li').first().click();

  await expect(page.getByTestId('user-tag')).toBeVisible();
};

const fillTermsOfServiceForm = async (page: Page, termsContent: string) => {
  await page.getByRole('button', { name: 'Terms of Service' }).click();
  await page.fill('.om-block-editor .has-focus', termsContent);
};

const fillSemanticsForm = async (
  page: Page,
  semanticsData: typeof DATA_PRODUCT_SEMANTICS
) => {
  await page.getByRole('button', { name: 'Semantics' }).click();

  await page.fill('#semantics_0_name', semanticsData.name);
  await page.fill('#semantics_0_description', semanticsData.description);

  const ruleLocator = page.locator('.group').nth(0);
  await selectOption(
    page,
    ruleLocator.locator('.group--field .ant-select'),
    semanticsData.rules[0].field,
    true
  );
  await selectOption(
    page,
    ruleLocator.locator('.rule--operator .ant-select'),
    semanticsData.rules[0].operator
  );

  await page.getByTestId('save-semantic-button').click();

  await expect(
    page
      .getByTestId('contract-semantics-card-0')
      .locator('.semantic-form-item-title')
  ).toContainText(semanticsData.name);
};

const fillSLAForm = async (
  page: Page,
  slaData: typeof DATA_PRODUCT_SLA,
  columnName: string
) => {
  await page.getByRole('tab', { name: 'SLA' }).click();

  await page
    .getByTestId('refresh-frequency-interval-input')
    .fill(slaData.refreshFrequencyInterval);
  await page.getByTestId('max-latency-value-input').fill(slaData.maxLatencyValue);
  await page.getByTestId('retention-period-input').fill(slaData.retentionPeriod);

  await page.locator('.availability-time-picker').click();
  await page.waitForSelector('.ant-picker-dropdown', { state: 'attached' });
  await page.getByTestId('availability').fill(slaData.availability);
  await page.locator('.ant-picker-ok .ant-btn').click();

  await page.locator('#timezone').fill(slaData.timezone);
  await page.locator('#timezone').press('Enter');

  await page.getByTestId('refresh-frequency-unit-select').click();
  await page
    .locator(`.refresh-frequency-unit-select [title=${slaData.refreshFrequencyUnit}]`)
    .click();

  await page.getByTestId('max-latency-unit-select').click();
  await page
    .locator(`.max-latency-unit-select [title=${slaData.maxLatencyUnit}]`)
    .click();

  await page.getByTestId('retention-unit-select').click();
  await page
    .locator(`.retention-unit-select [title=${slaData.retentionUnit}]`)
    .click();

  await page.locator('#columnName-select').fill(columnName);
  await page.locator('#columnName-select').press('Enter');
};

const saveContract = async (page: Page) => {
  const saveContractResponse = page.waitForResponse('/api/v1/dataContracts*');
  await page.getByTestId('save-contract-btn').click();
  await saveContractResponse;

  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
};

const openContractTab = async (page: Page) => {
  await page.click('[data-testid="contract"]');
  await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
};

const startAddingContract = async (page: Page) => {
  await expect(page.getByTestId('no-data-placeholder')).toBeVisible();
  await expect(page.getByTestId('add-contract-button')).toBeVisible();

  await page.getByTestId('add-contract-button').click();

  await expect(page.getByTestId('add-contract-card')).toBeVisible();
};

test.describe('Data Contract Inheritance', () => {
  const user = new UserClass();
  const domain = new Domain();
  const dataProduct = new DataProduct([domain]);
  const tableWithoutContract = new TableClass();
  const tableWithContract = new TableClass();
  const tableForSLAEditTest = new TableClass();
  const dataProductForPartialInheritance = new DataProduct([domain]);
  const dataProductForSLAEditTest = new DataProduct([domain]);

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await user.create(apiContext);
    await domain.create(apiContext);
    await dataProduct.create(apiContext);
    await tableWithoutContract.create(apiContext);
    await tableWithContract.create(apiContext);
    await tableForSLAEditTest.create(apiContext);
    await dataProductForPartialInheritance.create(apiContext);
    await dataProductForSLAEditTest.create(apiContext);

    // Assign tables to domain so they appear in data product asset selection
    await tableWithoutContract.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains/0',
          value: {
            id: domain.responseData.id,
            type: 'domain',
          },
        },
      ],
    });

    await tableWithContract.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains/0',
          value: {
            id: domain.responseData.id,
            type: 'domain',
          },
        },
      ],
    });

    await tableForSLAEditTest.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/domains/0',
          value: {
            id: domain.responseData.id,
            type: 'domain',
          },
        },
      ],
    });

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await tableWithoutContract.delete(apiContext);
    await tableWithContract.delete(apiContext);
    await tableForSLAEditTest.delete(apiContext);
    await dataProduct.delete(apiContext);
    await dataProductForPartialInheritance.delete(apiContext);
    await dataProductForSLAEditTest.delete(apiContext);
    await domain.delete(apiContext);
    await user.delete(apiContext);

    await afterAction();
  });

  test.beforeEach('Redirect to Home Page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('Full Contract Inheritance - Asset inherits full contract from Data Product', async ({
    page,
  }) => {
    test.setTimeout(300000);

    await test.step('Navigate to Data Product and add contract', async () => {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProduct.data);

      await openContractTab(page);
      await startAddingContract(page);
    });

    await test.step('Fill Data Product contract details', async () => {
      await fillContractDetailsForm(
        page,
        DATA_PRODUCT_CONTRACT_DETAILS.name,
        DATA_PRODUCT_CONTRACT_DETAILS.description
      );
    });

    await test.step('Fill Terms of Service', async () => {
      await fillTermsOfServiceForm(
        page,
        DATA_PRODUCT_CONTRACT_DETAILS.termsOfService
      );
    });

    await test.step('Fill Semantics', async () => {
      await fillSemanticsForm(page, DATA_PRODUCT_SEMANTICS);
    });

    await test.step('Fill SLA', async () => {
      const { apiContext } = await getApiContext(page);
      const tableResponse = await apiContext
        .get(`/api/v1/tables/${tableWithoutContract.entityResponseData.id}`)
        .then((res) => res.json());

      const columnName = tableResponse.columns?.[0]?.name ?? 'id';
      await fillSLAForm(page, DATA_PRODUCT_SLA, columnName);
    });

    await test.step('Save contract', async () => {
      await saveContract(page);
    });

    await test.step('Add asset to Data Product', async () => {
      await addAssetsToDataProduct(
        page,
        dataProduct.responseData.fullyQualifiedName ?? '',
        [tableWithoutContract]
      );
    });

    await test.step('Navigate to asset and verify inherited contract', async () => {
      await tableWithoutContract.visitEntityPage(page);
      await openContractTab(page);

      // Wait for contract to load
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Verify the contract is displayed (inherited from data product)
      await expect(page.getByTestId('contract-title')).toBeVisible();

      // Verify the inherited icon is shown next to contract name
      await expect(
        page.locator('.contract-header-container .inherit-icon')
      ).toBeVisible();

      // Verify Terms of Service has inherited icon
      await expect(
        page.locator('.contract-card-items').filter({ hasText: 'Terms of Service' })
      ).toBeVisible();

      // Verify SLA section exists and has inherited icon
      await expect(
        page.locator('.contract-card-items').filter({ hasText: 'Service Level Agreement' })
      ).toBeVisible();
      await expect(
        page
          .locator('.contract-card-items')
          .filter({ hasText: 'Service Level Agreement' })
          .locator('.inherit-icon')
      ).toBeVisible();

      // Verify Semantics section exists
      await expect(page.getByTestId('semantics-card')).toBeVisible();

      // Check for inherited icon on semantics rules
      await expect(
        page.getByTestId('semantics-card').locator('.inherit-icon')
      ).toBeVisible();
    });
  });

  test('Partial Contract Inheritance - Asset contract merges with Data Product contract', async ({
    page,
  }) => {
    test.setTimeout(300000);

    await test.step('Navigate to asset and add contract with semantics', async () => {
      await tableWithContract.visitEntityPage(page);
      await openContractTab(page);
      await startAddingContract(page);
    });

    await test.step('Fill asset contract details', async () => {
      await fillContractDetailsForm(
        page,
        ASSET_CONTRACT_DETAILS.name,
        ASSET_CONTRACT_DETAILS.description
      );
    });

    await test.step('Fill asset semantics', async () => {
      await fillSemanticsForm(page, ASSET_SEMANTICS);
    });

    await test.step('Save asset contract', async () => {
      await saveContract(page);

      // Verify contract was saved
      await expect(page.getByTestId('contract-title')).toBeVisible();
      await expect(page.getByTestId('semantics-card')).toBeVisible();
    });

    await test.step('Navigate to second Data Product and add contract with different semantics and SLA', async () => {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProductForPartialInheritance.data);

      await openContractTab(page);
      await startAddingContract(page);
    });

    await test.step('Fill Data Product contract details', async () => {
      await fillContractDetailsForm(
        page,
        `dp_partial_${uuid()}`,
        'Data Product contract for partial inheritance'
      );
    });

    await test.step('Fill Data Product Terms of Service', async () => {
      await fillTermsOfServiceForm(
        page,
        'Data Product Terms of Service for partial inheritance test.'
      );
    });

    await test.step('Fill Data Product semantics (different from asset)', async () => {
      await fillSemanticsForm(page, DATA_PRODUCT_SEMANTICS);
    });

    await test.step('Fill Data Product SLA', async () => {
      const { apiContext } = await getApiContext(page);
      const tableResponse = await apiContext
        .get(`/api/v1/tables/${tableWithContract.entityResponseData.id}`)
        .then((res) => res.json());

      const columnName = tableResponse.columns?.[0]?.name ?? 'id';
      await fillSLAForm(page, DATA_PRODUCT_SLA, columnName);
    });

    await test.step('Save Data Product contract', async () => {
      await saveContract(page);
    });

    await test.step('Add asset with contract to Data Product', async () => {
      await addAssetsToDataProduct(
        page,
        dataProductForPartialInheritance.responseData.fullyQualifiedName ?? '',
        [tableWithContract]
      );
    });

    await test.step('Navigate to asset and verify merged contract', async () => {
      await tableWithContract.visitEntityPage(page);
      await openContractTab(page);

      // Wait for contract to load
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Verify the contract is displayed
      await expect(page.getByTestId('contract-title')).toBeVisible();

      // Contract itself should NOT show inherited icon (asset has its own contract)
      await expect(
        page.locator('.contract-header-container .inherit-icon')
      ).not.toBeVisible();

      // Verify Terms of Service has inherited icon (from Data Product)
      await expect(
        page.locator('.contract-card-items').filter({ hasText: 'Terms of Service' })
      ).toBeVisible();
      await expect(
        page
          .locator('.contract-card-items')
          .filter({ hasText: 'Terms of Service' })
          .locator('.inherit-icon')
      ).toBeVisible();

      // Verify SLA section exists and has inherited icon (from Data Product)
      await expect(
        page.locator('.contract-card-items').filter({ hasText: 'Service Level Agreement' })
      ).toBeVisible();
      await expect(
        page
          .locator('.contract-card-items')
          .filter({ hasText: 'Service Level Agreement' })
          .locator('.inherit-icon')
      ).toBeVisible();

      // Verify Semantics section exists
      await expect(page.getByTestId('semantics-card')).toBeVisible();

      // Should have 2 semantic rules - one from asset (no inherited icon) and one from data product (with inherited icon)
      const semanticsSection = page.getByTestId('semantics-card');

      // Verify asset's semantic rule exists (without inherited icon)
      await expect(semanticsSection.getByText(ASSET_SEMANTICS.name)).toBeVisible();

      // Verify data product's semantic rule exists (with inherited icon)
      await expect(
        semanticsSection.getByText(DATA_PRODUCT_SEMANTICS.name)
      ).toBeVisible();

      // Count inherited icons in semantics section - should be at least 1 for the data product semantic
      const inheritedIconsCount = await semanticsSection
        .locator('.inherit-icon')
        .count();
      expect(inheritedIconsCount).toBeGreaterThanOrEqual(1);
    });
  });

  test('Edit Asset Contract - Add SLA when inheriting SLA from Data Product (PATCH should use /add not /replace)', async ({
    page,
  }) => {
    test.setTimeout(300000);

    const ASSET_SLA_EDIT = {
      refreshFrequencyInterval: '2',
      refreshFrequencyUnit: 'Hour',
      maxLatencyValue: '5',
      maxLatencyUnit: 'Minute',
      retentionPeriod: '14',
      retentionUnit: 'Day',
      availability: '10:30',
      timezone: 'GMT+00:00 (UTC)',
    };

    await test.step('Navigate to Data Product and add contract with SLA', async () => {
      await sidebarClick(page, SidebarItem.DATA_PRODUCT);
      await selectDataProduct(page, dataProductForSLAEditTest.data);

      await openContractTab(page);
      await startAddingContract(page);
    });

    await test.step('Fill Data Product contract with SLA', async () => {
      await fillContractDetailsForm(
        page,
        `dp_sla_edit_test_${uuid()}`,
        'Data Product contract with SLA for edit test'
      );
    });

    await test.step('Fill Data Product SLA', async () => {
      const { apiContext } = await getApiContext(page);
      const tableResponse = await apiContext
        .get(`/api/v1/tables/${tableForSLAEditTest.entityResponseData.id}`)
        .then((res) => res.json());

      const columnName = tableResponse.columns?.[0]?.name ?? 'id';
      await fillSLAForm(page, DATA_PRODUCT_SLA, columnName);
    });

    await test.step('Save Data Product contract', async () => {
      await saveContract(page);
    });

    await test.step('Add asset to Data Product', async () => {
      await addAssetsToDataProduct(
        page,
        dataProductForSLAEditTest.responseData.fullyQualifiedName ?? '',
        [tableForSLAEditTest]
      );
    });

    await test.step('Navigate to asset and add contract WITHOUT SLA', async () => {
      await tableForSLAEditTest.visitEntityPage(page);
      await openContractTab(page);

      // Wait for contract to load - it should show inherited contract
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Verify inherited SLA is shown
      await expect(
        page.locator('.contract-card-items').filter({ hasText: 'Service Level Agreement' })
      ).toBeVisible();

      // Click edit to add asset's own contract
      await page.getByTestId('manage-contract-actions').click();
      await page.waitForSelector('.contract-action-dropdown', { state: 'visible' });
      await page.getByTestId('contract-edit-button').click();

      // Wait for edit form to load
      await expect(page.getByTestId('add-contract-card')).toBeVisible();
    });

    await test.step('Fill asset contract details (without SLA initially)', async () => {
      await page.getByTestId('contract-name').fill(`asset_sla_edit_${uuid()}`);
      await page.fill(
        '.om-block-editor[contenteditable="true"]',
        'Asset contract for SLA edit test'
      );
    });

    await test.step('Save asset contract without SLA', async () => {
      await saveContract(page);

      // Verify contract was saved
      await expect(page.getByTestId('contract-title')).toBeVisible();

      // Verify SLA is still shown (inherited from Data Product)
      await expect(
        page.locator('.contract-card-items').filter({ hasText: 'Service Level Agreement' })
      ).toBeVisible();
      await expect(
        page
          .locator('.contract-card-items')
          .filter({ hasText: 'Service Level Agreement' })
          .locator('.inherit-icon')
      ).toBeVisible();
    });

    await test.step('Edit contract again to ADD its own SLA', async () => {
      // Click edit to modify contract
      await page.getByTestId('manage-contract-actions').click();
      await page.waitForSelector('.contract-action-dropdown', { state: 'visible' });
      await page.getByTestId('contract-edit-button').click();

      // Wait for edit form to load
      await expect(page.getByTestId('add-contract-card')).toBeVisible();
    });

    await test.step('Fill asset own SLA (this tests PATCH uses /add not /replace)', async () => {
      const { apiContext } = await getApiContext(page);
      const tableResponse = await apiContext
        .get(`/api/v1/tables/${tableForSLAEditTest.entityResponseData.id}`)
        .then((res) => res.json());

      const columnName = tableResponse.columns?.[0]?.name ?? 'id';
      await fillSLAForm(page, ASSET_SLA_EDIT, columnName);
    });

    await test.step('Save contract with own SLA - PATCH should succeed', async () => {
      // This is the critical test - if PATCH sends /replace instead of /add, it will fail
      // because the backend expects /add for a new SLA when the contract doesn't have one
      const patchResponse = page.waitForResponse((response) => {
        return (
          response.url().includes('/api/v1/dataContracts/') &&
          response.request().method() === 'PATCH'
        );
      });

      await page.getByTestId('save-contract-btn').click();
      const response = await patchResponse;

      // Verify PATCH succeeded (200 OK)
      expect(response.status()).toBe(200);

      await page.waitForLoadState('networkidle');
      await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });
    });

    await test.step('Verify asset now has its own SLA (no inherited icon)', async () => {
      // Reload to get fresh data
      await page.reload();
      await page.waitForLoadState('networkidle');
      await waitForAllLoadersToDisappear(page);

      // Verify SLA section exists
      await expect(
        page.locator('.contract-card-items').filter({ hasText: 'Service Level Agreement' })
      ).toBeVisible();

      // Verify SLA does NOT have inherited icon (asset has its own SLA now)
      await expect(
        page
          .locator('.contract-card-items')
          .filter({ hasText: 'Service Level Agreement' })
          .locator('.inherit-icon')
      ).not.toBeVisible();

      // Verify the asset's SLA values are displayed
      await expect(
        page.getByText(ASSET_SLA_EDIT.refreshFrequencyInterval)
      ).toBeVisible();
    });
  });
});
