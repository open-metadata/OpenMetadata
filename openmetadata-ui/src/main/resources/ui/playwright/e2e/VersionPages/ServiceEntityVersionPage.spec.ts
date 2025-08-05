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
import { expect, Page, test as base } from '@playwright/test';
import { BIG_ENTITY_DELETE_TIMEOUT } from '../../constant/delete';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { EntityDataClassCreationConfig } from '../../support/entity/EntityDataClass.interface';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  descriptionBoxReadOnly,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { addMultiOwner, assignTier } from '../../utils/entity';

const entityCreationConfig: EntityDataClassCreationConfig = {
  apiService: true,
  apiCollection: true,
  databaseService: true,
  dashboardService: true,
  messagingService: true,
  database: true,
  databaseSchema: true,
  mlmodelService: true,
  pipelineService: true,
  searchIndexService: true,
  storageService: true,
  entityDetails: true,
};

const entities = [
  EntityDataClass.apiService,
  EntityDataClass.apiCollection1,
  EntityDataClass.databaseService,
  EntityDataClass.dashboardService,
  EntityDataClass.messagingService,
  EntityDataClass.mlmodelService,
  EntityDataClass.pipelineService,
  EntityDataClass.searchIndexService,
  EntityDataClass.storageService,
  EntityDataClass.database,
  EntityDataClass.databaseSchema,
];

// use the admin user to login

const adminUser = new UserClass();

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
});

test.describe('Service Version pages', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);

    await EntityDataClass.preRequisitesForTests(
      apiContext,
      entityCreationConfig
    );

    for (const entity of entities) {
      const domain = EntityDataClass.domain1.responseData;
      await entity.patch(apiContext, [
        {
          op: 'add',
          path: '/tags/0',
          value: {
            labelType: 'Manual',
            state: 'Confirmed',
            source: 'Classification',
            tagFQN: 'PersonalData.SpecialCategory',
          },
        },
        {
          op: 'add',
          path: '/tags/1',
          value: {
            labelType: 'Manual',
            state: 'Confirmed',
            source: 'Classification',
            tagFQN: 'PII.Sensitive',
          },
        },
        {
          op: 'add',
          path: '/description',
          value: 'Description for newly added service',
        },
        {
          op: 'add',
          path: '/domains',
          value: [
            {
              id: domain.id,
              type: 'domain',
              name: domain.name,
              description: domain.description,
            },
          ],
        },
      ]);
    }

    await afterAction();
  });

  test.afterAll('Cleanup', async ({ browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.delete(apiContext);

    await EntityDataClass.postRequisitesForTests(
      apiContext,
      entityCreationConfig
    );
    await afterAction();
  });

  test.beforeEach('Visit entity details page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  entities.forEach((entity) => {
    test(`${entity.getType()}`, async ({ page }) => {
      await entity.visitEntityPage(page);
      const versionDetailResponse = page.waitForResponse(`**/versions/0.2`);
      await page.locator('[data-testid="version-button"]').click();
      await versionDetailResponse;

      await test.step(
        'should show edited tags and description changes',
        async () => {
          await expect(
            page.locator(
              '[data-testid="domain-link"] [data-testid="diff-added"]'
            )
          ).toBeVisible();

          await expect(
            page.locator(
              `[data-testid="asset-description-container"] ${descriptionBoxReadOnly} [data-testid="diff-added"]`
            )
          ).toBeVisible();

          await expect(
            page.locator(
              '[data-testid="entity-right-panel"] .diff-added [data-testid="tag-PersonalData.SpecialCategory"]'
            )
          ).toBeVisible();

          await expect(
            page.locator(
              '[data-testid="entity-right-panel"] .diff-added [data-testid="tag-PII.Sensitive"]'
            )
          ).toBeVisible();
        }
      );

      await test.step('should show owner changes', async () => {
        await page.locator('[data-testid="version-button"]').click();
        const OWNER1 = EntityDataClass.user1.getUserName();

        await addMultiOwner({
          page,
          ownerNames: [OWNER1],
          activatorBtnDataTestId: 'edit-owner',
          resultTestId: 'data-assets-header',
          endpoint: entity.endpoint,
          type: 'Users',
        });

        const versionDetailResponse = page.waitForResponse(`**/versions/0.3`);
        await page.locator('[data-testid="version-button"]').click();
        await versionDetailResponse;

        await expect(
          page.locator('[data-testid="owner-link"] [data-testid="diff-added"]')
        ).toBeVisible();
      });

      await test.step('should show tier changes', async () => {
        await page.locator('[data-testid="version-button"]').click();

        await assignTier(page, 'Tier1', entity.endpoint);

        const versionDetailResponse = page.waitForResponse(`**/versions/0.3`);
        await page.locator('[data-testid="version-button"]').click();
        await versionDetailResponse;

        await expect(
          page.locator('[data-testid="Tier"] > [data-testid="diff-added"]')
        ).toBeVisible();
      });

      await test.step(
        'should show version details after soft deleted',
        async () => {
          await page.locator('[data-testid="version-button"]').click();

          await page.click('[data-testid="manage-button"]');
          await page.click('[data-testid="delete-button"]');

          await page.waitForSelector('[role="dialog"].ant-modal');

          await expect(page.locator('[role="dialog"].ant-modal')).toBeVisible();

          await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');
          const deleteResponse = page.waitForResponse(
            `/api/v1/${entity.endpoint}/async/*?hardDelete=false&recursive=true`
          );
          await page.click('[data-testid="confirm-button"]');

          await deleteResponse;

          await toastNotification(
            page,
            /deleted successfully!/,
            BIG_ENTITY_DELETE_TIMEOUT
          );

          await page.reload();

          const deletedBadge = page.locator('[data-testid="deleted-badge"]');

          await expect(deletedBadge).toHaveText('Deleted');

          const versionDetailResponse = page.waitForResponse(`**/versions/0.4`);
          await page.locator('[data-testid="version-button"]').click();
          await versionDetailResponse;

          // Deleted badge should be visible
          await expect(
            page.locator('[data-testid="deleted-badge"]')
          ).toBeVisible();
        }
      );
    });
  });
});
