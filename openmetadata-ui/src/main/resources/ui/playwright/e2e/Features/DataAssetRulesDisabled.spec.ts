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
import { expect } from '@playwright/test';
import { SERVICE_TYPE } from '../../constant/service';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { ApiCollectionClass } from '../../support/entity/ApiCollectionClass';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ChartClass } from '../../support/entity/ChartClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { DirectoryClass } from '../../support/entity/DirectoryClass';
import { FileClass } from '../../support/entity/FileClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { ApiServiceClass } from '../../support/entity/service/ApiServiceClass';
import { DashboardServiceClass } from '../../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { DriveServiceClass } from '../../support/entity/service/DriveServiceClass';
import { MessagingServiceClass } from '../../support/entity/service/MessagingServiceClass';
import { MlmodelServiceClass } from '../../support/entity/service/MlmodelServiceClass';
import { PipelineServiceClass } from '../../support/entity/service/PipelineServiceClass';
import { SearchIndexServiceClass } from '../../support/entity/service/SearchIndexServiceClass';
import { StorageServiceClass } from '../../support/entity/service/StorageServiceClass';
import { SpreadsheetClass } from '../../support/entity/SpreadsheetClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { WorksheetClass } from '../../support/entity/WorksheetClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  assignDataProduct,
  assignDomain,
  clickOutside,
  descriptionBoxReadOnly,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { DATA_ASSET_RULES } from '../../utils/dataAssetRules';
import {
  addMultiOwner,
  assignGlossaryTerm,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import {
  createDatabaseRowDetails,
  createDatabaseSchemaRowDetails,
  createTableRowDetails,
  fillRowDetails,
  validateImportStatus,
} from '../../utils/importUtils';
import { visitServiceDetailsPage } from '../../utils/service';
import { test } from '../fixtures/pages';

const entities = [
  ApiEndpointClass,
  TableClass,
  StoredProcedureClass,
  DashboardClass,
  PipelineClass,
  TopicClass,
  MlModelClass,
  ContainerClass,
  SearchIndexClass,
  DashboardDataModelClass,
  MetricClass,
  ChartClass,
  DirectoryClass,
  FileClass,
  SpreadsheetClass,
  WorksheetClass,
  ApiServiceClass,
  ApiCollectionClass,
  DatabaseServiceClass,
  DashboardServiceClass,
  MessagingServiceClass,
  MlmodelServiceClass,
  PipelineServiceClass,
  SearchIndexServiceClass,
  StorageServiceClass,
  DatabaseClass,
  DatabaseSchemaClass,
  DriveServiceClass,
] as const;

const user = new UserClass();
const user2 = new UserClass();
const team = new TeamClass();
const table = new TableClass();
const table2 = new TableClass();
const table3 = new TableClass();
const domain = new Domain();
const domain2 = new Domain();
const testDataProducts = [new DataProduct([domain]), new DataProduct([domain])];
const createdDataProducts: DataProduct[] = [];
const glossary = new Glossary();
const glossaryTerm = new GlossaryTerm(glossary);
const glossaryTerm2 = new GlossaryTerm(glossary);

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  test.slow(true);

  const { apiContext, afterAction } = await performAdminLogin(browser);
  await user.create(apiContext);
  await user2.create(apiContext);
  await team.create(apiContext);
  await table.create(apiContext);
  await table2.create(apiContext);
  await table3.create(apiContext);
  await domain.create(apiContext);
  await domain2.create(apiContext);
  for (const dp of testDataProducts) {
    await dp.create(apiContext);
    createdDataProducts.push(dp);
  }
  await glossary.create(apiContext);
  await glossaryTerm.create(apiContext);
  await glossaryTerm2.create(apiContext);

  // Enable All the Data Asset Rules
  await apiContext.put(`/api/v1/system/settings`, {
    data: {
      config_type: 'entityRulesSettings',
      config_value: {
        entitySemantics: DATA_ASSET_RULES.map((item) => ({
          ...item,
          enabled: false,
        })),
      },
    },
    headers: {
      'Content-Type': 'application/json',
    },
  });

  await afterAction();
});

test.describe(
  `Data Asset Rules Disabled`,
  {
    tag: '@dataAssetRules',
  },
  () => {
    for (const EntityClass of entities) {
      const entity = new EntityClass();
      const entityName = entity.getType();

      test(`Verify the ${entityName} entity item action after rules disabled`, async ({
        page,
        browser,
      }) => {
        test.slow(true);

        const { apiContext, afterAction } = await performAdminLogin(browser);
        await entity.create(apiContext);
        await afterAction();

        await redirectToHomePage(page);
        await entity.visitEntityPage(page);

        // Assign and Team and User both owner together
        const teamName = team.responseData.displayName;
        await addMultiOwner({
          page,
          ownerNames: [user.getUserDisplayName(), user2.getUserDisplayName()],
          activatorBtnDataTestId: 'edit-owner',
          resultTestId: 'data-assets-header',
          endpoint: entity.endpoint,
          type: 'Users',
        });

        await page.click(`[data-testid="edit-owner"]`);

        await expect(
          page.locator("[data-testid='select-owner-tabs']")
        ).toBeVisible();

        await page.waitForSelector(
          '[data-testid="select-owner-tabs"] [data-testid="loader"]',
          { state: 'detached' }
        );

        await page
          .locator("[data-testid='select-owner-tabs']")
          .getByRole('tab', { name: 'Teams' })
          .click();

        await page.waitForSelector(
          '[data-testid="select-owner-tabs"] [data-testid="loader"]',
          { state: 'detached' }
        );

        const teamsSearchBar = page.getByTestId('owner-select-teams-search-bar');
        await teamsSearchBar.waitFor({ state: 'visible' });

        const searchUser = page.waitForResponse(
          `/api/v1/search/query?q=*${encodeURIComponent(teamName)}*`
        );
        await teamsSearchBar.fill(teamName);
        await searchUser;

        const ownerItem = page.getByRole('listitem', {
          name: teamName,
          exact: true,
        });

        await ownerItem.waitFor({ state: 'visible' });
        await ownerItem.click();
        const patchRequest = page.waitForResponse(
          `/api/v1/${entity.endpoint}/*`
        );
        await page
          .locator('[id^="rc-tabs-"][id$="-panel-teams"]')
          .getByTestId('selectable-list-update-btn')
          .click();
        await patchRequest;

        await expect(
          page.getByTestId('data-assets-header').getByTestId(`${teamName}`)
        ).toBeVisible();

        for (const name of [
          user.getUserDisplayName(),
          user2.getUserDisplayName(),
          teamName,
        ]) {
          await expect(
            page.getByTestId('data-assets-header').getByTestId(`${name}`)
          ).toBeVisible();
        }

        await assignDomain(page, domain.responseData);
        await assignDomain(page, domain2.responseData, false);

        await expect(page.getByTestId('domain-count-button')).toBeVisible();

        // Add Multiple DataProduct, since default single select is off
        if (!entityName.includes('Service')) {
          await assignDataProduct(page, domain.responseData, [
            createdDataProducts[0].responseData,
          ]);

          await assignDataProduct(
            page,
            domain.responseData,
            [createdDataProducts[1].responseData],
            'Edit'
          );
        }

        // Add Multiple GlossaryTerm to Table
        await assignGlossaryTerm(
          page,
          glossaryTerm.responseData,
          'Add',
          entity.endpoint
        );
        await assignGlossaryTerm(
          page,
          glossaryTerm2.responseData,
          'Edit',
          entity.endpoint
        );
      });
    }
  }
);

test.describe(
  `Data Asset Rules Disabled Bulk Edit Actions`,
  {
    tag: '@dataAssetRules',
  },
  () => {
    const glossaryDetails = {
      name: glossaryTerm.data.name,
      parent: glossary.data.name,
    };

    const databaseSchemaDetails1 = {
      ...createDatabaseSchemaRowDetails(),
      glossary: glossaryDetails,
    };

    const tableDetails1 = {
      ...createTableRowDetails(),
      glossary: glossaryDetails,
    };

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
    });

    test('Database service', async ({ page, browser }) => {
      test.slow(true);

      const table = new TableClass();

      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.create(apiContext);

      await test.step('Perform bulk edit action', async () => {
        const databaseDetails = {
          ...createDatabaseRowDetails(),
          domains: domain.responseData,
          glossary: glossaryDetails,
        };

        await visitServiceDetailsPage(
          page,
          {
            name: table.service.name,
            type: SERVICE_TYPE.Database,
          },
          false
        );
        await page.click('[data-testid="bulk-edit-table"]');

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Adding some assertion to make sure that CSV loaded correctly
        await expect(page.locator('.rdg-header-row')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Previous' })
        ).not.toBeVisible();

        // Adding manual wait for the file to load
        await page.waitForTimeout(500);

        // Click on first cell and edit

        await page.click('.rdg-cell[role="gridcell"]');
        await fillRowDetails(
          {
            ...databaseDetails,
            name: table.database.name,
            owners: [
              user.responseData?.['displayName'],
              user2.responseData?.['displayName'],
            ],
            teamOwners: [team.responseData?.['displayName']],
            retentionPeriod: undefined,
            sourceUrl: undefined,
          },
          page,
          undefined,
          undefined,
          true
        );

        await page.getByRole('button', { name: 'Next' }).click();

        await validateImportStatus(page, {
          passed: '2',
          processed: '2',
          failed: '0',
        });

        const updateButtonResponse = page.waitForResponse(
          `/api/v1/services/databaseServices/name/*/importAsync?*dryRun=false&recursive=false*`
        );

        await page.getByRole('button', { name: 'Update' }).click();

        await page
          .locator('.inovua-react-toolkit-load-mask__background-layer')
          .waitFor({ state: 'detached' });
        await updateButtonResponse;
        await page.waitForEvent('framenavigated');
        await toastNotification(page, /details updated successfully/);

        await page.click('[data-testid="databases"]');

        await page.waitForLoadState('networkidle');

        // Verify Details updated
        await expect(page.getByTestId('column-name')).toHaveText(
          `${table.database.name}${databaseDetails.displayName}`
        );

        await expect(
          page.locator(`.ant-table-cell ${descriptionBoxReadOnly}`)
        ).toContainText('Playwright Database description.');

        // Verify Owners
        await expect(
          page.getByTestId(user.responseData?.['displayName'])
        ).toBeVisible();
        await expect(
          page.getByTestId(user2.responseData?.['displayName'])
        ).toBeVisible();

        await expect(
          page.getByRole('link', { name: team.responseData?.['displayName'] })
        ).toBeVisible();

        // Verify Tags
        await expect(
          page.getByRole('link', {
            name: 'Sensitive',
          })
        ).toBeVisible();

        await expect(
          page.getByRole('link', {
            name: 'Tier1',
          })
        ).toBeVisible();

        await expect(
          page.getByRole('link', {
            name: glossaryTerm.data.displayName,
          })
        ).toBeVisible();
      });

      await table.delete(apiContext);
      await afterAction();
    });

    test('Database', async ({ page, browser }) => {
      test.slow(true);

      const table = new TableClass();

      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.create(apiContext);

      await test.step('Perform bulk edit action', async () => {
        // visit entity Page
        await visitServiceDetailsPage(
          page,
          {
            name: table.service.name,
            type: SERVICE_TYPE.Database,
          },
          false
        );

        const databaseResponse = page.waitForResponse(
          `/api/v1/databases/name/*${table.database.name}?**`
        );
        await page.getByTestId(table.database.name).click();
        await databaseResponse;

        await page.click('[data-testid="bulk-edit-table"]');

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Adding some assertion to make sure that CSV loaded correctly
        await expect(page.locator('.rdg-header-row')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Previous' })
        ).not.toBeVisible();

        // Adding manual wait for the file to load
        await page.waitForTimeout(500);

        // click on last row first cell
        await page.click('.rdg-cell[role="gridcell"]');

        // Click on first cell and edit
        await fillRowDetails(
          {
            ...databaseSchemaDetails1,
            name: table.schema.name,
            owners: [
              user.responseData?.['displayName'],
              user2.responseData?.['displayName'],
            ],
            teamOwners: [team.responseData?.['displayName']],
            domains: domain.responseData,
          },
          page,
          undefined,
          undefined,
          true
        );

        await page.getByRole('button', { name: 'Next' }).click();
        const loader = page.locator(
          '.inovua-react-toolkit-load-mask__background-layer'
        );

        await loader.waitFor({ state: 'hidden' });

        await validateImportStatus(page, {
          passed: '2',
          processed: '2',
          failed: '0',
        });

        await page.waitForSelector('.rdg-header-row', {
          state: 'visible',
        });
        const updateButtonResponse = page.waitForResponse(
          `/api/v1/databases/name/*/importAsync?*dryRun=false&recursive=false*`
        );
        await page.getByRole('button', { name: 'Update' }).click();
        await page
          .locator('.inovua-react-toolkit-load-mask__background-layer')
          .waitFor({ state: 'detached' });
        await updateButtonResponse;
        await page.waitForEvent('framenavigated');
        await toastNotification(page, /details updated successfully/);

        // Verify Details updated
        await expect(page.getByTestId('column-name')).toHaveText(
          `${table.schema.name}${databaseSchemaDetails1.displayName}`
        );

        await expect(
          page.locator(`.ant-table-cell ${descriptionBoxReadOnly}`)
        ).toContainText('Playwright Database Schema description.');

        // Verify Owners
        await expect(
          page.getByTestId(user.responseData?.['displayName'])
        ).toBeVisible();

        await expect(
          page.getByTestId(user2.responseData?.['displayName'])
        ).toBeVisible();

        await expect(
          page.getByRole('link', { name: team.responseData?.['displayName'] })
        ).toBeVisible();

        await page.getByTestId('column-display-name').click();

        await page.waitForLoadState('networkidle');
        await page.waitForSelector('loader', { state: 'hidden' });

        // Verify Tags
        await expect(
          page.getByRole('link', {
            name: 'Sensitive',
          })
        ).toBeVisible();

        await expect(
          page.getByRole('link', {
            name: 'Tier1',
          })
        ).toBeVisible();

        await expect(
          page.getByRole('link', {
            name: glossaryTerm.data.displayName,
          })
        ).toBeVisible();
      });

      await table.delete(apiContext);
      await afterAction();
    });

    test('Database Schema', async ({ page, browser }) => {
      test.slow(true);

      const table = new TableClass();

      const { apiContext, afterAction } = await performAdminLogin(browser);
      await table.create(apiContext);

      await test.step('Perform bulk edit action', async () => {
        // visit entity page
        await visitServiceDetailsPage(
          page,
          {
            name: table.service.name,
            type: SERVICE_TYPE.Database,
          },
          false
        );

        const databaseResponse = page.waitForResponse(
          `/api/v1/databases/name/*${table.database.name}?**`
        );
        await page.getByTestId(table.database.name).click();
        await databaseResponse;
        const databaseSchemaResponse = page.waitForResponse(
          `/api/v1/databaseSchemas/name/*${table.schema.name}?*`
        );
        await page.getByTestId(table.schema.name).click();
        await databaseSchemaResponse;

        await page.click('[data-testid="bulk-edit-table"]');

        // Adding some assertion to make sure that CSV loaded correctly
        await expect(page.locator('.rdg-header-row')).toBeVisible();
        await expect(page.getByRole('button', { name: 'Next' })).toBeVisible();
        await expect(
          page.getByRole('button', { name: 'Previous' })
        ).not.toBeVisible();

        // Adding manual wait for the file to load
        await page.waitForTimeout(500);

        // Click on first cell and edit
        await page.click('.rdg-cell[role="gridcell"]');
        await fillRowDetails(
          {
            ...tableDetails1,
            name: table.entity.name,
            owners: [
              user.responseData?.['displayName'],
              user2.responseData?.['displayName'],
            ],
            teamOwners: [team.responseData?.['displayName']],
            domains: domain.responseData,
          },
          page,
          undefined,
          undefined,
          true
        );

        await page.getByRole('button', { name: 'Next' }).click();

        await validateImportStatus(page, {
          passed: '2',
          processed: '2',
          failed: '0',
        });
        const updateButtonResponse = page.waitForResponse(
          `/api/v1/databaseSchemas/name/*/importAsync?*dryRun=false&recursive=false*`
        );
        await page.getByRole('button', { name: 'Update' }).click();

        await updateButtonResponse;
        await page.waitForEvent('framenavigated');
        await toastNotification(page, /details updated successfully/);

        // Verify Details updated
        await expect(page.getByTestId('column-name')).toHaveText(
          `${table.entity.name}${tableDetails1.displayName}`
        );

        await expect(
          page.locator(`.ant-table-cell ${descriptionBoxReadOnly}`)
        ).toContainText('Playwright Table description');

        // Go to Table Page
        await page
          .getByTestId('column-display-name')
          .getByTestId(table.entity.name)
          .click();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('loader', { state: 'hidden' });

        // Verify Domain
        await expect(page.getByTestId('domain-link')).toContainText(
          domain.responseData.displayName
        );

        // Verify Owners
        await expect(
          page.getByTestId(user.responseData?.['displayName'])
        ).toBeVisible();

        await expect(
          page.getByTestId(user2.responseData?.['displayName'])
        ).toBeVisible();

        await expect(
          page.getByRole('link', { name: team.responseData?.['displayName'] })
        ).toBeVisible();

        // Verify Tags
        await expect(
          page.getByRole('link', {
            name: 'Sensitive',
          })
        ).toBeVisible();

        await expect(
          page.getByRole('link', {
            name: 'Tier1',
          })
        ).toBeVisible();

        await expect(
          page.getByRole('link', {
            name: glossaryTerm.data.displayName,
          })
        ).toBeVisible();
      });

      await table.delete(apiContext);
      await afterAction();
    });
  }
);

test.describe(
  `GlossaryTerm Domain Entity Rules Disabled`,
  {
    tag: '@dataAssetRules',
  },
  () => {
    // Verify glossary term allows multiple domains when entity rules are disabled
    test('should allow multiple domain selection for glossary term when entity rules are disabled', async ({
      page,
      browser,
    }) => {
      test.slow(true);
      const { apiContext, afterAction } = await performAdminLogin(browser);
      const testDomain1 = new Domain();
      const testDomain2 = new Domain();
      const testGlossary = new Glossary();
      const testGlossaryTerm = new GlossaryTerm(testGlossary);

      try {
        await testDomain1.create(apiContext);
        await testDomain2.create(apiContext);
        await testGlossary.create(apiContext);
        await testGlossaryTerm.create(apiContext);

        // Navigate to glossary term page with full page load
        await page.goto(
          `/glossary/${encodeURIComponent(testGlossaryTerm.responseData.fullyQualifiedName)}`
        );

        // Wait for page to be fully loaded
        await page.waitForLoadState('domcontentloaded');
        await waitForAllLoadersToDisappear(page);

        // Open domain selector to verify multi-select mode (checkboxes visible)
        await page.getByTestId('add-domain').click();
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Verify checkboxes ARE visible (multi-select mode)
        await expect(
          page.locator('.domain-selectable-tree .ant-tree-checkbox').first()
        ).toBeVisible();

        // Close the selector by clicking outside
        await clickOutside(page);

        // Wait for domain selector to be fully closed
        await page.waitForSelector('[data-testid="domain-selectable-tree"]', {
          state: 'detached',
        });

        // Assign first domain (multi-select mode)
        await assignDomain(page, testDomain1.responseData);

        // Assign second domain (should ADD to first, not replace)
        await assignDomain(page, testDomain2.responseData, false);

        // Verify both domains are visible (multi-select mode allows multiple)
        // Use filter to find specific domain links
        await expect(
          page
            .getByTestId('domain-link')
            .filter({ hasText: testDomain1.data.displayName })
        ).toBeVisible();
        await expect(
          page
            .getByTestId('domain-link')
            .filter({ hasText: testDomain2.data.displayName })
        ).toBeVisible();
      } finally {
        await testGlossaryTerm.delete(apiContext);
        await testGlossary.delete(apiContext);
        await testDomain1.delete(apiContext);
        await testDomain2.delete(apiContext);
        await afterAction();
      }
    });
  }
);
