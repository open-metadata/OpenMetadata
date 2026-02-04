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
import { RightPanelPageObject } from './RightPanelPageObject';

/**
 * PROPER PAGE OBJECT PATTERN FOR LINEAGE TAB
 *
 * Handles lineage visualization, navigation, and interaction
 */
export class LineagePageObject {
  private readonly rightPanel: RightPanelPageObject;

  // ============ PRIVATE LOCATORS (scoped to container) ============
  private readonly container: Locator;
  private readonly upstreamButton: Locator;
  private readonly downstreamButton: Locator;
  private readonly nodes: Locator;
  private readonly edges: Locator;
  constructor(rightPanel: RightPanelPageObject) {
    this.rightPanel = rightPanel;

    // Base container - scoped to right panel summary panel
    this.container = this.rightPanel.getSummaryPanel().locator('.lineage-tab-content');
    this.upstreamButton = this.container.locator('[data-testid="upstream-button-text"]');
    this.downstreamButton = this.container.locator('[data-testid="downstream-button-text"]');
    this.nodes = this.container.locator('.lineage-node, [data-testid*="lineage-node"]');
    this.edges = this.container.locator('.lineage-edge, .react-flow__edge');
  }

  // ============ NAVIGATION METHODS (Fluent Interface) ============

  /**
   * Navigate to the Lineage tab
   * @returns LineagePageObject for method chaining
   */
  async navigateToLineageTab(): Promise<LineagePageObject> {
    await this.rightPanel.navigateToTab('lineage');
    await this.rightPanel.waitForLoadersToDisappear();
    return this;
  }

  // ============ ACTION METHODS (Fluent Interface) ============

  /**
   * Click the upstream button to expand upstream lineage
   * @returns LineagePageObject for method chaining
   */
  async clickUpstreamButton(): Promise<LineagePageObject> {
    await this.upstreamButton.click();
    await this.rightPanel.waitForLoadersToDisappear();
    return this;
  }

  /**
   * Click the downstream button to expand downstream lineage
   * @returns LineagePageObject for method chaining
   */
  async clickDownstreamButton(): Promise<LineagePageObject> {
    await this.downstreamButton.click();
    await this.rightPanel.waitForLoadersToDisappear();
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
    const actualCount = await this.nodes.count();
    if (actualCount !== expectedCount) {
      throw new Error(`Should show ${expectedCount} data assets in lineage, but shows ${actualCount}`);
    }
  }

  /**
   * Verify lineage contains at least one data asset
   */
  async shouldShowDataAssets(): Promise<void> {
    const count = await this.nodes.count();
    if (count === 0) {
      throw new Error('Should show at least one data asset in lineage but shows none');
    }
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
    const count = await this.nodes.count();
    if (count > 0) {
      throw new Error(`Should show empty lineage but shows ${count} data assets`);
    }
  }

  /**
   * Verify lineage shows connections between data assets
   */
  async shouldShowLineageConnections(): Promise<void> {
    const count = await this.edges.count();
    if (count === 0) {
      throw new Error('Should show lineage connections but shows none');
    }
  }
}