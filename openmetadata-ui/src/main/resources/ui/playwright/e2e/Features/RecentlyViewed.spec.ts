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
import { MetricClass } from '../../support/entity/MetricClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { getEntityDisplayName } from '../../utils/entity';

const entities = [
  new ApiEndpointClass(),
  new TableClass(),
  new StoredProcedureClass(),
  new DashboardClass(),
  new PipelineClass(),
  new TopicClass(),
  new MlModelClass(),
  new ContainerClass(),
  new SearchIndexClass(),
  new DashboardDataModelClass(),
  new MetricClass(),
] as const;

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe.skip('Recently viewed data assets', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test.beforeAll(async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);
    for await (const entity of entities) {
      await entity.create(apiContext);
    }
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { afterAction, apiContext } = await createNewPage(browser);
    for await (const entity of entities) {
      await entity.delete(apiContext);
    }
    await afterAction();
  });

  test('Recently viewed widget should be visible on the home page', async ({
    page,
  }) => {
    test.slow(true);

    for await (const entity of entities) {
      await test.step(
        `Check ${entity.getType()} in recently viewed widget `,
        async () => {
          await entity.visitEntityPage(page);

          await page.waitForSelector(`[data-testid="breadcrumb"]`);

          await redirectToHomePage(page);

          await page.waitForSelector(`[data-testid="recently-viewed-widget"]`);

          const selector = `[data-testid="recently-viewed-widget"] [title="${getEntityDisplayName(
            entity.entity
          )}"]`;

          await expect(page.locator(selector)).toBeVisible();
        }
      );
    }
  });
});
