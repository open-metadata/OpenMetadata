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

import { COMMON_TIER_TAG } from '../../constant/common';
import { PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ } from '../../constant/config';
import { SidebarItem } from '../../constant/sidebar';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  FIELDS,
  OPERATOR,
  runRuleGroupTests,
  runRuleGroupTestsWithNonExistingValue,
  verifyAllConditions,
} from '../../utils/advancedSearch';
import { redirectToHomePage } from '../../utils/common';
import { sidebarClick } from '../../utils/sidebar';
import { test } from '../fixtures/pages';

const user = new UserClass();
const table = new TableClass(undefined, 'Regular');
let glossaryEntity: Glossary;
const table1 = new TableClass();
const table2 = new TableClass();
const topic1 = new TopicClass();
const topic2 = new TopicClass();

test.describe('Advanced Search', { tag: ['@advanced-search', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ.tag] }, () => {
  let searchCriteria: Record<string, Array<string>> = {};

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);

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
      'owners.displayName.keyword': [
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
        table1.entityResponseData.displayName,
        table2.entityResponseData.displayName,
      ],
      serviceType: [
        table1.serviceResponseData.serviceType,
        topic1.serviceResponseData.serviceType,
      ],
      'messageSchema.schemaFields.name.keyword': [
        topic1.entityResponseData?.messageSchema.schemaFields[0].name,
        topic2.entityResponseData?.messageSchema.schemaFields[1].name,
      ],
      'dataModel.columns.name.keyword': [
        EntityDataClass.container1.entityResponseData.dataModel.columns[0].name,
        EntityDataClass.container2.entityResponseData.dataModel.columns[1].name,
      ],
      dataModelType: [
        EntityDataClass.dashboard1.dataModelResponseData.dataModelType,
        EntityDataClass.dashboard2.dataModelResponseData.dataModelType,
      ],
      'fields.name.keyword': [
        EntityDataClass.searchIndex1.entityResponseData.fields[1].name,
        EntityDataClass.searchIndex2.entityResponseData.fields[3].name,
      ],
      'tasks.displayName.keyword': [
        EntityDataClass.pipeline1.entityResponseData.tasks[0].displayName,
        EntityDataClass.pipeline2.entityResponseData.tasks[1].displayName,
      ],
      'domains.displayName.keyword': [
        EntityDataClass.domain1.responseData.displayName,
        EntityDataClass.domain2.responseData.displayName,
      ],
      'responseSchema.schemaFields.name.keyword': [
        EntityDataClass.apiCollection1.apiEndpointResponseData.responseSchema
          .schemaFields[0].name,
        EntityDataClass.apiCollection2.apiEndpointResponseData.responseSchema
          .schemaFields[1].name,
      ],
      'requestSchema.schemaFields.name.keyword': [
        EntityDataClass.apiCollection1.apiEndpointResponseData.requestSchema
          .schemaFields[0].name,
        EntityDataClass.apiCollection2.apiEndpointResponseData.requestSchema
          .schemaFields[1].name,
      ],
      'name.keyword': [
        table1.entityResponseData.name,
        table2.entityResponseData.name,
      ],
      'project.keyword': [
        EntityDataClass.dashboardDataModel1.entityResponseData.project,
        EntityDataClass.dashboardDataModel2.entityResponseData.project,
      ],
      entityStatus: ['Approved', 'In Review'],
      // Some common field value search criteria are causing problems in not equal filter tests
      // TODO: Refactor the advanced search tests so that these fields can be added back
      // tableType: [table.entity.tableType, 'MaterializedView'],
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
