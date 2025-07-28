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
import test from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { EntityDataClassCreationConfig } from '../../support/entity/EntityDataClass.interface';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { UserClass } from '../../support/user/UserClass';
import {
  FIELDS,
  OPERATOR,
  runRuleGroupTests,
  runRuleGroupTestsWithNonExistingValue,
  verifyAllConditions,
} from '../../utils/advancedSearch';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { assignTier } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

const creationConfig: EntityDataClassCreationConfig = {
  table: true,
  topic: true,
  dashboard: true,
  mlModel: true,
  pipeline: true,
  dashboardDataModel: true,
  apiCollection: true,
  searchIndex: true,
  container: true,
  entityDetails: true,
};

const user = new UserClass();
const table = new TableClass(undefined, 'Regular');
let glossaryEntity: Glossary;

test.describe('Advanced Search', { tag: '@advanced-search' }, () => {
  // use the admin user to login
  test.use({ storageState: 'playwright/.auth/admin.json' });

  let searchCriteria: Record<string, any> = {};

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow(true);

    const { page, apiContext, afterAction } = await createNewPage(browser);
    await EntityDataClass.preRequisitesForTests(apiContext, creationConfig);
    await user.create(apiContext);
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

    // Add Owner & Tag to the table
    await EntityDataClass.table1.visitEntityPageWithCustomSearchBox(page);
    await EntityDataClass.table1.patch({
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
          path: '/domain',
          value: {
            id: EntityDataClass.domain1.responseData.id,
            type: 'domain',
            name: EntityDataClass.domain1.responseData.name,
            displayName: EntityDataClass.domain1.responseData.displayName,
          },
        },
      ],
    });

    await EntityDataClass.table2.visitEntityPage(page);
    await EntityDataClass.table2.patch({
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
          path: '/domain',
          value: {
            id: EntityDataClass.domain2.responseData.id,
            type: 'domain',
            name: EntityDataClass.domain2.responseData.name,
            displayName: EntityDataClass.domain2.responseData.displayName,
          },
        },
      ],
    });

    // Add Tier To the topic 1
    await EntityDataClass.topic1.visitEntityPage(page);
    await assignTier(
      page,
      EntityDataClass.tierTag1.data.displayName,
      EntityDataClass.topic1.endpoint
    );

    // Add Tier To the topic 2
    await EntityDataClass.topic2.visitEntityPage(page);
    await assignTier(
      page,
      EntityDataClass.tierTag2.data.displayName,
      EntityDataClass.topic2.endpoint
    );

    // Update Search Criteria here
    searchCriteria = {
      'owners.displayName.keyword': [
        EntityDataClass.user1.getUserName(),
        EntityDataClass.user2.getUserName(),
      ],
      'tags.tagFQN': ['PersonalData.Personal', 'PII.None'],
      'tier.tagFQN': [
        EntityDataClass.tierTag1.responseData.fullyQualifiedName,
        EntityDataClass.tierTag2.responseData.fullyQualifiedName,
      ],
      'service.displayName.keyword': [
        EntityDataClass.table1.service.name,
        EntityDataClass.table2.service.name,
      ],
      'database.displayName.keyword': [
        EntityDataClass.table1.database.name,
        EntityDataClass.table2.database.name,
      ],
      'databaseSchema.displayName.keyword': [
        EntityDataClass.table1.schema.name,
        EntityDataClass.table2.schema.name,
      ],
      'columns.name.keyword': [
        EntityDataClass.table1.entity.columns[2].name,
        EntityDataClass.table2.entity.columns[3].name,
      ],
      'displayName.keyword': [
        EntityDataClass.table1.entity.displayName,
        EntityDataClass.table2.entity.displayName,
      ],
      serviceType: [
        EntityDataClass.table1.service.serviceType,
        EntityDataClass.topic1.service.serviceType,
      ],
      'messageSchema.schemaFields.name.keyword': [
        EntityDataClass.topic1.entity.messageSchema.schemaFields[0].name,
        EntityDataClass.topic2.entity.messageSchema.schemaFields[1].name,
      ],
      'dataModel.columns.name.keyword': [
        EntityDataClass.container1.entity.dataModel.columns[0].name,
        EntityDataClass.container2.entity.dataModel.columns[1].name,
      ],
      dataModelType: [
        EntityDataClass.dashboard1.dataModel.dataModelType,
        EntityDataClass.dashboard2.dataModel.dataModelType,
      ],
      'fields.name.keyword': [
        EntityDataClass.searchIndex1.entity.fields[1].name,
        EntityDataClass.searchIndex2.entity.fields[3].name,
      ],
      'tasks.displayName.keyword': [
        EntityDataClass.pipeline1.entity.tasks[0].displayName,
        EntityDataClass.pipeline2.entity.tasks[1].displayName,
      ],
      'domain.displayName.keyword': [
        EntityDataClass.domain1.data.displayName,
        EntityDataClass.domain2.data.displayName,
      ],
      'responseSchema.schemaFields.name.keyword': [
        EntityDataClass.apiCollection1.apiEndpoint.responseSchema
          .schemaFields[0].name,
        EntityDataClass.apiCollection2.apiEndpoint.responseSchema
          .schemaFields[1].name,
      ],
      'requestSchema.schemaFields.name.keyword': [
        EntityDataClass.apiCollection1.apiEndpoint.requestSchema.schemaFields[0]
          .name,
        EntityDataClass.apiCollection2.apiEndpoint.requestSchema.schemaFields[1]
          .name,
      ],
      'name.keyword': [
        EntityDataClass.table1.entity.name,
        EntityDataClass.table2.entity.name,
      ],
      'project.keyword': [
        EntityDataClass.dashboardDataModel1.entity.project,
        EntityDataClass.dashboardDataModel2.entity.project,
      ],
      status: ['Approved', 'In Review'],
      tableType: [table.entity.tableType, 'MaterializedView'],
      'charts.displayName.keyword': [
        EntityDataClass.dashboard1.charts.displayName,
        EntityDataClass.dashboard2.charts.displayName,
      ],
    };

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    test.slow(true);

    const { apiContext, afterAction } = await createNewPage(browser);
    await EntityDataClass.postRequisitesForTests(apiContext, creationConfig);
    await glossaryEntity.delete(apiContext);
    await user.delete(apiContext);
    await table.delete(apiContext);
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
