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
import { ApiCollectionClass } from '../../support/entity/ApiCollectionClass';
import { DatabaseClass } from '../../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../../support/entity/DatabaseSchemaClass';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { ApiServiceClass } from '../../support/entity/service/ApiServiceClass';
import { DashboardServiceClass } from '../../support/entity/service/DashboardServiceClass';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { DriveServiceClass } from '../../support/entity/service/DriveServiceClass';
import { MessagingServiceClass } from '../../support/entity/service/MessagingServiceClass';
import { MlmodelServiceClass } from '../../support/entity/service/MlmodelServiceClass';
import { PipelineServiceClass } from '../../support/entity/service/PipelineServiceClass';
import { SearchIndexServiceClass } from '../../support/entity/service/SearchIndexServiceClass';
import { StorageServiceClass } from '../../support/entity/service/StorageServiceClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  descriptionBoxReadOnly,
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { addMultiOwner, assignTier } from '../../utils/entity';

const entities = {
  'Api Service': new ApiServiceClass(),
  'Api Collection': new ApiCollectionClass(),
  'Dashboard Service': new DashboardServiceClass(),
  'Database Service': new DatabaseServiceClass(),
  'Messaging Service': new MessagingServiceClass(),
  'Mlmodel Service': new MlmodelServiceClass(),
  'Pipeline Service': new PipelineServiceClass(),
  'SearchIndex Service': new SearchIndexServiceClass(),
  'Storage Service': new StorageServiceClass(),
  Database: new DatabaseClass(),
  'Database Schema': new DatabaseSchemaClass(),
  'Drive Service': new DriveServiceClass(),
};

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

    for (const entity of Object.values(entities)) {
      await entity.create(apiContext);
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

    await afterAction();
  });

  test.beforeEach('Visit entity details page', async ({ page }) => {
    await redirectToHomePage(page);
  });

  Object.entries(entities).forEach(([key, entity]) => {
    /**
     * Tests comprehensive version history tracking for service entities
     * @description This test validates the version history feature for service entities across multiple version increments.
     * It verifies that the version page correctly displays visual diffs (additions, modifications, deletions) for:
     * - Version 0.2: Initial changes including domain assignment, description updates, and tag additions (PersonalData.SpecialCategory, PII.Sensitive)
     * - Version 0.3: Owner assignments showing user ownership changes
     * - Version 0.3: Tier assignments displaying tier classification updates
     * - Version 0.4: Soft deletion state with appropriate deleted badge visibility
     *
     * The test ensures that each version increment is properly tracked and the diff indicators (diff-added) are correctly rendered
     * in the UI to highlight what changed between versions
     */
    test(key, async ({ page }) => {
      await entity.visitEntityPage(page);
      const versionDetailResponse = page.waitForResponse(`**/versions/0.2`);
      await page.locator('[data-testid="version-button"]').click();
      await versionDetailResponse;

      /**
       * Step 1: Validate version 0.2 changes
       * @description Verifies that the version page displays diff indicators for domain, description, and tag additions.
       * Expects to see:
       * - Domain link with diff-added class showing the newly assigned domain
       * - Description container with diff-added showing the updated description text
       * - Two tags (PersonalData.SpecialCategory and PII.Sensitive) marked as added in the right panel
       */
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

      /**
       * Step 2: Validate owner change tracking in version 0.3
       * @description Tests that adding an owner to the service creates a new version (0.3) and displays
       * the owner addition with a diff-added indicator. Exits version view, adds a user owner,
       * then re-enters version view to verify the change is tracked
       */
      await test.step('should show owner changes', async () => {
        await page.locator('[data-testid="version-button"]').click();
        const OWNER1 = EntityDataClass.user1.getUserDisplayName();

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

      /**
       * Step 3: Validate tier assignment tracking in version 0.3
       * @description Tests that assigning a tier (Tier1) to the service is tracked in version history.
       * Exits version view, assigns a tier, then re-enters version view to verify the tier assignment
       * is displayed with a diff-added indicator
       */
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

      /**
       * Step 4: Validate soft deletion tracking in version 0.4
       * @description Tests that soft deleting the service creates version 0.4 and properly displays the deleted state.
       * This step:
       * 1. Exits version view
       * 2. Initiates soft delete through the manage menu
       * 3. Confirms deletion with 'DELETE' text input
       * 4. Waits for async deletion to complete (hardDelete=false&recursive=true)
       * 5. Verifies deletion toast notification
       * 6. Reloads the page and confirms the deleted badge is visible
       * 7. Opens version 0.4 view and verifies the deleted badge persists in version history
       *
       * This ensures that soft-deleted entities remain viewable in version history with proper deleted indicators
       */
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
