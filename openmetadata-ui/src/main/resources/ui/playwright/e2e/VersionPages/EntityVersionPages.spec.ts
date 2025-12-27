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
import { test as base, expect, Page } from '@playwright/test';
import { COMMON_TIER_TAG } from '../../constant/common';
import { BIG_ENTITY_DELETE_TIMEOUT } from '../../constant/delete';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DirectoryClass } from '../../support/entity/DirectoryClass';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { FileClass } from '../../support/entity/FileClass';
import { MlModelClass } from '../../support/entity/MlModelClass';
import { PipelineClass } from '../../support/entity/PipelineClass';
import { SearchIndexClass } from '../../support/entity/SearchIndexClass';
import { SpreadsheetClass } from '../../support/entity/SpreadsheetClass';
import { StoredProcedureClass } from '../../support/entity/StoredProcedureClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { WorksheetClass } from '../../support/entity/WorksheetClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  descriptionBoxReadOnly,
  getApiContext,
  redirectToHomePage,
  reloadAndWaitForNetworkIdle,
  toastNotification,
} from '../../utils/common';
import { getEntityDataTypeDisplayPatch } from '../../utils/entity';

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
  new DirectoryClass(),
  new FileClass(),
  new SpreadsheetClass(),
  new WorksheetClass(),
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

test.describe('Entity Version pages', () => {
  test.beforeAll('Setup pre-requests', async ({ browser }) => {
    test.slow();

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.create(apiContext);
    await adminUser.setAdminRole(apiContext);

    const domain = EntityDataClass.domain1.responseData;

    for (const entity of entities) {
      await entity.create(apiContext);
      const dataTypeDisplayPath = getEntityDataTypeDisplayPatch(entity);
      await entity.patch({
        apiContext,
        patchData: [
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
            path: '/domains/0',
            value: {
              id: domain.id,
              type: 'domain',
              name: domain.name,
              description: domain.description,
            },
          },
          ...(dataTypeDisplayPath
            ? [
                {
                  op: 'add' as const,
                  path: dataTypeDisplayPath,
                  value: 'OBJECT',
                },
              ]
            : []),
        ],
      });
    }

    await afterAction();
  });

  test.beforeEach('Visit entity details page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  test.afterAll('Cleanup', async ({ browser }) => {

    const { apiContext, afterAction } = await performAdminLogin(browser);
    await adminUser.delete(apiContext);

    await afterAction();
  });

  entities.forEach((entity) => {
    test(`${entity.getType()}`, async ({ page }) => {
      test.slow();

      const { apiContext } = await getApiContext(page);
      await entity.visitEntityPage(page);

      await page.waitForLoadState('domcontentloaded');
      const versionDetailResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/versions/0.2') && response.status() === 200
      );
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
        const OWNER1 = EntityDataClass.user1.responseData;

        await entity.patch({
          apiContext,
          patchData: [
            {
              op: 'add',
              path: '/owners/0',
              value: {
                id: OWNER1.id,
                type: 'user',
              },
            },
          ],
        });

        await reloadAndWaitForNetworkIdle(page);

        const versionDetailResponse = page.waitForResponse(`**/versions/0.3`);
        await page.locator('[data-testid="version-button"]').click();
        await versionDetailResponse;

        await expect(
          page.locator('[data-testid="owner-link"] [data-testid="diff-added"]')
        ).toBeVisible();
      });

      if (entity.endpoint === 'tables') {
        await test.step(
          'should show column display name changes properly',
          async () => {
            await page.locator('[data-testid="version-button"]').click();

            await page
              .locator(
                `[data-row-key$="${
                  (entity as TableClass).entity.columns[0].name
                }"] [data-testid="edit-displayName-button"]`
              )
              .click();

            await page.locator('#displayName').clear();
            await page.locator('#displayName').fill('New Column Name');

            await page
              .locator('.ant-modal-footer [data-testid="save-button"]')
              .click();

            await page.waitForSelector('.ant-modal-body', {
              state: 'detached',
            });

            await page.locator('[data-testid="version-button"]').click();

            await expect(
              page.locator(
                `[data-row-key$="${
                  (entity as TableClass).entity.columns[0].name
                }"] [data-testid="diff-added"]`
              )
            ).toBeVisible();
          }
        );
      }

      await test.step('should show tier changes', async () => {
        await page.locator('[data-testid="version-button"]').click();

        await entity.patch({
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

        await reloadAndWaitForNetworkIdle(page);

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
