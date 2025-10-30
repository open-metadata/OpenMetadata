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
import { GlobalSettingOptions } from '../../constant/settings';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ChartClass } from '../../support/entity/ChartClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DirectoryClass } from '../../support/entity/DirectoryClass';
import { FileClass } from '../../support/entity/FileClass';
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
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
  assignSingleSelectDomain,
  redirectToHomePage,
} from '../../utils/common';
import {
  addMultiOwner,
  addOwner,
  assignGlossaryTerm,
} from '../../utils/entity';
import { settingClick } from '../../utils/sidebar';
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

  await afterAction();
});

test.describe.serial('Data Asset Rules', () => {
  test.beforeEach('Redirect to Home Page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  try {
    test('Platform Rules Enabled', async ({ page, browser }) => {
      test.setTimeout(360000);

      await test.step('Enable all data asset rules', async () => {
        const rulesResponse = page.waitForResponse(
          '/api/v1/system/settings/entityRulesSettings'
        );
        await settingClick(page, GlobalSettingOptions.DATA_ASSET_RULES);
        await rulesResponse;

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Enable both rules
        const ruleEnabledResponse = page.waitForResponse(
          '/api/v1/system/settings'
        );

        await page
          .getByRole('row', { name: 'Multiple Data Products are' })
          .getByRole('switch')
          .click();

        await ruleEnabledResponse;

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        const ruleEnabledResponse2 = page.waitForResponse(
          '/api/v1/system/settings'
        );

        await page
          .getByRole('row', { name: 'Tables can only have a single' })
          .getByRole('switch')
          .click();

        await ruleEnabledResponse2;

        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });
      });

      for (const EntityClass of entities) {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const entity = new EntityClass();
        const entityName = entity.getType();
        await entity.create(apiContext);
        await afterAction();

        await test.step(
          `Verify the ${entityName} Entity Action items after rules is Enabled`,
          async () => {
            await entity.visitEntityPage(page);

            // If after adding single team it closes then default rule is working. Single team or multiple users
            await addOwner({
              page,
              owner: team.responseData.displayName,
              type: 'Teams',
              endpoint: entity.endpoint,
              dataTestId: 'data-assets-header',
            });

            // Single Domain Add Check
            await assignSingleSelectDomain(page, domain.responseData);

            // Here the createdDataProducts[1] will only be available due to single select type is enabled
            await assignDataProduct(page, domain.responseData, [
              createdDataProducts[0].responseData,
            ]);
            await assignDataProduct(
              page,
              domain.responseData,
              [createdDataProducts[1].responseData],
              'Edit'
            );

            await expect(
              page
                .getByTestId('KnowledgePanel.DataProducts')
                .getByTestId('data-products-list')
                .getByTestId(
                  `data-product-${createdDataProducts[0].responseData.fullyQualifiedName}`
                )
            ).not.toBeVisible();

            if (entityName === 'Table') {
              // Only glossaryTerm2.responseData data will be available due to single select type is enabled
              await assignGlossaryTerm(page, glossaryTerm.responseData);
              await assignGlossaryTerm(
                page,
                glossaryTerm2.responseData,
                'Edit'
              );

              await expect(
                page
                  .getByTestId('KnowledgePanel.GlossaryTerms')
                  .getByTestId('glossary-container')
                  .getByTestId(
                    `tag-${glossaryTerm.responseData.fullyQualifiedName}`
                  )
              ).not.toBeVisible();
            }
          }
        );
      }
    });

    test('Platform Rules Disabled', async ({ page, browser }) => {
      test.setTimeout(600000);

      await test.step('Disable all data asset rules ', async () => {
        const rulesResponse = page.waitForResponse(
          '/api/v1/system/settings/entityRulesSettings'
        );
        await settingClick(page, GlobalSettingOptions.DATA_ASSET_RULES);
        await rulesResponse;

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        const ruleEnabledResponse1 = page.waitForResponse(
          '/api/v1/system/settings'
        );

        await page
          .getByRole('row', { name: 'Multiple Users or Single Team' })
          .getByRole('switch')
          .click();

        await ruleEnabledResponse1;

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        const ruleEnabledResponse2 = page.waitForResponse(
          '/api/v1/system/settings'
        );
        await page
          .getByRole('row', { name: 'Multiple Domains are not' })
          .getByRole('switch')
          .click();
        await ruleEnabledResponse2;

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        const ruleEnabledResponse3 = page.waitForResponse(
          '/api/v1/system/settings'
        );

        await page
          .getByRole('row', { name: 'Multiple Data Products are' })
          .getByRole('switch')
          .click();

        await ruleEnabledResponse3;

        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        const ruleEnabledResponse4 = page.waitForResponse(
          '/api/v1/system/settings'
        );

        await page
          .getByRole('row', { name: 'Tables can only have a single' })
          .getByRole('switch')
          .click();

        await ruleEnabledResponse4;

        await page.reload();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });
      });

      for (const EntityClass of entities) {
        const { apiContext, afterAction } = await performAdminLogin(browser);
        const entity = new EntityClass();
        const entityName = entity.getType();
        await entity.create(apiContext);
        await afterAction();

        await test.step(
          `Verify the ${entityName} entity item action after rules disabled`,
          async () => {
            await entity.visitEntityPage(page);

            // Assign and Team and User both owner together
            const teamName = team.responseData.displayName;
            await addMultiOwner({
              page,
              ownerNames: [user.getUserName(), user2.getUserName()],
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
            await page
              .getByTestId(`owner-select-teams-search-bar`)
              .fill(teamName);
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
              user.getUserName(),
              user2.getUserName(),
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
            await assignDataProduct(page, domain.responseData, [
              createdDataProducts[0].responseData,
              createdDataProducts[1].responseData,
            ]);

            // Add Multiple GlossaryTerm to Table
            await assignGlossaryTerm(page, glossaryTerm.responseData);
            await assignGlossaryTerm(page, glossaryTerm2.responseData, 'Edit');
          }
        );
      }
    });
  } finally {
    test('Reset Data Asset Rules to Default', async ({ page }) => {
      const rulesResponse = page.waitForResponse(
        '/api/v1/system/settings/entityRulesSettings'
      );
      await settingClick(page, GlobalSettingOptions.DATA_ASSET_RULES);
      await rulesResponse;

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const ruleEnabledResponse1 = page.waitForResponse(
        '/api/v1/system/settings'
      );

      await page
        .getByRole('row', { name: 'Multiple Users or Single Team' })
        .getByRole('switch')
        .click();

      await ruleEnabledResponse1;

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const ruleEnabledResponse2 = page.waitForResponse(
        '/api/v1/system/settings'
      );
      await page
        .getByRole('row', { name: 'Multiple Domains are not' })
        .getByRole('switch')
        .click();
      await ruleEnabledResponse2;

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });
    });
  }
});
