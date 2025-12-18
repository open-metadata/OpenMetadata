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
import { isUndefined } from 'lodash';
import { COMMON_TIER_TAG } from '../../constant/common';
import { CustomPropertySupportedEntityList } from '../../constant/customProperty';
import { DATA_CONSUMER_RULES } from '../../constant/permission';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ChartClass } from '../../support/entity/ChartClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { DashboardClass } from '../../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../../support/entity/DashboardDataModelClass';
import { DirectoryClass } from '../../support/entity/DirectoryClass';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { FileClass } from '../../support/entity/FileClass';
import { MetricClass } from '../../support/entity/MetricClass';
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
  assignSingleSelectDomain,
  descriptionBox,
  generateRandomUsername,
  getApiContext,
  getAuthContext,
  getToken,
  redirectToHomePage,
  removeSingleSelectDomain,
  toastNotification,
  uuid,
  verifyDomainPropagation,
} from '../../utils/common';
import { CustomPropertyTypeByName } from '../../utils/customProperty';
import {
  addMultiOwner,
  removeOwner,
  removeOwnersFromList,
} from '../../utils/entity';
import { visitServiceDetailsPage } from '../../utils/service';

const entities = {
  'Api Endpoint': ApiEndpointClass,
  Table: TableClass,
  'Stored Procedure': StoredProcedureClass,
  Dashboard: DashboardClass,
  Pipeline: PipelineClass,
  Topic: TopicClass,
  'Ml Model': MlModelClass,
  Container: ContainerClass,
  'Search Index': SearchIndexClass,
  'Dashboard Data Model': DashboardDataModelClass,
  Metric: MetricClass,
  Chart: ChartClass,
  Directory: DirectoryClass,
  File: FileClass,
  Spreadsheet: SpreadsheetClass,
  Worksheet: WorksheetClass,
} as const;

const adminUser = new UserClass();
const dataConsumerUser = new UserClass();
const user = new UserClass();
const tableEntity = new TableClass();

const test = base.extend<{
  page: Page;
  dataConsumerPage: Page;
}>({
  page: async ({ browser }, use) => {
    const adminPage = await browser.newPage();
    await adminUser.login(adminPage);
    await use(adminPage);
    await adminPage.close();
  },
  dataConsumerPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await dataConsumerUser.login(page);
    await use(page);
    await page.close();
  },
});

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await dataConsumerUser.create(apiContext);
  await user.create(apiContext);
  await tableEntity.create(apiContext);
  await afterAction();
});

Object.entries(entities).forEach(([key, EntityClass]) => {
  const entity = new EntityClass();
  const deleteEntity = new EntityClass();
  const entityName = entity.getType();

  test.describe(key, () => {
    const rowSelector =
      entity.type === 'MlModel' ? 'data-testid' : 'data-row-key';

    test.beforeAll('Setup pre-requests', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await entity.create(apiContext);
      await afterAction();
    });

    test.beforeEach('Visit entity details page', async ({ page }) => {
      await redirectToHomePage(page);
      await entity.visitEntityPage(page);
    });

    /**
     * Tests domain management on entities
     * @description Tests adding a domain to an entity, updating it to a different domain, and removing the domain
     */
    test('Domain Add, Update and Remove', async ({ page }) => {
      test.slow(true);

      await entity.domain(
        page,
        EntityDataClass.domain1.responseData,
        EntityDataClass.domain2.responseData,
        EntityDataClass.dataProduct1.responseData,
        EntityDataClass.dataProduct2.responseData,
        EntityDataClass.dataProduct3.responseData
      );
    });

    /**
     * Tests domain propagation from service to entity
     * @description Verifies that a domain assigned to a service propagates to its child entities,
     * and that removing the domain from the service removes it from the entity
     */
    test('Domain Propagation', async ({ page }) => {
      const serviceCategory = entity.serviceCategory;
      if (serviceCategory && 'service' in entity) {
        await visitServiceDetailsPage(
          page,
          {
            name: entity.service.name,
            type: serviceCategory,
          },
          false
        );

        await assignSingleSelectDomain(
          page,
          EntityDataClass.domain1.responseData
        );
        await verifyDomainPropagation(
          page,
          EntityDataClass.domain1.responseData,
          entity.entityResponseData?.['fullyQualifiedName']
        );

        await visitServiceDetailsPage(
          page,
          {
            name: entity.service.name,
            type: serviceCategory,
          },
          false
        );
        await removeSingleSelectDomain(
          page,
          EntityDataClass.domain1.responseData
        );
      }
    });

    /**
     * Tests user ownership management on entities
     * @description Tests adding users as owners, updating owner list, and removing owners from an entity
     */
    test('User as Owner Add, Update and Remove', async ({ page }) => {
      test.slow(true);

      const OWNER1 = EntityDataClass.user1.getUserDisplayName();
      const OWNER2 = EntityDataClass.user2.getUserDisplayName();
      const OWNER3 = EntityDataClass.user3.getUserDisplayName();
      await entity.owner(page, [OWNER1, OWNER3], [OWNER2]);
    });

    /**
     * Tests team ownership management on entities
     * @description Tests adding teams as owners, updating team owner list, and removing teams from an entity
     */
    test('Team as Owner Add, Update and Remove', async ({ page }) => {
      const OWNER1 = EntityDataClass.team1.responseData.displayName;
      const OWNER2 = EntityDataClass.team2.responseData.displayName;
      await entity.owner(page, [OWNER1], [OWNER2], 'Teams');
    });

    /**
     * Tests multi-user ownership with unsorted owner list
     * @description Tests adding multiple owners in different order, removing individual owners,
     * and verifying the owner list maintains proper state
     */
    test('User as Owner with unsorted list', async ({ page }) => {
      test.slow(true);

      const { afterAction, apiContext } = await getApiContext(page);
      const owner1Data = generateRandomUsername('PW_A_');
      const owner2Data = generateRandomUsername('PW_B_');
      const OWNER1 = new UserClass(owner1Data);
      const OWNER2 = new UserClass(owner2Data);
      await OWNER1.create(apiContext);
      await OWNER2.create(apiContext);

      await addMultiOwner({
        page,
        ownerNames: [OWNER2.getUserDisplayName()],
        activatorBtnDataTestId: 'edit-owner',
        resultTestId: 'data-assets-header',
        endpoint: entity.endpoint,
        type: 'Users',
      });

      await addMultiOwner({
        page,
        ownerNames: [OWNER1.getUserDisplayName()],
        activatorBtnDataTestId: 'edit-owner',
        resultTestId: 'data-assets-header',
        endpoint: entity.endpoint,
        type: 'Users',
        clearAll: false,
      });

      await removeOwnersFromList({
        page,
        ownerNames: [OWNER1.getUserDisplayName()],
        endpoint: entity.endpoint,
        dataTestId: 'data-assets-header',
      });

      await removeOwner({
        page,
        endpoint: entity.endpoint,
        ownerName: OWNER2.getUserDisplayName(),
        type: 'Users',
        dataTestId: 'data-assets-header',
      });

      await OWNER1.delete(apiContext);
      await OWNER2.delete(apiContext);
      await afterAction();
    });

    /**
     * Tests tier management on entities
     * @description Tests assigning a tier to an entity, updating it to a different tier, and removing the tier
     */
    test('Tier Add, Update and Remove', async ({ page }) => {
      await entity.tier(
        page,
        'Tier1',
        COMMON_TIER_TAG[2].name,
        COMMON_TIER_TAG[2].fullyQualifiedName,
        entity
      );
    });

    /**
     * Tests certification management on entities
     * @description Tests adding a certification badge to an entity, updating it to a different certification, and removing it
     */
    test('Certification Add Remove', async ({ page }) => {
      await entity.certification(
        page,
        EntityDataClass.certificationTag1,
        EntityDataClass.certificationTag2,
        entity
      );
    });

    if (['Dashboard', 'DashboardDataModel'].includes(entityName)) {
      /**
       * Tests project name visibility on Dashboard and DashboardDataModel pages
       * @description Verifies that the project name is displayed on Dashboard and DashboardDataModel entity pages
       */
      test(`${entityName} page should show the project name`, async ({
        page,
      }) => {
        await expect(
          page.getByText((entity.entity as { project: string }).project)
        ).toBeVisible();
      });
    }

    /**
     * Tests description update functionality
     * @description Tests adding and updating entity description
     */
    test('Update description', async ({ page }) => {
      await entity.descriptionUpdate(page);
    });

    /**
     * Tests tag management on entities
     * @description Tests adding tags to an entity, updating the tag selection, and removing tags
     */
    test('Tag Add, Update and Remove', async ({ page }) => {
      test.slow(true);

      await entity.tag(
        page,
        'PersonalData.Personal',
        EntityDataClass.tag1.responseData.displayName,
        entity,
        EntityDataClass.tag1.responseData.fullyQualifiedName
      );
    });

    /**
     * Tests glossary term management on entities
     * @description Tests assigning glossary terms to an entity, updating term selection, and removing glossary terms
     */
    test('Glossary Term Add, Update and Remove', async ({ page }) => {
      test.slow(true);

      await entity.glossaryTerm(
        page,
        EntityDataClass.glossaryTerm1.responseData,
        EntityDataClass.glossaryTerm2.responseData,
        entity
      );
    });

    if (
      ![
        'Store Procedure',
        'Metric',
        'Chart',
        'Directory',
        'File',
        'Spreadsheet',
      ].includes(entity.type)
    ) {
      /**
       * Tests tag and glossary selector mutual exclusivity
       * @description Verifies that opening the tag selector closes the glossary selector and vice versa
       */
      test('Tag and Glossary Selector should close vice versa', async ({
        page,
      }) => {
        test.slow(true);

        const isMlModel = entity.type === 'MlModel';
        // Tag Selector
        await page
          .locator(`[${rowSelector}="${entity.childrenSelectorId ?? ''}"]`)
          .getByTestId('tags-container')
          .getByTestId('add-tag')
          .click();

        await expect(page.locator('.async-select-list-dropdown')).toBeVisible();
        await expect(
          page.locator('.async-tree-select-list-dropdown')
        ).toBeHidden();

        // Glossary Selector
        await page
          .locator(
            `[${rowSelector}="${
              isMlModel
                ? entity.childrenSelectorId2
                : entity.childrenSelectorId ?? ''
            }"]`
          )
          .getByTestId('glossary-container')
          .getByTestId('add-tag')
          .click();

        await expect(
          page.locator('.async-tree-select-list-dropdown')
        ).toBeVisible();
        await expect(page.locator('.async-select-list-dropdown')).toBeHidden();

        // Re-check Tag Selector
        await page
          .locator(`[${rowSelector}="${entity.childrenSelectorId ?? ''}"]`)
          .getByTestId('tags-container')
          .getByTestId('add-tag')
          .click();

        await expect(page.locator('.async-select-list-dropdown')).toBeVisible();
        await expect(
          page.locator('.async-tree-select-list-dropdown')
        ).toBeHidden();
      });
    }

    /**
     * Tests tag management for child entities
     * @description Tests adding, updating, and removing tags on child entities within a parent entity
     */
    // Run only if entity has children
    if (!isUndefined(entity.childrenTabId)) {
      test('Tag Add, Update and Remove for child entities', async ({
        page,
      }) => {
        test.slow(true);

        await page.getByTestId(entity.childrenTabId ?? '').click();

        await entity.tagChildren({
          page: page,
          tag1: 'PersonalData.Personal',
          tag2: 'PII.None',
          rowId: entity.childrenSelectorId ?? '',
          rowSelector,
          entityEndpoint: entity.endpoint,
        });

        await test.step(
          'Add and remove tags via column detail panel',
          async () => {
            // Open column detail panel
            const columnNameTestId =
              entity.type === 'Pipeline' ? 'task-name' : 'column-name';
            const columnName = page
              .locator(`[${rowSelector}="${entity.childrenSelectorId ?? ''}"]`)
              .getByTestId(columnNameTestId)
              .first();
            await columnName.scrollIntoViewIfNeeded();
            await columnName.click();

            await expect(page.locator('.column-detail-panel')).toBeVisible();

            const panelContainer = page.locator('.column-detail-panel');

            // Add tag via panel
            await panelContainer
              .locator('[data-testid="edit-icon-tags"]')
              .click();
            await page
              .locator('[data-testid="selectable-list"]')
              .waitFor({ state: 'visible' });

            const searchTag = page.waitForResponse(
              '/api/v1/search/query?q=*index=tag_search_index*'
            );
            await page
              .locator('[data-testid="tag-select-search-bar"]')
              .fill('PersonalData.SpecialCategory');
            await searchTag;
            await page.waitForSelector('[data-testid="loader"]', {
              state: 'detached',
            });

            const tagOption = page.getByTitle('SpecialCategory');
            await tagOption.click();

            // Wait for update response - could be columns endpoint or entity-specific endpoint
            const updateResponse = page.waitForResponse(
              (response) =>
                response.url().includes('/api/v1/columns/name/') ||
                response.url().includes(`/api/v1/${entity.endpoint}/`)
            );
            await page.getByRole('button', { name: 'Update' }).click();
            await updateResponse;

            await expect(
              page
                .locator('.tags-list')
                .getByTestId('tag-PersonalData.SpecialCategory')
            ).toBeVisible();

            // Close panel
            await panelContainer.getByTestId('close-button').click();

            await expect(
              page.locator('.column-detail-panel')
            ).not.toBeVisible();
          }
        );
      });
    }

    // Run only if entity has children
    if (!isUndefined(entity.childrenTabId)) {
      test('Tag and Glossary Term preservation in column detail panel', async ({
        page,
      }) => {
        test.slow(true);

        await page.getByTestId(entity.childrenTabId ?? '').click();

        // Test that updating tags preserves glossary terms and vice versa
        await test.step(
          'Verify tag updates preserve glossary terms',
          async () => {
            // Open column detail panel
            const columnNameTestId =
              entity.type === 'Pipeline' ? 'task-name' : 'column-name';
            const columnName = page
              .locator(`[${rowSelector}="${entity.childrenSelectorId ?? ''}"]`)
              .getByTestId(columnNameTestId)
              .first();
            await columnName.scrollIntoViewIfNeeded();
            await columnName.click();

            await expect(page.locator('.column-detail-panel')).toBeVisible();

            const panelContainer = page.locator('.column-detail-panel');

            // Step 1: Add a glossary term first
            await panelContainer
              .locator('[data-testid="edit-glossary-terms"]')
              .click();
            await page
              .locator('[data-testid="selectable-list"]')
              .waitFor({ state: 'visible' });

            const searchBar = page.locator(
              '[data-testid="glossary-term-select-search-bar"]'
            );
            await searchBar.fill(
              EntityDataClass.glossaryTerm1.responseData.displayName
            );
            await page.waitForSelector('[data-testid="loader"]', {
              state: 'detached',
            });

            const termOption = page.locator('.ant-list-item').filter({
              hasText: EntityDataClass.glossaryTerm1.responseData.displayName,
            });
            await termOption.click();

            const glossaryUpdateResponse = page.waitForResponse(
              (response) =>
                response.url().includes('/api/v1/columns/name/') ||
                response.url().includes(`/api/v1/${entity.endpoint}/`)
            );
            await page.getByRole('button', { name: 'Update' }).click();
            await glossaryUpdateResponse;

            // Verify glossary term is added
            await expect(
              panelContainer.getByTestId(
                `tag-${EntityDataClass.glossaryTerm1.responseData.fullyQualifiedName}`
              )
            ).toBeVisible();

            // Step 2: Add a classification tag (should preserve glossary term)
            await panelContainer
              .locator('[data-testid="edit-icon-tags"]')
              .click();
            await page
              .locator('[data-testid="selectable-list"]')
              .waitFor({ state: 'visible' });

            const searchTag = page.waitForResponse(
              '/api/v1/search/query?q=*index=tag_search_index*'
            );
            await page
              .locator('[data-testid="tag-select-search-bar"]')
              .fill('PersonalData.SpecialCategory');
            await searchTag;
            await page.waitForSelector('[data-testid="loader"]', {
              state: 'detached',
            });

            const tagOption = page.getByTitle('SpecialCategory');
            await tagOption.click();

            const tagUpdateResponse = page.waitForResponse(
              (response) =>
                response.url().includes('/api/v1/columns/name/') ||
                response.url().includes(`/api/v1/${entity.endpoint}/`)
            );
            await page.getByRole('button', { name: 'Update' }).click();
            await tagUpdateResponse;

            // Verify both tag and glossary term are still present
            await expect(
              page
                .locator('.tags-list')
                .getByTestId('tag-PersonalData.SpecialCategory')
            ).toBeVisible();
            await expect(
              panelContainer.getByTestId(
                `tag-${EntityDataClass.glossaryTerm1.responseData.fullyQualifiedName}`
              )
            ).toBeVisible();

            // Close panel
            await panelContainer.getByTestId('close-button').click();

            await expect(
              page.locator('.column-detail-panel')
            ).not.toBeVisible();
          }
        );
      });

      test('Column detail panel data type display and nested column navigation', async ({
        page,
      }) => {
        test.slow(true);

        await page.getByTestId(entity.childrenTabId ?? '').click();

        await test.step(
          'Verify data type display and nested column counting',
          async () => {
            // Open column detail panel
            const columnNameTestId =
              entity.type === 'Pipeline' ? 'task-name' : 'column-name';
            const columnName = page
              .locator(`[${rowSelector}="${entity.childrenSelectorId ?? ''}"]`)
              .getByTestId(columnNameTestId)
              .first();
            await columnName.scrollIntoViewIfNeeded();
            await columnName.click();

            await expect(page.locator('.column-detail-panel')).toBeVisible();

            const panelContainer = page.locator('.column-detail-panel');

            // Verify data type is displayed (if available)
            if (entity.type !== 'Pipeline') {
              const dataTypeChip = panelContainer.locator('.data-type-chip');
              const hasDataType = (await dataTypeChip.count()) > 0;

              if (hasDataType) {
                // If data type chip exists, it should have content
                const dataTypeText = await dataTypeChip.textContent();

                expect(dataTypeText).toBeTruthy();
                expect(dataTypeText?.trim().length).toBeGreaterThan(0);
              }
            }
            // Verify pagination shows correct count (including nested columns)
            const paginationText = panelContainer.locator(
              '.pagination-header-text'
            );
            const paginationContent = await paginationText.textContent();

            // Should match format: "X of Y columns"
            expect(paginationContent).toMatch(/\d+\s+of\s+\d+\s+columns?/i);

            // Extract numbers from pagination text
            const match = paginationContent?.match(/(\d+)\s+of\s+(\d+)/i);
            if (match) {
              const currentIndex = parseInt(match[1], 10);
              const totalCount = parseInt(match[2], 10);

              expect(currentIndex).toBeGreaterThan(0);
              expect(totalCount).toBeGreaterThanOrEqual(currentIndex);

              // If there are multiple columns, test navigation
              if (totalCount > 1) {
                const nextButton = panelContainer
                  .locator('.navigation-container')
                  .locator('button')
                  .nth(1);

                if (await nextButton.isEnabled()) {
                  // Navigate to next column
                  await nextButton.click();
                  await page.waitForLoadState('networkidle');

                  // Verify pagination updated
                  const updatedPagination = await paginationText.textContent();
                  const updatedMatch =
                    updatedPagination?.match(/(\d+)\s+of\s+(\d+)/i);

                  if (updatedMatch) {
                    const newIndex = parseInt(updatedMatch[1], 10);

                    expect(newIndex).toBe(currentIndex + 1);
                    expect(parseInt(updatedMatch[2], 10)).toBe(totalCount);
                  }

                  // Navigate back
                  const prevButton = panelContainer
                    .locator('.navigation-container')
                    .locator('button')
                    .nth(0);

                  await prevButton.click();
                  await page.waitForLoadState('networkidle');

                  // Verify we're back
                  const finalPagination = await paginationText.textContent();

                  expect(finalPagination).toBe(paginationContent);
                }
              }
            }

            // Close panel
            await panelContainer.getByTestId('close-button').click();

            await expect(
              page.locator('.column-detail-panel')
            ).not.toBeVisible();
          }
        );
      });
    }

    /**
     * Tests glossary term management for child entities
     * @description Tests adding, updating, and removing glossary terms on child entities within a parent entity
     */
    // Run only if entity has children
    if (!isUndefined(entity.childrenTabId)) {
      test('Glossary Term Add, Update and Remove for child entities', async ({
        page,
      }) => {
        await page.getByTestId(entity.childrenTabId ?? '').click();

        await entity.glossaryTermChildren({
          page: page,
          glossaryTerm1: EntityDataClass.glossaryTerm1.responseData,
          glossaryTerm2: EntityDataClass.glossaryTerm2.responseData,
          rowId: entity.childrenSelectorId ?? '',
          rowSelector,
          entityEndpoint: entity.endpoint,
        });

        await test.step(
          'Add and remove glossary terms via column detail panel',
          async () => {
            // Open column detail panel
            const columnNameTestId =
              entity.type === 'Pipeline' ? 'task-name' : 'column-name';
            const columnName = page
              .locator(`[${rowSelector}="${entity.childrenSelectorId ?? ''}"]`)
              .getByTestId(columnNameTestId)
              .first();
            await columnName.click();

            await expect(page.locator('.column-detail-panel')).toBeVisible();

            const panelContainer = page.locator('.column-detail-panel');

            // Add glossary term via panel
            await panelContainer
              .locator('[data-testid="edit-glossary-terms"]')
              .click();
            await page
              .locator('[data-testid="selectable-list"]')
              .waitFor({ state: 'visible' });

            const searchBar = page.locator(
              '[data-testid="glossary-term-select-search-bar"]'
            );
            await searchBar.fill(
              EntityDataClass.glossaryTerm1.responseData.displayName
            );
            await page.waitForSelector('[data-testid="loader"]', {
              state: 'detached',
            });

            const termOption = page.locator('.ant-list-item').filter({
              hasText: EntityDataClass.glossaryTerm1.responseData.displayName,
            });
            await termOption.click();

            // Wait for update response - could be columns endpoint or entity-specific endpoint
            const updateResponse = page.waitForResponse(
              (response) =>
                response.url().includes('/api/v1/columns/name/') ||
                response.url().includes(`/api/v1/${entity.endpoint}/`)
            );
            await page.getByRole('button', { name: 'Update' }).click();
            await updateResponse;

            await expect(
              panelContainer.getByTestId(
                `tag-${EntityDataClass.glossaryTerm1.responseData.fullyQualifiedName}`
              )
            ).toBeVisible();

            // Close panel
            await panelContainer.getByTestId('close-button').click();

            await expect(
              page.locator('.column-detail-panel')
            ).not.toBeVisible();
          }
        );
      });

      /**
       * Tests display name management for child entities
       * @description Tests adding, updating, and removing display names on child entities
       */
      if (['Table', 'DashboardDataModel'].includes(entity.type)) {
        test('DisplayName Add, Update and Remove for child entities', async ({
          page,
        }) => {
          await page.getByTestId(entity.childrenTabId ?? '').click();

          await entity.displayNameChildren({
            page: page,
            columnName: entity.childrenSelectorId ?? '',
            rowSelector,
          });
        });
      }

      /**
       * Tests description management for child entities
       * @description Tests adding, updating, and removing descriptions on child entities within a parent entity
       */
      test('Description Add, Update and Remove for child entities', async ({
        page,
      }) => {
        await page.getByTestId(entity.childrenTabId ?? '').click();

        await entity.descriptionUpdateChildren(
          page,
          entity.childrenSelectorId ?? '',
          rowSelector,
          entity.endpoint
        );

        await test.step(
          'Update description via column detail panel and test panel features',
          async () => {
            // Open column detail panel
            const columnNameTestId =
              entity.type === 'Pipeline' ? 'task-name' : 'column-name';
            const columnName = page
              .locator(`[${rowSelector}="${entity.childrenSelectorId ?? ''}"]`)
              .getByTestId(columnNameTestId)
              .first();
            await columnName.click();

            await expect(page.locator('.column-detail-panel')).toBeVisible();

            const panelContainer = page.locator('.column-detail-panel');

            // Verify panel displays correct column information
            await expect(page.getByTestId('entity-link')).toBeVisible();

            if (entity.type !== 'Pipeline') {
              // Verify data type chip exists (may not be visible if data type is not available)
              const dataTypeChip = page.locator('.data-type-chip');

              // Data type chip should be attached to DOM (may be empty for some entity types)
              await expect(dataTypeChip.first()).toBeAttached();
            }

            // Verify Overview tab is active by default
            await expect(page.getByTestId('overview-tab')).toHaveClass(
              /selected/
            );

            // Update description via panel
            const newDescription = `Updated description for column - ${uuid()}`;
            const editDescriptionButton =
              panelContainer.getByTestId('edit-description');

            if (await editDescriptionButton.isVisible()) {
              await editDescriptionButton.click();
              await page.locator(descriptionBox).first().clear();
              await page.locator(descriptionBox).first().fill(newDescription);
              await page.getByTestId('save').click();

              await toastNotification(page, /Description updated successfully/);

              await expect(
                panelContainer
                  .locator('[data-testid="viewer-container"]')
                  .getByText(newDescription)
              ).toBeVisible();
            }

            // Test tab navigation
            await page.getByTestId('data-quality-tab').click();

            await expect(page.getByTestId('data-quality-tab')).toHaveClass(
              /ant-menu-item-selected/
            );

            await page.getByTestId('custom-properties-tab').click();

            await expect(page.getByTestId('custom-properties-tab')).toHaveClass(
              /ant-menu-item-selected/
            );

            await page.getByTestId('overview-tab').click();

            await expect(page.getByTestId('overview-tab')).toHaveClass(
              /ant-menu-item-selected/
            );

            // Test column navigation with arrow buttons and verify nested column counting
            const paginationText = page.locator('.pagination-header-text');
            const initialText = await paginationText.textContent();

            // Verify pagination text format: "X of Y columns" (includes nested columns)
            expect(initialText).toMatch(/\d+\s+of\s+\d+\s+columns?/i);

            const nextButton = page
              .locator('.navigation-container')
              .locator('button')
              .nth(1);

            if (await nextButton.isEnabled()) {
              await nextButton.click();
              await page.waitForLoadState('networkidle');

              const updatedText = await paginationText.textContent();

              expect(updatedText).not.toBe(initialText);
              // Verify pagination still shows correct format after navigation
              expect(updatedText).toMatch(/\d+\s+of\s+\d+\s+columns?/i);
              await expect(page.getByTestId('entity-link')).toBeVisible();

              // Navigate back to previous column
              const prevButton = page
                .locator('.navigation-container')
                .locator('button')
                .nth(0);

              await expect(prevButton).toBeEnabled();

              await prevButton.click();
              await page.waitForLoadState('networkidle');

              await expect(page.getByTestId('entity-link')).toBeVisible();

              // Verify we're back to the original column
              const finalText = await paginationText.textContent();

              expect(finalText).toBe(initialText);
            }

            // Close panel
            await panelContainer.getByTestId('close-button').click();

            await expect(
              page.locator('.column-detail-panel')
            ).not.toBeVisible();
          }
        );
      });
    }

    /**
     * Tests announcement lifecycle management
     * @description Tests creating an announcement on an entity, editing it, and deleting it
     */
    test(`Announcement create, edit & delete`, async ({ page }) => {
      test.slow();

      await entity.announcement(page);
    });

    /**
     * Tests inactive announcement management
     * @description Tests creating an inactive announcement and then deleting it
     */
    test(`Inactive Announcement create & delete`, async ({ page }) => {
      await entity.inactiveAnnouncement(page);
    });

    /**
     * Tests entity voting functionality
     * @description Tests upvoting an entity and downvoting it, verifying vote state changes
     */
    test(`UpVote & DownVote entity`, async ({ page }) => {
      await entity.upVote(page);
      await entity.downVote(page);
    });

    /**
     * Tests entity following functionality
     * @description Tests following an entity and unfollowing it, verifying follow state changes
     */
    test(`Follow & Un-follow entity`, async ({ page }) => {
      test.slow(true);

      const entityName = entity.entityResponseData?.['displayName'];
      await entity.followUnfollowEntity(page, entityName);
    });

    /**
     * Tests custom property management on supported entities
     * @description Tests setting and updating various types of custom properties (String, Markdown, Integer, Boolean, Email, Date, List)
     */
    // Create custom property only for supported entities
    if (CustomPropertySupportedEntityList.includes(entity.endpoint)) {
      const properties = Object.values(CustomPropertyTypeByName);
      const titleText = properties.join(', ');

      test(`Set & Update ${titleText} Custom Property `, async ({ page }) => {
        // increase timeout as it using single test for multiple steps
        test.slow(true);

        const { apiContext, afterAction } = await getApiContext(page);
        await entity.prepareCustomProperty(apiContext);

        await test.step(`Set ${titleText} Custom Property`, async () => {
          for (const type of properties) {
            await entity.updateCustomProperty(
              page,
              entity.customPropertyValue[type].property,
              entity.customPropertyValue[type].value
            );
          }
        });

        await test.step(`Update ${titleText} Custom Property`, async () => {
          for (const type of properties) {
            await entity.updateCustomProperty(
              page,
              entity.customPropertyValue[type].property,
              entity.customPropertyValue[type].newValue
            );
          }
        });

        await entity.cleanupCustomProperty(apiContext);
        await afterAction();
      });
    }

    /**
     * Tests entity display name update
     * @description Tests renaming an entity by updating its display name
     */
    test(`Update displayName`, async ({ page }) => {
      await entity.renameEntity(page, entity.entity.name);
    });

    /**
     * Tests access control for description editing with deny policy
     * @description Tests that a user assigned a role with a deny rule for EditDescription cannot edit entity descriptions
     */
    test('User should be denied access to edit description when deny policy rule is applied on an entity', async ({
      page,
      dataConsumerPage,
    }) => {
      await redirectToHomePage(page);

      await entity.visitEntityPage(page);

      const { apiContext } = await getApiContext(page);

      // Create policy with deny rule for edit description
      const customPolicy = new PolicyClass();
      await customPolicy.create(apiContext, [
        ...DATA_CONSUMER_RULES,
        {
          name: 'DenyEditDescription-Rule',
          resources: ['All'],
          operations: ['EditDescription'],
          effect: 'deny',
        },
      ]);

      // Create role with the custom policy
      const customRole = new RolesClass();
      await customRole.create(apiContext, [customPolicy.responseData.name]);

      // Assign the custom role to the data consumer user
      await dataConsumerUser.patch({
        apiContext,
        patchData: [
          {
            op: 'replace',
            path: '/roles',
            value: [
              {
                id: customRole.responseData.id,
                type: 'role',
                name: customRole.responseData.name,
              },
            ],
          },
        ],
      });

      await entity.visitEntityPage(dataConsumerPage);

      // Check if edit description button is not visible
      await expect(
        dataConsumerPage.locator('[data-testid="edit-description"]')
      ).not.toBeVisible();

      const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
        await getApiContext(page);
      await customRole.delete(cleanupContext);
      await customPolicy.delete(cleanupContext);
      await cleanupAfterAction();
    });

    /**
     * Tests tab switching between Data Observability and Activity Feed
     * @description Tests switching from Data Observability tab (with profiler subtabs) to Activity Feed tab
     * and verifies that the appropriate data loads for each tab
     */
    // Add the data consumer test only for Table entity
    if (entityName === 'Table') {
      test('Switch from Data Observability tab to Activity Feed tab and verify data appears', async ({
        page,
      }) => {
        test.slow();

        // Create a test case to ensure there's data in the profiler tab
        const { apiContext, afterAction } = await getApiContext(page);
        await tableEntity.createTestCase(apiContext);
        await afterAction();

        // Navigate to the table entity page
        await entity.visitEntityPage(page);
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });

        // Step 1: Navigate to Data Observability tab and verify profiler tab is selected by default
        await test.step('Navigate to Data Observability tab', async () => {
          const profilerTab = page.getByTestId('profiler');

          await expect(profilerTab).toBeVisible();

          // Wait for profiler API call (profiler tab is selected by default, no need to click)
          const profilerResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/tables/') &&
              response.url().includes('/tableProfile')
          );

          await profilerTab.click();
          await profilerResponse;

          await page.waitForLoadState('networkidle');
          await page.waitForSelector('[data-testid="loader"]', {
            state: 'detached',
          });
        });

        // Step 2: Verify tabs UI component is rendered in Data Observability tab
        await test.step(
          'Verify tabs UI component is rendered in Data Observability tab',
          async () => {
            // Verify that the profiler sub-tabs are visible
            // (Table Profile, Column Profile, Data Quality, or Incidents)
            expect(page.getByTestId('table-profile')).toBeVisible();
            expect(page.getByTestId('column-profile')).toBeVisible();
            expect(page.getByTestId('data-quality')).toBeVisible();
          }
        );

        // Step 3: Switch to Activity Feed tab (all tab is selected by default)
        await test.step('Switch to Activity Feed tab', async () => {
          const activityFeedTab = page.getByTestId('activity_feed');

          await expect(activityFeedTab).toBeVisible();

          // Wait for activity feed API call (all tab is selected by default)
          const activityFeedResponse = page.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/feed') &&
              response.url().includes('entityLink')
          );

          await activityFeedTab.click();
          await activityFeedResponse;

          await page.waitForLoadState('networkidle');
          await page.waitForSelector('[data-testid="loader"]', {
            state: 'detached',
          });
        });

        // Step 4: Verify tabs or left component is rendered in Activity Feed tab
        await test.step(
          'Verify tabs or left component is rendered in Activity Feed tab',
          async () => {
            // Verify that activity feed tabs are visible (All, Mentions, Tasks)
            // Check for the left panel menu or the tab navigation
            await expect(
              page.locator('[data-testid="global-setting-left-panel"]')
            ).toBeVisible();
          }
        );
      });

      /**
       * Tests access control for table-level data access with deny policy
       * @description Tests that a data consumer assigned a role with deny rules for ViewQueries and ViewSampleData
       * cannot access those tabs on table entities
       */
      test('Data Consumer should be denied access to queries and sample data tabs when deny policy rule is applied on table level', async ({
        page,
        dataConsumerPage,
      }) => {
        await redirectToHomePage(page);

        await tableEntity.visitEntityPage(page);

        const { apiContext } = await getApiContext(page);

        // Create policy with both allow and deny rules
        const customPolicy = new PolicyClass();
        await customPolicy.create(apiContext, [
          ...DATA_CONSUMER_RULES,
          {
            name: 'DataConsumerPolicy-DenyRule',
            resources: ['All'],
            operations: ['ViewQueries', 'ViewSampleData'],
            effect: 'deny',
          },
        ]);

        // Create role with the custom policy
        const customRole = new RolesClass();
        await customRole.create(apiContext, [customPolicy.responseData.name]);

        // Assign the custom role to the data consumer user
        await dataConsumerUser.patch({
          apiContext,
          patchData: [
            {
              op: 'replace',
              path: '/roles',
              value: [
                {
                  id: customRole.responseData.id,
                  type: 'role',
                  name: customRole.responseData.name,
                },
              ],
            },
          ],
        });

        await tableEntity.visitEntityPage(dataConsumerPage);

        // check if queries tab is visible
        await dataConsumerPage.locator('[data-testid="table_queries"]').click();

        await expect(
          dataConsumerPage
            .locator('[data-testid="permission-error-placeholder"]')
            .getByText(
              "You don't have necessary permissions. Please check with the admin to get the View Queries permission."
            )
        ).toBeVisible();

        // check is sample data tab visible
        await dataConsumerPage.locator('[data-testid="sample_data"]').click();

        await expect(
          dataConsumerPage
            .locator('[data-testid="permission-error-placeholder"]')
            .getByText(
              "You don't have necessary permissions. Please check with the admin to get the View Sample Data permission."
            )
        ).toBeVisible();

        const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
          await getApiContext(page);
        await customRole.delete(cleanupContext);
        await customPolicy.delete(cleanupContext);
        await cleanupAfterAction();
      });
    }

    test.afterAll('Cleanup', async ({ browser }) => {
      test.slow();

      const { apiContext, afterAction } = await performAdminLogin(browser);
      await entity.delete(apiContext);
      await afterAction();
    });
  });

  /**
   * Tests entity deletion (soft and hard delete)
   * @description Tests soft deleting an entity and then hard deleting it to completely remove it from the system

   */
  test(`Delete ${key}`, async ({ page }) => {
    // increase timeout as it using single test for multiple steps
    test.slow(true);

    await redirectToHomePage(page);
    // get the token
    const token = await getToken(page);

    // create a new context with the token
    const apiContext = await getAuthContext(token);
    await deleteEntity.create(apiContext);
    await redirectToHomePage(page);
    await deleteEntity.visitEntityPage(page);

    await test.step('Soft delete', async () => {
      await deleteEntity.softDeleteEntity(
        page,
        deleteEntity.entity.name,
        deleteEntity.entityResponseData?.['displayName']
      );
    });

    await test.step('Hard delete', async () => {
      await deleteEntity.hardDeleteEntity(
        page,
        deleteEntity.entity.name,
        deleteEntity.entityResponseData?.['displayName']
      );
    });
  });
});

test.afterAll('Cleanup', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await adminUser.delete(apiContext);
  await dataConsumerUser.delete(apiContext);
  await user.delete(apiContext);
  await tableEntity.delete(apiContext);
  await afterAction();
});
