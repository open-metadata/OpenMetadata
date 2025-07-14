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
import { Page, test as base } from '@playwright/test';
import { ApiEndpointClass } from '../../../support/entity/ApiEndpointClass';
import { ContainerClass } from '../../../support/entity/ContainerClass';
import { DashboardClass } from '../../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../../support/entity/DashboardDataModelClass';
import { MetricClass } from '../../../support/entity/MetricClass';
import { MlModelClass } from '../../../support/entity/MlModelClass';
import { PipelineClass } from '../../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../../support/entity/SearchIndexClass';
import { StoredProcedureClass } from '../../../support/entity/StoredProcedureClass';
import { TableClass } from '../../../support/entity/TableClass';
import { TopicClass } from '../../../support/entity/TopicClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import {
  followEntity,
  validateFollowedEntityToWidget,
} from '../../../utils/entity';

const entities = [
  TableClass,
  DashboardClass,
  PipelineClass,
  TopicClass,
  ContainerClass,
  MlModelClass,
  SearchIndexClass,
  ApiEndpointClass,
  DashboardDataModelClass,
  StoredProcedureClass,
  MetricClass,
] as const;

const adminUser = new UserClass();

const test = base.extend<{ adminPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
});

entities.forEach((EntityClass) => {
  const entity = new EntityClass();

  test.describe(entity.getType(), () => {
    test.beforeAll('Setup pre-requests', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await adminUser.create(apiContext);
      await adminUser.setAdminRole(apiContext);
      await entity.create(apiContext);
      await afterAction();
    });

    test('Check followed entity present in following widget', async ({
      adminPage,
    }) => {
      await redirectToHomePage(adminPage);

      await entity.visitEntityPage(adminPage);

      const entityName = entity.entityResponseData?.['displayName'];

      await followEntity(adminPage, entity.endpoint);
      await validateFollowedEntityToWidget(adminPage, entityName, true);
    });
  });
});
