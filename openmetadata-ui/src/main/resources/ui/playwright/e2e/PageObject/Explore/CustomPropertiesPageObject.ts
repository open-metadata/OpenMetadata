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
import { RightPanelPageObject, RIGHT_PANEL_TAB } from './RightPanelPageObject';

/**
 * PROPER PAGE OBJECT PATTERN FOR CUSTOM PROPERTIES TAB
 *
 * Handles custom properties display, search, and verification
 */
export class CustomPropertiesPageObject extends RightPanelBase {
  // ============ PRIVATE LOCATORS (scoped to container) ============
  private readonly container: Locator;
  private readonly searchBar: Locator;
  private readonly propertyCard: Locator;
  private readonly emptyCustomPropertiesContainer: Locator;
  private readonly customPropertiesContainer: Locator;

  constructor(rightPanel: RightPanelPageObject) {
    super(rightPanel);
    this.container = this.getSummaryPanel().locator(
      '.custom-properties-container'
    );
    this.customPropertiesContainer = this.page.locator(
      '.custom-properties-section-container'
    );
    this.searchBar = this.page.getByTestId('searchbar');
    this.propertyCard = this.page.getByTestId(
      'custom-property-right-panel-card'
    );
    this.emptyCustomPropertiesContainer = this.page.getByTestId(
      'no-data-placeholder'
    );
  }

  // ============ NAVIGATION METHODS (Fluent Interface) ============

  /**
   * Navigate to the Custom Properties tab
   * @returns CustomPropertiesPageObject for method chaining
   */
  async navigateToCustomPropertiesTab(): Promise<CustomPropertiesPageObject> {
    await this.rightPanel.navigateToTab(RIGHT_PANEL_TAB.CUSTOM_PROPERTIES);
    await this.waitForLoadersToDisappear();
    return this;
  }

  /**
   * Reusable assertion: navigate to Custom Properties tab and assert tab + container visible.
   */
  async assertContent(): Promise<void> {
    await this.navigateToCustomPropertiesTab();
    await this.shouldBeVisible();
    await this.shouldShowCustomPropertiesContainer();
  }

  // ============ ACTION METHODS (Fluent Interface) ============

  /**
   * Search custom properties by name
   * @param searchTerm - Term to search for
   * @returns CustomPropertiesPageObject for method chaining
   */
  async searchCustomProperties(
    searchTerm: string
  ): Promise<CustomPropertiesPageObject> {
    await this.searchBar.fill(searchTerm);
    await this.searchBar.press('Enter');
    await this.waitForLoadersToDisappear();
    return this;
  }

  /**
   * Verify empty custom properties container is visible
   * @returns CustomPropertiesPageObject for method chaining
   */
  async shouldShowEmptyCustomPropertiesContainer(): Promise<void> {
    await this.emptyCustomPropertiesContainer.waitFor({ state: 'visible' });
  }

  /**
   * Clear the search input
   * @returns CustomPropertiesPageObject for method chaining
   */
  async clearSearch(): Promise<CustomPropertiesPageObject> {
    await this.searchBar.clear();
    await this.waitForLoadersToDisappear();
    return this;
  }

  /**
   * Verify that the Custom Properties tab is currently visible
   */
  async shouldBeVisible(): Promise<void> {
    await this.container.waitFor({ state: 'visible' });
  }

  async shouldShowCustomPropertiesContainer(): Promise<void> {
    await this.customPropertiesContainer.waitFor({ state: 'visible' });
  }

  /**
   * Verify custom property is visible
   * @param propertyName - Name of the custom property
   */
  async shouldShowCustomProperty(propertyName: string): Promise<void> {
    // Use semantic selectors - look for property by name text
    const propertyCard = this.customPropertiesContainer.getByTestId(
      `${propertyName}`
    );
    await propertyCard.scrollIntoViewIfNeeded();
    await propertyCard.waitFor({ state: 'visible' });
  }

  /**
   * Verify custom property is not visible
   * @param propertyName - Name of the custom property
   */
  async shouldNotShowCustomProperty(propertyName: string): Promise<void> {
    // Use semantic selectors - look for property by name text
    const propertyCard = this.propertyCard.filter({ hasText: propertyName });
    await propertyCard.waitFor({ state: 'hidden' });
  }

  /**
   * Verify custom property has specific value
   * @param propertyName - Name of the custom property
   * @param expectedValue - Expected value
   */
  async shouldShowCustomPropertyWithValue(
    propertyName: string,
    expectedValue: string
  ): Promise<void> {
    const propertyCard = this.propertyCard.filter({ hasText: propertyName });
    await propertyCard.waitFor({ state: 'visible' });

    const valueElement = propertyCard.locator(
      '.value, [class*="value"], [data-testid="value"]'
    );
    await valueElement.waitFor({ state: 'visible' });
    const actualValue = await valueElement.textContent();
    if (!actualValue?.includes(expectedValue)) {
      throw new Error(
        `Custom property "${propertyName}" should show value "${expectedValue}" but shows "${actualValue}"`
      );
    }
  }

  /**
   * Verify the number of custom properties shown
   * @param expectedCount - Expected number of custom properties
   */
  async shouldShowCustomPropertiesCount(expectedCount: number): Promise<void> {
    // Use semantic selectors - count all property elements
    const cards = this.propertyCard;
    const actualCount = await cards.count();
    if (actualCount !== expectedCount) {
      throw new Error(
        `Should show ${expectedCount} custom properties, but shows ${actualCount}`
      );
    }
  }

  /**
   * Verify search bar is visible and functional
   */
  async shouldHaveSearchBar(): Promise<void> {
    await this.searchBar.waitFor({ state: 'visible' });
  }

  /**
   * Verify search bar contains specific text
   * @param expectedText - Expected text in search bar
   */
  async shouldShowSearchText(expectedText: string): Promise<void> {
    await this.searchBar.waitFor({ state: 'visible' });
    const actualText = await this.searchBar.inputValue();
    if (actualText !== expectedText) {
      throw new Error(
        `Search bar should show "${expectedText}" but shows "${actualText}"`
      );
    }
  }

  /**
   * Assert internal fields of the Custom Properties tab (container visible).
   * Call after navigating to Custom Properties tab (e.g. from assertTabInternalFieldsByAssetType).
   */
  async assertInternalFields(assetType?: string): Promise<void> {
    const tabLabel = 'Custom Property';
    const prefix = assetType ? `[Asset: ${assetType}] [Tab: ${tabLabel}] ` : '';
    await expect(
      this.customPropertiesContainer,
      `${prefix}Missing: custom properties container`
    ).toBeVisible();
  }
}
