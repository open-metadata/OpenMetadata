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
 * PROPER PAGE OBJECT PATTERN FOR SCHEMA TAB
 *
 * Handles schema field display, data types, and verification
 */
export class SchemaPageObject extends RightPanelBase {
  // ============ PRIVATE LOCATORS (scoped to container) ============
  private readonly container: Locator;
  private readonly schemaSearchBar: Locator;
  private readonly schemaFieldsContainer: Locator;
  private readonly schemaFields: Locator;
  private readonly noDataContainer: Locator;
  private readonly expandIcon: Locator;

  constructor(rightPanel: RightPanelPageObject) {
    super(rightPanel);
    this.container = this.getSummaryPanel();
    this.schemaSearchBar = this.page.getByTestId('searchbar');
    this.schemaFieldsContainer = this.page.locator(
      '.schema-field-cards-container'
    );
    this.schemaFields = this.schemaFieldsContainer.locator('.field-card ');
    this.noDataContainer = this.getSummaryPanel().locator('.no-data-container');
    this.expandIcon = this.schemaFieldsContainer
      .getByTestId('expand-icon')
      .first();
  }

  // ============ NAVIGATION METHODS (Fluent Interface) ============

  /**
   * Navigate to the Schema tab
   * @returns SchemaPageObject for method chaining
   */
  async navigateToSchemaTab(): Promise<SchemaPageObject> {
    await this.rightPanel.navigateToTab('schema');
    await this.waitForLoadersToDisappear();
    return this;
  }

  /**
   * Reusable assertion: navigate to Schema tab and assert tab + schema fields visible.
   */
  async assertContent(): Promise<void> {
    await this.navigateToSchemaTab();
    await this.shouldBeVisible();
    await this.shouldShowSchemaField();
  }

  // ============ SEARCH METHODS ============

  /**
   * Type into the schema search bar and wait for results to update.
   */
  async searchFor(text: string): Promise<void> {
    await this.schemaSearchBar.fill(text);
    // Brief pause to let debounced filter settle
    await this.page.waitForTimeout(300);
  }

  /**
   * Clear the schema search bar.
   */
  async clearSearch(): Promise<void> {
    await this.schemaSearchBar.clear();
    await this.page.waitForTimeout(300);
  }

  /**
   * Assert a field card with the given name is visible.
   * Uses the data-testid set by FieldCard: `field-card-{name}`.
   */
  async shouldShowFieldByName(name: string): Promise<void> {
    await expect(
      this.page.getByTestId(`field-card-${name}`),
      `Expected field card "${name}" to be visible`
    ).toBeVisible();
  }

  /**
   * Assert a field card with the given name is NOT present in the DOM.
   */
  async shouldNotShowFieldByName(name: string): Promise<void> {
    await expect(
      this.page.getByTestId(`field-card-${name}`),
      `Expected field card "${name}" to be hidden`
    ).not.toBeVisible();
  }

  /**
   * Assert the "Show Nested (n)" expand button is visible —
   * meaning the search matched a nested child and the parent is shown collapsed.
   */
  async shouldShowExpandButton(): Promise<void> {
    await expect(
      this.expandIcon,
      'Expected a nested expand button to be visible'
    ).toBeVisible();
  }

  /**
   * Assert the no-data message is shown (search returned no results).
   */
  async shouldShowNoResults(): Promise<void> {
    await expect(this.noDataContainer).toBeVisible();
  }

  /**
   * Return the current count of visible field cards.
   */
  async fieldCount(): Promise<number> {
    return this.schemaFields.count();
  }

  // ============ VERIFICATION METHODS (BDD Style) ============

  /**
   * Verify that the Schema tab is currently visible
   */
  async shouldBeVisible(): Promise<void> {
    await this.container.waitFor({ state: 'visible' });
  }

  /**
   * Verify schema tab has search bar and either schema fields or empty state.
   * For Database/Database Schema the tab may show empty state when no children are loaded.
   */
  async shouldShowSchemaField(): Promise<void> {
    await expect(this.schemaSearchBar).toBeVisible();
    const hasFields = (await this.schemaFields.count()) > 0;
    const hasEmptyState = await this.noDataContainer.isVisible();
    expect(hasFields || hasEmptyState).toBe(true);
  }

  async schemaFieldsCount(): Promise<number> {
    const count = await this.schemaFields.count();
    return count;
  }

  async shouldShowSchemaFieldsCount(expectedCount: number): Promise<void> {
    const count = await this.schemaFieldsCount();
    expect(count).toBe(expectedCount);
  }

  /**
   * Assert internal fields of the Schema tab (search bar, and either schema content or empty state).
   * Database and Database Schema may show empty state when no schemas/tables are returned.
   */
  async assertInternalFields(assetType?: string): Promise<void> {
    const tabLabel = 'Schema';
    const prefix = assetType ? `[Asset: ${assetType}] [Tab: ${tabLabel}] ` : '';
    await expect(
      this.schemaSearchBar,
      `${prefix}Missing: schema search bar`
    ).toBeVisible();
    const hasFields = (await this.schemaFields.count()) > 0;
    const hasEmptyState = await this.noDataContainer.isVisible();
    expect(
      hasFields || hasEmptyState,
      `${prefix}Expected schema fields container or empty state`
    ).toBe(true);
  }

  /**
   * Validates Schema tab content for the given asset type: visibility and key UI elements.
   * Use from RightPanelPageObject.validateRightPanelForAsset after navigating to Schema tab.
   */
  async validateTabContentForAsset(assetType: string): Promise<void> {
    await this.shouldBeVisible();
    await this.shouldShowSchemaField();
    await this.assertInternalFields(assetType);
  }
}
