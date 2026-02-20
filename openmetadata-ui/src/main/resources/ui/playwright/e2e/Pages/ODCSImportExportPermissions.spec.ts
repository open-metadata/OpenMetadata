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
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  getApiContext,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import {
  importODCSYaml,
  navigateToContractTab,
  openODCSImportDropdown,
} from '../../utils/odcsImportExport';
import { test as base } from '../fixtures/pages';
import { ODCS_VALID_BASIC_YAML } from '../../constant/dataContracts';

// Policy rules for dataContract EditAll permissions
const DATA_CONTRACT_EDIT_RULES = [
  {
    name: `data-contract-edit-${uuid()}`,
    resources: ['dataContract'],
    operations: ['ViewAll', 'ViewBasic', 'EditAll', 'Create', 'Delete'],
    effect: 'allow',
  },
  {
    name: `all-view-${uuid()}`,
    resources: ['all'],
    operations: ['ViewAll'],
    effect: 'allow',
  },
];

// Policy rules for dataContract ViewOnly permissions
const DATA_CONTRACT_VIEW_ONLY_RULES = [
  {
    name: `data-contract-view-${uuid()}`,
    resources: ['dataContract'],
    operations: ['ViewAll', 'ViewBasic'],
    effect: 'allow',
  },
  {
    name: `all-view-${uuid()}`,
    resources: ['all'],
    operations: ['ViewAll'],
    effect: 'allow',
  },
];

const dataContractEditPolicy = new PolicyClass();
const dataContractEditRole = new RolesClass();
const dataContractEditUser = new UserClass();

const dataContractViewPolicy = new PolicyClass();
const dataContractViewRole = new RolesClass();
const dataContractViewUser = new UserClass();

const test = base.extend<{
  dataContractEditPage: Page;
  dataContractViewPage: Page;
}>({
  dataContractEditPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await dataContractEditUser.login(page);
    await use(page);
    await page.close();
  },
  dataContractViewPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await dataContractViewUser.login(page);
    await use(page);
    await page.close();
  },
});

/**
 * Verifies visibility of import/export buttons in the contract action menu
 */
const verifyContractButtonVisibility = async (
  page: Page,
  options: {
    importOdcs: boolean;
    importOm: boolean;
    exportOdcs: boolean;
    exportOm: boolean;
  }
) => {
  const importOdcsButton = page.getByTestId('import-odcs-contract-button');
  const importOmButton = page.getByTestId('import-openmetadata-contract-button');
  const exportOdcsButton = page.getByTestId('export-odcs-contract-button');
  const exportOmButton = page.getByTestId('export-contract-button');

  if (options.importOdcs) {
    await expect(importOdcsButton).toBeVisible();
  } else {
    await expect(importOdcsButton).not.toBeVisible();
  }

  if (options.importOm) {
    await expect(importOmButton).toBeVisible();
  } else {
    await expect(importOmButton).not.toBeVisible();
  }

  if (options.exportOdcs) {
    await expect(exportOdcsButton).toBeVisible();
  } else {
    await expect(exportOdcsButton).not.toBeVisible();
  }

  if (options.exportOm) {
    await expect(exportOmButton).toBeVisible();
  } else {
    await expect(exportOmButton).not.toBeVisible();
  }
};

/**
 * Performs ODCS export and returns the download
 */
const performODCSExport = async (page: Page) => {
  const downloadPromise = page.waitForEvent('download');
  await page.getByTestId('export-odcs-contract-button').click();
  const download = await downloadPromise;
  await toastNotification(page, 'ODCS Contract exported successfully');

  return download;
};

test.describe('ODCS Import/Export - RBAC Permissions', () => {
  const tableWithContract = new TableClass();
  const tableWithoutContract = new TableClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    // Create users with custom permissions
    await dataContractEditUser.create(apiContext, false);
    await dataContractViewUser.create(apiContext, false);

    // Create and assign EditAll policy/role
    const editPolicyResponse = await dataContractEditPolicy.create(
      apiContext,
      DATA_CONTRACT_EDIT_RULES
    );
    const editRoleResponse = await dataContractEditRole.create(apiContext, [
      editPolicyResponse.fullyQualifiedName,
    ]);
    await dataContractEditUser.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/roles/0',
          value: {
            id: editRoleResponse.id,
            type: 'role',
            name: editRoleResponse.name,
          },
        },
      ],
    });

    // Create and assign ViewOnly policy/role
    const viewPolicyResponse = await dataContractViewPolicy.create(
      apiContext,
      DATA_CONTRACT_VIEW_ONLY_RULES
    );
    const viewRoleResponse = await dataContractViewRole.create(apiContext, [
      viewPolicyResponse.fullyQualifiedName,
    ]);
    await dataContractViewUser.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/roles/0',
          value: {
            id: viewRoleResponse.id,
            type: 'role',
            name: viewRoleResponse.name,
          },
        },
      ],
    });

    // Create tables
    await tableWithContract.create(apiContext);
    await tableWithoutContract.create(apiContext);

    // Create a contract on one table via API
    await apiContext.post('/api/v1/dataContracts', {
      data: {
        name: `test-contract-${uuid()}`,
        description: 'Test contract for permission testing',
        entity: {
          id: tableWithContract.entityResponseData.id,
          type: 'table',
        },
      },
    });

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    await tableWithContract.delete(apiContext);
    await tableWithoutContract.delete(apiContext);
    await dataContractEditUser.delete(apiContext);
    await dataContractViewUser.delete(apiContext);
    await dataContractEditRole.delete(apiContext);
    await dataContractEditPolicy.delete(apiContext);
    await dataContractViewRole.delete(apiContext);
    await dataContractViewPolicy.delete(apiContext);

    await afterAction();
  });

  test.describe('Admin User', () => {
    /**
     * @description Verify admin can see all import/export options for existing contract
     */
    test('Admin should see all import and export options for existing contract', async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await navigateToContractTab(page, tableWithContract);

      await page.getByTestId('manage-contract-actions').click();

      await verifyContractButtonVisibility(page, {
        importOdcs: true,
        importOm: true,
        exportOdcs: true,
        exportOm: true,
      });
    });

    /**
     * @description Verify admin can export ODCS contract
     */
    test('Admin should successfully export ODCS contract', async ({ page }) => {
      await redirectToHomePage(page);
      await navigateToContractTab(page, tableWithContract);

      await page.getByTestId('manage-contract-actions').click();
      const download = await performODCSExport(page);
      expect(download.suggestedFilename()).toContain('.yaml');
    });

    /**
     * @description Verify admin can import ODCS contract on table without contract
     */
    test('Admin should successfully import ODCS contract', async ({ page }) => {
      await redirectToHomePage(page);
      await navigateToContractTab(page, tableWithoutContract);

      await openODCSImportDropdown(page);
      await importODCSYaml(page, ODCS_VALID_BASIC_YAML, 'admin-import.yaml');

      await expect(page.getByTestId('contract-title')).toBeVisible();
    });
  });

  test.describe('Data Consumer Role', () => {
    /**
     * @description Data Consumer should see export options but not import options
     */
    test('Data Consumer should see export but not import options', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);
      await navigateToContractTab(dataConsumerPage, tableWithContract);

      await dataConsumerPage.getByTestId('manage-contract-actions').click();

      await verifyContractButtonVisibility(dataConsumerPage, {
        importOdcs: false,
        importOm: false,
        exportOdcs: true,
        exportOm: true,
      });
    });

    /**
     * @description Data Consumer can successfully export ODCS contract
     */
    test('Data Consumer can export ODCS contract', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);
      await navigateToContractTab(dataConsumerPage, tableWithContract);

      await dataConsumerPage.getByTestId('manage-contract-actions').click();
      const download = await performODCSExport(dataConsumerPage);
      expect(download.suggestedFilename()).toContain('.yaml');
    });
  });

  test.describe('Data Steward Role', () => {
    /**
     * @description Data Steward should see export options but not import options
     */
    test('Data Steward should see export but not import options', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);
      await navigateToContractTab(dataStewardPage, tableWithContract);

      await dataStewardPage.getByTestId('manage-contract-actions').click();

      await verifyContractButtonVisibility(dataStewardPage, {
        importOdcs: false,
        importOm: false,
        exportOdcs: true,
        exportOm: true,
      });
    });

    /**
     * @description Data Steward can successfully export ODCS contract
     */
    test('Data Steward can export ODCS contract', async ({
      dataStewardPage,
    }) => {
      await redirectToHomePage(dataStewardPage);
      await navigateToContractTab(dataStewardPage, tableWithContract);

      await dataStewardPage.getByTestId('manage-contract-actions').click();
      const download = await performODCSExport(dataStewardPage);
      expect(download.suggestedFilename()).toContain('.yaml');
    });
  });

  test.describe('User with DataContract EditAll Permission', () => {
    /**
     * @description User with EditAll permission should see all import and export options
     */
    test('User with EditAll should see all import and export options', async ({
      dataContractEditPage,
    }) => {
      await redirectToHomePage(dataContractEditPage);
      await navigateToContractTab(dataContractEditPage, tableWithContract);

      await dataContractEditPage.getByTestId('manage-contract-actions').click();

      await verifyContractButtonVisibility(dataContractEditPage, {
        importOdcs: true,
        importOm: true,
        exportOdcs: true,
        exportOm: true,
      });
    });

    /**
     * @description User with EditAll permission can export ODCS contract
     */
    test('User with EditAll can export ODCS contract', async ({
      dataContractEditPage,
    }) => {
      await redirectToHomePage(dataContractEditPage);
      await navigateToContractTab(dataContractEditPage, tableWithContract);

      await dataContractEditPage.getByTestId('manage-contract-actions').click();
      const download = await performODCSExport(dataContractEditPage);
      expect(download.suggestedFilename()).toContain('.yaml');
    });

    /**
     * @description User with EditAll permission can import ODCS contract
     */
    test('User with EditAll can import ODCS contract', async ({
      dataContractEditPage,
    }) => {
      // Create a new table for this test
      const testTable = new TableClass();
      const { apiContext: adminApi, afterAction } = await performAdminLogin(
        await dataContractEditPage.context().browser()!
      );
      await testTable.create(adminApi);
      await afterAction();

      try {
        await redirectToHomePage(dataContractEditPage);
        await navigateToContractTab(dataContractEditPage, testTable);

        await openODCSImportDropdown(dataContractEditPage);
        await importODCSYaml(
          dataContractEditPage,
          ODCS_VALID_BASIC_YAML,
          'edit-user-import.yaml'
        );

        await expect(
          dataContractEditPage.getByTestId('contract-title')
        ).toBeVisible();
      } finally {
        const { apiContext: cleanupApi, afterAction: cleanupAfterAction } =
          await performAdminLogin(
            await dataContractEditPage.context().browser()!
          );
        await testTable.delete(cleanupApi);
        await cleanupAfterAction();
      }
    });
  });

  test.describe('User with DataContract ViewOnly Permission', () => {
    /**
     * @description User with ViewOnly permission should see export but not import options
     */
    test('User with ViewOnly should see export but not import options', async ({
      dataContractViewPage,
    }) => {
      await redirectToHomePage(dataContractViewPage);
      await navigateToContractTab(dataContractViewPage, tableWithContract);

      await dataContractViewPage.getByTestId('manage-contract-actions').click();

      await verifyContractButtonVisibility(dataContractViewPage, {
        importOdcs: false,
        importOm: false,
        exportOdcs: true,
        exportOm: true,
      });
    });

    /**
     * @description User with ViewOnly permission can export ODCS contract
     */
    test('User with ViewOnly can export ODCS contract', async ({
      dataContractViewPage,
    }) => {
      await redirectToHomePage(dataContractViewPage);
      await navigateToContractTab(dataContractViewPage, tableWithContract);

      await dataContractViewPage.getByTestId('manage-contract-actions').click();
      const download = await performODCSExport(dataContractViewPage);
      expect(download.suggestedFilename()).toContain('.yaml');
    });
  });

  test.describe('API-Level Permission Enforcement', () => {
    /**
     * @description Verify API allows export for users with view permission
     */
    test('API should allow export for users with view permission', async ({
      dataConsumerPage,
    }) => {
      await redirectToHomePage(dataConsumerPage);
      await navigateToContractTab(dataConsumerPage, tableWithContract);

      // Get contract ID from page
      const { apiContext } = await getApiContext(dataConsumerPage);

      // Get the contract first
      const contractsResponse = await apiContext.get(
        `/api/v1/dataContracts?entity=${tableWithContract.entityResponseData.id}`
      );
      const contracts = await contractsResponse.json();

      if (contracts.data && contracts.data.length > 0) {
        const contractId = contracts.data[0].id;

        // Try to export via API
        const exportResponse = await apiContext.get(
          `/api/v1/dataContracts/${contractId}/odcs/yaml`
        );

        // Should succeed with 200
        expect(exportResponse.status()).toBe(200);
      }
    });
  });
});
