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
import type { RightPanelPageObject } from './RightPanelPageObject';

/**
 * Base class for right-panel tab Page Objects only.
 * Holds shared Playwright logic: page reference, getSummaryPanel, waitForLoadersToDisappear, waitForVisible.
 * Defined in this file to avoid circular dependency; other tab POs import RightPanelBase from here.
 */
export abstract class RightPanelBase {
  protected readonly rightPanel: RightPanelPageObject;

  constructor(rightPanel: RightPanelPageObject) {
    this.rightPanel = rightPanel;
  }

  protected get page(): Page {
    return this.rightPanel.page;
  }

  protected getSummaryPanel(): Locator {
    return this.rightPanel.getSummaryPanel();
  }

  protected async waitForLoadersToDisappear(): Promise<void> {
    await this.rightPanel.waitForLoadersToDisappear();
  }

  protected async waitForVisible(locator: Locator): Promise<void> {
    await locator.waitFor({ state: 'visible' });
  }
}

/**
 * PROPER PAGE OBJECT PATTERN FOR OVERVIEW TAB
 *
 * Handles overview section interactions: description, tags, tiers, domains, etc.
 */
export class OverviewPageObject extends RightPanelBase {
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
  private readonly domainList: Locator;
  private readonly glossaryTermSearchBar: Locator;
  private readonly tagListContainer: Locator;
  private readonly tierListContainer: Locator;
  private readonly updateTierButton: Locator;
  private readonly tierList: Locator;
  private readonly glossaryTermListContainer: Locator;
  private readonly userSearchBar: Locator;
  private readonly userListItem: Locator;
  private readonly userListContainer: Locator;
  private readonly editOwnersIcon: Locator;
  private readonly updateOwnersButton: Locator;
  private readonly dataQualitySectionInOverview: Locator;
  private readonly lineageSection: Locator;
  private readonly selectOwnerTabs: Locator;
  private readonly selectOwnerTabsRoleTab: Locator;
  private readonly selectOwnerTabsLoader: Locator;
  private readonly selectOwnerUsersTab: Locator;
  private readonly teamsSearchBar: Locator;
  private readonly listItem: Locator;
  private readonly domainTree: Locator;
  private readonly domainTreeNode: Locator;
  private readonly clearTierButton: Locator;
  private readonly tagsSection: Locator;
  private readonly tierSection: Locator;
  private readonly domainsSection: Locator;

  constructor(rightPanel: RightPanelPageObject) {
    super(rightPanel);
    this.container = this.getSummaryPanel();
    this.lineageSection = this.getSummaryPanel().locator('.lineage-content');

    // Scoped locators for action elements
    this.editDescriptionIcon = this.getSummaryPanel().locator(
      '[data-testid="edit-description"]'
    );
    this.editTagsIcon = this.getSummaryPanel().locator(
      '[data-testid="edit-icon-tags"]'
    );
    this.editGlossaryTermsIcon = this.getSummaryPanel().locator(
      '[data-testid="edit-glossary-terms"]'
    );
    this.editTierIcon = this.getSummaryPanel().getByTestId('edit-icon-tier');
    this.addDomainIcon = this.getSummaryPanel().getByTestId('add-domain');
    this.markdownEditor = this.page.locator(
      '.om-block-editor[contenteditable="true"]'
    );
    this.saveButton = this.page.getByTestId('save');
    this.updateButton = this.page.getByTestId('selectable-list-update-btn');
    this.loader = this.page.getByTestId('loader');
    this.selectableList = this.page.getByTestId('selectable-list');
    this.descriptionSection = this.getSummaryPanel().locator(
      '.description-section'
    );
    this.searchBar = this.page.getByTestId('search-bar-container');
    this.tagSearchBar = this.searchBar.getByTestId('tag-select-search-bar');
    this.domainTree = this.page.getByTestId('domain-selectable-tree');
    this.domainSearchBar = this.domainTree.getByTestId('searchbar');
    this.domainList = this.page.locator('.domains-content');
    this.glossaryTermSearchBar = this.searchBar.getByTestId(
      'glossary-term-select-search-bar'
    );
    this.tagListContainer = this.page.locator('.tags-section');
    this.tierListContainer = this.page.getByTestId('cards');
    this.updateTierButton = this.page.getByTestId('update-tier-card');
    this.tierList = this.getSummaryPanel().getByTestId('Tier');
    this.glossaryTermListContainer =
      this.page.getByTestId('glossary-container');
    this.userSearchBar = this.page.getByTestId('owner-select-users-search-bar');
    this.userListItem = this.page.locator('.ant-list-item-main');
    this.userListContainer = this.page.getByTestId('user-tag');
    this.editOwnersIcon = this.getSummaryPanel().getByTestId('edit-owners');
    this.updateOwnersButton = this.page.getByTestId(
      'selectable-list-update-btn'
    );
    this.dataQualitySectionInOverview = this.getSummaryPanel().locator(
      '.data-quality-section, .data-quality-content'
    );
    this.selectOwnerTabs = this.page.getByTestId('select-owner-tabs');
    this.selectOwnerTabsRoleTab = this.page
      .locator('[data-testid="select-owner-tabs"] [role="tab"]')
      .first();
    this.selectOwnerTabsLoader = this.page.locator(
      '[data-testid="select-owner-tabs"] .ant-spin-dot'
    );
    this.selectOwnerUsersTab = this.selectOwnerTabs.getByRole('tab', {
      name: 'Users',
    });
    this.teamsSearchBar = this.page.getByTestId(
      'owner-select-teams-search-bar'
    );
    this.listItem = this.page.locator('.ant-list-item');
    this.domainTreeNode = this.domainTree.locator('.ant-tree-treenode');
    this.clearTierButton = this.tierListContainer.getByTestId('clear-tier');
    this.tagsSection = this.container.locator('.tags-section, [class*="tags"]');
    this.tierSection = this.container.locator('.tier-section, [class*="tier"]');
    this.domainsSection = this.container.locator(
      '.domains-section, [class*="domain"]'
    );
  }

  // ============ NAVIGATION METHODS (Fluent Interface) ============

  /**
   * Navigate to the Overview tab
   * @returns OverviewPageObject for method chaining
   */
  async navigateToOverviewTab(): Promise<OverviewPageObject> {
    await this.rightPanel.navigateToTab('overview');
    await this.waitForLoadersToDisappear();
    return this;
  }

  /**
   * Reusable assertion: navigate to Overview tab and assert tab + description section visible.
   */
  async assertContent(): Promise<void> {
    await this.navigateToOverviewTab();
    await this.shouldBeVisible();
    await this.shouldShowDescriptionSection();
  }

  // ============ ACTION METHODS (Fluent Interface) ============

  /**
   * Edit description in the overview tab
   * @param description - New description text
   * @returns OverviewPageObject for method chaining
   */
  async editDescription(description: string): Promise<OverviewPageObject> {
    await this.editDescriptionIcon.waitFor({ state: 'visible' });
    await this.editDescriptionIcon.dispatchEvent('click');

    // Wait for the markdown editor modal to be fully visible - use semantic selector
    await this.markdownEditor.waitFor({ state: 'visible' });

    await this.markdownEditor.click();
    await this.page.keyboard.press('ControlOrMeta+a');
    await this.page.keyboard.press('Backspace');
    if (description) {
      await this.markdownEditor.fill(description);
    }

    // Set up PATCH listener before clicking save so we don't race with the response.
    // This ensures the description is committed to the server before the caller proceeds
    // (particularly important when clearing description and then immediately reloading).
    const patchPromise = this.waitForPatchResponse();
    await this.saveButton.click();
    await patchPromise;
    return this;
  }

  /**
   * Edit tags in the overview tab
   * @param tagName - Name of the tag to add
   * @returns OverviewPageObject for method chaining
   */
  async editTags(tagName: string): Promise<OverviewPageObject> {
    // Use dispatchEvent to avoid Playwright's internal scroll-into-view on click().
    // Scrolling the panel container triggers a React re-render that detaches the icon,
    // causing Playwright to retry the scroll → re-render → infinite loop under load.
    await this.editTagsIcon.waitFor({ state: 'visible' });
    await this.editTagsIcon.dispatchEvent('click');

    // Wait for the tag selection modal to be visible
    await this.selectableList.waitFor({ state: 'visible' });

    // Use semantic search bar selector
    await this.tagSearchBar.fill(tagName);

    // Scope loader to the selectable-list to avoid strict-mode violations when
    // multiple [data-testid="loader"] elements coexist on the page during
    // parallel test runs (e.g. one inside lineage section, one inside the popover).
    await this.selectableList
      .getByTestId('loader')
      .waitFor({ state: 'hidden' });

    // Use getByTitle to target the outer .selectable-list-item wrapper, which carries the
    // 'active' CSS class when the tag is already selected.
    const tagItem = this.selectableList.getByTitle(tagName);
    await tagItem.waitFor({ state: 'visible' });

    // Only click if not already active — in parallel test runs another test may have added
    // this tag already. Clicking an already-active item would deselect (remove) it.
    // Use dispatchEvent to avoid scroll-triggered re-renders.
    const isAlreadySelected = await tagItem.evaluate((el) =>
      el.classList.contains('active')
    );
    if (!isAlreadySelected) {
      await tagItem.dispatchEvent('click');
    }

    await this.updateButton.waitFor({ state: 'visible' });
    await this.updateButton.click();

    // After update the popover closes; rely on tag list container assertions
    // with built-in retry rather than a page-wide loader that may be ambiguous.
    await this.tagListContainer.waitFor({ state: 'visible' });
    await expect(this.tagListContainer).toContainText(tagName);

    return this;
  }

  /**
   * Edit glossary terms in the overview tab
   * @param termName - Name of the glossary term to add
   * @returns OverviewPageObject for method chaining
   */
  async editGlossaryTerms(termName: string): Promise<OverviewPageObject> {
    await this.editGlossaryTermsIcon.click();

    await this.selectableList.waitFor({ state: 'visible' });

    // Use semantic search bar selector
    await this.glossaryTermSearchBar.fill(termName);

    // Scope loader to selectableList to avoid strict-mode violations when a
    // parallel test has a lineage or other section loader visible at the same time.
    await this.selectableList
      .getByTestId('loader')
      .waitFor({ state: 'hidden' });

    // Use getByTitle to target the outer .selectable-list-item wrapper, which carries the
    // 'active' CSS class when the term is already selected.
    const termItem = this.selectableList.getByTitle(termName);
    await termItem.waitFor({ state: 'visible' });
    await termItem.scrollIntoViewIfNeeded();

    // Only click if not already active — parallel tests may have added this term already.
    // Clicking an already-active item would deselect (remove) it.
    const isAlreadySelected = await termItem.evaluate((el) =>
      el.classList.contains('active')
    );
    if (!isAlreadySelected) {
      await termItem.click();
    }

    await this.updateButton.waitFor({ state: 'visible' });
    await this.updateButton.click();
    // After update the popover closes; rely on glossary-term container assertion
    // with built-in retry rather than a page-wide loader that may be ambiguous.
    await this.glossaryTermListContainer.waitFor({ state: 'visible' });
    await expect(this.glossaryTermListContainer).toContainText(termName);
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
    const tierRadioButton = this.tierListContainer.getByTestId(
      `radio-btn-${tierName}`
    );
    await tierRadioButton.scrollIntoViewIfNeeded();
    await tierRadioButton.waitFor({ state: 'visible' });
    await tierRadioButton.click();

    await this.updateTierButton.waitFor({ state: 'visible' });
    await this.updateTierButton.click();

    // Wait for loader to disappear
    await this.loader.waitFor({ state: 'hidden' });
    await this.tierList.waitFor({ state: 'visible' });
    await expect(this.tierList).toContainText(tierName);
    return this;
  }

  /**
   * Edit domain in the overview tab
   * @param domainName - Name of the domain to assign
   * @returns OverviewPageObject for method chaining
   */
  async editDomain(domainName: string): Promise<OverviewPageObject> {
    // Pre-flight: if domain is already displayed, skip the tree interaction.
    // In parallel test runs another test may have assigned this domain already.
    // Clicking an already-selected AntD tree node (isClearable=true) deselects it,
    // which would remove the domain instead of adding it.
    const alreadyAssigned = await this.domainList
      .getByText(domainName, { exact: false })
      .isVisible();

    if (!alreadyAssigned) {
      await this.addDomainIcon.click();

      await this.loader.waitFor({ state: 'detached' });
      await this.domainSearchBar.waitFor({ state: 'visible' });
      await this.domainSearchBar.scrollIntoViewIfNeeded();
      await this.domainSearchBar.fill(domainName);

      await this.loader.waitFor({ state: 'detached' });

      await this.domainTreeNode
        .filter({ hasText: domainName })
        .waitFor({ state: 'visible' });
      await this.domainTreeNode.filter({ hasText: domainName }).click();

      await this.loader.waitFor({ state: 'hidden' });
    }

    await this.domainList.waitFor({ state: 'visible' });
    await expect(this.domainList).toContainText(domainName);
    return this;
  }

  async addOwnerWithoutValidation(
    owner: string,
    type: 'Teams' | 'Users' = 'Users'
  ): Promise<OverviewPageObject> {
    await this.editOwnersIcon.click();

    await this.selectOwnerTabs.waitFor({ state: 'visible' });
    await this.selectOwnerTabsRoleTab.waitFor({ state: 'visible' });

    if (type === 'Users') {
      const isAlreadyActive = await this.selectOwnerUsersTab.getAttribute(
        'aria-selected'
      );
      if (isAlreadyActive !== 'true') {
        await this.selectOwnerUsersTab.click();
      }
    }

    await expect(this.selectOwnerTabsLoader).toHaveCount(0);
    await this.userSearchBar.waitFor({ state: 'visible' });

    const searchUser = this.page.waitForResponse(
      `/api/v1/search/query?q=*${encodeURIComponent(owner)}*`
    );
    await this.userSearchBar.fill(owner);

    await searchUser;

    await expect(this.selectOwnerTabsLoader).toHaveCount(0);

    if (type === 'Teams') {
      await this.page
        .getByRole('listitem', { name: owner, exact: true })
        .click();
    } else {
      await this.page
        .getByRole('listitem', { name: owner, exact: true })
        .click();
      await this.updateOwnersButton.click();
    }
    await this.loader.waitFor({ state: 'detached' });
    return this;
  }

  async editOwners(ownerName: string): Promise<OverviewPageObject> {
    await this.editOwnersIcon.scrollIntoViewIfNeeded();
    await this.editOwnersIcon.click({ force: true });
    await this.userSearchBar.waitFor({ state: 'visible' });
    await this.userSearchBar.scrollIntoViewIfNeeded();
    await this.userSearchBar.fill(ownerName);
    await this.loader.waitFor({ state: 'hidden' });
    await this.userListItem
      .filter({ hasText: ownerName })
      .waitFor({ state: 'visible' });
    await this.userListItem.filter({ hasText: ownerName }).click();
    await this.updateButton.waitFor({ state: 'visible' });
    await this.updateButton.click();
    await this.loader.waitFor({ state: 'hidden' });
    await this.userListContainer.waitFor({ state: 'visible' });
    await expect(this.userListContainer).toContainText(ownerName);
    return this;
  }

  // ============ REMOVAL METHODS (Fluent Interface) ============

  /**
   * Remove owner from the overview tab
   * @param ownerNames - Array of owner names to remove
   * @param type - Type of owner (Users or Teams)
   * @returns OverviewPageObject for method chaining
   */
  async removeOwner(
    ownerNames: string[],
    type: 'Users' | 'Teams' = 'Users'
  ): Promise<OverviewPageObject> {
    await this.editOwnersIcon.waitFor({ state: 'visible' });
    await this.editOwnersIcon.click({ force: true });

    await this.selectOwnerTabs.waitFor({ state: 'visible' });
    await this.page.getByRole('tab', { name: type }).click();

    let anyChangesMade = false;
    for (const ownerName of ownerNames) {
      const searchBar =
        type === 'Users' ? this.userSearchBar : this.teamsSearchBar;

      await expect(this.selectOwnerTabsLoader).toHaveCount(0);
      await searchBar.waitFor({ state: 'visible' });
      await searchBar.fill(ownerName);

      const ownerItem = this.listItem.filter({ hasText: ownerName });
      await ownerItem.waitFor({ state: 'visible' });

      // Check if it's currently selected (active) before clicking
      // If it's not active, another parallel test may have already removed it
      const isActive = await ownerItem.evaluate((el) =>
        el.classList.contains('active')
      );

      if (isActive) {
        await ownerItem.click();
        anyChangesMade = true;
      }
    }

    await this.updateButton.waitFor({ state: 'visible' });

    // Only wait for PATCH response if we actually deselected an owner.
    // If no owner was active (already removed by a parallel test), clicking
    // update sends no change and no PATCH is issued — waiting would hang forever.
    if (anyChangesMade) {
      const patchPromise = this.waitForPatchResponse();
      await this.updateButton.click();
      await patchPromise;
    } else {
      await this.updateButton.click();
    }
    return this;
  }

  /**
   * Remove tag from the overview tab
   * @param tagDisplayNames - Array of tag names to remove
   * @returns OverviewPageObject for method chaining
   */
  async removeTag(tagDisplayNames: string[]): Promise<OverviewPageObject> {
    await this.editTagsIcon.click();
    await this.selectableList.waitFor({ state: 'visible' });
    await this.selectableList
      .getByTestId('loader')
      .waitFor({ state: 'detached' });

    for (const tagName of tagDisplayNames) {
      const tagOption = this.page.getByTitle(tagName);
      await tagOption.waitFor({ state: 'visible' });
      // Only click if it's currently active (selected)
      const isActive = await tagOption.evaluate((el) =>
        el.classList.contains('active')
      );
      if (isActive) {
        await tagOption.click();
      }
    }

    const patchPromise = this.waitForPatchResponse();
    await this.updateButton.click();
    await patchPromise;

    return this;
  }

  /**
   * Remove glossary term from the overview tab
   * @param termDisplayNames - Array of glossary term names to remove
   * @returns OverviewPageObject for method chaining
   */
  async removeGlossaryTerm(
    termDisplayNames: string[]
  ): Promise<OverviewPageObject> {
    await this.editGlossaryTermsIcon.scrollIntoViewIfNeeded();
    await this.editGlossaryTermsIcon.waitFor({ state: 'visible' });
    await this.editGlossaryTermsIcon.click({ force: true });

    await this.selectableList.waitFor({ state: 'visible' });
    await this.selectableList
      .getByTestId('loader')
      .waitFor({ state: 'detached' });

    for (const termName of termDisplayNames) {
      await this.glossaryTermSearchBar.fill(termName);

      const termItem = this.listItem.filter({ hasText: termName });
      await termItem.waitFor({ state: 'visible' });

      // Only click if it's currently active (selected)
      const isActive = await termItem.evaluate((el) =>
        el.classList.contains('active')
      );
      if (isActive) {
        await termItem.click();
      }

      await this.glossaryTermSearchBar.clear();
    }

    const patchPromise = this.waitForPatchResponse();
    await this.updateButton.click();
    await patchPromise;

    return this;
  }

  /**
   * Remove tier from the overview tab
   * @returns OverviewPageObject for method chaining
   */
  async removeTier(): Promise<OverviewPageObject> {
    await this.editTierIcon.scrollIntoViewIfNeeded();
    await this.editTierIcon.waitFor({ state: 'visible' });
    await this.editTierIcon.click({ force: true });

    await this.tierListContainer.waitFor({ state: 'visible' });
    await this.clearTierButton.waitFor({ state: 'visible' });

    const patchPromise = this.waitForPatchResponse();
    await this.clearTierButton.click();
    await patchPromise;

    return this;
  }

  /**
   * Remove domain from the overview tab
   * @param domainName - Name of the domain to remove
   * @returns OverviewPageObject for method chaining
   */
  async removeDomain(domainName: string): Promise<OverviewPageObject> {
    await this.addDomainIcon.waitFor({ state: 'visible' });
    await this.addDomainIcon.click({ force: true });

    await this.domainTree.waitFor({ state: 'visible' });

    const searchDomainPromise = this.page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes(`q=`)
    );

    await this.domainSearchBar.fill(domainName);
    await searchDomainPromise;

    const domainItem = this.domainTreeNode.filter({ hasText: domainName });
    const patchPromise = this.waitForPatchResponse();

    await domainItem.click();

    await patchPromise;
    return this;
  }

  // ============ DELETED ENTITY VERIFICATION METHODS ============

  /**
   * Verify that a deleted owner is not visible in the owner selection dropdown
   * @param ownerName - Name of the deleted owner
   * @param type - Type of owner (Users or Teams)
   * @returns Locator of the deleted item (should not be visible)
   */
  async verifyDeletedOwnerNotVisible(
    ownerName: string,
    type: 'Users' | 'Teams' = 'Users'
  ): Promise<Locator> {
    const searchIndexMap = {
      Users: 'user_search_index',
      Teams: 'team_search_index',
    };

    await this.editOwnersIcon.click({ force: true });

    await this.selectOwnerTabsRoleTab.waitFor({ state: 'visible' });

    if (type === 'Users') {
      const isAlreadyActive = await this.selectOwnerUsersTab.getAttribute(
        'aria-selected'
      );
      if (isAlreadyActive !== 'true') {
        await this.selectOwnerUsersTab.click();
      }
    }

    const searchBar =
      type === 'Users' ? this.userSearchBar : this.teamsSearchBar;
    await searchBar.waitFor({ state: 'visible' });

    const searchResponsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes(`index=${searchIndexMap[type]}`)
    );

    await searchBar.fill(ownerName);
    const searchResponse = await searchResponsePromise;
    expect(searchResponse.status()).toBe(200);

    await expect(this.selectOwnerTabsLoader).toHaveCount(0);

    return this.page.getByTitle(ownerName);
  }

  /**
   * Verify that a deleted tag is not visible in the tag selection dropdown
   * @param tagName - Name of the deleted tag
   * @returns Locator of the deleted item (should not be visible)
   */
  async verifyDeletedTagNotVisible(tagName: string): Promise<Locator> {
    await this.editTagsIcon.click();
    await this.selectableList.waitFor({ state: 'visible' });
    await this.selectableList
      .getByTestId('loader')
      .waitFor({ state: 'detached' });

    const searchResponsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('index=tag_search_index')
    );

    await this.tagSearchBar.fill(tagName);
    const searchResponse = await searchResponsePromise;
    expect(searchResponse.status()).toBe(200);

    await this.selectableList
      .getByTestId('loader')
      .waitFor({ state: 'detached' });

    return this.page.getByTitle(tagName);
  }

  /**
   * Verify that a deleted glossary term is not visible in the glossary term selection dropdown
   * @param termName - Name of the deleted glossary term
   * @returns Locator of the deleted item (should not be visible)
   */
  async verifyDeletedGlossaryTermNotVisible(
    termName: string
  ): Promise<Locator> {
    await this.editGlossaryTermsIcon.click();
    await this.selectableList.waitFor({ state: 'visible' });
    await this.selectableList
      .getByTestId('loader')
      .waitFor({ state: 'detached' });

    const searchResponsePromise = this.page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes('index=glossary_term_search_index')
    );

    await this.glossaryTermSearchBar.fill(termName);
    const searchResponse = await searchResponsePromise;
    expect(searchResponse.status()).toBe(200);

    await this.selectableList
      .getByTestId('loader')
      .waitFor({ state: 'detached' });

    return this.page.getByTitle(termName);
  }

  // ============ HELPER METHODS ============

  private async waitForPatchResponse(): Promise<void> {
    const responsePromise = this.page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/v1/') &&
        resp.request().method() === 'PATCH' &&
        !resp.url().includes('/api/v1/analytics')
    );

    const response = await responsePromise;
    expect(response.status()).toBe(200);
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
    await this.domainList.waitFor({ state: 'visible' });
  }

  /**
   * Verify owners section is visible
   */
  async shouldShowOwner(ownerName: string): Promise<void> {
    await this.page.getByTestId(`${ownerName}`).waitFor({ state: 'visible' });
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
    await this.lineageSection.waitFor({ state: 'visible' });
  }

  /**
   * Verify a specific tag is visible in the overview
   * @param tagName - Name of the tag to verify
   */
  async shouldShowTag(tagName: string): Promise<void> {
    await this.tagsSection.getByText(tagName).waitFor({ state: 'visible' });
  }

  /**
   * Verify a specific tier is assigned
   * @param tierName - Name of the tier to verify
   */
  async shouldShowTier(tierName: string): Promise<void> {
    await this.tierSection.getByText(tierName).waitFor({ state: 'visible' });
  }

  /**
   * Verify a specific domain is assigned
   * @param domainName - Name of the domain to verify
   */
  async shouldShowDomain(domainName: string): Promise<void> {
    await this.domainsSection
      .getByText(domainName)
      .waitFor({ state: 'visible' });
  }

  /**
   * Verify description contains specific text
   * @param expectedText - Text to verify in description
   */
  async shouldShowDescriptionWithText(expectedText: string): Promise<void> {
    await this.descriptionSection
      .getByText(expectedText)
      .waitFor({ state: 'visible' });
  }

  /**
   * Assert internal fields of the Overview tab for the given asset type.
   * Verifies key sections always rendered in DataAssetSummaryPanelV1: description, tags, tier, owners, domains, glossary.
   * Call after navigating to Overview tab (e.g. from assertTabInternalFieldsByAssetType).
   */
  async assertInternalFieldsForAssetType(assetType: string): Promise<void> {
    const tabLabel = 'Overview';
    const prefix = `[Asset: ${assetType}] [Tab: ${tabLabel}]`;

    await expect(
      this.descriptionSection,
      `${prefix} Missing: description section`
    ).toBeVisible();

    await expect(
      this.tagListContainer,
      `${prefix} Missing: tags section`
    ).toBeVisible();

    await expect(
      this.editTierIcon,
      `${prefix} Missing: tier section`
    ).toBeVisible();

    await expect(
      this.editOwnersIcon,
      `${prefix} Missing: owners section`
    ).toBeVisible();

    await expect(
      this.domainList,
      `${prefix} Missing: domains section`
    ).toBeVisible();

    await expect(
      this.glossaryTermListContainer,
      `${prefix} Missing: glossary terms section`
    ).toBeVisible();
  }

  /**
   * Assert the Data Quality section is visible in the Overview tab.
   * Use when the asset has a visible Data Quality tab (cross-tab dependency).
   */
  async assertDataQualitySectionVisible(): Promise<void> {
    await expect(this.dataQualitySectionInOverview).toBeVisible();
  }

  /**
   * Assert the Data Quality section is not visible in the Overview tab.
   * Use when the asset does not have a Data Quality tab (cross-tab dependency).
   */
  async assertDataQualitySectionNotVisible(): Promise<void> {
    await expect(this.dataQualitySectionInOverview).not.toBeVisible();
  }
}
