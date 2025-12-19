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
import { expect, Page } from '@playwright/test';
import { Column } from '../../../src/generated/entity/data/table';
import { DataProduct } from '../../support/domain/DataProduct';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { TableClass } from '../../support/entity/TableClass';
import { test } from '../../support/fixtures/userPages';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { ClassificationClass } from '../../support/tag/ClassificationClass';
import { TagClass } from '../../support/tag/TagClass';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, redirectToExplorePage, uuid } from '../../utils/common';
import {
  createCustomPropertyForEntity,
  CustomProperty,
  setValueForProperty,
} from '../../utils/customProperty';
import { getCurrentMillis } from '../../utils/dateTime';
import {
  addOwnerWithoutValidation,
  assignTier,
  updateDescription,
  waitForAllLoadersToDisappear,
} from '../../utils/entity';
import {
  clearAndAddGlossaryTerms,
  clearDataProducts,
  clickDataQualityStatCard,
  editDomain,
  editTags,
  navigateToEntityPanelTab,
  navigateToIncidentsTab,
  openEntitySummaryPanel,
  verifyDeletedEntityNotVisible,
} from '../../utils/entityPanel';
import { addPipelineBetweenNodes } from '../../utils/lineage';

const testEntity = new TableClass();
const testDataProduct = new DataProduct(
  [EntityDataClass.domain1],
  'PW_TestDataProduct'
);

test.beforeAll('Setup shared test data', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await testEntity.create(apiContext);
  await testDataProduct.create(apiContext);

  // Assign the test entity to domain1 so data products can be linked
  await testEntity.patch({
    apiContext,
    patchData: [
      {
        op: 'add',
        path: '/domains/0',
        value: {
          id: EntityDataClass.domain1.responseData.id,
          type: 'domain',
        },
      },
    ],
  });

  await afterAction();
});

test.afterAll('Cleanup shared test data', async ({ browser }) => {
  const { apiContext, afterAction } = await performAdminLogin(browser);

  await testDataProduct.delete(apiContext);
  await testEntity.delete(apiContext);

  await afterAction();
});

async function navigateToExploreAndSelectTable(page: Page) {
  await redirectToExplorePage(page);

  await page
    .waitForSelector('[data-testid="loader"]', {
      state: 'detached',
      timeout: 15000,
    })
    .catch(() => {
      // Loader might not appear, continue
    });
  await openEntitySummaryPanel(page, testEntity.entity.name);
}

test.describe('Right Entity Panel - Admin User Flow', () => {
  test.beforeEach('Navigate to explore page', async ({ adminPage }) => {
    await navigateToExploreAndSelectTable(adminPage);
  });

  test('Admin - Overview Tab - Description Section - Add and Update', async ({
    adminPage,
  }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const descriptionSection = summaryPanel.locator('.description-section');

    await expect(descriptionSection).toBeVisible();

    await updateDescription(adminPage, 'Admin updated description', false, '');

    await expect(adminPage.getByTestId('markdown-editor')).not.toBeVisible();
    await expect(
      adminPage.getByText(/Description updated successfully/)
    ).toBeVisible();
  });

  test('Admin - Overview Tab - Owners Section - Add and Update, Verify Deleted Users Not Visible', async ({
    adminPage,
  }) => {
    const { apiContext, afterAction } = await getApiContext(adminPage);
    const deletedUser = new UserClass();

    try {
      await deletedUser.create(apiContext);

      const deletedUserDisplayName = deletedUser.getUserDisplayName();

      const summaryPanel = adminPage.locator('.entity-summary-panel-container');
      const ownersSection = summaryPanel.locator('.owners-section');

      await expect(ownersSection).toBeVisible();

      await addOwnerWithoutValidation({
        page: adminPage,
        owner: deletedUserDisplayName,
        type: 'Users',
        initiatorId: 'edit-owners',
      });

      await expect(
        adminPage.getByText(/Owners updated successfully/i)
      ).toBeVisible();

      await deletedUser.delete(apiContext, false);

      await navigateToExploreAndSelectTable(adminPage);

      const summaryPanelAfterDelete = adminPage.locator(
        '.entity-summary-panel-container'
      );
      await summaryPanelAfterDelete.waitFor({ state: 'visible' });

      const ownersSectionAfterDelete =
        summaryPanelAfterDelete.locator('.owners-section');
      await ownersSectionAfterDelete.waitFor({ state: 'visible' });
      await ownersSectionAfterDelete.scrollIntoViewIfNeeded();

      await expect(ownersSectionAfterDelete).toBeVisible();

      const editButtonAfterDelete =
        ownersSectionAfterDelete.getByTestId('edit-owners');
      if (await editButtonAfterDelete.isVisible()) {
        await editButtonAfterDelete.click();

        const popoverAfterDelete = adminPage.getByTestId('select-owner-tabs');

        await expect(popoverAfterDelete).toBeVisible();

        await adminPage.getByRole('tab', { name: 'Users' }).click();

        const deletedUserItem = await verifyDeletedEntityNotVisible(
          adminPage,
          deletedUserDisplayName,
          'owner-select-users-search-bar',
          'user'
        );

        await expect(deletedUserItem).not.toBeVisible();

        await adminPage.waitForSelector('.ant-list-empty-text', {
          state: 'visible',
        });
      }
    } finally {
      await afterAction();
    }
  });

  test('Admin - Overview Tab - Owners Section - Add Team Owner and Verify Deleted Teams Not Visible', async ({
    adminPage,
  }) => {
    const { apiContext, afterAction } = await getApiContext(adminPage);
    const deletedTeam = new TeamClass();

    try {
      await deletedTeam.create(apiContext);

      const deletedTeamDisplayName = deletedTeam.getTeamDisplayName();

      const summaryPanel = adminPage.locator('.entity-summary-panel-container');
      const ownersSection = summaryPanel.locator('.owners-section');

      await expect(ownersSection).toBeVisible();

      await addOwnerWithoutValidation({
        page: adminPage,
        owner: deletedTeamDisplayName,
        type: 'Teams',
        initiatorId: 'edit-owners',
      });

      await expect(
        adminPage.getByText(/Owners updated successfully/i)
      ).toBeVisible();

      await deletedTeam.delete(apiContext);

      await navigateToExploreAndSelectTable(adminPage);

      const summaryPanelAfterDelete = adminPage.locator(
        '.entity-summary-panel-container'
      );
      await summaryPanelAfterDelete.waitFor({ state: 'visible' });

      const ownersSectionAfterDelete =
        summaryPanelAfterDelete.locator('.owners-section');
      await ownersSectionAfterDelete.waitFor({ state: 'visible' });
      await ownersSectionAfterDelete.scrollIntoViewIfNeeded();

      await expect(ownersSectionAfterDelete).toBeVisible();

      const editButtonAfterDelete =
        ownersSectionAfterDelete.getByTestId('edit-owners');
      if (await editButtonAfterDelete.isVisible()) {
        await editButtonAfterDelete.click();

        const popoverAfterDelete = adminPage.getByTestId('select-owner-tabs');

        await expect(popoverAfterDelete).toBeVisible();

        await adminPage.getByRole('tab', { name: 'Teams' }).click();

        const deletedTeamItem = await verifyDeletedEntityNotVisible(
          adminPage,
          deletedTeamDisplayName,
          'owner-select-teams-search-bar',
          'team'
        );

        await expect(deletedTeamItem).not.toBeVisible();

        await adminPage.waitForSelector('.ant-list-empty-text', {
          state: 'visible',
        });
      }
    } finally {
      await afterAction();
    }
  });

  test('Admin - Overview Tab - Tags Section - Add Tag and Verify Deleted Tags Not Visible', async ({
    adminPage,
  }) => {
    const { apiContext, afterAction } = await getApiContext(adminPage);
    const testClassification = new ClassificationClass();
    const deletedTag = new TagClass({
      classification: testClassification.data.name,
    });

    try {
      await testClassification.create(apiContext);
      await deletedTag.create(apiContext);

      const deletedTagDisplayName = deletedTag.getTagDisplayName();

      const summaryPanel = adminPage.locator('.entity-summary-panel-container');
      const tagsSection = summaryPanel.locator('.tags-section');

      await tagsSection.scrollIntoViewIfNeeded();

      await expect(tagsSection).toBeVisible();

      await editTags(adminPage, deletedTagDisplayName, true);

      await deletedTag.delete(apiContext);

      await navigateToExploreAndSelectTable(adminPage);

      const summaryPanelAfterDelete = adminPage.locator(
        '.entity-summary-panel-container'
      );
      const tagsSectionAfterDelete =
        summaryPanelAfterDelete.locator('.tags-section');
      await tagsSectionAfterDelete.scrollIntoViewIfNeeded();

      await expect(tagsSectionAfterDelete).toBeVisible();

      await adminPage
        .locator('[data-testid="edit-icon-tags"]')
        .scrollIntoViewIfNeeded();

      await adminPage.locator('[data-testid="edit-icon-tags"]').click();

      const deletedTagItem = await verifyDeletedEntityNotVisible(
        adminPage,
        deletedTagDisplayName,
        'tag-select-search-bar',
        'tag'
      );

      await expect(deletedTagItem).not.toBeVisible();

      const cancelBtn = adminPage.getByRole('button', { name: 'Cancel' });
      if (await cancelBtn.isVisible()) {
        await cancelBtn.click();
      }
    } finally {
      await testClassification.delete(apiContext);
      await afterAction();
    }
  });

  test('Admin - Overview Tab - Glossary Terms Section - Add Term and Verify Deleted Terms Not Visible', async ({
    adminPage,
  }) => {
    const { apiContext, afterAction } = await getApiContext(adminPage);
    const deletedTerm = new GlossaryTerm();

    try {
      await deletedTerm.create(apiContext);

      const deletedTermDisplayName = deletedTerm.getTermDisplayName();

      const summaryPanel = adminPage.locator('.entity-summary-panel-container');
      const glossarySection = summaryPanel.locator('.glossary-terms-section');

      await glossarySection.scrollIntoViewIfNeeded();

      await expect(glossarySection).toBeVisible();

      await clearAndAddGlossaryTerms(adminPage, deletedTermDisplayName);

      await expect(
        adminPage.getByText(/Glossary terms updated successfully/i)
      ).toBeVisible();

      await deletedTerm.delete(apiContext);

      await navigateToExploreAndSelectTable(adminPage);

      const summaryPanelAfterDelete = adminPage.locator(
        '.entity-summary-panel-container'
      );
      const glossarySectionAfterDelete = summaryPanelAfterDelete.locator(
        '.glossary-terms-section'
      );
      await glossarySectionAfterDelete.scrollIntoViewIfNeeded();

      await expect(glossarySectionAfterDelete).toBeVisible();

      await adminPage
        .locator('[data-testid="edit-glossary-terms"]')
        .scrollIntoViewIfNeeded();

      await adminPage.locator('[data-testid="edit-glossary-terms"]').click();

      const deletedTermItem = await verifyDeletedEntityNotVisible(
        adminPage,
        deletedTermDisplayName,
        'glossary-term-select-search-bar',
        'glossaryTerm'
      );

      await expect(deletedTermItem).not.toBeVisible();

      await adminPage.waitForSelector('.ant-list-empty-text', {
        state: 'visible',
      });
      const cancelBtn = adminPage.getByRole('button', { name: 'Cancel' });
      await cancelBtn.click();
    } finally {
      await afterAction();
    }
  });

  test('Admin - Overview Tab - Tier Section - Add and Update', async ({
    adminPage,
  }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const tierSection = summaryPanel.locator('.tier-section');

    await expect(tierSection).toBeVisible();

    await assignTier(
      adminPage,
      'Tier1',
      EntityTypeEndpoint.Table,
      'edit-icon-tier'
    );

    await expect(
      adminPage.getByText(/Tier updated successfully/i)
    ).toBeVisible();
  });

  test('Admin - Overview Tab - Domains Section - Add and Update', async ({
    adminPage,
  }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const domainsSection = summaryPanel.locator('.domains-section');

    await domainsSection.scrollIntoViewIfNeeded();

    await domainsSection.waitFor({ state: 'visible' });

    await clearDataProducts(adminPage);

    await editDomain(adminPage, 'TestDomain');

    await expect(
      adminPage.getByText(/Domains updated successfully/i)
    ).toBeVisible();
  });

  test('Admin - Schema Tab - View Schema', async ({ adminPage }) => {
    const schemaTab = adminPage.locator('[data-testid="schema-tab"]');

    await schemaTab.click();
    await adminPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const tabContent = adminPage.locator(
      '[data-testid="entity-details-section"]'
    );

    await expect(tabContent).toBeVisible();

    for (const child of testEntity.children as Column[]) {
      const fieldCard = adminPage.locator(
        `[data-testid="field-card-${child.name}"]`
      );

      await expect(fieldCard).toBeVisible();

      const dataTypeBadge = fieldCard.locator(
        `[data-testid="data-type-text-${child.dataType}"]`
      );

      await expect(dataTypeBadge).toBeVisible();

      const fieldName = fieldCard.locator(
        `[data-testid="field-name-${child.name}"]`
      );

      await expect(fieldName).toHaveText(child.name);

      const fieldDescription = fieldCard.locator(
        `[data-testid="field-description-${child.name}"]`
      );

      await expect(fieldDescription).toBeVisible();
      await expect(fieldDescription).toContainText(child.description ?? '');
    }
  });

  test('Lineage Tab - No Lineage', async ({ adminPage }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');

    const lineageSection = summaryPanel.locator(
      '[data-testid="lineage-section"]'
    );

    if (await lineageSection.isVisible()) {
      await expect(
        summaryPanel.getByText(/no lineage connections found/i)
      ).toBeVisible();
    }

    // Now test the Lineage tab
    const lineageTab = summaryPanel.getByRole('menuitem', {
      name: /lineage/i,
    });

    await lineageTab.click();
    await adminPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const tabContent = summaryPanel.locator(
      '.entity-summary-panel-tab-content'
    );

    await expect(tabContent).toBeVisible();

    // When there's no lineage, verify empty state
    await expect(adminPage.getByText(/Lineage not found/i)).toBeVisible();
  });

  test('Lineage Tab - With Upstream and Downstream', async ({ adminPage }) => {
    // Create additional entities for lineage
    const { apiContext } = await getApiContext(adminPage);
    const upstreamTable = new TableClass();
    const downstreamTable = new TableClass();

    try {
      await upstreamTable.create(apiContext);
      await downstreamTable.create(apiContext);

      // Add lineage connections: upstream -> testEntity -> downstream
      await addPipelineBetweenNodes(adminPage, upstreamTable, testEntity);
      await addPipelineBetweenNodes(adminPage, testEntity, downstreamTable);

      // Navigate back to explore and open the entity panel
      await navigateToExploreAndSelectTable(adminPage);

      const summaryPanel = adminPage.locator('.entity-summary-panel-container');

      // First verify the Overview tab shows lineage counts in LineageSection
      await summaryPanel
        .getByRole('menuitem', {
          name: /overview/i,
        })
        .click();

      await adminPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const lineageSection = summaryPanel.locator(
        '[data-testid="upstream-lineage"]'
      );

      if (await lineageSection.isVisible()) {
        // Verify upstream and downstream counts are visible
        const upstreamText = summaryPanel.getByText(/upstream:/i);
        const downstreamText = summaryPanel.getByText(/downstream:/i);

        await expect(upstreamText).toBeVisible();
        await expect(downstreamText).toBeVisible();

        // Verify the actual counts (should be 1 upstream and 1 downstream)
        const upstreamCountElement = summaryPanel.locator(
          '[data-testid="upstream-count"]'
        );
        const downstreamCountElement = summaryPanel.locator(
          '[data-testid="downstream-count"]'
        );

        await expect(upstreamCountElement).toHaveText('1');
        await expect(downstreamCountElement).toHaveText('1');

        // Click on lineage section to navigate to lineage page
        await lineageSection.click();

        // Verify navigation to lineage route
        await adminPage.waitForURL(/.*\/lineage$/);

        expect(adminPage.url()).toContain('/lineage');

        // Navigate back to explore and reopen the entity panel
        await navigateToExploreAndSelectTable(adminPage);
      }

      // Now test the Lineage tab
      const lineageTab = summaryPanel.getByRole('menuitem', {
        name: /lineage/i,
      });

      await lineageTab.click();
      await adminPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });
      await adminPage.waitForLoadState('networkidle');

      const tabContent = summaryPanel.locator(
        '.entity-summary-panel-tab-content'
      );

      await expect(tabContent).toBeVisible();

      // Verify lineage content is loaded
      const lineageContainer = summaryPanel.locator('.lineage-tab-content');

      await expect(lineageContainer).toBeVisible();

      // Verify upstream/downstream filter buttons exist
      const filterButtons = lineageContainer.locator('.lineage-filter-buttons');

      await expect(filterButtons).toBeVisible();

      // Get the filter buttons by their text content
      const upstreamButton = lineageContainer.getByTestId(
        'upstream-button-text'
      );
      const downstreamButton = lineageContainer.getByTestId(
        'downstream-button-text'
      );

      await expect(upstreamButton).toHaveText('Upstream');
      await expect(downstreamButton).toHaveText('Downstream');

      // Verify downstream entity card is visible (shown by default)
      const downstreamCard = lineageContainer
        .locator('.lineage-item-card')
        .first();

      await expect(downstreamCard).toBeVisible();
      await expect(downstreamCard).toContainText(
        downstreamTable.entity.displayName
      );

      // Verify downstream icon is present
      const downstreamIcon = downstreamCard.locator(
        '.lineage-item-direction svg'
      );

      await expect(downstreamIcon).toBeVisible();

      // Click upstream button to view upstream entities
      await upstreamButton.click();

      // Get upstream card after switching to upstream view
      const upstreamCard = lineageContainer
        .locator('.lineage-item-card')
        .first();

      await expect(upstreamCard).toBeVisible();
      await expect(upstreamCard).toContainText(
        upstreamTable.entity.displayName
      );

      // Verify upstream icon is present
      const upstreamIcon = upstreamCard.locator('.lineage-item-direction svg');

      await expect(upstreamIcon).toBeVisible();

      // Verify card structure and content
      const card = lineageContainer.locator('.lineage-item-card').first();

      // Verify service icon
      const serviceIcon = card.locator('.service-icon');

      await expect(serviceIcon).toBeVisible();

      // Verify entity name
      const entityName = card.locator('.item-name-text');

      await expect(entityName).toBeVisible();

      // Verify entity type
      const entityType = card.locator('.item-entity-type-text');

      await expect(entityType).toContainText(/table/i);

      // Verify owner info is present (either owner label or no owner)
      const ownerSection = card.locator('.lineage-info-container');

      await expect(ownerSection).toBeVisible();

      // Verify card is clickable link
      const cardLink = card.locator('.breadcrumb-menu-button');

      await expect(cardLink).toBeVisible();
    } finally {
      // Cleanup
      await upstreamTable.delete(apiContext);
      await downstreamTable.delete(apiContext);
    }
  });

  test('Data Quality Tab - No Test Cases', async ({ adminPage }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const dqTab = summaryPanel.getByRole('menuitem', {
      name: /data quality/i,
    });

    await dqTab.click();
    await adminPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const tabContent = summaryPanel.locator('.data-quality-tab-container');

    await expect(tabContent).toBeVisible();

    // Verify empty state message
    await expect(
      adminPage.getByText(
        /No data quality results found.*Schedule or run tests to see results/i
      )
    ).toBeVisible();
  });

  test('Data Quality Tab - Incidents Empty State', async ({ adminPage }) => {
    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const dqTab = summaryPanel.getByRole('menuitem', {
      name: /data quality/i,
    });

    await dqTab.click();
    await adminPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const tabContent = summaryPanel.locator('.data-quality-tab-container');

    await expect(tabContent).toBeVisible();

    // Verify empty state message
    await expect(
      adminPage.getByText(
        /No data quality results found.*Schedule or run tests to see results/i
      )
    ).toBeVisible();
  });

  test('Data Quality Tab - With Test Cases', async ({ adminPage }) => {
    test.slow(true);

    const { apiContext, afterAction } = await getApiContext(adminPage);

    try {
      // Create test cases for the entity
      await testEntity.createTestSuiteAndPipelines(apiContext);

      const testCase1 = await testEntity.createTestCase(apiContext, {
        name: `pw_test_case_success_${uuid()}`,
        testDefinition: 'tableRowCountToBeBetween',
        parameterValues: [
          { name: 'minValue', value: 1 },
          { name: 'maxValue', value: 100 },
        ],
      });

      const testCase2 = await testEntity.createTestCase(apiContext, {
        name: `pw_test_case_failed_${uuid()}`,
        entityLink: `<#E::table::${
          testEntity.entityResponseData?.['fullyQualifiedName']
        }::columns::${(testEntity.entity?.columns as Column[])[0].name}>`,
        testDefinition: 'columnValueLengthsToBeBetween',
        parameterValues: [
          { name: 'minLength', value: 3 },
          { name: 'maxLength', value: 6 },
        ],
      });

      const testCase3 = await testEntity.createTestCase(apiContext, {
        name: `pw_test_case_aborted_${uuid()}`,
        testDefinition: 'tableRowCountToBeBetween',
        parameterValues: [
          { name: 'minValue', value: 1 },
          { name: 'maxValue', value: 100 },
        ],
      });

      // Add test results
      await testEntity.addTestCaseResult(
        apiContext,
        testCase1.fullyQualifiedName,
        {
          testCaseStatus: 'Success',
          timestamp: getCurrentMillis(),
        }
      );

      await testEntity.addTestCaseResult(
        apiContext,
        testCase2.fullyQualifiedName,
        {
          testCaseStatus: 'Failed',
          result: 'Test failed due to invalid length',
          timestamp: getCurrentMillis(),
        }
      );

      await testEntity.addTestCaseResult(
        apiContext,
        testCase3.fullyQualifiedName,
        { testCaseStatus: 'Aborted', timestamp: getCurrentMillis() }
      );
      // Navigate back to explore and open the entity panel
      await navigateToExploreAndSelectTable(adminPage);

      const summaryPanel = adminPage.locator('.entity-summary-panel-container');
      const dqTab = summaryPanel.getByRole('menuitem', {
        name: /data quality/i,
      });

      await dqTab.click();
      await adminPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });
      await adminPage.waitForLoadState('networkidle');

      const tabContent = summaryPanel.locator('.data-quality-tab-container');

      await expect(tabContent).toBeVisible();

      // Verify Data Quality tabs are present
      const dqTabsContainer = tabContent.locator('.data-quality-tabs');

      await expect(dqTabsContainer).toBeVisible();

      // Verify Data Quality tab is active by default
      const dataQualityTabLabel = tabContent
        .locator('.tab-header-container')
        .filter({ hasText: 'Data Quality' });

      await expect(dataQualityTabLabel).toBeVisible();

      // Verify total count badge
      const totalCountBadge = dataQualityTabLabel.locator(
        '.data-quality-tab-count'
      );

      await expect(totalCountBadge).toHaveText('3');

      // Verify test case stats are displayed
      const successStat = adminPage.locator(
        '[data-testid="data-quality-stat-card-success"]'
      );

      const failedStat = adminPage.locator(
        '[data-testid="data-quality-stat-card-failed"]'
      );

      const abortedStat = adminPage.locator(
        '[data-testid="data-quality-stat-card-aborted"]'
      );

      await expect(successStat).toBeVisible();
      await expect(failedStat).toBeVisible();
      await expect(abortedStat).toBeVisible();

      await expect(successStat).toHaveText('1Passed');
      await expect(failedStat).toHaveText('1Failed');
      await expect(abortedStat).toHaveText('1Aborted');

      // Click on failed filter to see failed test cases
      await clickDataQualityStatCard(adminPage, 'failed');

      // Verify test case cards section
      const testCaseCardsSection = tabContent.locator(
        '.test-case-cards-section'
      );

      await expect(testCaseCardsSection).toBeVisible();

      // Verify failed test case card is visible
      const testCaseCards = testCaseCardsSection.locator('.test-case-card');

      await expect(testCaseCards).toHaveCount(1);

      const failedCard = testCaseCards.first();

      await expect(failedCard).toBeVisible();

      // Verify card structure
      const cardHeader = failedCard.locator('.test-case-header');

      await expect(cardHeader).toBeVisible();

      // Verify test case name is a link
      const testCaseNameLink = cardHeader.locator('.test-case-name');

      await expect(testCaseNameLink).toBeVisible();
      await expect(testCaseNameLink).toContainText(testCase2.name);
      await expect(testCaseNameLink).toHaveAttribute('href', /.+/);

      // Verify status badge shows "Failed"
      const statusBadge = cardHeader.locator('.status-badge-label');

      await expect(statusBadge).toBeVisible();
      await expect(statusBadge).toContainText(/failed/i);

      // Verify test case details section
      const testCaseDetails = failedCard.locator('.test-case-details');

      await expect(testCaseDetails).toBeVisible();

      // Verify column name is shown for column-level test
      // Look for the detail item with "Column Name" label that contains the actual column name
      const columnName = (testEntity.entity?.columns as Column[])[0].name;
      const columnDetail = testCaseDetails
        .locator('.test-case-detail-item')
        .filter({ hasText: /column name/i })
        .filter({ hasText: columnName });

      await expect(columnDetail).toBeVisible();
      await expect(columnDetail).toContainText(columnName);

      // Switch to success filter

      await clickDataQualityStatCard(adminPage, 'success');

      // Verify success test case card
      const successCards = testCaseCardsSection.locator('.test-case-card');

      await expect(successCards).toHaveCount(1);

      const successCard = successCards.first();

      await expect(successCard).toContainText(testCase1.name);

      // Verify status badge shows "Success"
      const successBadge = successCard.locator('.status-badge-label');

      await expect(successBadge).toContainText(/success/i);

      await clickDataQualityStatCard(adminPage, 'aborted');
      // Verify aborted test case card
      const abortedCards = testCaseCardsSection.locator('.test-case-card');

      await expect(abortedCards).toHaveCount(1);

      const abortedCard = abortedCards.first();

      await expect(abortedCard).toContainText(testCase3.name);

      // Verify status badge shows "Aborted"
      const abortedBadge = abortedCard.locator('.status-badge-label');

      await expect(abortedBadge).toContainText(/aborted/i);
    } finally {
      await afterAction();
    }
  });

  test('Data Quality Tab - Incidents Tab', async ({ adminPage }) => {
    test.slow(true);

    const { apiContext, afterAction } = await getApiContext(adminPage);

    try {
      // Create test case with incident
      await testEntity.createTestSuiteAndPipelines(apiContext);

      const testCase = await testEntity.createTestCase(apiContext, {
        name: `pw_incident_test_${uuid()}`,
        testDefinition: 'tableRowCountToBeBetween',
        parameterValues: [
          { name: 'minValue', value: 1 },
          { name: 'maxValue', value: 10 },
        ],
      });

      // Add failed test result to create incident
      await testEntity.addTestCaseResult(
        apiContext,
        testCase.fullyQualifiedName,
        {
          testCaseStatus: 'Failed',
          result: 'Row count exceeded maximum',
          timestamp: getCurrentMillis(),
        }
      );

      // Create incident (you might need to add this method to TableClass)
      // For now, we'll just test the UI when incidents exist

      // Navigate to right panel
      await navigateToExploreAndSelectTable(adminPage);

      const summaryPanel = adminPage.locator('.entity-summary-panel-container');
      const dqTab = summaryPanel.getByRole('menuitem', {
        name: /data quality/i,
      });

      await dqTab.click();
      await adminPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });
      await adminPage.waitForLoadState('networkidle');

      const tabContent = summaryPanel.locator('.data-quality-tab-container');

      // Click on Incidents tab
      await navigateToIncidentsTab(adminPage);

      // Verify incidents tab content is visible
      const incidentsTabContent = tabContent.locator('.incidents-tab-content');

      await expect(incidentsTabContent).toBeVisible();

      // Verify incident stats container
      const incidentStatsContainer = incidentsTabContent.locator(
        '.incidents-stats-container'
      );

      await expect(incidentStatsContainer).toBeVisible();

      // Verify incident stat cards
      const newCard = incidentStatsContainer.locator(
        '.incident-stat-card.new-card'
      );

      await expect(newCard).toBeVisible();
      await expect(
        incidentStatsContainer.locator('.incident-stat-card.ack-card')
      ).toBeVisible();
      await expect(
        incidentStatsContainer.locator('.incident-stat-card.assigned-card')
      ).toBeVisible();
      await expect(
        incidentStatsContainer.locator('.resolved-section')
      ).toBeVisible();

      // Click on a filter to see incidents
      const activeFilter = await newCard.evaluate((el) =>
        el.classList.contains('active')
      );

      if (!activeFilter) {
        await newCard.click();
        await adminPage.waitForSelector('[data-testid="loader"]', {
          state: 'detached',
        });
      }

      // Verify incident cards section (may be empty if no incidents)
      const incidentCardsSection = incidentsTabContent.locator(
        '.incident-cards-section'
      );

      await expect(incidentCardsSection).toBeVisible();

      // If incidents exist, verify card structure
      const incidentCards = incidentCardsSection.locator('.test-case-card');
      const cardCount = await incidentCards.count();

      if (cardCount > 0) {
        const firstIncidentCard = incidentCards.first();

        // Verify assignee info
        const assigneeSection = firstIncidentCard
          .locator('.test-case-detail-item')
          .filter({ hasText: /assignee/i });

        await expect(assigneeSection).toBeVisible();
      }
    } finally {
      await afterAction();
    }
  });

  test('Data Quality Tab - Incidents Tab - Test Case Link Navigation', async ({
    adminPage,
  }) => {
    test.slow(true);

    const { apiContext, afterAction } = await getApiContext(adminPage);

    try {
      // Create a test case
      await testEntity.createTestSuiteAndPipelines(apiContext);

      const testCase = await testEntity.createTestCase(apiContext, {
        name: `pw_link_test_${uuid()}`,
        testDefinition: 'tableRowCountToBeBetween',
        parameterValues: [
          { name: 'minValue', value: 1 },
          { name: 'maxValue', value: 100 },
        ],
      });

      await testEntity.addTestCaseResult(
        apiContext,
        testCase.fullyQualifiedName,
        { testCaseStatus: 'Success', timestamp: getCurrentMillis() }
      );

      // Navigate to right panel
      await navigateToExploreAndSelectTable(adminPage);

      const summaryPanel = adminPage.locator('.entity-summary-panel-container');
      const dqTab = summaryPanel.getByRole('menuitem', {
        name: /data quality/i,
      });

      await dqTab.click();
      await adminPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });
      await adminPage.waitForLoadState('networkidle');

      const tabContent = summaryPanel.locator('.data-quality-tab-container');

      // Click on test case card link
      const testCaseLink = tabContent
        .locator(`.test-case-name[data-testid="test-case-${testCase.name}"]`)
        .first();

      // Verify link has correct href
      const href = await testCaseLink.getAttribute('href');

      expect(href).toContain('test-case');
      expect(href).toContain(testCase.fullyQualifiedName);

      // Verify link opens in new tab
      const target = await testCaseLink.getAttribute('target');

      expect(target).toBe('_blank');
    } finally {
      await afterAction();
    }
  });

  test('Admin - Custom Properties Tab - View Custom Properties', async ({
    adminPage,
  }) => {
    test.slow(true);

    const { apiContext, afterAction } = await getApiContext(adminPage);

    // Create custom properties for Table entity via API
    const { customProperties } = await createCustomPropertyForEntity(
      apiContext,
      EntityTypeEndpoint.Table
    );

    // Set custom property values on the entity via PATCH API
    const propertyTypes = Object.keys(customProperties).slice(0, 3);
    const extensionData: Record<string, string> = {};

    for (const propertyType of propertyTypes) {
      const { property, value } = customProperties[propertyType];
      const propertyName = property.name as string;
      extensionData[propertyName] = value;
    }

    // Patch the entity to add custom property values
    await testEntity.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/extension',
          value: extensionData,
        },
      ],
    });

    // Navigate to explore and select the entity
    await navigateToExploreAndSelectTable(adminPage);

    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const cpTab = summaryPanel.getByRole('menuitem', {
      name: /custom propert/i,
    });

    await cpTab.click();
    await adminPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const tabContent = summaryPanel.locator(
      '.entity-summary-panel-tab-content'
    );

    await expect(tabContent).toBeVisible();

    const customPropertiesContainer = tabContent.locator(
      '.custom-properties-list'
    );

    await expect(customPropertiesContainer).toBeVisible();

    const displayedPropertyCards = customPropertiesContainer.locator(
      '.custom-property-item'
    );
    const displayedCount = await displayedPropertyCards.count();

    // Verify at least some properties are displayed
    expect(displayedCount).toBeGreaterThan(0);

    for (let i = 0; i < displayedCount; i++) {
      const propertyCard = displayedPropertyCards.nth(i);

      await expect(propertyCard).toBeVisible();

      const propertyNameElement = propertyCard.locator('.property-name');

      await expect(propertyNameElement).toBeVisible();

      const propertyValueElement = propertyCard.locator('.property-value');

      await expect(propertyValueElement).toBeVisible();
    }

    await afterAction();
  });

  test('Admin - Custom Properties Tab - Search Functionality', async ({
    adminPage,
  }) => {
    test.slow(true);

    const { apiContext, afterAction } = await getApiContext(adminPage);

    // Create custom properties for Table entity via API
    const { customProperties } = await createCustomPropertyForEntity(
      apiContext,
      EntityTypeEndpoint.Table
    );

    // Set some custom property values
    const propertyTypes = Object.keys(customProperties).slice(0, 5);
    const extensionData: Record<string, string> = {};

    for (const propertyType of propertyTypes) {
      const { property, value } = customProperties[propertyType];
      const propertyName = property.name as string;
      extensionData[propertyName] = value;
    }

    await testEntity.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/extension',
          value: extensionData,
        },
      ],
    });

    // Navigate to explore and select the entity
    await navigateToExploreAndSelectTable(adminPage);

    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const cpTab = summaryPanel.getByRole('menuitem', {
      name: /custom propert/i,
    });

    await cpTab.click();
    await adminPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const tabContent = summaryPanel.locator(
      '.entity-summary-panel-tab-content'
    );

    // Verify search bar is present
    const searchBar = tabContent.locator('.searchbar-container input');

    await expect(searchBar).toBeVisible();

    // Get first property name to search for
    const firstPropertyName = Object.values(customProperties)[0].property
      .name as string;

    // Perform search
    await searchBar.fill(firstPropertyName);

    // Verify filtered results
    const visibleProperties = tabContent.locator('.custom-property-item');

    // Wait for filtered results to appear
    await expect(visibleProperties.first()).toBeVisible();

    const count = await visibleProperties.count();

    // Should show only matching property
    expect(count).toBeGreaterThan(0);

    // Verify the property name is visible
    await expect(
      visibleProperties.first().locator('.property-name')
    ).toHaveText(firstPropertyName);

    // Clear search and verify all properties show again
    await searchBar.clear();

    // Wait for all properties to reappear
    await expect(
      tabContent.locator('.custom-property-item').first()
    ).toBeVisible();

    // Test search with no results
    await searchBar.fill('nonexistent-property-xyz123');

    // Verify no results message appears (uses translation: "No {{entity}} found for {{name}}")
    await expect(
      tabContent.getByText(/No Custom Properties found for/i)
    ).toBeVisible();

    await afterAction();
  });

  test('Admin - Custom Properties Tab - Different Property Types Display', async ({
    adminPage,
  }) => {
    test.slow(true);

    const { apiContext, afterAction } = await getApiContext(adminPage);

    // Create custom properties for Table entity via API
    const { customProperties } = await createCustomPropertyForEntity(
      apiContext,
      EntityTypeEndpoint.Table
    );

    // Test different property types
    const propertyTypesToTest = [
      'string',
      'integer',
      'markdown',
      'enum',
      'email',
      'number',
      'duration',
      'sqlQuery',
      'timestamp',
      'entityReference',
      'entityReferenceList',
      'timeInterval',
      'time-cp',
      'date-cp',
      'dateTime-cp',
      'table-cp',
    ];

    // Navigate to the entity details page to set custom property values
    await adminPage.goto(
      `/table/${testEntity.entityResponseData?.['fullyQualifiedName']}`
    );
    await adminPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    // Click on custom properties tab to set values
    await adminPage.click('[data-testid="custom_properties"]');
    await adminPage.waitForLoadState('networkidle');

    // Set values for each property type through the UI
    for (const type of propertyTypesToTest) {
      if (customProperties[type]) {
        const { property, value } = customProperties[type];
        const propertyName = property.name as string;

        await setValueForProperty({
          page: adminPage,
          propertyName,
          value,
          propertyType: type,
          endpoint: EntityTypeEndpoint.Table,
        });
      }
    }

    // Now navigate to explore and verify in right panel
    await navigateToExploreAndSelectTable(adminPage);

    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const cpTab = summaryPanel.getByRole('menuitem', {
      name: /custom propert/i,
    });

    await cpTab.click();
    await adminPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const tabContent = summaryPanel.locator(
      '.entity-summary-panel-tab-content'
    );

    // Verify each property type is displayed correctly in the read-only view
    for (const type of propertyTypesToTest) {
      if (customProperties[type]) {
        const { property } = customProperties[type];
        const propertyName = property.name as string;
        const propertyWithDisplay = property as CustomProperty & {
          displayName?: string;
        };
        const displayName = propertyWithDisplay.displayName || propertyName;

        const propertyCard = tabContent.locator(
          `[data-testid="custom-property-${propertyName}-card"]`
        );

        await expect(propertyCard).toBeVisible();

        const propertyNameElement = propertyCard.locator(
          `[data-testid="property-${propertyName}-name"]`
        );

        await expect(propertyNameElement).toContainText(displayName);

        // Verify value is displayed (not "Not set")
        const valueElement = propertyCard.locator('[data-testid="value"]');

        await expect(valueElement).toBeVisible();
      }
    }

    await afterAction();
  });

  test('Admin - Custom Properties Tab - Empty State', async ({ adminPage }) => {
    // Navigate to explore without creating custom properties
    await navigateToExploreAndSelectTable(adminPage);

    const summaryPanel = adminPage.locator('.entity-summary-panel-container');
    const cpTab = summaryPanel.getByRole('menuitem', {
      name: /custom propert/i,
    });

    await cpTab.click();
    await adminPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const tabContent = summaryPanel.locator(
      '.entity-summary-panel-tab-content'
    );

    // Check if empty state is shown (when no custom properties are defined for the entity type)
    const noDataPlaceholder = tabContent.locator(
      '[data-testid="no-data-placeholder"]'
    );

    if (await noDataPlaceholder.isVisible()) {
      // Verify empty state message
      await expect(noDataPlaceholder).toContainText(/no custom propert/i);
      await expect(noDataPlaceholder.locator('a')).toHaveAttribute(
        'href',
        /.+/
      );
      await expect(noDataPlaceholder.locator('a')).toHaveAttribute(
        'target',
        '_blank'
      );
    }
  });
});

test.describe('Right Entity Panel - Data Steward User Flow', () => {
  test.beforeEach('Navigate to explore page', async ({ dataStewardPage }) => {
    await navigateToExploreAndSelectTable(dataStewardPage);
  });

  test('Data Steward - Overview Tab - Description Section - Add and Update', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const descriptionSection = summaryPanel.locator('.description-section');

    await expect(descriptionSection).toBeVisible();

    await updateDescription(
      dataStewardPage,
      'Data Steward updated description',
      false,
      ''
    );

    await expect(
      dataStewardPage.getByTestId('markdown-editor')
    ).not.toBeVisible();
    await expect(
      dataStewardPage.getByText(/Description updated successfully/)
    ).toBeVisible();
  });

  test('Data Steward - Overview Tab - Owners Section - Add and Update', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const ownersSection = summaryPanel.locator('.owners-section');

    await expect(ownersSection).toBeVisible();

    await addOwnerWithoutValidation({
      page: dataStewardPage,
      owner: 'admin',
      type: 'Users',
      initiatorId: 'edit-owners',
    });

    await expect(
      dataStewardPage.getByText(/Owners updated successfully/i)
    ).toBeVisible();
  });

  test('Data Steward - Overview Tab - Tier Section - Add and Update', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const tierSection = summaryPanel.locator('.tier-section');

    await expect(tierSection).toBeVisible();

    await assignTier(
      dataStewardPage,
      'Tier2',
      EntityTypeEndpoint.Table,
      'edit-icon-tier'
    );

    await expect(
      dataStewardPage.getByText(/Tier updated successfully/i)
    ).toBeVisible();
  });

  test('Data Steward - Overview Tab - Tags Section - Add and Update', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const tagsSection = summaryPanel.locator('.tags-section');

    await tagsSection.scrollIntoViewIfNeeded();

    await expect(tagsSection).toBeVisible();

    await editTags(dataStewardPage, 'NonSensitive', true);

    await expect(
      dataStewardPage.getByText(/Tags updated successfully/i)
    ).toBeVisible();
  });

  test('Data Steward - Overview Tab - Glossary Terms Section - Add and Update', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const glossarySection = summaryPanel.locator('.glossary-terms-section');

    await expect(glossarySection).toBeVisible();

    await clearAndAddGlossaryTerms(dataStewardPage);

    await expect(
      dataStewardPage.getByText(/Glossary terms updated successfully/i)
    ).toBeVisible();
  });

  test('Data Steward - Overview Tab - Should NOT have permissions for Domains', async ({
    dataStewardPage,
  }) => {
    await expect(dataStewardPage.getByTestId('add-domain')).not.toBeVisible();
    await expect(
      dataStewardPage.getByTestId('edit-data-products')
    ).not.toBeVisible();
  });

  test('Data Steward - Schema Tab - View Schema', async ({
    dataStewardPage,
  }) => {
    const schemaTab = dataStewardPage.locator('[data-testid="schema-tab"]');

    await schemaTab.click();
    await dataStewardPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const tabContent = dataStewardPage.locator(
      '[data-testid="entity-details-section"]'
    );

    await expect(tabContent).toBeVisible();

    for (const child of testEntity.children as Column[]) {
      const fieldCard = dataStewardPage.locator(
        `[data-testid="field-card-${child.name}"]`
      );

      await expect(fieldCard).toBeVisible();

      const dataTypeBadge = fieldCard.locator(
        `[data-testid="data-type-text-${child.dataType}"]`
      );

      await expect(dataTypeBadge).toBeVisible();

      const fieldName = fieldCard.locator(
        `[data-testid="field-name-${child.name}"]`
      );

      await expect(fieldName).toHaveText(child.name);

      const fieldDescription = fieldCard.locator(
        `[data-testid="field-description-${child.name}"]`
      );

      await expect(fieldDescription).toBeVisible();
      await expect(fieldDescription).toContainText(child.description ?? '');
    }
  });

  test('Data Steward - Lineage Tab - No Lineage', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const lineageTab = summaryPanel.getByRole('menuitem', {
      name: /lineage/i,
    });

    await lineageTab.click();
    await dataStewardPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const tabContent = summaryPanel.locator(
      '.entity-summary-panel-tab-content'
    );

    await expect(tabContent).toBeVisible();

    // When there's no lineage, verify empty state
    await expect(dataStewardPage.getByText(/Lineage not found/i)).toBeVisible();
  });

  test('Data Steward - Data Quality Tab - No Test Cases', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const dqTab = summaryPanel.getByRole('menuitem', {
      name: /data quality/i,
    });

    await dqTab.click();
    await dataStewardPage.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
    });

    const tabContent = summaryPanel.locator('.data-quality-tab-container');

    await expect(tabContent).toBeVisible();

    // Verify empty state message
    await expect(
      dataStewardPage.getByText(
        /No data quality results found.*Schedule or run tests to see results/i
      )
    ).toBeVisible();
  });

  test('Data Steward - Custom Properties Tab - View Custom Properties', async ({
    dataStewardPage,
  }) => {
    const summaryPanel = dataStewardPage.locator(
      '.entity-summary-panel-container'
    );
    const cpTab = summaryPanel.getByRole('menuitem', {
      name: /custom propert/i,
    });

    if (await cpTab.isVisible()) {
      await cpTab.click();
      await dataStewardPage.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      const tabContent = summaryPanel.locator(
        '.entity-summary-panel-tab-content'
      );

      await expect(tabContent).toBeVisible();

      // Verify custom properties container is visible (if custom properties exist from Admin test)
      const customPropertiesContainer =
        dataStewardPage.getByTestId('custom_properties');

      // Custom properties should be visible if they were created by Admin
      if (await customPropertiesContainer.isVisible()) {
        await expect(customPropertiesContainer).toBeVisible();

        // Verify at least one custom property card is displayed
        const propertyCards = customPropertiesContainer.locator(
          '[data-testid^="custom-property-"]'
        );
        const cardCount = await propertyCards.count();

        if (cardCount > 0) {
          const firstCard = propertyCards.first();

          await expect(firstCard).toBeVisible();

          // Verify property name and value elements exist
          await expect(firstCard.locator('.property-name')).toBeVisible();
          await expect(firstCard.locator('.property-value')).toBeVisible();
        }
      }
    }
  });
});

test.describe('Right Entity Panel - Data Consumer User Flow', () => {
  test.beforeEach('Navigate to explore page', async ({ dataConsumerPage }) => {
    await navigateToExploreAndSelectTable(dataConsumerPage);
  });

  test('Data Consumer - Overview Tab - Description Section - Add and Update', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const descriptionSection = summaryPanel.locator('.description-section');

    await expect(descriptionSection).toBeVisible();

    await updateDescription(
      dataConsumerPage,
      'Data Consumer updated description',
      false,
      ''
    );

    await expect(
      dataConsumerPage.getByTestId('markdown-editor')
    ).not.toBeVisible();
    await expect(
      dataConsumerPage.getByText(/Description updated successfully/)
    ).toBeVisible();
  });

  test('Data Consumer - Overview Tab - Owners Section - View Owners', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    await waitForAllLoadersToDisappear(dataConsumerPage, 'loader');
    const ownersSection = summaryPanel.locator('.owners-section');

    await expect(ownersSection).toBeVisible();
  });

  test('Data Consumer - Overview Tab - Tier Section - Add and Update', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const tierSection = summaryPanel.locator('.tier-section');

    await expect(tierSection).toBeVisible();

    await assignTier(
      dataConsumerPage,
      'Tier3',
      EntityTypeEndpoint.Table,
      'edit-icon-tier'
    );

    await expect(
      dataConsumerPage.getByText(/Tier updated successfully/i)
    ).toBeVisible();
  });

  test('Data Consumer - Overview Tab - Tags Section - Add and Update', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const tagsSection = summaryPanel.locator('.tags-section');

    await expect(tagsSection).toBeVisible();

    await editTags(dataConsumerPage, 'NonSensitive', true);

    await expect(
      dataConsumerPage.getByText(/Tags updated successfully/i)
    ).toBeVisible();
  });

  test('Data Consumer - Overview Tab - Glossary Terms Section - Add and Update', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const glossarySection = summaryPanel.locator('.glossary-terms-section');

    await expect(glossarySection).toBeVisible();

    await clearAndAddGlossaryTerms(dataConsumerPage);

    await expect(
      dataConsumerPage.getByText(/Glossary terms updated successfully/i)
    ).toBeVisible();
  });

  test('Data Consumer - Overview Tab - Should NOT have permissions for Domains & Data Products', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const domainsSection = summaryPanel.locator('.domains-section');

    await expect(domainsSection).toBeVisible();
    await expect(summaryPanel.getByTestId('add-domain')).not.toBeVisible();

    await expect(
      summaryPanel.getByTestId('edit-data-products')
    ).not.toBeVisible();
  });

  test('Data Consumer - Schema Tab - View Schema', async ({
    dataConsumerPage,
  }) => {
    await navigateToEntityPanelTab(dataConsumerPage, 'schema');

    const tabContent = dataConsumerPage.locator(
      '[data-testid="entity-details-section"]'
    );

    await expect(tabContent).toBeVisible();

    for (const child of testEntity.children as Column[]) {
      const fieldCard = dataConsumerPage.locator(
        `[data-testid="field-card-${child.name}"]`
      );

      await expect(fieldCard).toBeVisible();

      const dataTypeBadge = fieldCard.locator(
        `[data-testid="data-type-text-${child.dataType}"]`
      );

      await expect(dataTypeBadge).toBeVisible();

      const fieldName = fieldCard.locator(
        `[data-testid="field-name-${child.name}"]`
      );

      await expect(fieldName).toHaveText(child.name);

      const fieldDescription = fieldCard.locator(
        `[data-testid="field-description-${child.name}"]`
      );

      await expect(fieldDescription).toBeVisible();
      await expect(fieldDescription).toContainText(child.description ?? '');
    }
  });

  test('Data Consumer - Lineage Tab - No Lineage', async ({
    dataConsumerPage,
  }) => {
    await navigateToEntityPanelTab(dataConsumerPage, 'lineage');

    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const tabContent = summaryPanel.locator(
      '.entity-summary-panel-tab-content'
    );

    await expect(tabContent).toBeVisible();

    // When there's no lineage, verify empty state
    await expect(
      dataConsumerPage.getByText(/Lineage not found/i)
    ).toBeVisible();
  });

  test('Data Consumer - Data Quality Tab - No Test Cases', async ({
    dataConsumerPage,
  }) => {
    await navigateToEntityPanelTab(dataConsumerPage, 'data quality');

    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const tabContent = summaryPanel.locator('.data-quality-tab-container');

    await expect(tabContent).toBeVisible();

    // Verify empty state message
    await expect(
      dataConsumerPage.getByText(
        /No data quality results found.*Schedule or run tests to see results/i
      )
    ).toBeVisible();
  });

  test('Data Consumer - Data Quality Tab - Incidents Empty State', async ({
    dataConsumerPage,
  }) => {
    await navigateToEntityPanelTab(dataConsumerPage, 'data quality');

    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const tabContent = summaryPanel.locator('.data-quality-tab-container');

    await expect(tabContent).toBeVisible();

    // Verify empty state message
    await expect(
      dataConsumerPage.getByText(
        /No data quality results found.*Schedule or run tests to see results/i
      )
    ).toBeVisible();
  });

  test('Data Consumer - Custom Properties Tab - View Custom Properties', async ({
    dataConsumerPage,
  }) => {
    const summaryPanel = dataConsumerPage.locator(
      '.entity-summary-panel-container'
    );
    const cpTab = summaryPanel.getByRole('menuitem', {
      name: /custom propert/i,
    });

    if (await cpTab.isVisible()) {
      await navigateToEntityPanelTab(dataConsumerPage, 'custom property');

      const tabContent = summaryPanel.locator(
        '.entity-summary-panel-tab-content'
      );

      await expect(tabContent).toBeVisible();

      // Verify custom properties container is visible (if custom properties exist from Admin test)
      const customPropertiesContainer =
        dataConsumerPage.getByTestId('custom_properties');

      // Custom properties should be visible if they were created by Admin
      if (await customPropertiesContainer.isVisible()) {
        await expect(customPropertiesContainer).toBeVisible();

        // Verify at least one custom property card is displayed
        const propertyCards = customPropertiesContainer.locator(
          '[data-testid^="custom-property-"]'
        );
        const cardCount = await propertyCards.count();

        if (cardCount > 0) {
          const firstCard = propertyCards.first();

          await expect(firstCard).toBeVisible();

          // Verify property name and value elements exist
          await expect(firstCard.locator('.property-name')).toBeVisible();
          await expect(firstCard.locator('.property-value')).toBeVisible();
        }
      }
    }
  });
});
