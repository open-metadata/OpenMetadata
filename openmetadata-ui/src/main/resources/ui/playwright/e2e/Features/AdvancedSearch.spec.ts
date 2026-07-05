/*
 *  Copyright 2024 Collate.
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
import { EntityStatus } from '../../../src/generated/entity/data/searchIndex';
import { COMMON_TIER_TAG } from '../../constant/common';
import { DOMAIN_TAGS } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  FIELDS,
  fillRule,
  fillStaticListRule,
  OPERATOR,
  runRuleGroupTests,
  runRuleGroupTestsWithNonExistingValue,
  selectOption,
  showAdvancedSearchDialog,
  verifyAllConditions,
} from '../../utils/advancedSearch';
import { redirectToHomePage, uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  clickUpdateButtonIfVisible,
  searchAndClickOnOption,
} from '../../utils/explore';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

let user: UserClass;
let table: TableClass;
let glossaryEntity: Glossary;
let table1: TableClass;
let table2: TableClass;
let topic1: TopicClass;
let topic2: TopicClass;

test.describe('Advanced Search', { tag: ['@advanced-search'] }, () => {
  let searchCriteria: Record<string, Array<string>> = {};

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);

    user = new UserClass();
    table = new TableClass(undefined, 'Regular');
    table1 = new TableClass();
    table2 = new TableClass();
    topic1 = new TopicClass();
    topic2 = new TopicClass();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await user.create(apiContext);
    await Promise.allSettled([
      table1.create(apiContext),
      table2.create(apiContext),
      topic1.create(apiContext),
      topic2.create(apiContext),
    ]);
    glossaryEntity = new Glossary(undefined, [
      {
        id: user.responseData.id,
        type: 'user',
        name: user.responseData.name,
        displayName: user.responseData.displayName,
      },
    ]);
    const glossaryTermEntity = new GlossaryTerm(glossaryEntity);

    await glossaryEntity.create(apiContext);
    await glossaryTermEntity.create(apiContext);
    await table.create(apiContext);

    // Add Owner & Tag and domain to the table
    await table1.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          value: {
            type: 'user',
            id: EntityDataClass.user1.responseData.id,
          },
          path: '/owners/0',
        },
        {
          op: 'add',
          value: {
            tagFQN: 'PersonalData.Personal',
          },
          path: '/tags/0',
        },
        {
          op: 'add',
          path: '/domains/0',
          value: {
            id: EntityDataClass.domain1.responseData.id,
            type: 'domain',
            name: EntityDataClass.domain1.responseData.name,
            displayName: EntityDataClass.domain1.responseData.displayName,
          },
        },
      ],
    });

    // Add data product to the table 1
    await table1.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/dataProducts/0',
          value: {
            id: EntityDataClass.dataProduct1.responseData.id,
            type: 'dataProduct',
            name: EntityDataClass.dataProduct1.responseData.name,
            displayName: EntityDataClass.dataProduct1.responseData.displayName,
          },
        },
      ],
    });

    await table2.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          value: {
            type: 'user',
            id: EntityDataClass.user2.responseData.id,
          },
          path: '/owners/0',
        },
        {
          op: 'add',
          value: {
            tagFQN: 'PII.None',
          },
          path: '/tags/0',
        },
        {
          op: 'add',
          path: '/domains/0',
          value: {
            id: EntityDataClass.domain2.responseData.id,
            type: 'domain',
            name: EntityDataClass.domain2.responseData.name,
            displayName: EntityDataClass.domain2.responseData.displayName,
          },
        },
      ],
    });

    // Add data product to the table 2
    await table2.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/dataProducts/0',
          value: {
            id: EntityDataClass.dataProduct3.responseData.id,
            type: 'dataProduct',
            name: EntityDataClass.dataProduct3.responseData.name,
            displayName: EntityDataClass.dataProduct3.responseData.displayName,
          },
        },
      ],
    });

    // Add Tier To the topic 1
    await topic1.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/tags/0',
          value: {
            name: COMMON_TIER_TAG[0].name,
            tagFQN: COMMON_TIER_TAG[0].fullyQualifiedName,
            labelType: 'Manual',
            state: 'Confirmed',
          },
        },
      ],
    });

    // Add Tier To the topic 2
    await topic2.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/tags/0',
          value: {
            name: COMMON_TIER_TAG[1].name,
            tagFQN: COMMON_TIER_TAG[1].fullyQualifiedName,
            labelType: 'Manual',
            state: 'Confirmed',
          },
        },
      ],
    });

    // Update Search Criteria here
    searchCriteria = {
      ownerDisplayName: [
        EntityDataClass.user1.getUserDisplayName(),
        EntityDataClass.user2.getUserDisplayName(),
      ],
      'tags.tagFQN': ['PersonalData.Personal', 'PII.None'],
      'tier.tagFQN': [
        COMMON_TIER_TAG[0].fullyQualifiedName,
        COMMON_TIER_TAG[1].fullyQualifiedName,
      ],
      'service.displayName.keyword': [
        table1.serviceResponseData.name,
        table2.serviceResponseData.name,
      ],
      'database.displayName.keyword': [
        table1.databaseResponseData.name,
        table2.databaseResponseData.name,
      ],
      'databaseSchema.displayName.keyword': [
        table1.schemaResponseData.name,
        table2.schemaResponseData.name,
      ],
      'columns.name.keyword': [
        table1.entityResponseData.columns[2].name,
        table2.entityResponseData.columns[3].name,
      ],
      'displayName.keyword': [
        table1.entityResponseData.displayName ?? '',
        table2.entityResponseData.displayName ?? '',
      ],
      serviceType: [
        table1.serviceResponseData.serviceType ?? '',
        topic1.serviceResponseData.serviceType ?? '',
      ],
      'messageSchema.schemaFields.name.keyword': [
        topic1.entityResponseData?.messageSchema?.schemaFields?.[0].name ?? '',
        topic2.entityResponseData?.messageSchema?.schemaFields?.[1].name ?? '',
      ],
      'dataModel.columns.name.keyword': [
        EntityDataClass.container1.entityResponseData?.dataModel?.columns?.[0]
          .name ?? '',
        EntityDataClass.container2.entityResponseData?.dataModel?.columns?.[1]
          .name ?? '',
      ],
      dataModelType: [
        EntityDataClass.dashboard1.dataModelResponseData.dataModelType ?? '',
        EntityDataClass.dashboard2.dataModelResponseData.dataModelType ?? '',
      ],
      'fields.name.keyword': [
        EntityDataClass.searchIndex1.entityResponseData?.fields?.[1].name ?? '',
        EntityDataClass.searchIndex2.entityResponseData?.fields?.[3].name ?? '',
      ],
      'tasks.displayName.keyword': [
        EntityDataClass.pipeline1.entityResponseData?.tasks?.[0]?.displayName ??
          '',
        EntityDataClass.pipeline2.entityResponseData?.tasks?.[1]?.displayName ??
          '',
      ],
      'domains.displayName.keyword': [
        EntityDataClass.domain1.responseData.displayName,
        EntityDataClass.domain2.responseData.displayName,
      ],
      'responseSchema.schemaFields.name.keyword': [
        EntityDataClass.apiCollection1.apiEndpointResponseData.responseSchema
          ?.schemaFields[0].name ?? '',
        EntityDataClass.apiCollection2.apiEndpointResponseData.responseSchema
          ?.schemaFields[1].name ?? '',
      ],
      'requestSchema.schemaFields.name.keyword': [
        EntityDataClass.apiCollection1.apiEndpointResponseData.requestSchema
          ?.schemaFields[0].name ?? '',
        EntityDataClass.apiCollection2.apiEndpointResponseData.requestSchema
          ?.schemaFields[1].name ?? '',
      ],
      'name.keyword': [
        table1.entityResponseData.name,
        table2.entityResponseData.name,
      ],
      'project.keyword': [
        EntityDataClass.dashboardDataModel1.entityResponseData.project || '',
        EntityDataClass.dashboardDataModel2.entityResponseData.project || '',
      ],
      'charts.displayName.keyword': [
        EntityDataClass.dashboard1.chartsResponseData.displayName,
        EntityDataClass.dashboard2.chartsResponseData.displayName,
      ],
      'dataProducts.displayName.keyword': [
        EntityDataClass.dataProduct1.responseData.displayName,
        EntityDataClass.dataProduct3.responseData.displayName,
      ],
    };

    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.EXPLORE);
  });

  FIELDS.forEach((field) => {
    test(`Verify All conditions for ${field.id} field`, async ({ page }) => {
      test.slow(true);

      await verifyAllConditions(page, field, searchCriteria[field.name][0]);
    });
  });

  Object.values(OPERATOR).forEach(({ name: operator }) => {
    FIELDS.forEach((field) => {
      // Rule based search
      test(`Verify Rule functionality for field ${field.id} with ${operator} operator`, async ({
        page,
      }) => {
        test.slow(true);

        await runRuleGroupTests(page, field, operator, false, searchCriteria);
      });

      // Group based search
      test(`Verify Group functionality for field ${field.id} with ${operator} operator`, async ({
        page,
      }) => {
        test.slow(true);

        await runRuleGroupTests(page, field, operator, true, searchCriteria);
      });
    });
  });

  test('Verify search with non existing value do not result in infinite search', async ({
    page,
  }) => {
    test.slow(true);

    await runRuleGroupTestsWithNonExistingValue(page);
  });
});

const ENTITY_STATUSES = Object.values(EntityStatus);

test.describe(
  'Advanced Search - Entity Status Filter',
  { tag: [DOMAIN_TAGS.DISCOVERY] },
  () => {
    type StatusEntry = {
      status: EntityStatus;
      endpoint: string;
      id: () => string;
      displayName: () => string;
      fqn: () => string;
    };

    let glossaryForStatus: Glossary;
    let glossaryTermApproved: GlossaryTerm;
    let mlModelDraft: MlModelClass;
    let dataProductInReview: DataProduct;
    let statusEntries: StatusEntry[];

    test.beforeAll(
      'Create mixed entity types with distinct entity statuses',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        glossaryForStatus = new Glossary();
        glossaryTermApproved = new GlossaryTerm(glossaryForStatus);
        mlModelDraft = new MlModelClass();
        dataProductInReview = new DataProduct();

        await glossaryForStatus.create(apiContext);
        await Promise.all([
          glossaryTermApproved.create(apiContext),
          mlModelDraft.create(apiContext),
          dataProductInReview.create(apiContext),
        ]);

        statusEntries = [
          {
            status: EntityStatus.Approved,
            endpoint: 'glossaryTerms',
            id: () => glossaryTermApproved.responseData.id,
            displayName: () => glossaryTermApproved.data.displayName,
            fqn: () => glossaryTermApproved.responseData.fullyQualifiedName,
          },
          {
            status: EntityStatus.Draft,
            endpoint: 'mlmodels',
            id: () => mlModelDraft.entityResponseData.id,
            displayName: () => mlModelDraft.entity.displayName,
            fqn: () => mlModelDraft.entityResponseData.fullyQualifiedName,
          },
          {
            status: EntityStatus.InReview,
            endpoint: 'dataProducts',
            id: () => dataProductInReview.responseData.id ?? '',
            displayName: () => dataProductInReview.data.displayName,
            fqn: () =>
              dataProductInReview.responseData.fullyQualifiedName ?? '',
          },
        ];

        // Patch entityStatus on each entity
        await Promise.all(
          statusEntries.map(({ id, status, endpoint }) =>
            apiContext.patch(`/api/v1/${endpoint}/${id()}`, {
              data: [{ op: 'add', path: '/entityStatus', value: status }],
              headers: { 'Content-Type': 'application/json-patch+json' },
            })
          )
        );

        await afterAction();
      }
    );

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.EXPLORE);
    });

    test('All entity status options are visible in the Status dropdown', async ({
      page,
    }) => {
      await test.step('Open advanced search dialog', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step('Select Status field and == operator', async () => {
        const ruleLocator = page.locator('.rule').nth(0);
        await selectOption(
          page,
          ruleLocator.locator('.rule--field .ant-select'),
          'Status',
          true
        );
        await selectOption(
          page,
          ruleLocator.locator('.rule--operator .ant-select'),
          '=='
        );
      });

      await test.step('Open Status value dropdown and verify all hard-coded options appear', async () => {
        const ruleLocator = page.locator('.rule').nth(0);
        await ruleLocator.locator('.widget--widget > .ant-select').click();

        const dropdown = page
          .locator('.ant-select-dropdown')
          .filter({ hasText: EntityStatus.Approved })
          .last();

        await expect(dropdown).toBeVisible();

        for (const status of ENTITY_STATUSES) {
          await expect(
            dropdown
              .locator('.ant-select-item-option')
              .filter({ hasText: new RegExp(`^${status}$`, 'i') })
              .first()
          ).toBeVisible();
        }
      });
    });

    test('Filtering by status "==" shows matching entity and hides others across entity types', async ({
      page,
    }) => {
      test.slow();

      for (const entry of statusEntries) {
        const { status } = entry;
        const matchedName = entry.displayName();

        await test.step(`Apply Status == "${status}" AND Name == "${matchedName}"`, async () => {
          await showAdvancedSearchDialog(page);

          await fillStaticListRule(page, {
            fieldLabel: 'Status',
            condition: '==',
            value: status,
            ruleIndex: 1,
          });

          await page.getByTestId('advanced-search-add-rule').nth(1).click();

          await fillRule(page, {
            condition: '==',
            field: { id: 'Display Name', name: 'displayName.keyword' },
            searchCriteria: matchedName,
            index: 2,
          });

          const searchRes = page.waitForResponse(
            '/api/v1/search/query?*index=dataAsset*'
          );
          await page.getByTestId('apply-btn').click();
          await searchRes;
          await waitForAllLoadersToDisappear(page);
        });

        await test.step('Filter chip shows the applied status', async () => {
          await expect(
            page.getByTestId('advance-search-filter-container')
          ).toContainText(`'${status}'`);
        });

        await test.step(`"${matchedName}" (${entry.endpoint}) is visible`, async () => {
          await expect(
            page.getByTestId(`table-data-card_${entry.fqn()}`)
          ).toBeVisible();
        });

        await test.step('Entities with other statuses are not in results', async () => {
          const otherEntries = statusEntries.filter((e) => e.status !== status);

          for (const other of otherEntries) {
            await expect(
              page.getByTestId(`table-data-card_${other.fqn()}`)
            ).not.toBeVisible();
          }
        });

        await page.getByTestId('advance-search-clear-btn').click();
      }
    });

    test('Filtering by status "!=" excludes matched entity but shows all other entity types', async ({
      page,
    }) => {
      const targetEntry = statusEntries.find(
        (e) => e.status === EntityStatus.Approved
      )!;
      const approvedName = targetEntry.displayName();
      const otherEntries = statusEntries.filter(
        (e) => e.status !== EntityStatus.Approved
      );

      await test.step('Apply Status != "Approved" AND Name == approved entity name', async () => {
        await showAdvancedSearchDialog(page);

        await fillStaticListRule(page, {
          fieldLabel: 'Status',
          condition: '!=',
          value: EntityStatus.Approved,
          ruleIndex: 1,
        });

        await page.getByTestId('advanced-search-add-rule').nth(1).click();

        await fillRule(page, {
          condition: '==',
          field: { id: 'Display Name', name: 'displayName.keyword' },
          searchCriteria: approvedName,
          index: 2,
        });

        const searchRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataAsset*'
        );
        await page.getByTestId('apply-btn').click();
        await searchRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Filter chip reflects the != condition', async () => {
        await expect(
          page.getByTestId('advance-search-filter-container')
        ).toContainText(`'${EntityStatus.Approved}'`);
      });

      await test.step('GlossaryTerm with Approved status is not visible', async () => {
        await expect(
          page.getByTestId(`table-data-card_${targetEntry.fqn()}`)
        ).not.toBeVisible();
      });

      await test.step('Draft and In Review entities appear when searched by their name and non-Approved status', async () => {
        for (const entry of otherEntries) {
          await page.getByTestId('advance-search-clear-btn').click();
          await showAdvancedSearchDialog(page);

          await fillStaticListRule(page, {
            fieldLabel: 'Status',
            condition: '!=',
            value: EntityStatus.Approved,
            ruleIndex: 1,
          });

          await page.getByTestId('advanced-search-add-rule').nth(1).click();

          await fillRule(page, {
            condition: '==',
            field: { id: 'Display Name', name: 'displayName.keyword' },
            searchCriteria: entry.displayName(),
            index: 2,
          });

          const searchRes = page.waitForResponse(
            '/api/v1/search/query?*index=dataAsset*'
          );
          await page.getByTestId('apply-btn').click();
          await searchRes;
          await waitForAllLoadersToDisappear(page);

          await expect(
            page.getByTestId(`table-data-card_${entry.fqn()}`)
          ).toBeVisible();
        }
      });

      await page.getByTestId('advance-search-clear-btn').click();
    });
  }
);

let DESCRIPTION_TEXT: string;
const ABSENT_WORD = 'xyzzyquux';
let WORD_TO_SEARCH: string;
const DESCRIPTION_FIELD = { id: 'Description', name: 'description' };

let descFilterTable: TableClass;

test.describe(
  'Advanced Search – Description filter',
  { tag: ['@advanced-search'] },
  () => {
    test.beforeAll(
      'Setup – create table with unique description',
      async ({ browser }) => {
        const UNIQUE_WORD = `unique-word-${uuid()}`;
        WORD_TO_SEARCH = `the word ${UNIQUE_WORD} to test`;
        DESCRIPTION_TEXT = `This is a table description containing the word ${UNIQUE_WORD} to test the advanced search functionality.`;
        const { apiContext, afterAction } = await performAdminLogin(browser);

        descFilterTable = new TableClass();
        await descFilterTable.create(apiContext);

        await descFilterTable.patch({
          apiContext,
          patchData: [
            {
              op: 'replace',
              path: '/description',
              value: DESCRIPTION_TEXT,
            },
          ],
        });

        await afterAction();
      }
    );

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.EXPLORE);
    });

    test('Description Contains filter returns matching tables', async ({
      page,
    }) => {
      await test.step('Open advanced search dialog', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step(`Apply Description Contains "${WORD_TO_SEARCH}" AND Service == service name`, async () => {
        await fillRule(page, {
          condition: 'Contains',
          field: DESCRIPTION_FIELD,
          searchCriteria: WORD_TO_SEARCH,
          index: 1,
        });

        const searchRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataAsset*'
        );
        await page.getByTestId('apply-btn').click();
        await searchRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Filter chip reflects the description condition', async () => {
        await expect(
          page.getByTestId('advance-search-filter-container')
        ).toContainText(WORD_TO_SEARCH);
      });

      await test.step('Table card is visible in results', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${descFilterTable.entityResponseData.fullyQualifiedName}`
          )
        ).toBeVisible();
      });

      await page.getByTestId('advance-search-clear-btn').click();
    });

    test('Not Contains – table is NOT visible when filtering by a word that IS in the description', async ({
      page,
    }) => {
      await test.step('Open advanced search dialog', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step(`Apply Description Not Contains "${WORD_TO_SEARCH}" AND Service == service name`, async () => {
        await fillRule(page, {
          condition: 'Not Contains',
          field: DESCRIPTION_FIELD,
          searchCriteria: WORD_TO_SEARCH,
          index: 1,
        });

        await page.getByTestId('advanced-search-add-rule').nth(1).click();

        await fillRule(page, {
          condition: '==',
          field: FIELDS.find((f) => f.id === 'Service')!,
          searchCriteria: descFilterTable.serviceResponseData.name,
          index: 2,
        });

        const searchRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataAsset*'
        );
        await page.getByTestId('apply-btn').click();
        await searchRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Table card is NOT visible', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${descFilterTable.entityResponseData.fullyQualifiedName}`
          )
        ).not.toBeVisible();
      });

      await page.getByTestId('advance-search-clear-btn').click();
    });

    test('Not Contains – table IS visible (word absent from description)', async ({
      page,
    }) => {
      await test.step('Open advanced search dialog', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step(`Apply Description Not Contains "${ABSENT_WORD}" AND Service == service name`, async () => {
        await fillRule(page, {
          condition: 'Not Contains',
          field: DESCRIPTION_FIELD,
          searchCriteria: ABSENT_WORD,
          index: 1,
        });

        await page.getByTestId('advanced-search-add-rule').nth(1).click();

        await fillRule(page, {
          condition: '==',
          field: FIELDS.find((f) => f.id === 'Service')!,
          searchCriteria: descFilterTable.serviceResponseData.name,
          index: 2,
        });

        const searchRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataAsset*'
        );
        await page.getByTestId('apply-btn').click();
        await searchRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Table card IS visible', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${descFilterTable.entityResponseData.fullyQualifiedName}`
          )
        ).toBeVisible();
      });

      await page.getByTestId('advance-search-clear-btn').click();
    });

    test('Is not null – table with a description is visible', async ({
      page,
    }) => {
      await test.step('Open advanced search dialog', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step('Apply Description Is not null AND Service == service name', async () => {
        await fillRule(page, {
          condition: 'Is not null',
          field: DESCRIPTION_FIELD,
          index: 1,
        });

        await page.getByTestId('advanced-search-add-rule').nth(1).click();

        await fillRule(page, {
          condition: '==',
          field: FIELDS.find((f) => f.id === 'Service')!,
          searchCriteria: descFilterTable.serviceResponseData.name,
          index: 2,
        });

        const searchRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataAsset*'
        );
        await page.getByTestId('apply-btn').click();
        await searchRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Table card is visible', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${descFilterTable.entityResponseData.fullyQualifiedName}`
          )
        ).toBeVisible();
      });

      await page.getByTestId('advance-search-clear-btn').click();
    });

    test('Is null – table with a description is NOT visible', async ({
      page,
    }) => {
      await test.step('Open advanced search dialog', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step('Apply Description Is null AND Service == service name', async () => {
        await fillRule(page, {
          condition: 'Is null',
          field: DESCRIPTION_FIELD,
          index: 1,
        });

        await page.getByTestId('advanced-search-add-rule').nth(1).click();

        await fillRule(page, {
          condition: '==',
          field: FIELDS.find((f) => f.id === 'Service')!,
          searchCriteria: descFilterTable.serviceResponseData.name,
          index: 2,
        });

        const searchRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataAsset*'
        );
        await page.getByTestId('apply-btn').click();
        await searchRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Table card is NOT visible', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${descFilterTable.entityResponseData.fullyQualifiedName}`
          )
        ).not.toBeVisible();
      });

      await page.getByTestId('advance-search-clear-btn').click();
    });

    test.describe('Description Status filter', () => {
      test('Description Status == Complete – table with description is visible', async ({
        page,
      }) => {
        await test.step('Open advanced search dialog', async () => {
          await showAdvancedSearchDialog(page);
        });

        await test.step('Apply Description Status == Complete AND Service == service name', async () => {
          await fillStaticListRule(page, {
            fieldLabel: 'Description Status',
            condition: '==',
            value: 'Complete',
            ruleIndex: 1,
          });

          await page.getByTestId('advanced-search-add-rule').nth(1).click();

          await fillRule(page, {
            condition: '==',
            field: FIELDS.find((f) => f.id === 'Service')!,
            searchCriteria: descFilterTable.serviceResponseData.name,
            index: 2,
          });

          const searchRes = page.waitForResponse(
            '/api/v1/search/query?*index=dataAsset*'
          );
          await page.getByTestId('apply-btn').click();
          await searchRes;
          await waitForAllLoadersToDisappear(page);
        });

        await test.step('Table card is visible', async () => {
          await expect(
            page.getByTestId(
              `table-data-card_${descFilterTable.entityResponseData.fullyQualifiedName}`
            )
          ).toBeVisible();
        });

        await page.getByTestId('advance-search-clear-btn').click();
      });

      test('Description Status == Incomplete – table with description is NOT visible', async ({
        page,
      }) => {
        await test.step('Open advanced search dialog', async () => {
          await showAdvancedSearchDialog(page);
        });

        await test.step('Apply Description Status == Incomplete AND Service == service name', async () => {
          await fillStaticListRule(page, {
            fieldLabel: 'Description Status',
            condition: '==',
            value: 'Incomplete',
            ruleIndex: 1,
          });

          await page.getByTestId('advanced-search-add-rule').nth(1).click();

          await fillRule(page, {
            condition: '==',
            field: FIELDS.find((f) => f.id === 'Service')!,
            searchCriteria: descFilterTable.serviceResponseData.name,
            index: 2,
          });

          const searchRes = page.waitForResponse(
            '/api/v1/search/query?*index=dataAsset*'
          );
          await page.getByTestId('apply-btn').click();
          await searchRes;
          await waitForAllLoadersToDisappear(page);
        });

        await test.step('Table card is NOT visible', async () => {
          await expect(
            page.getByTestId(
              `table-data-card_${descFilterTable.entityResponseData.fullyQualifiedName}`
            )
          ).not.toBeVisible();
        });

        await page.getByTestId('advance-search-clear-btn').click();
      });
    });
  }
);

test.describe(
  'Explore Search Count Visibility',
  { tag: ['@explore-search-count'] },
  () => {
    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.EXPLORE);
      await waitForAllLoadersToDisappear(page);
    });

    test('Verify count shows with Advanced Search filter', async ({ page }) => {
      let resultTotal = 0;

      await test.step('Open Advanced Search', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step('Apply Description Contains filter', async () => {
        await fillRule(page, {
          condition: 'Contains',
          field: { id: 'Description', name: 'description' },
          searchCriteria: 'test',
          index: 1,
        });

        const searchRes = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/search/query') &&
            response.url().includes('index=dataAsset') &&
            response.url().includes('size=15')
        );

        await page.getByTestId('apply-btn').click();

        const response = await searchRes;
        resultTotal = (await response.json()).hits.total.value;

        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Verify count is visible and matches the API total', async () => {
        const countEl = page.getByTestId('search-results-count');

        await expect(countEl).toBeVisible();
        await expect(countEl).toContainText(resultTotal.toLocaleString());
      });

      await test.step('Clear filters and verify count disappears', async () => {
        await page.getByTestId('advance-search-clear-btn').click();
        await waitForAllLoadersToDisappear(page);

        await expect(
          page.getByTestId('search-results-count')
        ).not.toBeVisible();
      });
    });

    test('Verify count matches the API total for a quick filter', async ({
      page,
    }) => {
      let resultTotal = 0;

      await test.step('Apply the Table data-asset quick filter', async () => {
        await page.getByTestId('search-dropdown-Data Assets').click();

        const searchRes = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/search/query') &&
            response.url().includes('index=dataAsset') &&
            response.url().includes('size=15')
        );

        await searchAndClickOnOption(
          page,
          { label: 'Data Assets', key: 'entityType', value: 'Table' },
          true
        );
        await clickUpdateButtonIfVisible(page);

        const response = await searchRes;
        resultTotal = (await response.json()).hits.total.value;

        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Count badge shows the same total as the API', async () => {
        const countEl = page.getByTestId('search-results-count');

        await expect(countEl).toBeVisible();
        await expect(countEl).toContainText(resultTotal.toLocaleString());
      });
    });

    test('Verify the toolbar Clear All button is removed', async ({ page }) => {
      await test.step('Apply a quick filter', async () => {
        await page.getByTestId('search-dropdown-Data Assets').click();
        await searchAndClickOnOption(
          page,
          { label: 'Data Assets', key: 'entityType', value: 'Table' },
          true
        );
        await clickUpdateButtonIfVisible(page);
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Only the chip Clear button exists, no toolbar Clear All', async () => {
        await expect(page.getByTestId('clear-filters')).not.toBeVisible();
        await expect(page.getByTestId('clear-all-chips')).toBeVisible();
      });
    });

    test('Verify browse mode has no count', async ({ page }) => {
      await test.step('Verify no search and no filters are applied', async () => {
        await expect(
          page.getByTestId('advance-search-filter-container')
        ).not.toBeVisible();
      });

      await test.step('Verify count is not visible', async () => {
        await expect(
          page.getByTestId('search-results-count')
        ).not.toBeVisible();
      });
    });
  }
);

const COLUMN_TAG_FIELD = {
  id: 'Column Tags',
  name: 'columns.tags.tagFQN',
};

let columnTagTable1: TableClass;
let columnTagTable2: TableClass;
let columnTagClassification: ClassificationClass;
let columnTag1: TagClass;
let columnTag2: TagClass;

test.describe(
  'Advanced Search – Column Tag filter',
  { tag: ['@advanced-search'] },
  () => {
    test.beforeAll(
      'Setup – create classification, tags, and two tables with column tags',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        columnTagClassification = new ClassificationClass();
        await columnTagClassification.create(apiContext);

        columnTag1 = new TagClass({
          classification: columnTagClassification.responseData.name,
        });
        columnTag2 = new TagClass({
          classification: columnTagClassification.responseData.name,
        });
        await Promise.all([
          columnTag1.create(apiContext),
          columnTag2.create(apiContext),
        ]);

        columnTagTable1 = new TableClass();
        columnTagTable2 = new TableClass();
        await Promise.all([
          columnTagTable1.create(apiContext),
          columnTagTable2.create(apiContext),
        ]);

        await columnTagTable1.patch({
          apiContext,
          patchData: [
            {
              op: 'add',
              path: '/columns/0/tags/0',
              value: {
                tagFQN: columnTag1.responseData.fullyQualifiedName,
                labelType: 'Manual',
                state: 'Confirmed',
              },
            },
          ],
        });

        await columnTagTable2.patch({
          apiContext,
          patchData: [
            {
              op: 'add',
              path: '/columns/0/tags/0',
              value: {
                tagFQN: columnTag2.responseData.fullyQualifiedName,
                labelType: 'Manual',
                state: 'Confirmed',
              },
            },
          ],
        });

        await afterAction();
      }
    );

    test.beforeEach(async ({ page }) => {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.EXPLORE);
    });

    test('Column Tags == tag1 returns table1 and hides table2', async ({
      page,
    }) => {
      await test.step('Open advanced search dialog', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step('Apply Column Tags == tag1', async () => {
        await fillRule(page, {
          condition: '==',
          field: COLUMN_TAG_FIELD,
          searchCriteria: columnTag1.responseData.fullyQualifiedName,
          index: 1,
        });

        const searchRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataAsset*'
        );
        await page.getByTestId('apply-btn').click();
        await searchRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Filter chip reflects the applied column tag', async () => {
        await expect(
          page.getByTestId('advance-search-filter-container')
        ).toContainText(
          columnTag1.responseData.fullyQualifiedName.toLowerCase()
        );
      });

      await test.step('table1 (tagged with tag1) is visible', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${columnTagTable1.entityResponseData.fullyQualifiedName}`
          )
        ).toBeVisible();
      });

      await test.step('table2 (tagged with tag2) is NOT visible', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${columnTagTable2.entityResponseData.fullyQualifiedName}`
          )
        ).not.toBeVisible();
      });

      await page.getByTestId('advance-search-clear-btn').click();
    });

    test('Column Tags == tag2 returns table2 and hides table1', async ({
      page,
    }) => {
      await test.step('Open advanced search dialog', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step('Apply Column Tags == tag2', async () => {
        await fillRule(page, {
          condition: '==',
          field: COLUMN_TAG_FIELD,
          searchCriteria: columnTag2.responseData.fullyQualifiedName,
          index: 1,
        });

        const searchRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataAsset*'
        );
        await page.getByTestId('apply-btn').click();
        await searchRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('Filter chip reflects the applied column tag', async () => {
        await expect(
          page.getByTestId('advance-search-filter-container')
        ).toContainText(
          columnTag2.responseData.fullyQualifiedName.toLowerCase()
        );
      });

      await test.step('table2 (tagged with tag2) is visible', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${columnTagTable2.entityResponseData.fullyQualifiedName}`
          )
        ).toBeVisible();
      });

      await test.step('table1 (tagged with tag1) is NOT visible', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${columnTagTable1.entityResponseData.fullyQualifiedName}`
          )
        ).not.toBeVisible();
      });

      await page.getByTestId('advance-search-clear-btn').click();
    });

    test('Column Tags != tag1 excludes table1 from results', async ({
      page,
    }) => {
      await test.step('Open advanced search dialog', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step('Apply Column Tags != tag1 AND Service == table1 service', async () => {
        await fillRule(page, {
          condition: '!=',
          field: COLUMN_TAG_FIELD,
          searchCriteria: columnTag1.responseData.fullyQualifiedName,
          index: 1,
        });

        await page.getByTestId('advanced-search-add-rule').nth(1).click();

        await fillRule(page, {
          condition: '==',
          field: FIELDS.find((f) => f.id === 'Service')!,
          searchCriteria: columnTagTable1.serviceResponseData.name,
          index: 2,
        });

        const searchRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataAsset*'
        );
        await page.getByTestId('apply-btn').click();
        await searchRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('table1 (excluded by != tag1) is NOT visible', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${columnTagTable1.entityResponseData.fullyQualifiedName}`
          )
        ).not.toBeVisible();
      });

      await page.getByTestId('advance-search-clear-btn').click();
    });

    test('Column Tags Contains tag1 name returns table1', async ({ page }) => {
      await test.step('Open advanced search dialog', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step('Apply Column Tags Contains tag1 name', async () => {
        await fillRule(page, {
          condition: 'Contains',
          field: COLUMN_TAG_FIELD,
          searchCriteria: columnTag1.responseData.fullyQualifiedName,
          index: 1,
        });

        const searchRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataAsset*'
        );
        await page.getByTestId('apply-btn').click();
        await searchRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('table1 is visible in results', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${columnTagTable1.entityResponseData.fullyQualifiedName}`
          )
        ).toBeVisible();
      });

      await page.getByTestId('advance-search-clear-btn').click();
    });

    test('Column Tags Not contains tag1 name excludes table1', async ({
      page,
    }) => {
      await test.step('Open advanced search dialog', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step('Apply Column Tags Not contains tag1 AND Service == table1 service', async () => {
        await fillRule(page, {
          condition: 'Not contains',
          field: COLUMN_TAG_FIELD,
          searchCriteria: columnTag1.responseData.fullyQualifiedName,
          index: 1,
        });

        await page.getByTestId('advanced-search-add-rule').nth(1).click();

        await fillRule(page, {
          condition: '==',
          field: FIELDS.find((f) => f.id === 'Service')!,
          searchCriteria: columnTagTable1.serviceResponseData.name,
          index: 2,
        });

        const searchRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataAsset*'
        );
        await page.getByTestId('apply-btn').click();
        await searchRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('table1 is NOT visible', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${columnTagTable1.entityResponseData.fullyQualifiedName}`
          )
        ).not.toBeVisible();
      });

      await page.getByTestId('advance-search-clear-btn').click();
    });

    test('Column Tags Any in [tag1, tag2] returns both tables', async ({
      page,
    }) => {
      await test.step('Open advanced search dialog', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step('Apply Column Tags Any in [tag1, tag2]', async () => {
        await fillRule(page, {
          condition: 'Any in',
          field: COLUMN_TAG_FIELD,
          searchCriteria: columnTag1.responseData.fullyQualifiedName,
          index: 1,
        });

        const searchRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataAsset*'
        );
        await page.getByTestId('apply-btn').click();
        await searchRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('table1 is visible', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${columnTagTable1.entityResponseData.fullyQualifiedName}`
          )
        ).toBeVisible();
      });

      await page.getByTestId('advance-search-clear-btn').click();
    });

    test('Column Tags Not in [tag1] excludes table1', async ({ page }) => {
      await test.step('Open advanced search dialog', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step('Apply Column Tags Not in [tag1] AND Service == table1 service', async () => {
        await fillRule(page, {
          condition: 'Not in',
          field: COLUMN_TAG_FIELD,
          searchCriteria: columnTag1.responseData.fullyQualifiedName,
          index: 1,
        });

        await page.getByTestId('advanced-search-add-rule').nth(1).click();

        await fillRule(page, {
          condition: '==',
          field: FIELDS.find((f) => f.id === 'Service')!,
          searchCriteria: columnTagTable1.serviceResponseData.name,
          index: 2,
        });

        const searchRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataAsset*'
        );
        await page.getByTestId('apply-btn').click();
        await searchRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('table1 is NOT visible (excluded by Not in filter)', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${columnTagTable1.entityResponseData.fullyQualifiedName}`
          )
        ).not.toBeVisible();
      });

      await page.getByTestId('advance-search-clear-btn').click();
    });

    test('Column Tags Is not null returns table with a column tag', async ({
      page,
    }) => {
      await test.step('Open advanced search dialog', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step('Apply Column Tags Is not null AND Service == table1 service', async () => {
        await fillRule(page, {
          condition: 'Is not null',
          field: COLUMN_TAG_FIELD,
          index: 1,
        });

        await page.getByTestId('advanced-search-add-rule').nth(1).click();

        await fillRule(page, {
          condition: '==',
          field: FIELDS.find((f) => f.id === 'Service')!,
          searchCriteria: columnTagTable1.serviceResponseData.name,
          index: 2,
        });

        const searchRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataAsset*'
        );
        await page.getByTestId('apply-btn').click();
        await searchRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('table1 (has column tag) is visible', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${columnTagTable1.entityResponseData.fullyQualifiedName}`
          )
        ).toBeVisible();
      });

      await page.getByTestId('advance-search-clear-btn').click();
    });

    test('Column Tags Is null excludes tables that have column tags', async ({
      page,
    }) => {
      await test.step('Open advanced search dialog', async () => {
        await showAdvancedSearchDialog(page);
      });

      await test.step('Apply Column Tags Is null AND Service == table1 service', async () => {
        await fillRule(page, {
          condition: 'Is null',
          field: COLUMN_TAG_FIELD,
          index: 1,
        });

        await page.getByTestId('advanced-search-add-rule').nth(1).click();

        await fillRule(page, {
          condition: '==',
          field: FIELDS.find((f) => f.id === 'Service')!,
          searchCriteria: columnTagTable1.serviceResponseData.name,
          index: 2,
        });

        const searchRes = page.waitForResponse(
          '/api/v1/search/query?*index=dataAsset*'
        );
        await page.getByTestId('apply-btn').click();
        await searchRes;
        await waitForAllLoadersToDisappear(page);
      });

      await test.step('table1 (has column tag) is NOT visible', async () => {
        await expect(
          page.getByTestId(
            `table-data-card_${columnTagTable1.entityResponseData.fullyQualifiedName}`
          )
        ).not.toBeVisible();
      });

      await page.getByTestId('advance-search-clear-btn').click();
    });
  }
);
