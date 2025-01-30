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
import { Domain } from '../../support/domain/Domain';
import { ApiCollectionClass } from '../../support/entity/ApiCollectionClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { TagClass } from '../../support/tag/TagClass';
import { UserClass } from '../../support/user/UserClass';
import {
  FIELDS,
  OPERATOR,
  runRuleGroupTests,
  verifyAllConditions,
} from '../../utils/advancedSearch';
import {
  assignDomain,
  createNewPage,
  redirectToHomePage,
} from '../../utils/common';
import { addMultiOwner, assignTag, assignTier } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';

test.describe('Advanced Search', { tag: '@advanced-search' }, () => {
  // use the admin user to login
  test.use({ storageState: 'playwright/.auth/admin.json' });

  const user1 = new UserClass();
  const user2 = new UserClass();
  const table1 = new TableClass();
  const table2 = new TableClass();
  const topic1 = new TopicClass();
  const topic2 = new TopicClass();
  const tierTag1 = new TagClass({ classification: 'Tier' });
  const tierTag2 = new TagClass({ classification: 'Tier' });
  const dashboard1 = new DashboardClass();
  const dashboard2 = new DashboardClass();
  const domain1 = new Domain();
  const domain2 = new Domain();
  const apiCollection1 = new ApiCollectionClass();
  const apiCollection2 = new ApiCollectionClass();
  const mlModel1 = new MlModelClass();
  const pipeline1 = new PipelineClass();
  const dashboardDataModel1 = new DashboardDataModelClass();
  const dashboardDataModel2 = new DashboardDataModelClass();

  let searchCriteria: Record<string, any> = {};

  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.setTimeout(150000);

    const { page, apiContext, afterAction } = await createNewPage(browser);
    await Promise.all([
      user1.create(apiContext),
      user2.create(apiContext),
      table1.create(apiContext),
      table2.create(apiContext),
      topic1.create(apiContext),
      topic2.create(apiContext),
      tierTag1.create(apiContext),
      tierTag2.create(apiContext),
      dashboard1.create(apiContext),
      dashboard2.create(apiContext),
      domain1.create(apiContext),
      domain2.create(apiContext),
      apiCollection1.create(apiContext),
      apiCollection2.create(apiContext),
      mlModel1.create(apiContext),
      pipeline1.create(apiContext),
      dashboardDataModel1.create(apiContext),
      dashboardDataModel2.create(apiContext),
    ]);

    // Add Owner & Tag to the table
    await table1.visitEntityPage(page);
    await addMultiOwner({
      page,
      ownerNames: [user1.getUserName()],
      activatorBtnDataTestId: 'edit-owner',
      resultTestId: 'data-assets-header',
      endpoint: table1.endpoint,
      type: 'Users',
    });
    await assignTag(page, 'PersonalData.Personal');
    await assignDomain(page, domain1.data);

    await table2.visitEntityPage(page);
    await addMultiOwner({
      page,
      ownerNames: [user2.getUserName()],
      activatorBtnDataTestId: 'edit-owner',
      resultTestId: 'data-assets-header',
      endpoint: table1.endpoint,
      type: 'Users',
    });
    await assignTag(page, 'PII.None');
    await assignDomain(page, domain2.data);

    // Add Tier To the topic 1
    await topic1.visitEntityPage(page);
    await assignTier(page, tierTag1.data.displayName, topic1.endpoint);

    // Add Tier To the topic 2
    await topic2.visitEntityPage(page);
    await assignTier(page, tierTag2.data.displayName, topic2.endpoint);

    // Update Search Criteria here
    searchCriteria = {
      'owners.displayName.keyword': [user1.getUserName(), user2.getUserName()],
      'tags.tagFQN': ['PersonalData.Personal', 'PII.None'],
      'tier.tagFQN': [
        tierTag1.responseData.fullyQualifiedName,
        tierTag2.responseData.fullyQualifiedName,
      ],
      'service.displayName.keyword': [table1.service.name, table2.service.name],
      'database.displayName.keyword': [
        table1.database.name,
        table2.database.name,
      ],
      'databaseSchema.displayName.keyword': [
        table1.schema.name,
        table2.schema.name,
      ],
      'columns.name.keyword': ['email', 'shop_id'],
      'displayName.keyword': [
        table1.entity.displayName,
        table2.entity.displayName,
      ],
      serviceType: [table1.service.serviceType, table2.service.serviceType],
      'charts.displayName.keyword': [
        dashboard1.charts.displayName,
        dashboard2.charts.displayName,
      ],
      'messageSchema.schemaFields.name.keyword': [
        topic1.entity.messageSchema.schemaFields[0].name,
        topic1.entity.messageSchema.schemaFields[1].name,
      ],
      'dataModel.columns.name.keyword': [
        dashboard1.dataModel.columns[0].name,
        dashboard1.dataModel.columns[1].name,
      ],
      'dataModels.displayName.keyword': ['orders', 'operations'],
      dataModelType: [
        dashboard1.dataModel.dataModelType,
        dashboard2.dataModel.dataModelType,
      ],
      entityType: ['container', 'dashboard'],
      'mlFeatures.name': [
        mlModel1.entity.mlFeatures[0].name,
        mlModel1.entity.mlFeatures[1].name,
      ],
      'fields.name.keyword': ['Columns', 'Description'],
      tableType: ['Regular', 'Iceberg'],
      'tasks.displayName.keyword': [
        pipeline1.entity.tasks[0].displayName,
        pipeline1.entity.tasks[1].displayName,
      ],
      'domain.displayName.keyword': [
        domain1.data.displayName,
        domain2.data.displayName,
      ],
      'responseSchema.schemaFields.name.keyword': [
        apiCollection1.apiEndpoint.responseSchema.schemaFields[0].name,
        apiCollection1.apiEndpoint.responseSchema.schemaFields[1].name,
      ],
      'requestSchema.schemaFields.name.keyword': [
        apiCollection1.apiEndpoint.requestSchema.schemaFields[0].name,
        apiCollection1.apiEndpoint.requestSchema.schemaFields[1].name,
      ],
      'name.keyword': [table1.entity.name, table2.entity.name],
      'project.keyword': [
        dashboardDataModel1.entity.project,
        dashboardDataModel2.entity.project,
      ],
      status: ['Approved', 'In Review'],
    };

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await Promise.all([
      user1.delete(apiContext),
      user2.delete(apiContext),
      table1.delete(apiContext),
      table2.delete(apiContext),
      topic1.delete(apiContext),
      topic2.delete(apiContext),
      tierTag1.delete(apiContext),
      tierTag2.delete(apiContext),
      dashboard1.delete(apiContext),
      dashboard2.delete(apiContext),
      domain1.delete(apiContext),
      domain2.delete(apiContext),
      apiCollection1.delete(apiContext),
      apiCollection2.delete(apiContext),
      mlModel1.delete(apiContext),
      pipeline1.delete(apiContext),
      dashboardDataModel1.delete(apiContext),
      dashboardDataModel2.delete(apiContext),
    ]);
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
});
