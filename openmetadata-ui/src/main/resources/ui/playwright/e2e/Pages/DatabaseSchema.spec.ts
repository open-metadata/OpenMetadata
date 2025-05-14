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
// openmetadata-ui/src/main/resources/ui/playwright/e2e/Pages/DatabaseSchema.spec.ts
import { test } from '@playwright/test';
import { BaseEntity } from '../../support/entity/BaseEntityClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Database Entity Follow/Unfollow', () => {
  const entities: BaseEntity[] = [
    new DatabaseClass(),
    new DatabaseServiceClass(),
    new DatabaseSchemaClass(),
  ];

  entities.forEach((entity) => {
    test.describe(entity.constructor.name, () => {
      test.beforeAll('Setup pre-requests', async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        await entity.create(apiContext);
        await afterAction();
      });

      test.beforeEach('Visit entity details page', async ({ page }) => {
        await redirectToHomePage(page);
        await entity.visitEntityPage(page);
      });

      test(`Follow & Un-follow entity`, async ({ page }) => {
        const entityName = entity.entityResponseData?.['displayName'];
        await entity.followUnfollowEntity(page, entityName);
      });

      test.afterAll('Cleanup', async ({ browser }) => {
        const { apiContext, afterAction } = await createNewPage(browser);
        await entity.delete(apiContext);
        await afterAction();
      });
    });
  });
});
