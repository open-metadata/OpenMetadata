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

import { Locator, Page, expect } from '@playwright/test';
import { RightPanelPageObject } from './RightPanelPageObject';

/**
 * PROPER PAGE OBJECT PATTERN FOR OVERVIEW TAB
 *
 * Handles overview section interactions: description, tags, tiers, domains, etc.
 */
export class OverviewPageObject {
  private readonly rightPanel: RightPanelPageObject;
  private readonly page: Page;

  // ============ PRIVATE LOCATORS (scoped to right panel) ============
  private readonly container: Locator;
  private readonly editDescriptionIcon: Locator;
  private readonly editTagsIcon: Locator;
  private readonly editGlossaryTermsIcon: Locator;
  private readonly editTierIcon: Locator;
  private readonly addDomainIcon: Locator;
  private readonly markdownEditor: Locator;
  private readonly saveButton: Locator;
  private readonly updateButton: Locator;
  private readonly loader: Locator;
  private readonly selectableList: Locator;
  private readonly descriptionSection: Locator;
  private readonly searchBar: Locator;
  private readonly tagSearchBar: Locator;
  private readonly domainSearchBar: Locator;
  private readonly glossaryTermSearchBar: Locator;
  private readonly tagListItem: Locator;
  private readonly tagListContainer: Locator;
  private readonly tierListContainer: Locator;
  private readonly updateTierButton: Locator;
  private readonly tierList: Locator;
  private readonly glossaryTermListItem: Locator;
  private readonly glossaryTermListContainer: Locator;

  constructor(rightPanel: RightPanelPageObject, page: Page) {
    this.rightPanel = rightPanel;
    this.page = page;
    // Container scoped to right panel summary panel
    this.container = this.rightPanel.getSummaryPanel();

    // Scoped locators for action elements
    this.editDescriptionIcon = this.page.locator('[data-testid="edit-description"]');
    this.editTagsIcon = this.page.locator('[data-testid="edit-icon-tags"]');
    this.editGlossaryTermsIcon = this.page.locator('[data-testid="edit-glossary-terms"]');
    this.editTierIcon = this.page.getByTestId('edit-icon-tier');
    this.addDomainIcon = this.page.getByTestId('add-domain');
    this.markdownEditor = this.page.locator('.om-block-editor[contenteditable="true"]');
    this.saveButton = this.page.getByTestId('save');
    this.updateButton = this.page.getByTestId('selectable-list-update-btn');
    this.loader = this.page.getByTestId('loader');
    this.selectableList = this.page.getByTestId('selectable-list');
    this.descriptionSection = this.page.locator('.description-section');
    this.searchBar = this.page.getByTestId('search-bar-container');
    this.tagSearchBar = this.searchBar.getByTestId('tag-select-search-bar');
    this.domainSearchBar = this.searchBar.getByTestId('searchbar');
    this.glossaryTermSearchBar = this.searchBar.getByTestId('glossary-term-select-search-bar');
    this.tagListItem = this.selectableList.locator('.ant-list-item-main');
    this.tagListContainer = this.page.locator('.tags-section');
    this.tierListContainer = this.page.getByTestId('cards');
    this.updateTierButton = this.page.getByTestId('update-tier-card');
    this.tierList = this.page.getByTestId('Tier');
    this.glossaryTermListItem = this.page.locator('.ant-list-item-main');
    this.glossaryTermListContainer = this.page.getByTestId('glossary-container');
  }

  // ============ NAVIGATION METHODS (Fluent Interface) ============

  /**
   * Navigate to the Overview tab
   * @returns OverviewPageObject for method chaining
   */
  async navigateToOverviewTab(): Promise<OverviewPageObject> {
    await this.rightPanel.navigateToTab('overview');
    await this.rightPanel.waitForLoadersToDisappear();
    return this;
  }


  // ============ ACTION METHODS (Fluent Interface) ============

  /**
   * Edit description in the overview tab
   * @param description - New description text
   * @returns OverviewPageObject for method chaining
   */
  async editDescription(description: string): Promise<OverviewPageObject> {
    await this.editDescriptionIcon.click();

    // Wait for the markdown editor modal to be fully visible - use semantic selector
    await this.markdownEditor.waitFor({ state: 'visible' });

    await this.markdownEditor.clear();
    await this.markdownEditor.fill(description);
    await this.saveButton.click();
    await this.rightPanel.waitForPatchResponse();
    return this;
  }

  /**
   * Edit tags in the overview tab
   * @param tagName - Name of the tag to add
   * @returns OverviewPageObject for method chaining
   */
  async editTags(tagName: string): Promise<OverviewPageObject> {
    await this.editTagsIcon.click();

    // Wait for the tag selection modal to be visible
    await this.selectableList.waitFor({ state: 'visible' });

    // Use semantic search bar selector
    await this.tagSearchBar.fill(tagName);

    // Wait for loader to disappear
    await this.loader.waitFor({ state: 'hidden' });

    // Find and click the   tag option

    await this.tagListItem.filter({ hasText: tagName }).waitFor({ state: 'visible' });
    await this.tagListItem.filter({ hasText: tagName }).scrollIntoViewIfNeeded();
    await this.tagListItem.filter({ hasText: tagName }).click();
    await this.updateButton.waitFor({ state: 'visible' });
    await this.updateButton.click();

    await this.loader.waitFor({ state: 'hidden' });
    await this.tagListContainer.waitFor({ state: 'visible' });
    expect(this.tagListContainer).toContainText(tagName);


    return this;
  }

  /**
   * Edit glossary terms in the overview tab
   * @param termName - Name of the glossary term to add
   * @returns OverviewPageObject for method chaining
   */
  async editGlossaryTerms(termName: string): Promise<OverviewPageObject> {
    await this.editGlossaryTermsIcon.click();

    // Wait for the glossary term selection modal

    await this.selectableList.waitFor({ state: 'visible' });

    // Use semantic search bar selector
    await this.glossaryTermSearchBar.fill(termName);

    // Wait for loader to disappear
    await this.loader.waitFor({ state: 'hidden' });

    // Find and click the glossary term option
    await this.glossaryTermListItem.filter({ hasText: termName }).waitFor({ state: 'visible' });
    await this.glossaryTermListItem.filter({ hasText: termName }).click();
    await this.updateButton.waitFor({ state: 'visible' });
    await this.updateButton.click();
    await this.loader.waitFor({ state: 'hidden' });
    await this.glossaryTermListContainer.waitFor({ state: 'visible' });
    expect(this.glossaryTermListContainer).toContainText(termName);
    return this;
  }

  /**
   * Assign tier in the overview tab
   * @param tierName - Name of the tier to assign
   * @returns OverviewPageObject for method chaining
   */
  async assignTier(tierName: string): Promise<OverviewPageObject> {
    await this.editTierIcon.click();

    // Wait for the tier selection popover
    await this.tierListContainer.waitFor({ state: 'visible' });

    // Wait for loader to disappear
    await this.loader.waitFor({ state: 'hidden' });

    // Find and click the tier radio button
    const tierRadioButton = this.tierListContainer.getByTestId(`radio-btn-${tierName}`);
    await tierRadioButton.scrollIntoViewIfNeeded();
    await tierRadioButton.waitFor({ state: 'visible' });
    await tierRadioButton.click();

    await this.updateTierButton.waitFor({ state: 'visible' });
    await this.updateTierButton.click();

    await this.rightPanel.waitForPatchResponse();

    // Wait for loader to disappear
    await this.loader.waitFor({ state: 'hidden' });
    await this.tierList.waitFor({ state: 'visible' });
    expect(this.tierList).toContainText(tierName);
    return this;
  }

  /**
   * Edit domain in the overview tab
   * @param domainName - Name of the domain to assign
   * @returns OverviewPageObject for method chaining
   */
  async editDomain(domainName: string): Promise<OverviewPageObject> {
    await this.addDomainIcon.click();

    // Wait for the domain tree selector
    const tree = this.container.locator('[data-testid="domain-selectable-tree"], .domain-tree, [class*="domain"]');
    await tree.waitFor({ state: 'visible' });

    // Wait for search API response
    const searchDomainPromise = this.rightPanel.page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes(`q=`)
    );

    // Use semantic search bar selector
    
    await this.domainSearchBar.fill(domainName);

    await searchDomainPromise;

    const domainSelector = tree.getByText(domainName);
    await domainSelector.waitFor({ state: 'visible' });
    await domainSelector.click();

    await this.rightPanel.waitForPatchResponse();

    // Wait for loader to disappear
    await this.loader.waitFor({ state: 'hidden' });
    return this;
  }

  // ============ VERIFICATION METHODS (BDD Style) ============

  /**
   * Verify that the Overview tab is currently visible
   */
  async shouldBeVisible(): Promise<void> {
    await this.container.waitFor({ state: 'visible' });
  }

  /**
   * Verify description section is visible
   */
  async shouldShowDescriptionSection(): Promise<void> {
   await this.descriptionSection.waitFor({ state: 'visible' });
  }

  /**
   * Verify tags section is visible
   */
  async shouldShowTagsSection(): Promise<void> {

    await this.tagListContainer.waitFor({ state: 'visible' });
  }

  /**
   * Verify tier section is visible
   */
  async shouldShowTierSection(): Promise<void> {
    await this.tierList.waitFor({ state: 'visible' });
  }

  /**
   * Verify domains section is visible
   */
  async shouldShowDomainsSection(): Promise<void> {
    const domainsSection = this.container.locator('.domains-section, [class*="domain"]');
    await domainsSection.waitFor({ state: 'visible' });
  }

  /**
   * Verify owners section is visible
   */
  async shouldShowOwnersSection(): Promise<void> {
    const ownersSection = this.container.locator('.owners-section, [class*="owner"]');
    await ownersSection.waitFor({ state: 'visible' });
  }

  /**
   * Verify glossary terms section is visible
   */
  async shouldShowGlossaryTermsSection(): Promise<void> {
    await this.glossaryTermListContainer.waitFor({ state: 'visible' });
  }

  /**
   * Verify lineage section is visible
   */
  async shouldShowLineageSection(): Promise<void> {
    // await this.lineageSection.waitFor({ state: 'visible' });
  }

  /**
   * Verify a specific tag is visible in the overview
   * @param tagName - Name of the tag to verify
   */
  async shouldShowTag(tagName: string): Promise<void> {
    const tagsSection = this.container.locator('.tags-section, [class*="tags"]');
    await tagsSection.getByText(tagName).waitFor({ state: 'visible' });
  }

  /**
   * Verify a specific tier is assigned
   * @param tierName - Name of the tier to verify
   */
  async shouldShowTier(tierName: string): Promise<void> {
    const tierSection = this.container.locator('.tier-section, [class*="tier"]');
    await tierSection.getByText(tierName).waitFor({ state: 'visible' });
  }

  /**
   * Verify a specific domain is assigned
   * @param domainName - Name of the domain to verify
   */
  async shouldShowDomain(domainName: string): Promise<void> {
    const domainsSection = this.container.locator('.domains-section, [class*="domain"]');
    await domainsSection.getByText(domainName).waitFor({ state: 'visible' });
  }

  /**
   * Verify description contains specific text
   * @param expectedText - Text to verify in description
   */
  async shouldShowDescriptionWithText(expectedText: string): Promise<void> {
    await this.descriptionSection.getByText(expectedText).waitFor({ state: 'visible' });
  }
}