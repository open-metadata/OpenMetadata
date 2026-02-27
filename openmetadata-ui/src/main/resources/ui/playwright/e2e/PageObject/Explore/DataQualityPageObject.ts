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

import { expect, Locator } from '@playwright/test';
import { RightPanelBase } from './OverviewPageObject';
import { RightPanelPageObject } from './RightPanelPageObject';

/**
 * PROPER PAGE OBJECT PATTERN FOR DATA QUALITY TAB
 *
 * Key Principles:
 * 1. All locators are scoped to the component (no page-level selectors)
 * 2. Methods return the page object for chaining (fluent interface)
 * 3. Clear separation: Actions vs Getters vs Verifications
 * 4. Private locators, public methods only
 * 5. Descriptive method names following BDD style
 */
export class DataQualityPageObject extends RightPanelBase {
  // ============ PRIVATE LOCATORS (scoped to container) ============
  private readonly container: Locator;
  private readonly incidentsTab: Locator;
  private readonly successStatCard: Locator;
  private readonly failedStatCard: Locator;
  private readonly abortedStatCard: Locator;
  private readonly testCaseCardsSection: Locator;
  private readonly testCaseCards: Locator;
  private readonly nameLink: Locator;
  private readonly testCaseStatusBadge: Locator;
  private readonly searchBar: Locator;
  private readonly incidentsTabContent: Locator;
  private readonly noDataPlaceholder: Locator;

  constructor(rightPanel: RightPanelPageObject) {
    super(rightPanel);
    this.container = this.getSummaryPanel().locator(
      '.data-quality-tab-container'
    );

    // All other locators are scoped to the container
    this.incidentsTab = this.container
      .locator('.ant-tabs-tab')
      .filter({ hasText: /incident/i });
    this.successStatCard = this.container.locator(
      '[data-testid="data-quality-stat-card-success"]'
    );
    this.failedStatCard = this.container.locator(
      '[data-testid="data-quality-stat-card-failed"]'
    );
    this.abortedStatCard = this.container.locator(
      '[data-testid="data-quality-stat-card-aborted"]'
    );
    this.testCaseCardsSection = this.container.locator(
      '.test-case-cards-section, [data-testid="test-case-cards-section"]'
    );
    this.testCaseCards = this.testCaseCardsSection.locator('.test-case-card');
    this.nameLink = this.testCaseCards
      .locator('.test-case-name, [class*="name"], a')
      .first();
    this.testCaseStatusBadge = this.testCaseCards.locator(
      '.test-case-status-section .status-badge-label'
    );
    this.searchBar = this.container.getByTestId('searchbar');
    this.incidentsTabContent = this.container.locator('.incidents-tab-content');
    this.noDataPlaceholder = this.container
      .locator(
        '[data-testid="no-data-placeholder"], .no-data-placeholder, .ant-empty'
      )
      .first();
  }

  /**
   * Navigate to the Data Quality tab
   * @returns DataQualityPageObject for method chaining
   */
  async navigateToDataQualityTab(): Promise<DataQualityPageObject> {
    await this.rightPanel.navigateToTab('data quality');
    await this.waitForLoadersToDisappear();
    return this;
  }

  /**
   * Reusable assertion: navigate to Data Quality tab and assert tab + stat cards visible.
   */
  async assertContent(): Promise<void> {
    await this.navigateToDataQualityTab();
    await this.shouldBeVisible();
    await this.shouldShowAllStatCards();
  }

  /**
   * Navigate to the Incidents sub-tab within Data Quality
   * @returns DataQualityPageObject for method chaining
   */
  async navigateToIncidentsTab(): Promise<DataQualityPageObject> {
    await this.incidentsTab.click();
    await this.waitForLoadersToDisappear();
    return this;
  }

  // ============ ACTION METHODS (Fluent Interface) ============

  /**
   * Type into the data quality search bar and wait for results to update.
   */
  async searchFor(text: string): Promise<DataQualityPageObject> {
    await this.searchBar.fill(text);
    await this.page.waitForTimeout(300); // Wait for debounce
    return this;
  }

  /**
   * Clear the data quality search bar.
   */
  async clearSearch(): Promise<DataQualityPageObject> {
    await this.searchBar.clear();
    await this.page.waitForTimeout(300); // Wait for debounce
    return this;
  }

  /**
   * Click on a data quality stat card to filter test cases
   * @param statType - Type of stat card ('success', 'failed', 'aborted')
   * @returns DataQualityPageObject for method chaining
   */
  async clickStatCard(
    statType: 'success' | 'failed' | 'aborted'
  ): Promise<DataQualityPageObject> {
    const statCard = this.getStatCardLocator(statType);
    await statCard.click();
    await this.waitForLoadersToDisappear();
    return this;
  }

  /**
   * Click on a test case link to navigate to its details page
   * @param testCaseName - Name of the test case
   * @returns DataQualityPageObject for method chaining
   */
  async clickTestCaseLink(
    testCaseName: string
  ): Promise<DataQualityPageObject> {
    const testCaseLink = this.container
      .locator(`.test-case-name[data-testid="test-case-${testCaseName}"]`)
      .first();
    await testCaseLink.waitFor({ state: 'visible' });
    await testCaseLink.click();
    await this.page.waitForLoadState('networkidle');
    return this;
  }

  /**
   * Filter test cases or incidents by clicking stat cards
   * @param statType - Type of stat to filter by
   * @returns DataQualityPageObject for method chaining
   */
  async filterByStatus(
    statType: 'success' | 'failed' | 'aborted'
  ): Promise<DataQualityPageObject> {
    return this.clickStatCard(statType);
  }

  // ============ PRIVATE HELPERS ============

  /**
   * Get a specific stat card locator
   * @param statType - Type of stat card
   */
  private getStatCardLocator(
    statType: 'success' | 'failed' | 'aborted'
  ): Locator {
    switch (statType) {
      case 'success':
        return this.successStatCard;
      case 'failed':
        return this.failedStatCard;
      case 'aborted':
        return this.abortedStatCard;
      default:
        throw new Error(`Invalid stat type: ${statType}`);
    }
  }

  // ============ VERIFICATION METHODS (BDD Style) ============

  /**
   * Verify that the Data Quality tab is currently visible
   */
  async shouldBeVisible(): Promise<void> {
    await this.container.waitFor({ state: 'visible' });
  }

  /**
   * Verify that all stat cards are visible
   */
  async shouldShowAllStatCards(): Promise<void> {
    await this.successStatCard.waitFor({ state: 'visible' });
    await this.failedStatCard.waitFor({ state: 'visible' });
    await this.abortedStatCard.waitFor({ state: 'visible' });
  }

  /**
   * Verify a stat card shows specific text
   * @param statType - Type of stat card
   * @param expectedText - Text to verify (partial match)
   */
  async shouldShowStatCardWithText(
    statType: 'success' | 'failed' | 'aborted',
    expectedText: string
  ): Promise<void> {
    const statCard = this.getStatCardLocator(statType);
    await statCard.waitFor({ state: 'visible' });
    await expect(statCard).toContainText(expectedText);
  }

  /**
   * Verify a stat card shows specific count
   * @param statType - Type of stat card
   * @param expectedCount - Expected count to verify
   */
  async verifyStatCardCount(
    statType: 'success' | 'failed' | 'aborted',
    expectedCount: number
  ): Promise<void> {
    const statCard = this.getStatCardLocator(statType);
    await statCard.waitFor({ state: 'visible' });
    await expect(statCard).toContainText(expectedCount.toString());
  }

  /**
   * Verify a test case card with specific name and status
   * @param testCaseName - Expected test case name
   * @param expectedStatus - Expected status
   */
  async verifyTestCaseCard(
    testCaseName: string,
    expectedStatus: string
  ): Promise<void> {
    const cards = this.testCaseCards;
    const card = cards.filter({ hasText: testCaseName }).first();
    await card.waitFor({ state: 'visible' });

    const statusBadge = card.locator('.status-badge-label');
    await statusBadge.waitFor({ state: 'visible' });
    await expect(statusBadge).toContainText(new RegExp(expectedStatus, 'i'));
  }

  /**
   * Verify test case details (column name, entity link, etc.)
   * @param testCaseName - Name of the test case
   * @param details - Object containing expected details
   */
  async verifyTestCaseDetails(
    testCaseName: string,
    details: { columnName?: string; entityLink?: string }
  ): Promise<void> {
    const card = this.testCaseCards.filter({ hasText: testCaseName }).first();
    await card.waitFor({ state: 'visible' });

    if (details.columnName) {
      const columnDetail = card
        .locator('.test-case-detail-item, [class*="detail"]')
        .filter({ hasText: /column name/i })
        .filter({ hasText: details.columnName });
      await expect(columnDetail).toBeVisible();
      await expect(columnDetail).toContainText(details.columnName);
    }

    if (details.entityLink) {
      const testCaseLink = card.locator('.test-case-name');
      await expect(testCaseLink).toHaveAttribute(
        'href',
        new RegExp(details.entityLink)
      );
    }
  }

  /**
   * Verify incident card details
   * @param incidentData - Object containing expected incident data
   */
  async verifyIncidentCard(incidentData: {
    status?: string;
    hasAssignee?: boolean;
  }): Promise<void> {
    await this.incidentsTabContent.waitFor({ state: 'visible' });

    const incidentCard = this.incidentsTabContent
      .locator('.test-case-card')
      .first();
    await expect(incidentCard).toBeVisible();

    if (incidentData.status) {
      const statusBadge = incidentCard.locator('.status-badge-label');
      await expect(statusBadge).toContainText('New');
    }

    if (incidentData.hasAssignee !== undefined) {
      const assigneeSection = incidentCard
        .locator('.test-case-detail-item')
        .filter({ hasText: /assignee/i });

      await expect(assigneeSection).toBeVisible();

      if (incidentData.hasAssignee) {
        await expect(
          assigneeSection.getByTestId('no-owner-icon')
        ).not.toBeVisible();
      } else {
        await expect(
          assigneeSection.getByTestId('no-owner-icon')
        ).toBeVisible();
      }
    }
  }

  /**
   * Verify the number of test case cards shown
   * @param expectedCount - Expected number of test case cards
   */
  async shouldShowTestCaseCardsCount(expectedCount: number): Promise<void> {
    await expect(this.testCaseCards).toHaveCount(expectedCount);
  }

  /**
   * Verify that no test cases are shown, e.g. after a search with no matches
   */
  async shouldShowNoResults(): Promise<void> {
    await expect(this.testCaseCards).toHaveCount(0);
    await expect(this.noDataPlaceholder).toBeVisible();
  }

  /**
   * Verify a test case card shows specific name
   * @param testCaseName - Expected test case name
   * @param cardIndex - Index of the test case card (default: 0)
   */
  async shouldShowTestCaseCardWithName(
    testCaseName: string,
    cardIndex: number = 0
  ): Promise<void> {
    // Use semantic selectors - find card by index and check name
    const cards = this.testCaseCards;
    const card = cards.nth(cardIndex);
    await card.waitFor({ state: 'visible' });
    const nameElement = this.nameLink.nth(cardIndex);
    await nameElement.waitFor({ state: 'visible' });
    await expect(nameElement).toContainText(testCaseName);
  }

  /**
   * Verify a test case card shows specific status
   * @param status - Expected status ('success', 'failed', 'aborted')
   * @param cardIndex - Index of the test case card (default: 0)
   */
  async shouldShowTestCaseCardWithStatus(
    status: 'success' | 'failed' | 'aborted',
    cardIndex: number = 0
  ): Promise<void> {
    const card = this.testCaseCards.nth(cardIndex);
    await card.waitFor({ state: 'visible' });
    const expectedStatusText: Record<'success' | 'failed' | 'aborted', string> =
      {
        success: 'Success',
        failed: 'Failed',
        aborted: 'Aborted',
      };
    const expectedBadgeClass: Record<'success' | 'failed' | 'aborted', string> =
      {
        success: 'success',
        failed: 'failure',
        aborted: 'aborted',
      };
    const statusBadge = this.testCaseStatusBadge.nth(cardIndex);
    await statusBadge.waitFor({ state: 'visible' });
    await expect(statusBadge).toHaveText(expectedStatusText[status]);
    await expect(statusBadge).toHaveClass(
      new RegExp(`\\b${expectedBadgeClass[status]}\\b`)
    );
  }

  /**
   * Verify a test case card shows specific column name
   * @param columnName - Expected column name
   * @param cardIndex - Index of the test case card (default: 0)
   */
  async shouldShowTestCaseCardWithColumnName(
    columnName: string,
    cardIndex: number = 0
  ): Promise<void> {
    // Use semantic selectors - find card and look for column name in details
    const cards = this.testCaseCards;
    const card = cards.nth(cardIndex);
    await card.waitFor({ state: 'visible' });
    const columnDetail = card
      .locator('.detail-item, .test-case-detail, [class*="detail"]')
      .filter({ hasText: /column name|column/i })
      .filter({ hasText: columnName });
    await columnDetail.waitFor({ state: 'visible' });
  }

  /**
   * Verify a test case card has a working link
   * @param cardIndex - Index of the test case card (default: 0)
   */
  async shouldShowTestCaseCardWithLink(cardIndex: number = 0): Promise<void> {
    // Use semantic selectors - find card and check for link
    const cards = this.testCaseCards;
    const card = cards.nth(cardIndex);
    await card.waitFor({ state: 'visible' });
    await this.nameLink.nth(cardIndex).waitFor({ state: 'visible' });
    await expect(this.nameLink.nth(cardIndex)).toHaveAttribute('href', /.+/);
  }

  /**
   * Verify incidents tab is available
   */
  async shouldShowIncidentsTab(): Promise<void> {
    await this.incidentsTab.waitFor({ state: 'visible' });
  }

  /**
   * Verify incidents tab is not available
   */
  async shouldNotShowIncidentsTab(): Promise<void> {
    await this.incidentsTab.waitFor({ state: 'hidden' });
  }

  /**
   * Verify that the permission placeholder is shown when user lacks ViewTests permission
   */
  async shouldShowPermissionPlaceholder(): Promise<void> {
    const placeholder = this.container.locator(
      '[data-testid="permission-error-placeholder"]'
    );
    await expect(placeholder).toBeVisible();
  }

  /**
   * Assert internal fields of the Data Quality tab for Table (incidents tab presence).
   * Use only when Data Quality tab is available (e.g. Table). Call after navigating to Data Quality tab.
   *
   * Note: The stat cards (success / failed / aborted) are intentionally not asserted here.
   * They are conditionally rendered only when the entity has at least one completed test run.
   * Test entities used in this suite are freshly created with no runs, so the stat cards are
   * absent from the DOM. Use assertContent() when you need to verify stat cards against an
   * entity that has actual test-run data.
   */
  async assertInternalFieldsForTable(assetType?: string): Promise<void> {
    const tabLabel = 'Data Quality';
    const prefix = assetType ? `[Asset: ${assetType}] [Tab: ${tabLabel}] ` : '';
    await expect(
      this.incidentsTab,
      `${prefix}Missing: incidents tab`
    ).toBeVisible();
  }
}
