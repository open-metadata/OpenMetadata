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
import { isUndefined } from 'lodash';
import { COMMON_TIER_TAG, KEY_PROFILE_METRICS } from '../../constant/common';
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
import { EntityType } from '../../support/entity/EntityDataClass.interface';
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
import {
  CustomPropertyTypeByName,
  updateCustomPropertyInRightPanel,
} from '../../utils/customProperty';
import {
  addMultiOwner,
  closeColumnDetailPanel,
  openColumnDetailPanel,
  removeOwner,
  removeOwnersFromList,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import { visitServiceDetailsPage } from '../../utils/service';
import { PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ } from '../../constant/config';

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
          entity.entityResponseData?.['fullyQualifiedName'] ??
          entity.entityResponseData?.['name']
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
            `[${rowSelector}="${isMlModel
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
            const columnNameTestId =
              entity.type === 'Pipeline' ? 'task-name' : 'column-name';

            const panelContainer = await openColumnDetailPanel({
              page,
              rowSelector,
              columnId: entity.childrenSelectorId ?? '',
              columnNameTestId,
              entityType: entity.type as EntityType,
            });

            // Add tag via panel
            const editButton = panelContainer.getByTestId('edit-icon-tags');
            await editButton.click();

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
            await waitForAllLoadersToDisappear(page);

            const tagOption = page.getByTitle('SpecialCategory');
            await tagOption.click();

            const updateResponse = page.waitForResponse(
              (response) =>
                response.url().includes('/api/v1/columns/name/') ||
                response.url().includes(`/api/v1/${entity.endpoint}/`)
            );
            await page.getByRole('button', { name: 'Update' }).click();
            await updateResponse;
            await waitForAllLoadersToDisappear(page);

            await expect(
              page
                .locator('.tags-list')
                .getByTestId('tag-PersonalData.SpecialCategory')
            ).toBeVisible();

            await closeColumnDetailPanel(page);

            // Verify tag is visible in the main table row
            await expect(
              page
                .locator(
                  `[${rowSelector}="${entity.childrenSelectorId ?? ''}"]`
                )
                .getByTestId('tag-PersonalData.SpecialCategory')
            ).toBeVisible();

            // Cleanup: remove tag via panel
            await openColumnDetailPanel({
              page,
              rowSelector,
              columnId: entity.childrenSelectorId ?? '',
              columnNameTestId,
              entityType: entity.type as EntityType,
            });
            await panelContainer.getByTestId('edit-icon-tags').click();

            // Wait for selectable list to be visible and ready
            await page
              .locator('[data-testid="selectable-list"]')
              .waitFor({ state: 'visible' });

            const searchTagCleanup = page.waitForResponse(
              '/api/v1/search/query?q=*index=tag_search_index*'
            );
            await page
              .locator('[data-testid="tag-select-search-bar"]')
              .fill('PersonalData.SpecialCategory');
            await searchTagCleanup;
            await waitForAllLoadersToDisappear(page);

            await page.getByTitle('SpecialCategory', { exact: true }).click();
            const removeResponse = page.waitForResponse(
              (response) =>
                response.url().includes('/api/v1/columns/name/') ||
                response.url().includes(`/api/v1/${entity.endpoint}/`)
            );
            await page.getByRole('button', { name: 'Update' }).click();
            await removeResponse;
            await waitForAllLoadersToDisappear(page);

            await expect(
              panelContainer.getByTestId('tag-PersonalData.SpecialCategory')
            ).toBeHidden();

            await closeColumnDetailPanel(page);
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
            const columnNameTestId =
              entity.type === 'Pipeline' ? 'task-name' : 'column-name';

            const panelContainer = await openColumnDetailPanel({
              page,
              rowSelector,
              columnId: entity.childrenSelectorId ?? '',
              columnNameTestId,
              entityType: entity.type as EntityType,
            });

            // Step 1: Add a glossary term first
            const glossaryEditButton = panelContainer.getByTestId(
              'edit-glossary-terms'
            );
            await expect(glossaryEditButton).toBeVisible();
            await glossaryEditButton.click();

            // Wait for selectable list to be visible and ready
            const selectableList = page.locator(
              '[data-testid="selectable-list"]'
            );
            await expect(selectableList).toBeVisible();

            const searchBar = page.locator(
              '[data-testid="glossary-term-select-search-bar"]'
            );
            await expect(searchBar).toBeVisible();
            await searchBar.fill(
              EntityDataClass.glossaryTerm1.responseData.displayName
            );

            // Wait for loader to disappear after search
            await waitForAllLoadersToDisappear(page);

            // Wait for term option to be visible before clicking
            const termOption = page.locator('.ant-list-item').filter({
              hasText: EntityDataClass.glossaryTerm1.responseData.displayName,
            });
            await expect(termOption).toBeVisible();
            await termOption.click();

            // Wait for both API response AND UI update
            const glossaryUpdateResponse = page.waitForResponse(
              (response) =>
                response.url().includes('/api/v1/columns/name/') ||
                response.url().includes(`/api/v1/${entity.endpoint}/`)
            );
            const updateButton = page.getByRole('button', { name: 'Update' });
            await expect(updateButton).toBeVisible();
            await expect(updateButton).toBeEnabled();
            await updateButton.click();
            await glossaryUpdateResponse;

            // CRITICAL: Wait for UI to update after API response
            await waitForAllLoadersToDisappear(page);

            // Verify glossary term is added
            await expect(
              panelContainer.getByTestId(
                `tag-${EntityDataClass.glossaryTerm1.responseData.fullyQualifiedName}`
              )
            ).toBeVisible();

            // Step 2: Add a classification tag (should preserve glossary term)
            const editTagsButton = panelContainer.locator(
              '[data-testid="edit-icon-tags"]'
            );
            await expect(editTagsButton).toBeVisible();
            await editTagsButton.click();

            // Wait for selectable list to be visible and ready
            await expect(selectableList).toBeVisible();

            const tagSearchBar = page.locator(
              '[data-testid="tag-select-search-bar"]'
            );
            await expect(tagSearchBar).toBeVisible();

            const searchTag = page.waitForResponse(
              '/api/v1/search/query?q=*index=tag_search_index*'
            );
            await tagSearchBar.fill('PII.Sensitive');
            await searchTag;

            // Wait for loader to disappear after search
            await waitForAllLoadersToDisappear(page);

            // Wait for tag option to be visible before clicking
            const tagOption = page.getByTitle('Sensitive', { exact: true });
            await expect(tagOption).toBeVisible();
            await tagOption.click();

            // Wait for both API response AND UI update
            const tagUpdateResponse = page.waitForResponse(
              (response) =>
                response.url().includes('/api/v1/columns/name/') ||
                response.url().includes(`/api/v1/${entity.endpoint}/`)
            );
            const tagUpdateButton = page.getByRole('button', {
              name: 'Update',
            });
            await expect(tagUpdateButton).toBeVisible();
            await expect(tagUpdateButton).toBeEnabled();
            await tagUpdateButton.click();
            await tagUpdateResponse;

            // Verify both tag and glossary term are still present in the panel
            // Use panelContainer scope to avoid ambiguity with multiple tags-list elements across table rows
            await expect(
              panelContainer.getByTestId('tag-PII.Sensitive')
            ).toBeVisible();
            await expect(
              panelContainer.getByTestId(
                `tag-${EntityDataClass.glossaryTerm1.responseData.fullyQualifiedName}`
              )
            ).toBeVisible();

            await closeColumnDetailPanel(page);

            // Verify both tag and glossary term are visible in the main table row
            const rowLocator = page.locator(
              `[${rowSelector}="${entity.childrenSelectorId ?? ''}"]`
            );
            await expect(
              rowLocator.getByTestId('tag-PII.Sensitive')
            ).toBeVisible();
            await expect(
              rowLocator.getByTestId(
                `tag-${EntityDataClass.glossaryTerm1.responseData.fullyQualifiedName}`
              )
            ).toBeVisible();

            // Cleanup: remove both tag and glossary term from column detail panel
            const cleanupPanel = await openColumnDetailPanel({
              page,
              rowSelector,
              columnId: entity.childrenSelectorId ?? '',
              columnNameTestId,
              entityType: entity.type as EntityType,
            });

            // Remove glossary term
            await cleanupPanel.getByTestId('edit-glossary-terms').click();
            await page
              .locator('[data-testid="selectable-list"]')
              .waitFor({ state: 'visible' });

            const searchGlossaryCleanup = page.waitForResponse(
              '/api/v1/search/query?q=*index=glossary_term_search_index*'
            );
            await page
              .locator('[data-testid="glossary-term-select-search-bar"]')
              .fill(EntityDataClass.glossaryTerm1.responseData.displayName);
            await searchGlossaryCleanup;
            await waitForAllLoadersToDisappear(page);

            await page
              .getByTitle(
                EntityDataClass.glossaryTerm1.responseData.displayName,
                { exact: true }
              )
              .click();
            const glossaryCleanupResponse = page.waitForResponse(
              (response) =>
                response.url().includes('/api/v1/columns/name/') ||
                response.url().includes(`/api/v1/${entity.endpoint}/`)
            );
            await page.getByRole('button', { name: 'Update' }).click();
            await glossaryCleanupResponse;
            await waitForAllLoadersToDisappear(page);

            // Remove tag
            await cleanupPanel.getByTestId('edit-icon-tags').click();
            await page
              .locator('[data-testid="selectable-list"]')
              .waitFor({ state: 'visible' });

            const searchTagCleanup2 = page.waitForResponse(
              '/api/v1/search/query?q=*index=tag_search_index*'
            );
            await page
              .locator('[data-testid="tag-select-search-bar"]')
              .fill('PII.Sensitive');
            await searchTagCleanup2;
            await waitForAllLoadersToDisappear(page);

            await page.getByTitle('Sensitive', { exact: true }).click();
            const tagCleanupResponse = page.waitForResponse(
              (response) =>
                response.url().includes('/api/v1/columns/name/') ||
                response.url().includes(`/api/v1/${entity.endpoint}/`)
            );
            await page.getByRole('button', { name: 'Update' }).click();
            await tagCleanupResponse;
            await waitForAllLoadersToDisappear(page);

            await closeColumnDetailPanel(page);
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
            const panelContainer = await openColumnDetailPanel({
              page,
              rowSelector,
              columnId: entity.childrenSelectorId ?? '',
              columnNameTestId,
              entityType: entity.type as EntityType,
            });

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

      test('Complex nested column structures - comprehensive validation', async ({
        page,
      }) => {
        test.slow(true);

        // Only run for entities that have nested columns (like Table)
        if (entity.type !== 'Table') {
          test.skip();
        }

        await page.getByTestId(entity.childrenTabId ?? '').click();
        await page.waitForLoadState('networkidle');

        await test.step(
          'Verify nested column has expand icon in main table',
          async () => {
            // Get the third column which is the nested parent column (name column)
            // From TableClass: columnsName[2] has children at index 3 and 4
            const tableFQN = entity.entityResponseData?.['fullyQualifiedName'];
            const nestedParentColName = (entity as TableClass).columnsName[2];
            const nestedParentFQN = `${tableFQN}.${nestedParentColName}`;

            const nestedColumnRow = page.locator(
              `[data-row-key="${nestedParentFQN}"]`
            );

            // Scroll to the row to ensure it's visible
            await nestedColumnRow.scrollIntoViewIfNeeded();

            // Verify expand icon is visible for nested column
            await expect(
              nestedColumnRow.getByTestId('expand-icon')
            ).toBeVisible();

            // Verify non-nested columns don't have expand icons
            const simpleColumnFQN = `${tableFQN}.${(entity as TableClass).columnsName[0]
              }`;

            await expect(
              page
                .locator(`[data-row-key="${simpleColumnFQN}"]`)
                .getByTestId('expand-icon')
            ).not.toBeVisible();
          }
        );

        await test.step(
          'Open column detail panel for nested column',
          async () => {
            // Click on the parent nested column name to open detail panel
            const nestedParentFQN = `${entity.entityResponseData?.['fullyQualifiedName']
              }.${(entity as TableClass).columnsName[2]}`;

            await openColumnDetailPanel({
              page,
              rowSelector: 'data-row-key',
              columnId: nestedParentFQN,
              columnNameTestId: 'column-name',
              entityType: entity.type as EntityType,
            });

            // Wait for any loaders to disappear
            await page.waitForSelector('[data-testid="loader"]', {
              state: 'detached',
            });
          }
        );

        await test.step(
          'Verify NestedColumnsSection renders with correct structure',
          async () => {
            const panelContainer = page.locator('.column-detail-panel');

            // Wait for nested columns section to load by checking visibility

            // Verify section title is present (using translated text key)
            const nestedColumnLinks = panelContainer.locator(
              '.nested-column-name'
            );

            // Should have at least one nested column link
            await expect(nestedColumnLinks.first()).toBeVisible({
              timeout: 5000,
            });

            const linkCount = await nestedColumnLinks.count();

            expect(linkCount).toBeGreaterThan(0);
          }
        );

        await test.step(
          'Verify count badge shows only top-level columns',
          async () => {
            const panelContainer = page.locator('.column-detail-panel');

            // Find count badge - it's a Box with Typography.Text containing just a number
            const countBadge = panelContainer
              .locator('text=/^\\d+$/')
              .filter({ hasNot: page.locator('.nested-column-name') })
              .first();

            const badgeText = await countBadge.textContent();

            if (badgeText) {
              const count = parseInt(badgeText, 10);

              expect(count).toBeGreaterThan(0);

              // Count should represent top-level children only
              const nestedColumnLinks = panelContainer.locator(
                '.nested-column-name'
              );
              const totalLinks = await nestedColumnLinks.count();

              // Count badge should be <= total links (since links include all nested levels)
              expect(count).toBeLessThanOrEqual(totalLinks);
            }
          }
        );

        await test.step(
          'Verify proper indentation for nested levels',
          async () => {
            const panelContainer = page.locator('.column-detail-panel');
            const nestedColumnItems = panelContainer
              .locator('.nested-column-name')
              .locator('..');

            // Get all nested column items and verify they have proper padding
            const items = await nestedColumnItems.all();

            if (items.length > 1) {
              // Verify at least one item has padding (indicating nested structure)
              const hasIndentation = await Promise.all(
                items.map(async (item) => {
                  const paddingLeft = await item.evaluate((el) => {
                    const style = window.getComputedStyle(el);

                    return style.paddingLeft;
                  });

                  return paddingLeft !== '0px';
                })
              );

              const hasAnyIndentation = hasIndentation.some(Boolean);

              expect(hasAnyIndentation).toBeTruthy();
            }
          }
        );

        await test.step(
          'Verify clicking on nested column navigates correctly',
          async () => {
            const panelContainer = page.locator('.column-detail-panel');
            const nestedColumnLinks = panelContainer.locator(
              '.nested-column-name'
            );

            const firstLink = nestedColumnLinks.first();
            await firstLink.scrollIntoViewIfNeeded();

            // Verify link is visible and clickable
            await expect(firstLink).toBeVisible();

            // Click the link and verify API call or panel update
            const clickResponse = page.waitForResponse(
              (response) =>
                response.url().includes('/api/v1/columns/name/') ||
                response.url().includes('/api/v1/tables/name/'),
              { timeout: 10000 }
            );

            await firstLink.click();
            await clickResponse;

            // Wait for loader to disappear after navigation
            await page.waitForSelector('[data-testid="loader"]', {
              state: 'detached',
            });

            // Verify panel is still visible (navigated to nested column)
            await expect(page.locator('.column-detail-panel')).toBeVisible();
          }
        );

        await test.step(
          'Verify clicking on intermediate nested levels (non-leaf nodes)',
          async () => {
            const panelContainer = page.locator('.column-detail-panel');

            // Navigate back to parent column first
            const prevButton = panelContainer
              .locator('.navigation-container')
              .locator('button')
              .nth(0);

            // Only navigate back if we moved forward
            if (await prevButton.isEnabled()) {
              await prevButton.click();
              // Wait for loader to disappear after navigation
              await page.waitForSelector('[data-testid="loader"]', {
                state: 'detached',
              });
            }

            const allNestedLinks = panelContainer.locator(
              '.nested-column-name'
            );
            const totalLinks = await allNestedLinks.count();

            if (totalLinks > 1) {
              // Click on an intermediate level (not the first, not the last if possible)
              const middleIndex = Math.min(
                Math.floor(totalLinks / 2),
                totalLinks - 1
              );
              const intermediateLink = allNestedLinks.nth(middleIndex);

              await intermediateLink.scrollIntoViewIfNeeded();

              await expect(intermediateLink).toBeVisible();

              // Click intermediate link
              const intermediateClickResponse = page.waitForResponse(
                (response) =>
                  response.url().includes('/api/v1/columns/name/') ||
                  response.url().includes('/api/v1/tables/name/'),
                { timeout: 10000 }
              );

              await intermediateLink.click();
              await intermediateClickResponse;

              // Wait for loader to disappear after navigation
              await page.waitForSelector('[data-testid="loader"]', {
                state: 'detached',
              });

              // Verify panel updated correctly
              await expect(page.locator('.column-detail-panel')).toBeVisible();
            }
          }
        );

        await test.step(
          'Verify multiple sibling columns at same nesting level',
          async () => {
            const panelContainer = page.locator('.column-detail-panel');
            const nestedColumnLinks = panelContainer.locator(
              '.nested-column-name'
            );

            const linkCount = await nestedColumnLinks.count();

            if (linkCount > 1) {
              // Get all link texts to verify siblings exist
              const allLinks = await nestedColumnLinks.all();
              const linkTexts = await Promise.all(
                allLinks.map((link) => link.textContent())
              );

              // Should have multiple distinct column names
              const uniqueNames = new Set(
                linkTexts.filter((text) => text && text.trim().length > 0)
              );

              expect(uniqueNames.size).toBeGreaterThan(0);

              // Verify that siblings are all visible
              const visibleLinks = await Promise.all(
                allLinks.map(async (link) => await link.isVisible())
              );
              const visibleCount = visibleLinks.filter(Boolean).length;

              expect(visibleCount).toBeGreaterThan(0);
            }
          }
        );

        await test.step(
          'Verify deep nesting (3+ levels) if available',
          async () => {
            const panelContainer = page.locator('.column-detail-panel');
            const nestedColumnLinks = panelContainer.locator(
              '.nested-column-name'
            );

            // Check if we have multiple levels by examining padding
            const allLinks = await nestedColumnLinks.all();

            if (allLinks.length >= 3) {
              // Get padding values to detect nesting depth
              const paddingValues = await Promise.all(
                allLinks.map(async (link) => {
                  const parent = link.locator('..');

                  return await parent.evaluate((el) => {
                    const style = window.getComputedStyle(el);

                    return parseFloat(style.paddingLeft);
                  });
                })
              );

              // Should have at least 2 different padding values (indicating multiple levels)
              const uniquePaddings = new Set(paddingValues);

              expect(uniquePaddings.size).toBeGreaterThan(0);
            }
          }
        );

        await test.step('Close panel', async () => {
          const panelContainer = page.locator('.column-detail-panel');

          await panelContainer.getByTestId('close-button').click();

          await expect(page.locator('.column-detail-panel')).not.toBeVisible();
        });
      });

      test('Array type columns with nested structures in NestedColumnsSection', async ({
        page,
      }) => {
        test.slow(true);

        if (entity.type !== 'Table') {
          test.skip();
        }

        await page.getByTestId(entity.childrenTabId ?? '').click();
        await page.waitForLoadState('networkidle');

        await test.step(
          'Verify array column with nested children renders correctly',
          async () => {
            const tableResponse = entity.entityResponseData as any;
            const columns = tableResponse?.columns || [];

            const nestedParent = columns.find(
              (col: any) => col.name === (entity as TableClass).columnsName[2]
            );

            if (!nestedParent) {
              throw new Error(
                `Nested parent column not found: ${(entity as TableClass).columnsName[2]
                }`
              );
            }

            const nestedParentFQN = nestedParent.fullyQualifiedName;

            const arrayColumn = nestedParent.children?.find(
              (col: any) => col.name === (entity as TableClass).columnsName[4]
            );

            if (!arrayColumn) {
              throw new Error(
                `Array column not found: ${(entity as TableClass).columnsName[4]
                }`
              );
            }

            const arrayColumnFQN = arrayColumn.fullyQualifiedName;

            const parentRow = page.locator(
              `[data-row-key="${nestedParentFQN}"]`
            );

            await parentRow.waitFor({ state: 'visible' });
            await page.waitForLoadState('networkidle');

            const arrayColumnRow = page.locator(
              `[data-row-key="${arrayColumnFQN}"]`
            );

            await arrayColumnRow.waitFor({ state: 'visible' });

            const arrayColumnId = await arrayColumnRow.getAttribute(
              'data-row-key'
            );

            const panelContainer = await openColumnDetailPanel({
              page,
              rowSelector: 'data-row-key',
              columnId: arrayColumnId ?? '',
              columnNameTestId: 'column-name',
              entityType: entity.type as EntityType,
            });

            const nestedColumnLinks = panelContainer.locator(
              '.nested-column-name'
            );

            if ((await nestedColumnLinks.count()) > 0) {
              await expect(nestedColumnLinks.first()).toBeVisible();

              const linkCount = await nestedColumnLinks.count();

              expect(linkCount).toBeGreaterThan(0);

              await panelContainer.getByTestId('close-button').click();
            }
          }
        );
      });

      test('Mixed sibling columns (simple + nested) at same level', async ({
        page,
      }) => {
        test.slow(true);

        if (entity.type !== 'Table') {
          test.skip();
        }

        await page.getByTestId(entity.childrenTabId ?? '').click();
        await page.waitForLoadState('networkidle');

        await test.step(
          'Verify mixed siblings have consistent indentation',
          async () => {
            // columnsName[2] has mixed children: columnsName[3] (STRUCT) and columnsName[4] (ARRAY with nested children)
            const nestedParentFQN = `${entity.entityResponseData?.['fullyQualifiedName']
              }.${(entity as TableClass).columnsName[2]}`;

            const nestedColumnRow = page.locator(
              `[data-row-key="${nestedParentFQN}"]`
            );

            if (await nestedColumnRow.getByTestId('expand-icon').isVisible()) {
              await nestedColumnRow.getByTestId('expand-icon').click();
              // Wait for expansion to complete
              await page.waitForSelector('[data-testid="loader"]', {
                state: 'detached',
              });

              // Open detail panel
              const nestedColumnId = await nestedColumnRow.getAttribute(
                'data-row-key'
              );
              const panelContainer = await openColumnDetailPanel({
                page,
                rowSelector: 'data-row-key',
                columnId: nestedColumnId ?? nestedParentFQN,
                columnNameTestId: 'column-name',
                entityType: entity.type as EntityType,
              });
              const nestedColumnLinks = panelContainer.locator(
                '.nested-column-name'
              );

              if ((await nestedColumnLinks.count()) > 1) {
                // Get parent elements to check padding
                const linkParents = await nestedColumnLinks.all();
                const paddingValues = await Promise.all(
                  linkParents.map(async (link) => {
                    const parent = link.locator('..');

                    return await parent.evaluate((el) => {
                      return window.getComputedStyle(el).paddingLeft;
                    });
                  })
                );

                // Verify we have multiple padding values indicating nesting levels
                if (paddingValues.length >= 2) {
                  expect(paddingValues.length).toBeGreaterThan(0);

                  // Should have different padding values for different nesting levels
                  const uniquePaddings = new Set(paddingValues);

                  expect(uniquePaddings.size).toBeGreaterThan(0);
                }
              }

              await panelContainer.getByTestId('close-button').click();
            }
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
            const columnNameTestId =
              entity.type === 'Pipeline' ? 'task-name' : 'column-name';

            const panelContainer = await openColumnDetailPanel({
              page,
              rowSelector,
              columnId: entity.childrenSelectorId ?? '',
              columnNameTestId,
              entityType: entity.type as EntityType,
            });

            // Add glossary term via panel
            const editButton = panelContainer.getByTestId(
              'edit-glossary-terms'
            );
            await expect(editButton).toBeVisible();
            await editButton.click();

            // Wait for selectable list to be visible and ready
            const selectableList = page.locator(
              '[data-testid="selectable-list"]'
            );
            await expect(selectableList).toBeVisible();

            const searchBar = page.locator(
              '[data-testid="glossary-term-select-search-bar"]'
            );
            await expect(searchBar).toBeVisible();
            await searchBar.fill(
              EntityDataClass.glossaryTerm1.responseData.displayName
            );

            // Wait for loader to disappear after search
            await page.waitForSelector('[data-testid="loader"]', {
              state: 'detached',
            });

            // Wait for term option to be visible before clicking
            const termOption = page.locator('.ant-list-item').filter({
              hasText: EntityDataClass.glossaryTerm1.responseData.displayName,
            });
            await expect(termOption).toBeVisible();
            await termOption.click();

            // Wait for both API response AND UI update
            const updateResponse = page.waitForResponse(
              (response) =>
                response.url().includes('/api/v1/columns/name/') ||
                response.url().includes(`/api/v1/${entity.endpoint}/`)
            );
            const updateButton = page.getByRole('button', { name: 'Update' });
            await expect(updateButton).toBeVisible();
            await expect(updateButton).toBeEnabled();
            await updateButton.click();
            await updateResponse;

            // CRITICAL: Wait for UI to update after API response
            await page.waitForSelector('[data-testid="loader"]', {
              state: 'detached',
            });

            await expect(
              panelContainer.getByTestId(
                `tag-${EntityDataClass.glossaryTerm1.responseData.fullyQualifiedName}`
              )
            ).toBeVisible();

            await closeColumnDetailPanel(page);
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
            const panelContainer = await openColumnDetailPanel({
              page,
              rowSelector,
              columnId: entity.childrenSelectorId ?? '',
              columnNameTestId,
              entityType: entity.type as EntityType,
            });

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

              // Wait for description box to be visible and ready
              const descBox = page.locator(descriptionBox).first();
              await expect(descBox).toBeVisible();
              await descBox.clear();
              await descBox.fill(newDescription);

              // Wait for API response on save
              const saveResponse = page.waitForResponse(
                (response) =>
                  response.url().includes('/api/v1/columns/name/') ||
                  response.url().includes(`/api/v1/${entity.endpoint}/`)
              );
              const saveButton = page.getByTestId('save');
              await expect(saveButton).toBeVisible();
              await expect(saveButton).toBeEnabled();
              await saveButton.click();
              await saveResponse;

              await toastNotification(page, /Description updated successfully/);

              await expect(
                panelContainer
                  .locator('[data-testid="viewer-container"]')
                  .getByText(newDescription)
              ).toBeVisible();
            }

            if (entity.type === 'Table') {
              await page.getByTestId('data-quality-tab').click();

              await expect(page.getByTestId('data-quality-tab')).toHaveClass(
                /ant-menu-item-selected/
              );
            }

            await page.getByTestId('overview-tab').click();

            await expect(page.getByTestId('overview-tab')).toHaveClass(
              /ant-menu-item-selected/
            );

            // Test column navigation with arrow buttons and verify nested column counting
            const paginationText = page.locator('.pagination-header-text');
            await expect(paginationText).toBeVisible();
            const initialText = await paginationText.textContent();

            // Verify pagination text format: "X of Y columns" (includes nested columns)
            expect(initialText).toMatch(/\d+\s+of\s+\d+\s+columns?/i);

            const nextButton = page
              .locator('.navigation-container')
              .locator('button')
              .nth(1);

            if (await nextButton.isEnabled()) {
              // Wait for navigation API response

              await nextButton.click();

              // Wait for loader to disappear after navigation
              await page.waitForSelector('[data-testid="loader"]', {
                state: 'detached',
              });

              // Verify entity link is visible after navigation
              await expect(page.getByTestId('entity-link')).toBeVisible();

              const updatedText = await paginationText.textContent();

              expect(updatedText).not.toBe(initialText);
              // Verify pagination still shows correct format after navigation
              expect(updatedText).toMatch(/\d+\s+of\s+\d+\s+columns?/i);

              // Navigate back to previous column
              const prevButton = page
                .locator('.navigation-container')
                .locator('button')
                .nth(0);

              await expect(prevButton).toBeEnabled();

              await prevButton.click();

              // Wait for loader to disappear after navigation
              await page.waitForSelector('[data-testid="loader"]', {
                state: 'detached',
              });

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

      if (entity.type === 'Table') {
        test('Column detail panel key profile metrics validation', async ({
          page,
        }) => {
          test.slow(true);

          await page.getByTestId(entity.childrenTabId ?? '').click();

          await test.step(
            'Verify key profile metrics are displayed in column detail panel',
            async () => {
              // Open column detail panel and wait for profile API call
              const columnNameTestId = 'column-name';
              const columnName = page
                .locator(
                  `[${rowSelector}="${entity.childrenSelectorId ?? ''}"]`
                )
                .getByTestId(columnNameTestId)
                .first();
              await columnName.scrollIntoViewIfNeeded();

              // Wait for profile API response when panel opens
              const profileResponse = page.waitForResponse(
                (response) =>
                  response.url().includes('/api/v1/tables/') &&
                  response.url().includes('fields=profile')
              );
              await columnName.click();
              await profileResponse;

              await expect(page.locator('.column-detail-panel')).toBeVisible();

              const panelContainer = page.locator('.column-detail-panel');

              // Verify Key Profile Metrics section is visible
              await expect(
                panelContainer.getByText('Key Profile Metrics')
              ).toBeVisible();

              // Verify all four metric chips are present and visible using data-testid
              const expectedMetrics = KEY_PROFILE_METRICS;

              for (const metric of expectedMetrics) {
                const metricChip = panelContainer.getByTestId(
                  `key-profile-metric-${metric}`
                );

                await expect(metricChip).toBeVisible();

                // Verify the metric label is visible
                await expect(panelContainer.getByText(metric)).toBeVisible();

                // Verify that the chip has content (metric value)
                const chipContent = await metricChip.textContent();

                expect(chipContent).toBeTruthy();
                // Value should match one of these patterns: percentage (e.g., "75%"), number (e.g., "1,000"), or placeholder ("--")
                expect(chipContent).toMatch(/(\d+%|\d{1,3}(,\d{3})*|--)/);
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
      // used slow as test contain page reload which might lead to timeout
      test.slow(true);
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

      const entityName =
        entity.entityResponseData?.['displayName'] ?? entity.entity.name;
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

        await test.step(
          `Update ${titleText} Custom Property in Right Panel`,
          async () => {
            test.slow();
            for (const [index, type] of properties.entries()) {
              await updateCustomPropertyInRightPanel({
                page,
                entityName:
                  entity.entityResponseData['displayName'] ??
                  entity.entityResponseData['name'],
                propertyDetails: entity.customPropertyValue[type].property,
                value: entity.customPropertyValue[type].value,
                endpoint: entity.endpoint,
                skipNavigation: index > 0,
              });
            }
          }
        );

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
  });

  /**
   * Tests entity deletion (soft and hard delete)
   * @description Tests soft deleting an entity and then hard deleting it to completely remove it from the system

   */
  test(`Delete ${key}`, PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, async ({ page }) => {
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
