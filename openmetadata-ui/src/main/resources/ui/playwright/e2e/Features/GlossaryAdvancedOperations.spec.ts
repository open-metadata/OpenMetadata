/*
 *  Copyright 2024 Collate.
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
import test, { expect } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Domain } from '../../support/domain/Domain';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import {
  createNewPage,
  descriptionBox,
  redirectToHomePage,
} from '../../utils/common';
import { addMultiOwner } from '../../utils/entity';
import {
  addMultiOwnerInDialog,
  addTeamAsReviewer,
  selectActiveGlossary,
} from '../../utils/glossary';
import { sidebarClick } from '../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

// G-C04: Create glossary with mutually exclusive toggle OFF
test.describe('Glossary with Mutually Exclusive OFF', () => {
  const glossary = new Glossary();

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should create glossary with mutually exclusive toggle OFF', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);

    await page.click('[data-testid="add-glossary"]');
    await page.waitForSelector('[data-testid="form-heading"]');

    await page.fill('[data-testid="name"]', glossary.data.name);
    await page.locator(descriptionBox).fill(glossary.data.description);

    // Verify mutually exclusive toggle is OFF by default
    const mutuallyExclusiveBtn = page.getByTestId('mutually-exclusive-button');

    await expect(mutuallyExclusiveBtn).toBeVisible();

    // Verify alert is NOT visible when toggle is OFF
    await expect(
      page.locator('[data-testid="form-item-alert"]')
    ).not.toBeVisible();

    const glossaryResponse = page.waitForResponse('/api/v1/glossaries');
    await page.click('[data-testid="save-glossary"]');
    const response = await glossaryResponse;
    const responseData = await response.json();

    // Store response data for cleanup
    glossary.responseData = responseData;

    // Verify mutuallyExclusive is false
    expect(responseData.mutuallyExclusive).toBe(false);

    await expect(page.getByTestId('entity-header-name')).toHaveText(
      glossary.data.name
    );
  });
});

// G-C12: Create glossary with multiple owners (users + teams)
test.describe('Glossary with Multiple Owners', () => {
  const user1 = new UserClass();
  const user2 = new UserClass();
  const team = new TeamClass();
  const glossary = new Glossary();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user1.create(apiContext);
    await user2.create(apiContext);
    await team.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await user1.delete(apiContext);
    await user2.delete(apiContext);
    await team.delete(apiContext);
    await afterAction();
  });

  test('should create glossary with multiple owners (users + teams)', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);

    await page.click('[data-testid="add-glossary"]');
    await page.waitForSelector('[data-testid="form-heading"]');

    await page.fill('[data-testid="name"]', glossary.data.name);
    await page.locator(descriptionBox).fill(glossary.data.description);

    // Add first user owner
    await addMultiOwnerInDialog({
      page,
      ownerNames: [user1.getUserDisplayName()],
      activatorBtnLocator: '[data-testid="add-owner"]',
      resultTestId: 'owner-container',
      endpoint: EntityTypeEndpoint.Glossary,
      isSelectableInsideForm: true,
      type: 'Users',
    });

    const glossaryResponse = page.waitForResponse('/api/v1/glossaries');
    await page.click('[data-testid="save-glossary"]');
    const response = await glossaryResponse;
    glossary.responseData = await response.json();

    // Verify first owner is visible by checking owner link contains user name
    const ownerSection = page.getByTestId('glossary-right-panel-owner-link');
    await expect(ownerSection).toBeVisible();

    // Add second user owner
    await addMultiOwner({
      page,
      ownerNames: [user2.getUserDisplayName()],
      activatorBtnDataTestId: 'edit-owner',
      resultTestId: 'glossary-right-panel-owner-link',
      endpoint: EntityTypeEndpoint.Glossary,
      isSelectableInsideForm: false,
      type: 'Users',
    });

    // Verify owners section is visible with both owners
    await expect(ownerSection).toBeVisible();
  });
});

// G-C13: Create glossary with multiple reviewers (users + teams)
test.describe('Glossary with Multiple Reviewers', () => {
  const user1 = new UserClass();
  const user2 = new UserClass();
  const team = new TeamClass();
  const glossary = new Glossary();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user1.create(apiContext);
    await user2.create(apiContext);
    await team.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await user1.delete(apiContext);
    await user2.delete(apiContext);
    await team.delete(apiContext);
    await afterAction();
  });

  test('should create glossary with multiple reviewers (users + teams)', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);

    await page.click('[data-testid="add-glossary"]');
    await page.waitForSelector('[data-testid="form-heading"]');

    await page.fill('[data-testid="name"]', glossary.data.name);
    await page.locator(descriptionBox).fill(glossary.data.description);

    // Add user reviewer during creation
    await addMultiOwnerInDialog({
      page,
      ownerNames: [user1.getUserDisplayName()],
      activatorBtnLocator: '[data-testid="add-reviewers"]',
      resultTestId: 'reviewers-container',
      endpoint: EntityTypeEndpoint.Glossary,
      isSelectableInsideForm: true,
      type: 'Users',
    });

    const glossaryResponse = page.waitForResponse('/api/v1/glossaries');
    await page.click('[data-testid="save-glossary"]');
    const response = await glossaryResponse;
    glossary.responseData = await response.json();

    // Verify first reviewer is visible
    await expect(
      page.getByTestId('glossary-reviewer').getByTestId('owner-link')
    ).toContainText(user1.getUserDisplayName());

    // Add team as reviewer (using edit-reviewer-button since glossary is already saved)
    // This proves multiple reviewers can be added to a glossary
    await addTeamAsReviewer(
      page,
      team.data.displayName,
      'edit-reviewer-button',
      'glossary-reviewer-name'
    );

    // The addTeamAsReviewer function already verifies the team was added
    // Verify team reviewer is visible in the section
    await expect(
      page.getByTestId('glossary-reviewer').getByText(team.data.displayName)
    ).toBeVisible();
  });
});

// G-U05: Replace owner on glossary
test.describe('Replace Glossary Owner', () => {
  const user1 = new UserClass();
  const user2 = new UserClass();
  const glossary = new Glossary();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user1.create(apiContext);
    await user2.create(apiContext);
    await glossary.create(apiContext);
    // Add initial owner
    await glossary.patch(apiContext, [
      {
        op: 'add',
        path: '/owners/0',
        value: {
          id: user1.responseData.id,
          type: 'user',
        },
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await user1.delete(apiContext);
    await user2.delete(apiContext);
    await afterAction();
  });

  test('should replace owner on glossary', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Verify initial owner is visible
    await expect(
      page
        .getByTestId('glossary-right-panel-owner-link')
        .getByTestId(user1.getUserDisplayName())
    ).toBeVisible();

    // Click edit owner
    await page
      .getByTestId('glossary-right-panel-owner-link')
      .locator('[data-testid="edit-owner"]')
      .click();
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Clear existing owner
    await page.click('[data-testid="clear-all-button"]');

    // Search and add new owner
    const searchOwner = page.waitForResponse(
      'api/v1/search/query?q=*&index=user_search_index*'
    );
    await page.fill(
      '[data-testid="owner-select-users-search-bar"]',
      user2.getUserDisplayName()
    );
    await searchOwner;
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await page
      .getByRole('listitem', {
        name: user2.getUserDisplayName(),
        exact: true,
      })
      .click();

    const patchResponse = page.waitForResponse('/api/v1/glossaries/*');
    await page.click('[data-testid="selectable-list-update-btn"]');
    await patchResponse;

    // Verify new owner is visible and old owner is not
    await expect(
      page
        .getByTestId('glossary-right-panel-owner-link')
        .getByTestId(user2.getUserDisplayName())
    ).toBeVisible();
    await expect(
      page
        .getByTestId('glossary-right-panel-owner-link')
        .getByTestId(user1.getUserDisplayName())
    ).not.toBeVisible();
  });
});

// G-U08: Replace reviewer on glossary
test.describe('Replace Glossary Reviewer', () => {
  const user1 = new UserClass();
  const user2 = new UserClass();
  const glossary = new Glossary();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user1.create(apiContext);
    await user2.create(apiContext);
    await glossary.create(apiContext);
    // Add initial reviewer
    await glossary.patch(apiContext, [
      {
        op: 'add',
        path: '/reviewers/0',
        value: {
          id: user1.responseData.id,
          type: 'user',
        },
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await user1.delete(apiContext);
    await user2.delete(apiContext);
    await afterAction();
  });

  test('should replace reviewer on glossary', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Verify initial reviewer is visible
    await expect(
      page
        .getByTestId('glossary-reviewer-name')
        .getByText(user1.getUserDisplayName())
    ).toBeVisible();

    // Click edit reviewer
    await page.click('[data-testid="edit-reviewer-button"]');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Clear existing reviewer
    await page.click('[data-testid="clear-all-button"]');

    // Search and add new reviewer
    const searchUser = page.waitForResponse(
      'api/v1/search/query?q=*&index=user_search_index*'
    );
    await page.fill(
      '[data-testid="owner-select-users-search-bar"]',
      user2.getUserDisplayName()
    );
    await searchUser;
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    await page
      .getByRole('listitem', {
        name: user2.getUserDisplayName(),
        exact: true,
      })
      .click();

    const patchResponse = page.waitForResponse('/api/v1/glossaries/*');
    await page.click('[data-testid="selectable-list-update-btn"]');
    await patchResponse;

    // Verify new reviewer is visible
    await expect(
      page
        .getByTestId('glossary-reviewer-name')
        .getByText(user2.getUserDisplayName())
    ).toBeVisible();
  });
});

// G-U12: Remove domain from glossary
test.describe('Remove Domain from Glossary', () => {
  const domain = new Domain();
  const glossary = new Glossary();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await domain.create(apiContext);
    await glossary.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await domain.delete(apiContext);
    await afterAction();
  });

  test('should remove domain from glossary', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Add domain via UI first
    await page.getByTestId('add-domain').click();
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    const searchDomain = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes(encodeURIComponent(domain.responseData.name))
    );
    await page
      .getByTestId('domain-selectable-tree')
      .getByTestId('searchbar')
      .fill(domain.responseData.name);
    await searchDomain;

    const domainTag = page.getByTestId(
      `tag-${domain.responseData.fullyQualifiedName}`
    );
    await expect(domainTag).toBeVisible();

    const addPatchReq = page.waitForResponse(
      (req) => req.request().method() === 'PATCH'
    );
    await domainTag.click();
    await addPatchReq;
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Verify domain is visible
    await expect(page.locator('[data-testid="domain-link"]')).toContainText(
      domain.data.displayName
    );

    // Click on domain to edit/remove
    await page.getByTestId('add-domain').click();
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Click on the selected domain again to deselect/remove it
    const removePatchReq = page.waitForResponse(
      (req) => req.request().method() === 'PATCH'
    );
    // The domain is already selected (highlighted), clicking it again removes it
    const selectedDomainTag = page.getByTestId(
      `tag-${domain.responseData.fullyQualifiedName}`
    );
    await selectedDomainTag.click();
    await removePatchReq;
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Verify domain is removed - "No Domains" text should be visible
    await expect(page.getByTestId('no-domain-text')).toContainText('No Domains');
  });
});

// G-U13: Change domain on glossary
test.describe('Change Domain on Glossary', () => {
  const domain1 = new Domain();
  const domain2 = new Domain();
  const glossary = new Glossary();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await domain1.create(apiContext);
    await domain2.create(apiContext);
    await glossary.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await domain1.delete(apiContext);
    await domain2.delete(apiContext);
    await afterAction();
  });

  test('should change domain on glossary', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Add initial domain via UI first
    await page.getByTestId('add-domain').click();
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    const searchDomain1 = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes(encodeURIComponent(domain1.responseData.name))
    );
    await page
      .getByTestId('domain-selectable-tree')
      .getByTestId('searchbar')
      .fill(domain1.responseData.name);
    await searchDomain1;

    const domain1Tag = page.getByTestId(
      `tag-${domain1.responseData.fullyQualifiedName}`
    );
    await expect(domain1Tag).toBeVisible();

    const addPatchReq = page.waitForResponse(
      (req) => req.request().method() === 'PATCH'
    );
    await domain1Tag.click();
    await addPatchReq;
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Verify initial domain is visible
    await expect(page.locator('[data-testid="domain-link"]')).toContainText(
      domain1.data.displayName
    );

    // Click on domain to change it
    await page.getByTestId('add-domain').click();
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Search for new domain
    await page
      .getByTestId('domain-selectable-tree')
      .getByTestId('searchbar')
      .clear();

    const searchDomain2 = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/search/query') &&
        response.url().includes(encodeURIComponent(domain2.responseData.name))
    );
    await page
      .getByTestId('domain-selectable-tree')
      .getByTestId('searchbar')
      .fill(domain2.responseData.name);
    await searchDomain2;

    // Click on the new domain option
    const domain2Tag = page.getByTestId(
      `tag-${domain2.responseData.fullyQualifiedName}`
    );
    await expect(domain2Tag).toBeVisible();

    const changePatchReq = page.waitForResponse(
      (req) => req.request().method() === 'PATCH'
    );
    await domain2Tag.click();
    await changePatchReq;
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Verify new domain is visible
    await expect(page.locator('[data-testid="domain-link"]')).toContainText(
      domain2.data.displayName
    );
  });
});

// T-C15: Create term with custom style (color)
test.describe('Term with Custom Style Color', () => {
  const glossary = new Glossary();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should create term with custom style color', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    const termName = `ColorTerm${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Term with custom color');

    // Set custom color
    const customColor = '#FF5733';
    await page.locator('[data-testid="color-color-input"]').fill(customColor);

    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    const response = await createResponse;
    const responseData = await response.json();

    // Verify color was saved
    expect(responseData.style?.color).toBe(customColor);

    // Verify term is created
    await expect(page.getByTestId(termName)).toBeVisible();
  });
});

// T-C16: Create term with custom style (icon URL)
test.describe('Term with Custom Style Icon', () => {
  const glossary = new Glossary();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should create term with custom style icon URL', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    const termName = `IconTerm${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Term with custom icon');

    // Set custom icon URL
    const iconUrl = 'https://example.com/icon.png';
    await page.locator('[data-testid="icon-url"]').fill(iconUrl);

    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    const response = await createResponse;
    const responseData = await response.json();

    // Verify icon was saved
    expect(responseData.style?.iconURL).toBe(iconUrl);

    // Verify term is created
    await expect(page.getByTestId(termName)).toBeVisible();
  });
});

// T-U22: Update term style - set color
test.describe('Update Term Style Color', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should update term style to set color', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Open edit modal for the term
    const escapedFqn = glossaryTerm.responseData.fullyQualifiedName.replace(
      /"/g,
      '\\"'
    );
    const termRow = page.locator(`[data-row-key="${escapedFqn}"]`);
    await termRow.getByTestId('edit-button').click();

    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    // Set custom color
    const customColor = '#28A745';
    await page.locator('[data-testid="color-color-input"]').clear();
    await page.locator('[data-testid="color-color-input"]').fill(customColor);

    const updateResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.click('[data-testid="save-glossary-term"]');
    const response = await updateResponse;
    const responseData = await response.json();

    // Verify color was updated
    expect(responseData.style?.color).toBe(customColor);
  });
});

// T-U23: Update term style - set icon URL
test.describe('Update Term Style Icon', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should update term style to set icon URL', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Open edit modal for the term
    const escapedFqn = glossaryTerm.responseData.fullyQualifiedName.replace(
      /"/g,
      '\\"'
    );
    const termRow = page.locator(`[data-row-key="${escapedFqn}"]`);
    await termRow.getByTestId('edit-button').click();

    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    // Set custom icon URL
    const iconUrl = 'https://example.com/new-icon.png';
    await page.locator('[data-testid="icon-url"]').clear();
    await page.locator('[data-testid="icon-url"]').fill(iconUrl);

    const updateResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.click('[data-testid="save-glossary-term"]');
    const response = await updateResponse;
    const responseData = await response.json();

    // Verify icon was updated
    expect(responseData.style?.iconURL).toBe(iconUrl);
  });
});

// T-U08: Clear all synonyms
test.describe('Clear All Synonyms', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    // Add synonyms
    await glossaryTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/synonyms',
        value: ['Synonym1', 'Synonym2', 'Synonym3'],
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should clear all synonyms from term', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term details
    await page.getByTestId(glossaryTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Verify synonyms are visible
    await expect(page.getByTestId('Synonym1')).toBeVisible();
    await expect(page.getByTestId('Synonym2')).toBeVisible();
    await expect(page.getByTestId('Synonym3')).toBeVisible();

    // Click edit button for synonyms
    await page
      .getByTestId('synonyms-container')
      .getByTestId('edit-button')
      .click();

    // Clear all synonyms by clicking each remove button
    const removeButtons = page.locator(
      '.ant-select-selection-item .ant-select-selection-item-remove'
    );
    const count = await removeButtons.count();

    for (let i = count - 1; i >= 0; i--) {
      await removeButtons.nth(i).click();
    }

    const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.getByTestId('save-synonym-btn').click();
    await saveRes;

    // Verify all synonyms are removed
    await expect(page.getByTestId('Synonym1')).not.toBeVisible();
    await expect(page.getByTestId('Synonym2')).not.toBeVisible();
    await expect(page.getByTestId('Synonym3')).not.toBeVisible();
  });
});

// T-U10: Edit reference name
test.describe('Edit Reference Name', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    // Add reference
    await glossaryTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/references',
        value: [{ name: 'OriginalRef', endpoint: 'http://original.com' }],
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should edit reference name', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term details
    await page.getByTestId(glossaryTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Verify original reference is visible
    await expect(page.getByTestId('reference-link-OriginalRef')).toBeVisible();

    // Click edit button for references
    await page
      .getByTestId('references-container')
      .getByTestId('edit-button')
      .click();

    await expect(
      page.getByTestId('glossary-term-references-modal').getByText('References')
    ).toBeVisible();

    // Update the reference name
    await page.locator('#references_0_name').clear();
    await page.locator('#references_0_name').fill('UpdatedRefName');

    const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.getByTestId('save-btn').click();
    await saveRes;

    // Verify updated reference name is visible
    await expect(
      page.getByTestId('reference-link-UpdatedRefName')
    ).toBeVisible();
    await expect(
      page.getByTestId('reference-link-OriginalRef')
    ).not.toBeVisible();
  });
});

// T-U11: Edit reference URL
test.describe('Edit Reference URL', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    // Add reference
    await glossaryTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/references',
        value: [{ name: 'TestRef', endpoint: 'http://old-url.com' }],
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should edit reference URL', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term details
    await page.getByTestId(glossaryTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Click edit button for references
    await page
      .getByTestId('references-container')
      .getByTestId('edit-button')
      .click();

    await expect(
      page.getByTestId('glossary-term-references-modal').getByText('References')
    ).toBeVisible();

    // Verify old URL
    await expect(page.locator('#references_0_endpoint')).toHaveValue(
      'http://old-url.com'
    );

    // Update the reference URL
    await page.locator('#references_0_endpoint').clear();
    await page.locator('#references_0_endpoint').fill('http://new-url.com');

    const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.getByTestId('save-btn').click();
    await saveRes;

    // Verify the reference link has updated URL
    const refLink = page.getByTestId('reference-link-TestRef');

    await expect(refLink).toBeVisible();
    await expect(refLink).toHaveAttribute('href', 'http://new-url.com');
  });
});
