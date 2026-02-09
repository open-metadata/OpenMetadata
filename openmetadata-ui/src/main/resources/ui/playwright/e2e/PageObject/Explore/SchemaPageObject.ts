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

  constructor(rightPanel: RightPanelPageObject) {
    super(rightPanel);
    this.container = this.getSummaryPanel();
    this.schemaSearchBar = this.page.getByTestId('searchbar');
    this.schemaFieldsContainer = this.page.locator('.schema-field-cards-container');
    this.schemaFields = this.schemaFieldsContainer.locator('.field-card ');
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

  // ============ VERIFICATION METHODS (BDD Style) ============

  /**
   * Verify that the Schema tab is currently visible
   */
  async shouldBeVisible(): Promise<void> {
    await this.container.waitFor({ state: 'visible' });
  }

  /**
   * Verify schema tab has search bar, container, and at least one schema field visible.
   * Uses .first() because multiple .field-card elements exist (strict mode).
   */
  async shouldShowSchemaField(): Promise<void> {
    await expect(this.schemaSearchBar).toBeVisible();
    await expect(this.schemaFieldsContainer).toBeVisible();
    await expect(this.schemaFields.first()).toBeVisible();
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
   * Assert internal fields of the Schema tab (search bar, container, at least one field).
   * Call after navigating to Schema tab (e.g. from assertTabInternalFieldsByAssetType).
   */
  async assertInternalFields(assetType?: string): Promise<void> {
    const tabLabel = 'Schema';
    const prefix = assetType ? `[Asset: ${assetType}] [Tab: ${tabLabel}] ` : '';
    await expect(this.schemaSearchBar, `${prefix}Missing: schema search bar`).toBeVisible();
    await expect(this.schemaFieldsContainer, `${prefix}Missing: schema fields container`).toBeVisible();
    await expect(this.schemaFields.first(), `${prefix}Missing: at least one schema field`).toBeVisible();
  }
}