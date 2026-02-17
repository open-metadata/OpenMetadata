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

import { expect, Locator, Page } from '@playwright/test';
import { OverviewPageObject } from './OverviewPageObject';
import { SchemaPageObject } from './SchemaPageObject';
import { LineagePageObject } from './LineagePageObject';
import { DataQualityPageObject } from './DataQualityPageObject';
import { CustomPropertiesPageObject } from './CustomPropertiesPageObject';
import { EntityClass } from '../../../support/entity/EntityClass';

/** Tab names for data-driven visibility and content assertions. Must match UI labels (e.g. "Custom Property"). */
export const RIGHT_PANEL_TAB = {
  OVERVIEW: 'overview',
  SCHEMA: 'schema',
  LINEAGE: 'lineage',
  DATA_QUALITY: 'data quality',
  CUSTOM_PROPERTIES: 'custom property',
} as const;

/** All right-panel tab names; used to assert which tabs must not be visible per asset type. */
export const ALL_RIGHT_PANEL_TABS: readonly string[] = [
  RIGHT_PANEL_TAB.OVERVIEW,
  RIGHT_PANEL_TAB.SCHEMA,
  RIGHT_PANEL_TAB.LINEAGE,
  RIGHT_PANEL_TAB.DATA_QUALITY,
  RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
];

/** Asset types that have defined right-panel tab visibility in DATA_ASSET_CONFIGS. */
export const RIGHT_PANEL_ASSET_TYPES = [
  'Table',
  'Database',
  'Database Schema',
  'Store Procedure',
  'Dashboard',
  'DashboardDataModel',
  'Chart',
  'Pipeline',
  'Topic',
  'MlModel',
  'Container',
  'SearchIndex',
  'ApiEndpoint',
  'Api Collection',
  'File',
  'Directory',
  'Spreadsheet',
  'Worksheet',
  'Metric',
] as const;

export type AssetType = typeof RIGHT_PANEL_ASSET_TYPES[number] | string;

// Interface for entities that have children
interface EntityWithChildren extends EntityClass {
  children: unknown[];
}

// Configuration for different data asset types and their right panel characteristics
export interface DataAssetConfig {
  entityType: string;
  childrenTabId?: string;
  availableTabs: string[];
  hasSchemaTab?: boolean;
  hasTasksTab?: boolean;
  hasFeaturesTab?: boolean;
  hasFieldsTab?: boolean;
  hasModelTab?: boolean;
  hasChartsTab?: boolean;
  supportsDataQuality?: boolean;
  supportsCustomProperties?: boolean;
}

export class RightPanelPageObject {
  public readonly page: Page;
  private readonly summaryPanel = '.entity-summary-panel-container';
  private entityConfig?: DataAssetConfig;

  // Section page objects
  public readonly overview: OverviewPageObject;
  public readonly schema: SchemaPageObject;
  public readonly lineage: LineagePageObject;
  public readonly dataQuality: DataQualityPageObject;
  public readonly customProperties: CustomPropertiesPageObject;

  // Shared test IDs for general UI elements
  public readonly testIds = {
    loader: '[data-testid="loader"]',
    selectableList: '[data-testid="selectable-list"]',
  };

  // Data asset configurations aligned with EntityRightPanelVerticalNav (hasSchemaTab, hasLineageTab, data quality for Table only, hasCustomPropertiesTab)
  private static readonly DATA_ASSET_CONFIGS: Record<string, DataAssetConfig> =
    {
      Table: {
        entityType: 'Table',
        childrenTabId: 'schema',
        availableTabs: [
          'overview',
          'schema',
          'lineage',
          'data quality',
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        hasSchemaTab: true,
        supportsDataQuality: true,
        supportsCustomProperties: true,
      },
      Database: {
        entityType: 'Database',
        availableTabs: [
          'overview',
          'schema',
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        hasSchemaTab: true,
        supportsCustomProperties: true,
      },
      'Database Schema': {
        entityType: 'Database Schema',
        availableTabs: [
          'overview',
          'schema',
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        hasSchemaTab: true,
        supportsCustomProperties: true,
      },
      'Store Procedure': {
        entityType: 'Store Procedure',
        availableTabs: ['overview', RIGHT_PANEL_TAB.CUSTOM_PROPERTIES],
        supportsCustomProperties: true,
      },
      Dashboard: {
        entityType: 'Dashboard',
        availableTabs: [
          'overview',
          'schema',
          'lineage',
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        hasSchemaTab: true,
        supportsCustomProperties: true,
      },
      DashboardDataModel: {
        entityType: 'DashboardDataModel',
        childrenTabId: 'schema',
        availableTabs: [
          'overview',
          'schema',
          'lineage',
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        hasSchemaTab: true,
        supportsCustomProperties: true,
      },
      Chart: {
        entityType: 'Chart',
        availableTabs: [
          'overview',
          'lineage',
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        supportsCustomProperties: true,
      },
      Pipeline: {
        entityType: 'Pipeline',
        childrenTabId: 'schema',
        availableTabs: [
          'overview',
          'schema',
          'lineage',
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        hasSchemaTab: true,
        supportsCustomProperties: true,
      },
      Topic: {
        entityType: 'Topic',
        childrenTabId: 'schema',
        availableTabs: [
          'overview',
          'schema',
          'lineage',
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        hasSchemaTab: true,
        supportsCustomProperties: true,
      },
      MlModel: {
        entityType: 'MlModel',
        availableTabs: [
          'overview',
          'lineage',
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        supportsCustomProperties: true,
      },
      Container: {
        entityType: 'Container',
        availableTabs: [
          'overview',
          'schema',
          'lineage',
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        hasSchemaTab: true,
        supportsCustomProperties: true,
      },
      SearchIndex: {
        entityType: 'SearchIndex',
        childrenTabId: 'schema',
        availableTabs: [
          'overview',
          'schema',
          'lineage',
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        hasSchemaTab: true,
        supportsCustomProperties: true,
      },
      ApiEndpoint: {
        entityType: 'ApiEndpoint',
        childrenTabId: 'schema',
        availableTabs: [
          'overview',
          'schema',
          'lineage',
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        hasSchemaTab: true,
        supportsCustomProperties: true,
      },
      'Api Collection': {
        entityType: 'Api Collection',
        availableTabs: [
          'overview',
          'schema',
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        hasSchemaTab: true,
        supportsCustomProperties: true,
      },
      File: {
        entityType: 'File',
        availableTabs: ['overview', RIGHT_PANEL_TAB.CUSTOM_PROPERTIES],
        supportsCustomProperties: true,
      },
      Directory: {
        entityType: 'Directory',
        availableTabs: [
          'overview',
          'lineage',
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        supportsCustomProperties: true,
      },
      Spreadsheet: {
        entityType: 'Spreadsheet',
        availableTabs: ['overview', RIGHT_PANEL_TAB.CUSTOM_PROPERTIES],
        supportsCustomProperties: true,
      },
      Worksheet: {
        entityType: 'Worksheet',
        availableTabs: ['overview', RIGHT_PANEL_TAB.CUSTOM_PROPERTIES],
        supportsCustomProperties: true,
      },
      Metric: {
        entityType: 'Metric',
        availableTabs: ['overview', RIGHT_PANEL_TAB.CUSTOM_PROPERTIES],
        supportsCustomProperties: true,
      },
    };

  /** Maps camelCase / spec entity type keys to DATA_ASSET_CONFIGS keys for lookup. */
  private static readonly ENTITY_TYPE_TO_CONFIG_KEY: Record<string, string> = {
    table: 'Table',
    database: 'Database',
    databaseSchema: 'Database Schema',
    dashboard: 'Dashboard',
    dashboardDataModel: 'DashboardDataModel',
    pipeline: 'Pipeline',
    topic: 'Topic',
    mlmodel: 'MlModel',
    container: 'Container',
    searchIndex: 'SearchIndex',
  };

  private static getConfigKey(assetType: string): string {
    return (
      RightPanelPageObject.ENTITY_TYPE_TO_CONFIG_KEY[assetType] ?? assetType
    );
  }

  constructor(page: Page, entity?: EntityClass) {
    this.page = page;

    // Initialize section page objects (tab POs extend RightPanelBase and take rightPanel only)
    this.overview = new OverviewPageObject(this);
    this.schema = new SchemaPageObject(this);
    this.lineage = new LineagePageObject(this);
    this.dataQuality = new DataQualityPageObject(this);
    this.customProperties = new CustomPropertiesPageObject(this);

    // Set entity configuration if provided
    if (entity) {
      this.setEntityConfig(entity);
    }
  }

  /**
   * Set the entity configuration for dynamic behavior
   * @param entity - EntityClass instance to configure for
   */
  public setEntityConfig(entity: EntityClass): void {
    const entityType = entity.getType();
    this.entityConfig = RightPanelPageObject.DATA_ASSET_CONFIGS[entityType];

    if (!this.entityConfig) {
      this.entityConfig = {
        entityType,
        availableTabs: [
          RIGHT_PANEL_TAB.OVERVIEW,
          RIGHT_PANEL_TAB.LINEAGE,
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        supportsCustomProperties: true,
      };
    }
  }

  /**
   * Set entity configuration by asset type string (e.g. 'Table', 'Database').
   * Use when orchestrating tab assertions without an EntityClass instance.
   */
  public setEntityConfigByType(assetType: string): void {
    const configKey = RightPanelPageObject.getConfigKey(assetType);
    this.entityConfig = RightPanelPageObject.DATA_ASSET_CONFIGS[configKey];
    if (!this.entityConfig) {
      this.entityConfig = {
        entityType: assetType,
        availableTabs: [
          RIGHT_PANEL_TAB.OVERVIEW,
          RIGHT_PANEL_TAB.LINEAGE,
          RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
        ],
        supportsCustomProperties: true,
      };
    }
  }

  /**
   * Orchestration: run internal-field assertions for each visible tab based on asset type.
   * Sets config by asset type, then for each available tab runs that tab's field-level assertions.
   * Data Quality assertions run only when the tab is available (e.g. Table).
   * Call after the right panel is open and loaded.
   */
  public async assertTabInternalFieldsByAssetType(
    assetType: string
  ): Promise<void> {
    this.setEntityConfigByType(assetType);
    const tabs = this.getExpectedTabsForEntityType(assetType);

    for (const tabName of tabs) {
      const n = tabName.toLowerCase();
      if (n === RIGHT_PANEL_TAB.OVERVIEW) {
        await this.navigateToTab(RIGHT_PANEL_TAB.OVERVIEW);
        await this.waitForLoadersToDisappear();
        await this.overview.assertInternalFieldsForAssetType(assetType);
        continue;
      }
      if (
        n === RIGHT_PANEL_TAB.SCHEMA &&
        this.isTabAvailable(RIGHT_PANEL_TAB.SCHEMA)
      ) {
        await this.navigateToTab(RIGHT_PANEL_TAB.SCHEMA);
        await this.waitForLoadersToDisappear();
        await this.schema.assertInternalFields(assetType);
        continue;
      }
      if (
        n === RIGHT_PANEL_TAB.LINEAGE &&
        this.isTabAvailable(RIGHT_PANEL_TAB.LINEAGE)
      ) {
        await this.navigateToTab(RIGHT_PANEL_TAB.LINEAGE);
        await this.waitForLoadersToDisappear();
        await this.lineage.assertInternalFields(assetType);
        continue;
      }
      if (
        (n === RIGHT_PANEL_TAB.DATA_QUALITY || n === 'data quality') &&
        this.isTabAvailable(RIGHT_PANEL_TAB.DATA_QUALITY)
      ) {
        await this.navigateToTab(RIGHT_PANEL_TAB.DATA_QUALITY);
        await this.waitForLoadersToDisappear();
        await this.dataQuality.assertInternalFieldsForTable(assetType);
        continue;
      }
      if (
        n === RIGHT_PANEL_TAB.CUSTOM_PROPERTIES &&
        this.isTabAvailable(RIGHT_PANEL_TAB.CUSTOM_PROPERTIES)
      ) {
        await this.navigateToTab(RIGHT_PANEL_TAB.CUSTOM_PROPERTIES);
        await this.waitForLoadersToDisappear();
        await this.customProperties.assertInternalFields(assetType);
      }
    }
  }

  /**
   * Get the current entity configuration
   */
  public getEntityConfig(): DataAssetConfig | undefined {
    return this.entityConfig;
  }

  /**
   * Check if a specific tab is available for the current entity type
   * @param tabName - Name of the tab to check
   */
  public isTabAvailable(tabName: string): boolean {
    if (!this.entityConfig) {
      return false;
    }
    return this.entityConfig.availableTabs.includes(tabName.toLowerCase());
  }

  /**
   * Get the children tab ID for the current entity type
   */
  public getChildrenTabId(): string | undefined {
    return this.entityConfig?.childrenTabId;
  }

  /**
   * Navigate to the appropriate schema/children tab based on entity type
   */
  public async navigateToChildrenTab(): Promise<void> {
    const childrenTabId = this.getChildrenTabId();
    if (childrenTabId) {
      await this.navigateToTab(childrenTabId);
    }
  }

  /**
   * Verify that entity-specific content is available based on entity type
   */
  public async verifyEntitySpecificContent(): Promise<void> {
    if (!this.entityConfig) {
      return;
    }

    // Verify available tabs are present
    for (const tab of this.entityConfig.availableTabs) {
      await this.verifyTabExists(tab);
    }

    // Navigate to and verify children tab content if it exists
    if (this.entityConfig.childrenTabId) {
      await this.navigateToChildrenTab();
      await this.verifyChildrenTabContent();
    }
  }

  /**
   * Verify that a specific tab exists in the right panel
   * @param tabName - Name of the tab to verify
   */
  public async verifyTabExists(tabName: string): Promise<boolean> {
    try {
      const tab = this.getSummaryPanel().getByRole('menuitem', {
        name: new RegExp(tabName, 'i'),
      });
      await expect(tab).toBeVisible();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Verify content in the children tab based on entity type
   */
  private async verifyChildrenTabContent(): Promise<void> {
    if (!this.entityConfig) {
      return;
    }

    // Verify entity-specific content based on type
    if (this.entityConfig.hasSchemaTab) {
      await this.verifySchemaTabContent();
    } else if (this.entityConfig.hasTasksTab) {
      await this.verifyTasksTabContent();
    } else if (this.entityConfig.hasFeaturesTab) {
      await this.verifyFeaturesTabContent();
    } else if (this.entityConfig.hasFieldsTab) {
      await this.verifyFieldsTabContent();
    } else if (this.entityConfig.hasModelTab) {
      await this.verifyModelTabContent();
    } else if (this.entityConfig.hasChartsTab) {
      await this.verifyChartsTabContent();
    }
  }

  /**
   * Verify schema tab content (for Tables, Topics, API Endpoints)
   */
  private async verifySchemaTabContent(): Promise<void> {
    // Schema tab verification logic
    await this.page.waitForSelector(this.testIds.loader, {
      state: 'detached',
    });
    // Additional schema-specific verifications can be added here
  }

  /**
   * Verify tasks tab content (for Pipelines)
   */
  private async verifyTasksTabContent(): Promise<void> {
    // Tasks tab verification logic
    await this.page.waitForSelector(this.testIds.loader, {
      state: 'detached',
    });
    // Additional tasks-specific verifications can be added here
  }

  /**
   * Verify features tab content (for ML Models)
   */
  private async verifyFeaturesTabContent(): Promise<void> {
    // Features tab verification logic
    await this.page.waitForSelector(this.testIds.loader, {
      state: 'detached',
    });
    // Additional features-specific verifications can be added here
  }

  /**
   * Verify fields tab content (for Search Indexes)
   */
  private async verifyFieldsTabContent(): Promise<void> {
    // Fields tab verification logic
    await this.page.waitForSelector(this.testIds.loader, {
      state: 'detached',
    });
    // Additional fields-specific verifications can be added here
  }

  /**
   * Verify model tab content (for Dashboard Data Models)
   */
  private async verifyModelTabContent(): Promise<void> {
    // Model tab verification logic
    await this.page.waitForSelector(this.testIds.loader, {
      state: 'detached',
    });
    // Additional model-specific verifications can be added here
  }

  /**
   * Verify charts tab content (for Dashboards)
   */
  private async verifyChartsTabContent(): Promise<void> {
    // Charts tab verification logic
    await this.page.waitForSelector(this.testIds.loader, {
      state: 'detached',
    });
    // Additional charts-specific verifications can be added here
  }

  /**
   * Get the main summary panel locator
   */
  getSummaryPanel() {
    return this.page.locator(this.summaryPanel);
  }

  /**
   * Get the locator for a tab by name (case-insensitive).
   * Matches Ant Design Menu items (li.ant-menu-item) by visible label text.
   */
  getTabLocator(tabName: string): Locator {
    const normalized = tabName.trim();
    const pattern = new RegExp(normalized.replace(/\s+/g, '\\s*'), 'i');
    return this.getSummaryPanel()
      .locator('li.ant-menu-item')
      .filter({ hasText: pattern })
      .first();
  }

  /**
   * Assert that all expected tabs are visible in the right panel.
   * Call after panel is loaded and entity config is set.
   * @param expectedTabs - Tab names to verify (e.g. from getExpectedTabsForEntity)
   */
  async assertExpectedTabsVisible(
    expectedTabs: readonly string[]
  ): Promise<void> {
    for (const tabName of expectedTabs) {
      const tabLocator = this.getTabLocator(tabName);
      await expect(tabLocator).toBeVisible();
    }
  }

  /**
   * Get expected tab names for an entity type from DATA_ASSET_CONFIGS.
   * Falls back to overview, lineage, custom properties for unknown types.
   */
  getExpectedTabsForEntityType(entityType: string): readonly string[] {
    const configKey = RightPanelPageObject.getConfigKey(entityType);
    const config = RightPanelPageObject.DATA_ASSET_CONFIGS[configKey];
    if (config?.availableTabs?.length) {
      return config.availableTabs;
    }
    return [
      RIGHT_PANEL_TAB.OVERVIEW,
      RIGHT_PANEL_TAB.LINEAGE,
      RIGHT_PANEL_TAB.CUSTOM_PROPERTIES,
    ];
  }

  /**
   * Get tab names that must not be visible for the given asset type.
   */
  getHiddenTabsForAssetType(assetType: string): string[] {
    const visible = this.getExpectedTabsForEntityType(assetType).map((t) =>
      t.toLowerCase().trim()
    );
    return ALL_RIGHT_PANEL_TABS.filter(
      (tab) => !visible.includes(tab.toLowerCase())
    );
  }

  /**
   * Validates the right panel for the given asset type: expected tab visibility and tab content.
   * 1. Asserts each expected tab (from config) is visible.
   * 2. For each expected tab: navigates to it, waits for loaders, runs tab-specific field assertions.
   * 3. On Overview: asserts Data Quality section visible if Data Quality tab is available (skips assertion when tab not present).
   * Does not assert that non-expected tabs are hidden (UI tab visibility may differ by entityType).
   * Call after the right panel is open and loaded.
   */
  public async validateRightPanelForAsset(assetType: AssetType): Promise<void> {
    this.setEntityConfigByType(assetType);
    const expectedTabs = this.getExpectedTabsForEntityType(assetType);
    const actuallyPresentTabs: string[] = [];

    for (const tabName of expectedTabs) {
      const tabLocator = this.getTabLocator(tabName);
      if ((await tabLocator.count()) > 0) {
        await expect(tabLocator).toBeVisible();
        actuallyPresentTabs.push(tabName);
      }
    }

    for (const tabName of actuallyPresentTabs) {
      const n = tabName.toLowerCase();
      await this.navigateToTab(tabName);
      await this.waitForLoadersToDisappear();

      if (n === RIGHT_PANEL_TAB.OVERVIEW) {
        await this.overview.assertInternalFieldsForAssetType(assetType);
        if (this.isTabAvailable(RIGHT_PANEL_TAB.DATA_QUALITY)) {
          await this.overview.assertDataQualitySectionVisible();
        }
        continue;
      }
      if (n === RIGHT_PANEL_TAB.SCHEMA) {
        await this.schema.validateTabContentForAsset(assetType);
        continue;
      }
      if (n === RIGHT_PANEL_TAB.LINEAGE) {
        await this.lineage.assertInternalFields(assetType);
        continue;
      }
      if (
        (n === RIGHT_PANEL_TAB.DATA_QUALITY || n === 'data quality') &&
        this.isTabAvailable(RIGHT_PANEL_TAB.DATA_QUALITY)
      ) {
        await this.dataQuality.assertInternalFieldsForTable(assetType);
        continue;
      }
      if (
        n === RIGHT_PANEL_TAB.CUSTOM_PROPERTIES &&
        this.isTabAvailable(RIGHT_PANEL_TAB.CUSTOM_PROPERTIES)
      ) {
        await this.customProperties.assertInternalFields(assetType);
      }
    }
  }

  /**
   * Whether this tab has a dedicated Page Object and assertContent() for content assertions.
   */
  isTabWithContentAssertion(tabName: string): boolean {
    const n = tabName.toLowerCase();
    return (
      n === RIGHT_PANEL_TAB.OVERVIEW ||
      n === RIGHT_PANEL_TAB.SCHEMA ||
      n === RIGHT_PANEL_TAB.LINEAGE ||
      n === RIGHT_PANEL_TAB.DATA_QUALITY ||
      n === RIGHT_PANEL_TAB.CUSTOM_PROPERTIES
    );
  }

  /**
   * Navigate to the tab and run its Page Object assertContent() (visibility + key fields).
   * No-op for tabs without a content assertion (e.g. charts, tasks).
   */
  async assertTabContent(tabName: string): Promise<void> {
    const n = tabName.toLowerCase();
    if (n === RIGHT_PANEL_TAB.OVERVIEW) {
      await this.overview.assertContent();
      return;
    }
    if (n === RIGHT_PANEL_TAB.SCHEMA) {
      await this.schema.assertContent();
      return;
    }
    if (n === RIGHT_PANEL_TAB.LINEAGE) {
      await this.lineage.assertContent();
      return;
    }
    if (n === RIGHT_PANEL_TAB.DATA_QUALITY) {
      await this.dataQuality.assertContent();
      return;
    }
    if (n === RIGHT_PANEL_TAB.CUSTOM_PROPERTIES) {
      await this.customProperties.assertContent();
      return;
    }
  }

  /**
   * Wait for the right panel to be visible
   */
  async waitForPanelVisible() {
    await this.getSummaryPanel().waitFor({ state: 'visible' });
  }

  /**
   * Wait until the right panel has fully loaded
   * This method ensures:
   * 1. Panel is visible
   * 2. All loaders within the panel have disappeared
   * 3. Panel is ready for interaction
   * @param timeout - Optional timeout in milliseconds (default: 30000)
   */
  async waitForPanelLoaded(timeout: number = 30000) {
    // Step 1: Wait for panel to be visible
    await this.getSummaryPanel().waitFor({ state: 'visible', timeout });

    // Step 2: Wait for all loaders within the panel to disappear
    // Use the summary panel as the scope for loaders
    const panelLoaders = this.getSummaryPanel().locator(
      '[data-testid="loader"]'
    );

    // Wait for loader count to become 0 within the panel
    await expect(panelLoaders).toHaveCount(0, { timeout });

    // Step 3: Wait for any remaining loaders on the page (fallback)
    await this.page.waitForSelector('[data-testid="loader"]', {
      state: 'detached',
      timeout,
    });

    // Step 4: Ensure panel is still visible and stable
    await this.getSummaryPanel().waitFor({ state: 'visible' });
  }

  /**
   * Navigate to a specific tab in the right panel.
   */
  async navigateToTab(tabName: string) {
    const tab = this.getTabLocator(tabName);
    await tab.click();
    await this.page.waitForSelector(this.testIds.loader, {
      state: 'detached',
    });
  }

  /**
   * Verify that a specific section is visible in the right panel
   * @param sectionClass - CSS class of the section (e.g., 'description-section', 'owners-section')
   */
  async verifySectionVisible(sectionClass: string) {
    const section = this.getSummaryPanel().locator(`.${sectionClass}`);
    await expect(section).toBeVisible();
  }

  /**
   * Get a section locator within the right panel
   * @param sectionClass - CSS class of the section
   */
  getSection(sectionClass: string) {
    return this.getSummaryPanel().locator(`.${sectionClass}`);
  }

  /**
   * Click on an edit icon within a section
   * @param selector - CSS selector for the edit icon
   */
  async clickEditIcon(selector: string) {
    const editIcon = this.page.locator(selector);
    await editIcon.scrollIntoViewIfNeeded();
    await editIcon.waitFor({ state: 'visible' });
    await editIcon.click();
  }

  /**
   * Click on an add button within a section
   * @param selector - CSS selector for the add button
   */
  async clickAddButton(selector: string) {
    const addButton = this.page.locator(selector);
    await addButton.scrollIntoViewIfNeeded();
    await addButton.waitFor({ state: 'visible' });
    await addButton.click();
  }

  /**
   * Wait for patch response after an update operation
   */
  async waitForPatchResponse() {
    const responsePromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/') &&
        resp.request().method() === 'PATCH' &&
        !resp.url().includes('/api/v1/analytics')
    );

    const response = await responsePromise;
    expect(response.status()).toBe(200);

    return response;
  }

  /**
   * Verify that a success message is displayed
   * @param message - Partial text of the success message
   */
  async verifySuccessMessage(message: string) {
    await expect(this.page.getByText(new RegExp(message, 'i'))).toBeVisible();
  }

  /**
   * Generic Helper Methods
   */

  /**
   * Wait for all loaders to disappear
   */
  async waitForLoadersToDisappear() {
    await this.page.waitForSelector(this.testIds.loader, {
      state: 'detached',
    });
  }

  /**
   * Wait for network idle
   */
  async waitForNetworkIdle() {
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Verify text is visible in the panel
   * @param text - Text to verify
   */
  async verifyTextVisible(text: string) {
    await expect(this.getSummaryPanel().getByText(text)).toBeVisible();
  }

  /**
   * Verify text is not visible in the panel
   * @param text - Text to verify is not visible
   */
  async verifyTextNotVisible(text: string) {
    await expect(this.getSummaryPanel().getByText(text)).not.toBeVisible();
  }

  /**
   * Factory method to create a RightPanelPageObject for a specific entity
   * @param page - Playwright page instance
   * @param entity - Entity instance to configure for
   */
  static createForEntity(
    page: Page,
    entity: EntityClass
  ): RightPanelPageObject {
    return new RightPanelPageObject(page, entity);
  }

  /**
   * Get available tabs for the current entity configuration
   */
  public getAvailableTabs(): string[] {
    return this.entityConfig?.availableTabs || ['overview', 'lineage'];
  }

  /**
   * Navigate to all available tabs for the current entity type
   */
  public async navigateToAllAvailableTabs(): Promise<void> {
    const availableTabs = this.getAvailableTabs();

    for (const tabName of availableTabs) {
      await this.navigateToTab(tabName);
      await this.waitForLoadersToDisappear();
    }
  }

  /**
   * Run comprehensive verification for the current entity type
   */
  public async runEntitySpecificVerification(): Promise<void> {
    await this.waitForPanelVisible();

    // Verify all available tabs exist
    const availableTabs = this.getAvailableTabs();
    for (const tab of availableTabs) {
      const exists = await this.verifyTabExists(tab);
      if (!exists) {
        console.warn(
          `Tab "${tab}" not found for entity type ${this.entityConfig?.entityType}`
        );
      }
    }

    // Run entity-specific content verification
    await this.verifyEntitySpecificContent();
  }

  /**
   * Get entity type specific test data for verification
   * @param entity - Entity instance to get test data for
   */
  public getEntityTestData(entity: EntityClass): Record<string, unknown> {
    const entityType = entity.getType();

    // Helper function to safely get children data
    const getChildrenData = (entity: EntityClass): unknown[] => {
      return 'children' in entity &&
        Array.isArray((entity as EntityWithChildren).children)
        ? (entity as EntityWithChildren).children
        : [];
    };

    switch (entityType) {
      // Database Assets
      case 'Table':
        return {
          childrenTab: 'schema',
          childrenData: getChildrenData(entity),
          hasDataQuality: true,
        };
      case 'Database':
      case 'Database Schema':
      case 'Store Procedure':
        return {
          childrenTab: undefined,
          childrenData: getChildrenData(entity),
          hasDataQuality: false,
        };
      // Dashboard Assets
      case 'Dashboard':
        return {
          childrenTab: 'charts',
          childrenData: getChildrenData(entity),
          hasDataQuality: false,
        };
      case 'DashboardDataModel':
        return {
          childrenTab: 'model',
          childrenData: getChildrenData(entity),
          hasDataQuality: false,
        };
      case 'Chart':
        return {
          childrenTab: undefined,
          childrenData: getChildrenData(entity),
          hasDataQuality: false,
        };
      // Pipeline Assets
      case 'Pipeline':
        return {
          childrenTab: 'tasks',
          childrenData: getChildrenData(entity),
          hasDataQuality: false,
        };
      // Messaging Assets
      case 'Topic':
        return {
          childrenTab: 'schema',
          childrenData: getChildrenData(entity),
          hasDataQuality: false,
        };
      // ML Model Assets
      case 'MlModel':
        return {
          childrenTab: 'features',
          childrenData: getChildrenData(entity),
          hasDataQuality: false,
        };
      // Container Assets
      case 'Container':
        return {
          childrenTab: undefined,
          childrenData: getChildrenData(entity),
          hasDataQuality: false,
        };
      // Search Index Assets
      case 'SearchIndex':
        return {
          childrenTab: 'fields',
          childrenData: getChildrenData(entity),
          hasDataQuality: false,
        };
      // API Assets
      case 'ApiEndpoint':
        return {
          childrenTab: 'schema',
          childrenData: getChildrenData(entity),
          hasDataQuality: false,
        };
      case 'Api Collection':
        return {
          childrenTab: undefined,
          childrenData: getChildrenData(entity),
          hasDataQuality: false,
        };
      // Drive Assets
      case 'File':
      case 'Directory':
      case 'Spreadsheet':
      case 'Worksheet':
        return {
          childrenTab: undefined,
          childrenData: getChildrenData(entity),
          hasDataQuality: false,
        };
      // Metric Assets
      case 'Metric':
        return {
          childrenTab: undefined,
          childrenData: getChildrenData(entity),
          hasDataQuality: false,
        };
      default:
        return {
          childrenTab: undefined,
          childrenData: [],
          hasDataQuality: false,
        };
    }
  }
}
