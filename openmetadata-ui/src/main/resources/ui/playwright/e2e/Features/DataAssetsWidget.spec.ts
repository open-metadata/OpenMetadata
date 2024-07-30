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
import { test } from '@playwright/test';
import { toLower } from 'lodash';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  getEntityTypeSearchIndexMapping,
  redirectToHomePage,
} from '../../utils/common';
import { checkDataAssetWidget } from '../../utils/entity';
import { performUserLogin } from '../../utils/user';

const entities = [
  TableClass,
  DashboardClass,
  PipelineClass,
  TopicClass,
  ContainerClass,
  MlModelClass,
  SearchIndexClass,
] as const;

const menuLabel = {
  Table: 'Tables',
  Dashboard: 'Dashboards',
  Pipeline: 'Pipelines',
  Topic: 'Topics',
  Container: 'Containers',
  MlModel: 'ML Models',
  SearchIndex: 'search Search Indexes',
};

entities.forEach((EntityClass) => {
  const user = new UserClass();
  const entity = new EntityClass();

  test.describe(entity.getType(), () => {
    test.beforeAll('Setup pre-requests', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await user.create(apiContext);
      await entity.create(apiContext);
      await afterAction();
    });

    test('Check Data Asset and Service Filtration', async ({ browser }) => {
      const { page, afterAction } = await performUserLogin(browser, user);
      await redirectToHomePage(page);
      await checkDataAssetWidget(
        page,
        menuLabel[entity.type],
        getEntityTypeSearchIndexMapping(entity.type),
        toLower(entity.service.serviceType)
      );
      await afterAction();
    });

    test.afterAll('Cleanup', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await user.delete(apiContext);
      await entity.delete(apiContext);
      await afterAction();
    });
  });
});
