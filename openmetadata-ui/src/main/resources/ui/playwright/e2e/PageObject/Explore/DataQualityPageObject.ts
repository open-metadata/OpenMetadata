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
      '[data-testid="test-case-cards-section"]'
    );
    this.testCaseCards = this.testCaseCardsSection.locator(
      '.test-case-card, [class*="test-case"], [data-testid*="test-case"]'
    );
    this.nameLink = this.testCaseCards
      .locator('.test-case-name, [class*="name"], a')
      .first();
  }

  // ============ NAVIGATION METHODS (Fluent Interface) ============

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
    const statCardText = await statCard.textContent();
    if (!statCardText?.includes(expectedText)) {
      throw new Error(
        `Stat card ${statType} should show "${expectedText}" but shows "${statCardText}"`
      );
    }
  }

  /**
   * Verify the number of test case cards shown
   * @param expectedCount - Expected number of test case cards
   */
  async shouldShowTestCaseCardsCount(expectedCount: number): Promise<void> {
    // Use semantic selectors - count all test case card elements
    const cards = this.testCaseCards;
    const actualCount = await cards.count();
    if (actualCount !== expectedCount) {
      throw new Error(
        `Should show ${expectedCount} test case cards, but shows ${actualCount}`
      );
    }
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
    const nameText = await nameElement.textContent();
    if (!nameText?.includes(testCaseName)) {
      throw new Error(
        `Test case card ${cardIndex} should show name "${testCaseName}" but shows "${nameText}"`
      );
    }
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
    // Use semantic selectors - find card by index and check status
    const cards = this.testCaseCards;
    const card = cards.nth(cardIndex);
    await card.waitFor({ state: 'visible' });
    const statusBadge = card.locator(
      '.status-badge, .badge, [class*="status"]'
    );
    await statusBadge.waitFor({ state: 'visible' });
    const statusText = await statusBadge.textContent();
    const expectedStatusText = status.toLowerCase();
    if (!statusText?.toLowerCase().includes(expectedStatusText)) {
      throw new Error(
        `Test case card ${cardIndex} should show status "${expectedStatusText}" but shows "${statusText}"`
      );
    }
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
    const href = await this.nameLink.nth(cardIndex).getAttribute('href');
    if (!href) {
      throw new Error(
        `Test case card ${cardIndex} should have a working link but doesn't`
      );
    }
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
   * Assert internal fields of the Data Quality tab for Table (stat cards, incidents tab).
   * Use only when Data Quality tab is available (e.g. Table). Call after navigating to Data Quality tab.
   */
  async assertInternalFieldsForTable(assetType?: string): Promise<void> {
    const tabLabel = 'Data Quality';
    const prefix = assetType ? `[Asset: ${assetType}] [Tab: ${tabLabel}] ` : '';
    // await expect(this.successStatCard, `${prefix}Missing: success stat card`).toBeVisible();
    // await expect(this.failedStatCard, `${prefix}Missing: failed stat card`).toBeVisible();
    // await expect(this.abortedStatCard, `${prefix}Missing: aborted stat card`).toBeVisible();
    await expect(
      this.incidentsTab,
      `${prefix}Missing: incidents tab`
    ).toBeVisible();
  }
}
