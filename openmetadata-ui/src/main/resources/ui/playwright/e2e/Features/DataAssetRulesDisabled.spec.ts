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
  redirectToHomePage,
} from '../../utils/common';
import {
  DATA_ASSET_RULES,
  DEFAULT_DATA_ASSET_RULES,
} from '../../utils/dataAssetRules';
import { addMultiOwner, assignGlossaryTerm } from '../../utils/entity';
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

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  // Reset Rules to Default
  await apiContext.put(`/api/v1/system/settings`, {
    data: {
      config_type: 'entityRulesSettings',
      config_value: {
        entitySemantics: DEFAULT_DATA_ASSET_RULES,
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

        const searchUser = page.waitForResponse(
          `/api/v1/search/query?q=*${encodeURIComponent(teamName)}*`
        );
        await page.getByTestId(`owner-select-teams-search-bar`).fill(teamName);
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
        await assignGlossaryTerm(page, glossaryTerm.responseData);
        await assignGlossaryTerm(page, glossaryTerm2.responseData, 'Edit');
      });
    }
  }
);
