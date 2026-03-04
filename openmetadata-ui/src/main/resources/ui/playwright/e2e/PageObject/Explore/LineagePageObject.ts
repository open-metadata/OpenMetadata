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
 * PROPER PAGE OBJECT PATTERN FOR LINEAGE TAB
 *
 * Handles lineage visualization, navigation, and interaction
 */
export class LineagePageObject extends RightPanelBase {
  // ============ PRIVATE LOCATORS (scoped to container) ============
  private readonly container: Locator;
  private readonly upstreamButton: Locator;
  private readonly downstreamButton: Locator;
  private readonly nodes: Locator;
  private readonly edges: Locator;
  private readonly lineageItemCards: Locator;
  private readonly upstreamLineageLink: Locator;
  private readonly upstreamCount: Locator;
  private readonly downstreamCount: Locator;
  private readonly lineageCardTypeText: Locator;
  private readonly lineageCardOwnerSection: Locator;
  private readonly lineageCardLink: Locator;

  constructor(rightPanel: RightPanelPageObject) {
    super(rightPanel);
    this.container = this.getSummaryPanel().locator('.lineage-tab-content');
    this.upstreamButton = this.container.locator(
      '[data-testid="upstream-button-text"]'
    );
    this.downstreamButton = this.container.locator(
      '[data-testid="downstream-button-text"]'
    );
    this.nodes = this.container.locator(
      '.lineage-node, [data-testid*="lineage-node"]'
    );
    this.edges = this.container.locator('.lineage-edge, .react-flow__edge');
    this.lineageItemCards = this.container.locator('.lineage-item-card');
    this.upstreamLineageLink = this.getSummaryPanel().locator(
      '[data-testid="upstream-lineage"]'
    );
    this.upstreamCount = this.getSummaryPanel().locator(
      '[data-testid="upstream-count"]'
    );
    this.downstreamCount = this.getSummaryPanel().locator(
      '[data-testid="downstream-count"]'
    );
    this.lineageCardTypeText = this.lineageItemCards.locator(
      '.item-entity-type-text'
    );
    this.lineageCardOwnerSection = this.lineageItemCards.locator(
      '.lineage-info-container'
    );
    this.lineageCardLink = this.lineageItemCards.locator(
      '.breadcrumb-menu-button'
    );
  }

  // ============ NAVIGATION METHODS (Fluent Interface) ============

  /**
   * Navigate to the Lineage tab
   * @returns LineagePageObject for method chaining
   */
  async navigateToLineageTab(): Promise<LineagePageObject> {
    await this.rightPanel.navigateToTab('lineage');
    await this.waitForLoadersToDisappear();
    return this;
  }

  /**
   * Reusable assertion: navigate to Lineage tab and assert tab + lineage controls visible.
   */
  async assertContent(): Promise<void> {
    await this.navigateToLineageTab();
    await this.shouldBeVisible();
    await this.shouldShowLineageControls();
  }

  // ============ ACTION METHODS (Fluent Interface) ============

  /**
   * Click the upstream button to expand upstream lineage
   * @returns LineagePageObject for method chaining
   */
  async clickUpstreamButton(): Promise<LineagePageObject> {
    await this.upstreamButton.click();
    await this.waitForLoadersToDisappear();
    return this;
  }

  /**
   * Click the downstream button to expand downstream lineage
   * @returns LineagePageObject for method chaining
   */
  async clickDownstreamButton(): Promise<LineagePageObject> {
    await this.downstreamButton.click();
    await this.waitForLoadersToDisappear();
    return this;
  }

  /**
   * Click on a lineage card
   * @param entityName - Name of the entity card to click
   * @returns LineagePageObject for method chaining
   */
  async clickLineageCard(entityName: string): Promise<LineagePageObject> {
    const card = this.lineageItemCards.filter({ hasText: entityName });
    await card.waitFor({ state: 'visible' });
    await card.click();
    await this.page.waitForLoadState('networkidle');
    return this;
  }

  /**
   * Navigate to full lineage page
   * @returns LineagePageObject for method chaining
   */
  async navigateToFullLineage(): Promise<LineagePageObject> {
    await this.upstreamLineageLink.waitFor({ state: 'visible' });
    await this.upstreamLineageLink.click();
    await this.page.waitForURL(/.*\/lineage$/);
    return this;
  }

  // ============ VERIFICATION METHODS (BDD Style) ============

  /**
   * Verify that the Lineage tab is currently visible
   */
  async shouldBeVisible(): Promise<void> {
    await this.container.waitFor({ state: 'visible' });
  }

  /**
   * Verify upstream expansion button is visible
   */
  async shouldShowExpandUpstreamButton(): Promise<void> {
    await this.upstreamButton.waitFor({ state: 'visible' });
  }

  /**
   * Verify downstream expansion button is visible
   */
  async shouldShowExpandDownstreamButton(): Promise<void> {
    await this.downstreamButton.waitFor({ state: 'visible' });
  }

  /**
   * Verify upstream expansion button is not visible
   */
  async shouldNotShowExpandUpstreamButton(): Promise<void> {
    await this.upstreamButton.waitFor({ state: 'hidden' });
  }

  /**
   * Verify downstream expansion button is not visible
   */
  async shouldNotShowExpandDownstreamButton(): Promise<void> {
    await this.downstreamButton.waitFor({ state: 'hidden' });
  }

  /**
   * Verify lineage contains specific number of data assets
   * @param expectedCount - Expected number of data assets in lineage
   */
  async shouldShowDataAssetsCount(expectedCount: number): Promise<void> {
    await expect(this.nodes).toHaveCount(expectedCount);
  }

  /**
   * Verify lineage contains at least one data asset
   */
  async shouldShowDataAssets(): Promise<void> {
    await expect(this.nodes).not.toHaveCount(0);
  }

  async hasUpstreamButton(): Promise<boolean> {
    return await this.upstreamButton.isVisible();
  }

  async hasDownstreamButton(): Promise<boolean> {
    return await this.downstreamButton.isVisible();
  }

  /**
   * Verify lineage visualization controls are available
   */
  async shouldShowLineageControls(): Promise<void> {
    await expect(this.upstreamButton).toBeVisible();
    await expect(this.downstreamButton).toBeVisible();
  }

  /**
   * Verify lineage is empty (no data assets visible)
   */
  async shouldShowEmptyLineage(): Promise<void> {
    await expect(this.nodes).toHaveCount(0);
  }

  /**
   * Verify lineage shows connections between data assets
   */
  async shouldShowLineageConnections(): Promise<void> {
    await expect(this.edges).not.toHaveCount(0);
  }

  /**
   * Verify upstream count in overview tab
   * @param expectedCount - Expected number of upstream entities
   */
  async verifyUpstreamCount(expectedCount: number): Promise<void> {
    await expect(this.upstreamCount).toBeVisible();
    await expect(this.upstreamCount).toHaveText(expectedCount.toString());
  }

  /**
   * Verify downstream count in overview tab
   * @param expectedCount - Expected number of downstream entities
   */
  async verifyDownstreamCount(expectedCount: number): Promise<void> {
    await expect(this.downstreamCount).toBeVisible();
    await expect(this.downstreamCount).toHaveText(expectedCount.toString());
  }

  /**
   * Verify a lineage card exists for an entity
   * @param entityName - Name of the entity
   * @param direction - Direction ('upstream' or 'downstream')
   */
  async verifyLineageCard(
    entityName: string,
    direction: 'upstream' | 'downstream'
  ): Promise<void> {
    if (direction === 'upstream') {
      await this.clickUpstreamButton();
    } else {
      await this.clickDownstreamButton();
    }

    const card = this.lineageItemCards.filter({ hasText: entityName });
    await expect(card).toBeVisible();
    await expect(card).toContainText(entityName);
  }

  /**
   * Verify lineage card details (service icon, entity name, type, owner)
   * @param entityName - Name of the entity
   * @param details - Object containing expected details
   */
  async verifyLineageCardDetails(
    entityName: string,
    details: {
      hasServiceIcon?: boolean;
      entityType?: string;
      hasOwner?: boolean;
      hasLink?: boolean;
    }
  ): Promise<void> {
    const card = this.lineageItemCards.filter({ hasText: entityName });
    await expect(card).toBeVisible();

    if (details.hasServiceIcon) {
      await expect(card.locator('.service-icon')).toBeVisible();
    }

    if (details.entityType) {
      const typeText = this.lineageCardTypeText.filter({
        hasText: new RegExp(details.entityType, 'i'),
      });
      await expect(typeText).toBeVisible();
      await expect(typeText).toContainText(new RegExp(details.entityType, 'i'));
    }

    if (details.hasOwner) {
      await expect(
        card.filter({ has: this.lineageCardOwnerSection })
      ).toBeVisible();
    }

    if (details.hasLink) {
      await expect(card.filter({ has: this.lineageCardLink })).toBeVisible();
    }
  }

  /**
   * Assert internal fields of the Lineage tab (upstream/downstream controls).
   * Call after navigating to Lineage tab (e.g. from assertTabInternalFieldsByAssetType).
   */
  async assertInternalFields(assetType?: string): Promise<void> {
    const tabLabel = 'Lineage';
    const prefix = assetType ? `[Asset: ${assetType}] [Tab: ${tabLabel}] ` : '';
    await expect(
      this.upstreamButton,
      `${prefix}Missing: upstream control`
    ).toBeVisible();
    await expect(
      this.downstreamButton,
      `${prefix}Missing: downstream control`
    ).toBeVisible();
  }
}
