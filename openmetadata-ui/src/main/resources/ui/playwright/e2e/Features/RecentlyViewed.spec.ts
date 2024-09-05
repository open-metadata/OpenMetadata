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
import { expect, test } from '@playwright/test';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { getApiContext, redirectToHomePage } from '../../utils/common';

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
] as const;

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Recently viewed data assets', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  entities.forEach((Entity) => {
    const entity = new Entity();

    test(`${entity.getType()} should be added to the recently viewed list`, async ({
      page,
    }) => {
      const { afterAction, apiContext } = await getApiContext(page);
      await entity.create(apiContext);
      await entity.visitEntityPage(page);
      await redirectToHomePage(page);

      const selector = `[data-testid="recently-viewed-widget"] [title="${entity.entity.name}"]`;

      await expect(page.locator(selector)).toBeVisible();

      await entity.delete(apiContext);

      await afterAction();
    });
  });
});
