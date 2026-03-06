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
import {
  RightPanelPageObject,
  PageContext,
} from '../PageObject/Explore/RightPanelPageObject';
import { OverviewPageObject } from '../PageObject/Explore/OverviewPageObject';
import { SchemaPageObject } from '../PageObject/Explore/SchemaPageObject';
import { LineagePageObject } from '../PageObject/Explore/LineagePageObject';
import { DataQualityPageObject } from '../PageObject/Explore/DataQualityPageObject';
import { CustomPropertiesPageObject } from '../PageObject/Explore/CustomPropertiesPageObject';
import { EntityClass } from '../../support/entity/EntityClass';

export interface TestOptions {
  skipTabs?: string[];
  onlyTabs?: string[];
  skipCRUD?: boolean;
  role?: 'Admin' | 'DataSteward' | 'DataConsumer';
}

export class RightPanelTestSuite {
  private rightPanel: RightPanelPageObject;
  private overview: OverviewPageObject;
  private schema: SchemaPageObject;
  private lineage: LineagePageObject;
  private dataQuality: DataQualityPageObject;
  private customProperties: CustomPropertiesPageObject;

  constructor(
    page: Page,
    entityInstance: EntityClass,
    pageContext: PageContext = PageContext.EXPLORE
  ) {
    this.rightPanel = new RightPanelPageObject(page);
    this.rightPanel.setPageContext(pageContext);
    this.rightPanel.setEntityConfig(entityInstance);

    this.overview = new OverviewPageObject(this.rightPanel);
    this.schema = new SchemaPageObject(this.rightPanel);
    this.lineage = new LineagePageObject(this.rightPanel);
    this.dataQuality = new DataQualityPageObject(this.rightPanel);
    this.customProperties = new CustomPropertiesPageObject(this.rightPanel);
  }

  async runStandardTestSuite(options: TestOptions = {}): Promise<void> {
    const {
      skipTabs = [],
      onlyTabs = [],
      skipCRUD = false,
      role = 'Admin',
    } = options;

    if (role !== 'Admin') {
      this.rightPanel.setRolePermissions(role);
    }

    await this.rightPanel.waitForPanelVisible();

    const shouldTestTab = (tabName: string): boolean => {
      if (onlyTabs.length > 0) {
        return onlyTabs.includes(tabName);
      }
      return (
        !skipTabs.includes(tabName) && this.rightPanel.isTabAvailable(tabName)
      );
    };

    if (shouldTestTab('overview')) {
      await this.testOverviewTab(skipCRUD);
    }

    if (shouldTestTab('schema')) {
      await this.testSchemaTab();
    }

    if (shouldTestTab('lineage')) {
      await this.testLineageTab();
    }

    if (shouldTestTab('data quality')) {
      await this.testDataQualityTab();
    }

    if (shouldTestTab('custom property')) {
      await this.testCustomPropertiesTab();
    }
  }

  private async testOverviewTab(skipCRUD: boolean = false): Promise<void> {
    await this.overview.navigateToOverviewTab();
    await this.overview.shouldBeVisible();

    if (!skipCRUD) {
      await this.overview.shouldShowDescriptionSection();
    }
  }

  private async testSchemaTab(): Promise<void> {
    await this.schema.navigateToSchemaTab();
    await this.schema.shouldBeVisible();
  }

  private async testLineageTab(): Promise<void> {
    await this.lineage.navigateToLineageTab();
    await this.lineage.shouldBeVisible();
    await this.lineage.shouldShowLineageControls();
  }

  private async testDataQualityTab(): Promise<void> {
    await this.dataQuality.navigateToDataQualityTab();
    await this.dataQuality.shouldBeVisible();
  }

  private async testCustomPropertiesTab(): Promise<void> {
    await this.customProperties.navigateToCustomPropertiesTab();
    await this.customProperties.shouldShowCustomPropertiesContainer();
  }

  async testDescriptionCRUD(description: string): Promise<void> {
    await this.overview.navigateToOverviewTab();
    await this.overview.editDescription(description);
    await this.overview.shouldShowDescriptionWithText(description);
  }

  async testOwnersCRUD(
    ownerName: string,
    type: 'Users' | 'Teams' = 'Users'
  ): Promise<void> {
    await this.overview.navigateToOverviewTab();
    await this.overview.addOwnerWithoutValidation(ownerName);
    await this.overview.shouldShowOwner(ownerName);

    await this.overview.removeOwner([ownerName], type);
  }

  async testTagsCRUD(tagName: string): Promise<void> {
    await this.overview.navigateToOverviewTab();
    await this.overview.editTags(tagName);
    await this.overview.shouldShowTag(tagName);

    await this.overview.removeTag([tagName]);
  }

  async testGlossaryTermsCRUD(termName: string): Promise<void> {
    await this.overview.navigateToOverviewTab();
    await this.overview.editGlossaryTerms(termName);
    await this.overview.shouldShowGlossaryTermsSection();

    await this.overview.removeGlossaryTerm([termName]);
  }

  async testTierCRUD(tierName: string): Promise<void> {
    await this.overview.navigateToOverviewTab();
    await this.overview.assignTier(tierName);
    await this.overview.shouldShowTier(tierName);

    await this.overview.removeTier();
  }

  async testDomainCRUD(domainName: string): Promise<void> {
    await this.overview.navigateToOverviewTab();
    await this.overview.editDomain(domainName);
    await this.overview.shouldShowDomain(domainName);

    await this.overview.removeDomain(domainName);
  }

  async testAsRole(
    role: 'Admin' | 'DataSteward' | 'DataConsumer'
  ): Promise<void> {
    this.rightPanel.setRolePermissions(role);
    await this.rightPanel.verifyPermissions();
  }

  async verifyTabsAvailability(expectedTabs: string[]): Promise<void> {
    for (const tab of expectedTabs) {
      expect(this.rightPanel.isTabAvailable(tab)).toBeTruthy();
    }
  }

  async verifyEmptyStates(): Promise<void> {
    await this.overview.navigateToOverviewTab();

    if (this.rightPanel.isTabAvailable('data quality')) {
      await this.dataQuality.navigateToDataQualityTab();
      await this.dataQuality.shouldShowTestCaseCardsCount(0);
    }
  }

  getRightPanel(): RightPanelPageObject {
    return this.rightPanel;
  }

  getOverview(): OverviewPageObject {
    return this.overview;
  }

  getSchema(): SchemaPageObject {
    return this.schema;
  }

  getLineage(): LineagePageObject {
    return this.lineage;
  }

  getDataQuality(): DataQualityPageObject {
    return this.dataQuality;
  }

  getCustomProperties(): CustomPropertiesPageObject {
    return this.customProperties;
  }
}
