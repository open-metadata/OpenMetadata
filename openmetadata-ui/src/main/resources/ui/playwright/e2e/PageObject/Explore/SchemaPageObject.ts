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

import { Locator } from '@playwright/test';
import { RightPanelPageObject } from './RightPanelPageObject';

/**
 * PROPER PAGE OBJECT PATTERN FOR SCHEMA TAB
 *
 * Handles schema field display, data types, and verification
 */
export class SchemaPageObject {
  private readonly rightPanel: RightPanelPageObject;

  // ============ PRIVATE LOCATORS (scoped to container) ============
  private readonly container: Locator;
  private readonly fieldCard: Locator;
  private readonly dataType: Locator;

  constructor(rightPanel: RightPanelPageObject) {
    this.rightPanel = rightPanel;

    // Base container - scoped to right panel summary panel
      this.container = this.rightPanel.getSummaryPanel();
      this.fieldCard = this.container.locator('.field-card, [class*="field"], [data-testid*="field"]');
      this.dataType = this.container.locator('.data-type, [class*="type"], [data-testid*="type"]');

    }

  // ============ NAVIGATION METHODS (Fluent Interface) ============

  /**
   * Navigate to the Schema tab
   * @returns SchemaPageObject for method chaining
   */
  async navigateToSchemaTab(): Promise<SchemaPageObject> {
    await this.rightPanel.navigateToTab('schema');
    await this.rightPanel.waitForLoadersToDisappear();
    return this;
  }


  // ============ VERIFICATION METHODS (BDD Style) ============

  /**
   * Verify that the Schema tab is currently visible
   */
  async shouldBeVisible(): Promise<void> {
    await this.container.waitFor({ state: 'visible' });
  }

  /**
   * Verify schema field is visible
   * @param fieldName - Name of the field to verify
   */
  async shouldShowSchemaField(fieldName: string): Promise<void> {
    // Use semantic selectors - look for field by name text instead of test IDs
    const fieldCard = this.fieldCard.filter({ hasText: fieldName });
    await fieldCard.waitFor({ state: 'visible' });
  }

  /**
   * Verify schema field is not visible
   * @param fieldName - Name of the field to verify
   */
  async shouldNotShowSchemaField(fieldName: string): Promise<void> {
    // Use semantic selectors - look for field by name text instead of test IDs
    const fieldCard = this.fieldCard.filter({ hasText: fieldName });
    await fieldCard.waitFor({ state: 'hidden' });
  }

  /**
   * Verify data type is displayed for a field
   * @param dataType - Expected data type
   */
  async shouldShowDataType(dataType: string): Promise<void> {
    // Use semantic selectors - look for data type text anywhere in the container
    const dataTypeElement = this.dataType.filter({ hasText: dataType });
    await dataTypeElement.waitFor({ state: 'visible' });
  }

  /**
   * Verify the number of schema fields shown
   * @param expectedCount - Expected number of schema fields
   */
  async shouldShowSchemaFieldsCount(expectedCount: number): Promise<void> {
    // Use semantic selectors - count all field elements
    const fieldCards = this.fieldCard;
    const actualCount = await fieldCards.count();
    if (actualCount !== expectedCount) {
      throw new Error(`Should show ${expectedCount} schema fields, but shows ${actualCount}`);
    }
  }

  /**
   * Verify schema contains at least one field
   */
  async shouldShowSchemaFields(): Promise<void> {
    // Use semantic selectors - check for presence of any field elements
    const fieldCards = this.fieldCard;
    const count = await fieldCards.count();
    if (count === 0) {
      throw new Error('Should show at least one schema field but shows none');
    }
  }

  /**
   * Verify schema is empty (no fields visible)
   */
  async shouldShowEmptySchema(): Promise<void> {
    // Use semantic selectors - ensure no field elements exist
    const fieldCards = this.fieldCard;
    const count = await fieldCards.count();
    if (count > 0) {
      throw new Error(`Should show empty schema but shows ${count} fields`);
    }
  }
}