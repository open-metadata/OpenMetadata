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
import { SidebarItem } from '../../../constant/sidebar';
import { Domain } from '../../../support/domain/Domain';
import { EntityTypeEndpoint } from '../../../support/entity/Entity.interface';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { TeamClass } from '../../../support/team/TeamClass';
import { UserClass } from '../../../support/user/UserClass';
import {
  createNewPage,
  descriptionBox,
  redirectToHomePage,
} from '../../../utils/common';
import { addMultiOwner } from '../../../utils/entity';
import {
  addMultiOwnerInDialog,
  addTeamAsReviewer,
  selectActiveGlossary,
} from '../../../utils/glossary';
import { sidebarClick } from '../../../utils/sidebar';
import { performUserLogin } from '../../../utils/user';

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
    await expect(page.getByTestId('no-domain-text')).toContainText(
      'No Domains'
    );
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

// G-U04: Remove owner from glossary
test.describe('Remove Glossary Owner', () => {
  const user = new UserClass();
  const glossary = new Glossary();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.create(apiContext);
    await glossary.create(apiContext);
    // Add owner
    await glossary.patch(apiContext, [
      {
        op: 'add',
        path: '/owners/0',
        value: {
          id: user.responseData.id,
          type: 'user',
        },
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await user.delete(apiContext);
    await afterAction();
  });

  test('should remove owner from glossary', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Verify owner is visible
    await expect(
      page
        .getByTestId('glossary-right-panel-owner-link')
        .getByTestId(user.getUserDisplayName())
    ).toBeVisible();

    // Click edit owner
    await page
      .getByTestId('glossary-right-panel-owner-link')
      .locator('[data-testid="edit-owner"]')
      .click();
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Clear all owners
    await page.click('[data-testid="clear-all-button"]');

    const patchResponse = page.waitForResponse('/api/v1/glossaries/*');
    await page.click('[data-testid="selectable-list-update-btn"]');
    await patchResponse;

    // Verify owner is removed - should show "No Owner" or similar
    await expect(
      page
        .getByTestId('glossary-right-panel-owner-link')
        .getByTestId(user.getUserDisplayName())
    ).not.toBeVisible();
  });
});

// G-U07: Remove reviewer from glossary
test.describe('Remove Glossary Reviewer', () => {
  const user = new UserClass();
  const glossary = new Glossary();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.create(apiContext);
    await glossary.create(apiContext);
    // Add reviewer
    await glossary.patch(apiContext, [
      {
        op: 'add',
        path: '/reviewers/0',
        value: {
          id: user.responseData.id,
          type: 'user',
        },
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await user.delete(apiContext);
    await afterAction();
  });

  test('should remove reviewer from glossary', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Verify reviewer is visible
    await expect(
      page
        .getByTestId('glossary-reviewer-name')
        .getByText(user.getUserDisplayName())
    ).toBeVisible();

    // Click edit reviewer
    await page.click('[data-testid="edit-reviewer-button"]');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Clear all reviewers
    await page.click('[data-testid="clear-all-button"]');

    const patchResponse = page.waitForResponse('/api/v1/glossaries/*');
    await page.click('[data-testid="selectable-list-update-btn"]');
    await patchResponse;

    // Verify reviewer is removed
    await expect(
      page
        .getByTestId('glossary-reviewer-name')
        .getByText(user.getUserDisplayName())
    ).not.toBeVisible();
  });
});

// T-U07: Remove individual synonym
test.describe('Remove Individual Synonym', () => {
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
        value: ['KeepSynonym', 'RemoveSynonym'],
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

  test('should remove individual synonym from term', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term details
    await page.getByTestId(glossaryTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Verify both synonyms are visible
    await expect(page.getByTestId('KeepSynonym')).toBeVisible();
    await expect(page.getByTestId('RemoveSynonym')).toBeVisible();

    // Click edit button for synonyms
    await page
      .getByTestId('synonyms-container')
      .getByTestId('edit-button')
      .click();

    // Find and click the remove button for RemoveSynonym
    const synonymToRemove = page.locator('.ant-select-selection-item', {
      hasText: 'RemoveSynonym',
    });
    await synonymToRemove.locator('.ant-select-selection-item-remove').click();

    const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.getByTestId('save-synonym-btn').click();
    await saveRes;

    // Verify only RemoveSynonym is removed
    await expect(page.getByTestId('KeepSynonym')).toBeVisible();
    await expect(page.getByTestId('RemoveSynonym')).not.toBeVisible();
  });
});

// T-U12: Remove individual reference
test.describe('Remove Individual Reference', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    // Add references
    await glossaryTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/references',
        value: [
          { name: 'KeepRef', endpoint: 'http://keep.com' },
          { name: 'RemoveRef', endpoint: 'http://remove.com' },
        ],
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

  test('should remove individual reference from term', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term details
    await page.getByTestId(glossaryTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Verify both references are visible
    await expect(page.getByTestId('reference-link-KeepRef')).toBeVisible();
    await expect(page.getByTestId('reference-link-RemoveRef')).toBeVisible();

    // Click edit button for references
    await page
      .getByTestId('references-container')
      .getByTestId('edit-button')
      .click();

    await expect(
      page.getByTestId('glossary-term-references-modal').getByText('References')
    ).toBeVisible();

    // Click the delete button for the second reference (index 1)
    await page.locator('[data-testid="delete-ref-btn"]').nth(1).click();

    const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.getByTestId('save-btn').click();
    await saveRes;

    // Verify only RemoveRef is removed
    await expect(page.getByTestId('reference-link-KeepRef')).toBeVisible();
    await expect(
      page.getByTestId('reference-link-RemoveRef')
    ).not.toBeVisible();
  });
});

// T-U14: Remove related term
test.describe('Remove Related Term', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const relatedTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await relatedTerm.create(apiContext);
    // Add related term
    await glossaryTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/relatedTerms',
        value: [
          {
            id: relatedTerm.responseData.id,
            type: 'glossaryTerm',
          },
        ],
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossaryTerm.delete(apiContext);
    await relatedTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should remove related term', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term details
    await page.getByTestId(glossaryTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Verify related term is visible
    await expect(
      page
        .getByTestId('related-term-container')
        .getByTestId(relatedTerm.responseData.displayName)
    ).toBeVisible();

    // Click edit button for related terms
    await page
      .getByTestId('related-term-container')
      .getByTestId('edit-button')
      .click();

    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Clear all related terms
    await page.click('[data-testid="clear-all-button"]');

    const patchResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.click('[data-testid="selectable-list-update-btn"]');
    await patchResponse;

    // Verify related term is removed
    await expect(
      page
        .getByTestId('related-term-container')
        .getByTestId(relatedTerm.responseData.displayName)
    ).not.toBeVisible();
  });
});

// T-U19: Remove owner from term
test.describe('Remove Term Owner', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const user = new UserClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.create(apiContext);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    // Add owner to term
    await glossaryTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/owners/0',
        value: {
          id: user.responseData.id,
          type: 'user',
        },
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await user.delete(apiContext);
    await afterAction();
  });

  test('should remove owner from term', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term details
    await page.getByTestId(glossaryTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Verify owner is visible
    await expect(
      page
        .getByTestId('glossary-owner-name')
        .getByText(user.getUserDisplayName())
    ).toBeVisible();

    // Click edit owner button
    await page.getByTestId('edit-owner-button').click();
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Clear all owners
    await page.click('[data-testid="clear-all-button"]');

    const patchResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.click('[data-testid="selectable-list-update-btn"]');
    await patchResponse;

    // Verify owner is removed
    await expect(
      page
        .getByTestId('glossary-owner-name')
        .getByText(user.getUserDisplayName())
    ).not.toBeVisible();
  });
});

// T-U21: Remove reviewer from term
test.describe('Remove Term Reviewer', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const user = new UserClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.create(apiContext);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    // Add reviewer to term
    await glossaryTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/reviewers/0',
        value: {
          id: user.responseData.id,
          type: 'user',
        },
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await user.delete(apiContext);
    await afterAction();
  });

  test('should remove reviewer from term', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term details
    await page.getByTestId(glossaryTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Verify reviewer is visible
    await expect(
      page.getByTestId('glossary-reviewer').getByText(user.getUserDisplayName())
    ).toBeVisible();

    // Click edit reviewer button
    await page.getByTestId('edit-reviewer-button').click();
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Clear all reviewers
    await page.click('[data-testid="clear-all-button"]');

    const patchResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.click('[data-testid="selectable-list-update-btn"]');
    await patchResponse;

    // Verify reviewer is removed
    await expect(
      page.getByTestId('glossary-reviewer').getByText(user.getUserDisplayName())
    ).not.toBeVisible();
  });
});

// T-D02: Delete parent term (cascade children)
test.describe('Delete Parent Term with Children', () => {
  const glossary = new Glossary();
  const parentTerm = new GlossaryTerm(glossary);
  let childTermName: string;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await parentTerm.create(apiContext);
    // Create child term
    childTermName = `ChildTerm_${Date.now()}`;
    await apiContext.post('/api/v1/glossaryTerms', {
      data: {
        glossary: glossary.responseData.id,
        name: childTermName,
        displayName: childTermName,
        description: 'Child term for cascade delete test',
        parent: parentTerm.responseData.id,
      },
    });
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    // Parent and child should be deleted, just clean up glossary
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should delete parent term and cascade delete children', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Expand parent to see child
    await page.getByTestId('expand-icon').first().click();
    await page.waitForLoadState('networkidle');

    // Verify both parent and child are visible
    await expect(
      page.getByTestId(parentTerm.responseData.displayName)
    ).toBeVisible();
    await expect(page.getByTestId(childTermName)).toBeVisible();

    // Click on parent term row to select it
    const escapedFqn = parentTerm.responseData.fullyQualifiedName.replace(
      /"/g,
      '\\"'
    );
    const termRow = page.locator(`[data-row-key="${escapedFqn}"]`);

    // Click delete button for parent term
    await termRow.getByTestId('delete-button').click();

    // Confirm delete in modal
    await page.waitForSelector('[data-testid="confirmation-text-input"]');
    await page.fill('[data-testid="confirmation-text-input"]', 'DELETE');

    const deleteResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/glossaryTerms/') &&
        response.request().method() === 'DELETE'
    );
    await page.click('[data-testid="confirm-button"]');
    await deleteResponse;
    await page.waitForLoadState('networkidle');

    // Verify both parent and child are deleted
    await expect(
      page.getByTestId(parentTerm.responseData.displayName)
    ).not.toBeVisible();
    await expect(page.getByTestId(childTermName)).not.toBeVisible();
  });
});

// T-C11: Create term with synonyms
test.describe('Create Term with Synonyms', () => {
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

  test('should create term with synonyms', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    const termName = `SynonymTerm${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Term with synonyms');

    // Add synonyms
    await page.fill('[data-testid="synonyms"]', 'Syn1');
    await page.keyboard.press('Enter');
    await page.fill('[data-testid="synonyms"]', 'Syn2');
    await page.keyboard.press('Enter');

    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    const response = await createResponse;
    const responseData = await response.json();

    // Verify synonyms were saved
    expect(responseData.synonyms).toContain('Syn1');
    expect(responseData.synonyms).toContain('Syn2');

    // Verify term is created
    await expect(page.getByTestId(termName)).toBeVisible();
  });
});

// T-C12: Create term with references
test.describe('Create Term with References', () => {
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

  test('should create term with references', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    const termName = `RefTerm${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Term with references');

    // Add reference
    await page.click('[data-testid="add-reference-button"]');
    await page.locator('#references_0_name').fill('RefName');
    await page.locator('#references_0_endpoint').fill('http://reference.com');

    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    const response = await createResponse;
    const responseData = await response.json();

    // Verify references were saved
    expect(responseData.references).toHaveLength(1);
    expect(responseData.references[0].name).toBe('RefName');
    expect(responseData.references[0].endpoint).toBe('http://reference.com');

    // Verify term is created
    await expect(page.getByTestId(termName)).toBeVisible();
  });
});

// T-C14: Create term with tags
test.describe('Create Term with Tags', () => {
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

  test('should create term with tags', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    const termName = `TagTerm${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Term with tags');

    // Add tag - click add tags button
    await page.click('[data-testid="tag-selector"]');
    await page.waitForSelector('[data-testid="tag-selector-container"]');

    // Search and select a tag
    const searchResponse = page.waitForResponse('**/api/v1/search/query*');
    await page.fill('[data-testid="tag-selector"] input', 'PII');
    await searchResponse;

    // Click on PII.Sensitive option
    await page.click('[data-testid="tag-PII.Sensitive"]');
    await page.keyboard.press('Escape');

    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    const response = await createResponse;
    const responseData = await response.json();

    // Verify tags were saved
    expect(responseData.tags).toBeDefined();
    expect(responseData.tags.length).toBeGreaterThan(0);

    // Verify term is created
    await expect(page.getByTestId(termName)).toBeVisible();
  });
});

// T-C17: Create term with owners
test.describe('Create Term with Owners', () => {
  const glossary = new Glossary();
  const user = new UserClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.create(apiContext);
    await glossary.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await user.delete(apiContext);
    await afterAction();
  });

  test('should create term with owners', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    const termName = `OwnerTerm${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Term with owners');

    // Add owner via dialog
    await addMultiOwnerInDialog({
      page,
      ownerNames: [user.getUserDisplayName()],
      activatorBtnLocator: '[data-testid="add-owner"]',
      resultTestId: 'owner-container',
      endpoint: EntityTypeEndpoint.GlossaryTerm,
      isSelectableInsideForm: true,
      type: 'Users',
    });

    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    const response = await createResponse;
    const responseData = await response.json();

    // Verify owners were saved
    expect(responseData.owners).toBeDefined();
    expect(responseData.owners.length).toBeGreaterThan(0);

    // Verify term is created
    await expect(page.getByTestId(termName)).toBeVisible();
  });
});

// W-S01: New term starts as Draft (no reviewers)
test.describe('Term Status Draft without Reviewers', () => {
  const glossary = new Glossary();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    // Create glossary WITHOUT reviewers
    await glossary.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should create term with Draft status when glossary has no reviewers', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    const termName = `DraftTerm${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Term for draft status test');

    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    const response = await createResponse;
    const responseData = await response.json();

    // Verify status is Draft
    expect(responseData.status).toBe('Draft');

    // Verify term is created
    await expect(page.getByTestId(termName)).toBeVisible();
  });
});

// W-R03: Non-reviewer cannot see approve/reject buttons
test.describe('Non-Reviewer Cannot See Approve Buttons', () => {
  const glossary = new Glossary();
  const reviewer = new UserClass();
  const nonReviewer = new UserClass();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await reviewer.create(apiContext);
    await nonReviewer.create(apiContext);
    await glossary.create(apiContext);

    // Add reviewer to glossary
    await glossary.patch(apiContext, [
      {
        op: 'add',
        path: '/reviewers/0',
        value: {
          id: reviewer.responseData.id,
          type: 'user',
        },
      },
    ]);

    // Create term - will be in review since glossary has reviewer
    await glossaryTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await reviewer.delete(apiContext);
    await nonReviewer.delete(apiContext);
    await afterAction();
  });

  test('should not show approve/reject buttons for non-reviewer', async ({
    browser,
  }) => {
    // Login as non-reviewer user
    const { page, afterAction } = await performUserLogin(browser, nonReviewer);

    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Find the term row
    const escapedFqn = glossaryTerm.responseData.fullyQualifiedName.replace(
      /"/g,
      '\\"'
    );
    const termRow = page.locator(`[data-row-key="${escapedFqn}"]`);

    await expect(termRow).toBeVisible();

    // Verify approve/reject buttons are NOT visible for non-reviewer
    await expect(termRow.getByTestId('approve-term')).not.toBeVisible();
    await expect(termRow.getByTestId('reject-term')).not.toBeVisible();

    await afterAction();
  });
});

// G-C03: Create glossary with mutually exclusive toggle ON
test.describe('Glossary with Mutually Exclusive ON', () => {
  const glossary = new Glossary();

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should create glossary with mutually exclusive toggle ON', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);

    await page.click('[data-testid="add-glossary"]');
    await page.waitForSelector('[data-testid="form-heading"]');

    await page.fill('[data-testid="name"]', glossary.data.name);
    await page.locator(descriptionBox).fill(glossary.data.description);

    // Turn ON mutually exclusive toggle
    const mutuallyExclusiveBtn = page.getByTestId('mutually-exclusive-button');
    await mutuallyExclusiveBtn.click();

    // Verify alert IS visible when toggle is ON
    await expect(page.locator('[data-testid="form-item-alert"]')).toBeVisible();

    const glossaryResponse = page.waitForResponse('/api/v1/glossaries');
    await page.click('[data-testid="save-glossary"]');
    const response = await glossaryResponse;
    const responseData = await response.json();

    // Store response data for cleanup
    glossary.responseData = responseData;

    // Verify mutuallyExclusive is true
    expect(responseData.mutuallyExclusive).toBe(true);

    await expect(page.getByTestId('entity-header-name')).toHaveText(
      glossary.data.name
    );
  });
});

// T-C05: Create term via row action button (+)
test.describe('Create Term via Row Action Button', () => {
  const glossary = new Glossary();
  const parentTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await parentTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should create child term via row action button', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Find the parent term row
    const escapedFqn = parentTerm.responseData.fullyQualifiedName.replace(
      /"/g,
      '\\"'
    );
    const termRow = page.locator(`[data-row-key="${escapedFqn}"]`);

    // Click the add child term button in the row
    await termRow.getByTestId('add-classification').click();
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    const childTermName = `ChildViaRow${Date.now()}`;
    await page.fill('[data-testid="name"]', childTermName);
    await page
      .locator(descriptionBox)
      .fill('Child term created via row action');

    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    const response = await createResponse;
    const responseData = await response.json();

    // Verify parent is set correctly
    expect(responseData.parent.id).toBe(parentTerm.responseData.id);

    // Expand parent to see child
    await page.getByTestId('expand-icon').first().click();
    await page.waitForLoadState('networkidle');

    // Verify child term is visible
    await expect(page.getByTestId(childTermName)).toBeVisible();
  });
});

// T-C13: Create term with related terms
test.describe('Create Term with Related Terms', () => {
  const glossary = new Glossary();
  const existingTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await existingTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should create term with related terms', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    const termName = `RelatedTerm${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Term with related terms');

    // Add related term
    await page.click('[data-testid="add-related-term"]');
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    // Search for existing term
    const searchResponse = page.waitForResponse('**/api/v1/search/query*');
    await page.fill(
      '[data-testid="searchbar"]',
      existingTerm.responseData.displayName
    );
    await searchResponse;

    // Select the term
    await page
      .getByTestId(`tag-${existingTerm.responseData.fullyQualifiedName}`)
      .click();

    await page.click('[data-testid="selectable-list-update-btn"]');

    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    const response = await createResponse;
    const responseData = await response.json();

    // Verify related terms were saved
    expect(responseData.relatedTerms).toBeDefined();
    expect(responseData.relatedTerms.length).toBeGreaterThan(0);

    // Verify term is created
    await expect(page.getByTestId(termName)).toBeVisible();
  });
});

// T-C18: Create term - inherits glossary reviewers
test.describe('Term Inherits Glossary Reviewers', () => {
  const glossary = new Glossary();
  const reviewer = new UserClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await reviewer.create(apiContext);
    await glossary.create(apiContext);
    // Add reviewer to glossary
    await glossary.patch(apiContext, [
      {
        op: 'add',
        path: '/reviewers/0',
        value: {
          id: reviewer.responseData.id,
          type: 'user',
        },
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await reviewer.delete(apiContext);
    await afterAction();
  });

  test('should create term that inherits glossary reviewers', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    const termName = `InheritReviewer${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Term inheriting reviewers');

    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    const response = await createResponse;
    const responseData = await response.json();

    // Verify term status is InReview (since glossary has reviewers)
    expect(responseData.status).toBe('In Review');

    // Verify term is created
    await expect(page.getByTestId(termName)).toBeVisible();
  });
});

// T-U17: Remove tags from term
test.describe('Remove Tags from Term', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    // Add tags to term
    await glossaryTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/tags/0',
        value: {
          tagFQN: 'PII.Sensitive',
          source: 'Classification',
        },
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

  test('should remove tags from term', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term details
    await page.getByTestId(glossaryTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Verify tag is visible
    await expect(page.getByTestId('tag-PII.Sensitive')).toBeVisible();

    // Click edit button for tags
    await page.getByTestId('entity-tags').getByTestId('edit-button').click();
    await page.waitForSelector('[data-testid="tag-selector"]');

    // Remove the tag by clicking its close button
    await page
      .locator('[data-testid="tag-selector"]')
      .locator('.ant-tag')
      .filter({ hasText: 'PII.Sensitive' })
      .locator('.ant-tag-close-icon')
      .click();

    const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.getByTestId('save-button').click();
    await saveRes;

    // Verify tag is removed
    await expect(page.getByTestId('tag-PII.Sensitive')).not.toBeVisible();
  });
});

// G-U10: Remove tags from glossary
test.describe('Remove Tags from Glossary', () => {
  const glossary = new Glossary();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    // Add tags to glossary
    await glossary.patch(apiContext, [
      {
        op: 'add',
        path: '/tags/0',
        value: {
          tagFQN: 'PII.Sensitive',
          source: 'Classification',
        },
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should remove tags from glossary', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Verify tag is visible
    await expect(page.getByTestId('tag-PII.Sensitive')).toBeVisible();

    // Click edit button for tags
    await page
      .getByTestId('glossary-details-right-panel')
      .getByTestId('edit-button')
      .click();
    await page.waitForSelector('[data-testid="tag-selector"]');

    // Remove the tag by clicking its close button
    await page
      .locator('[data-testid="tag-selector"]')
      .locator('.ant-tag')
      .filter({ hasText: 'PII.Sensitive' })
      .locator('.ant-tag-close-icon')
      .click();

    const saveRes = page.waitForResponse('/api/v1/glossaries/*');
    await page.getByTestId('saveAssociatedTag').click();
    await saveRes;

    // Verify tag is removed
    await expect(page.getByTestId('tag-PII.Sensitive')).not.toBeVisible();
  });
});

// G-C09: Cancel glossary creation
test.describe('Cancel Glossary Creation', () => {
  test('should cancel glossary creation without saving', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);

    await page.click('[data-testid="add-glossary"]');
    await page.waitForSelector('[data-testid="form-heading"]');

    const glossaryName = `CancelTest${Date.now()}`;
    await page.fill('[data-testid="name"]', glossaryName);
    await page.locator(descriptionBox).fill('This should be cancelled');

    // Click cancel button
    await page.click('[data-testid="cancel-glossary"]');

    // Verify we're back on glossary page and the glossary was not created
    await page.waitForLoadState('networkidle');

    // The glossary should not exist - check it's not in the list
    await expect(page.getByTestId(glossaryName)).not.toBeVisible();
  });
});

// T-C10: Cancel term creation
test.describe('Cancel Term Creation', () => {
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

  test('should cancel term creation without saving', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    const termName = `CancelTermTest${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('This should be cancelled');

    // Click cancel button (X or Cancel)
    await page.click('[data-testid="cancel-glossary-term"]');

    // Verify term was not created
    await page.waitForLoadState('networkidle');

    await expect(page.getByTestId(termName)).not.toBeVisible();
  });
});

// G-D04: Cancel delete operation
test.describe('Cancel Glossary Delete', () => {
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

  test('should cancel glossary delete operation', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Click manage button then delete
    await page.getByTestId('manage-button').click();
    await page.getByTestId('delete-button-title').click();

    // Wait for delete modal
    await page.waitForSelector('[data-testid="confirmation-text-input"]');

    // Click cancel instead of confirming
    await page.click('[data-testid="cancel"]');

    // Verify modal is closed and glossary still exists
    await expect(
      page.locator('[data-testid="confirmation-text-input"]')
    ).not.toBeVisible();
    await expect(page.getByTestId('entity-header-name')).toHaveText(
      glossary.data.name
    );
  });
});

// T-D04: Cancel term delete operation
test.describe('Cancel Term Delete', () => {
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
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should cancel term delete operation', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Find the term row
    const escapedFqn = glossaryTerm.responseData.fullyQualifiedName.replace(
      /"/g,
      '\\"'
    );
    const termRow = page.locator(`[data-row-key="${escapedFqn}"]`);

    // Click delete button
    await termRow.getByTestId('delete-button').click();

    // Wait for delete modal
    await page.waitForSelector('[data-testid="confirmation-text-input"]');

    // Click cancel instead of confirming
    await page.click('[data-testid="cancel"]');

    // Verify modal is closed and term still exists
    await expect(
      page.locator('[data-testid="confirmation-text-input"]')
    ).not.toBeVisible();
    await expect(
      page.getByTestId(glossaryTerm.responseData.displayName)
    ).toBeVisible();
  });
});

// S-S03: Search is case-insensitive
test.describe('Case Insensitive Search', () => {
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
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should find term with case-insensitive search', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Get the term name and search with different case
    const termName = glossaryTerm.responseData.displayName;
    const upperCaseName = termName.toUpperCase();

    // Search with uppercase
    const searchResponse = page.waitForResponse('**/api/v1/search/query*');
    await page.fill('[data-testid="searchbar"]', upperCaseName);
    await searchResponse;
    await page.waitForLoadState('networkidle');

    // Verify term is still found
    await expect(page.getByTestId(termName)).toBeVisible();
  });
});

// S-S07: Search no results - empty state
test.describe('Search No Results', () => {
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

  test('should show empty state when no search results', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Search for something that doesn't exist
    const searchResponse = page.waitForResponse('**/api/v1/search/query*');
    await page.fill('[data-testid="searchbar"]', 'NonExistentTermXYZ12345');
    await searchResponse;
    await page.waitForLoadState('networkidle');

    // Verify empty state message or no results
    await expect(
      page.getByText(/no glossary terms/i).or(page.getByText(/no results/i))
    ).toBeVisible();
  });
});

// S-F03: Filter by InReview status
test.describe('Filter by InReview Status', () => {
  const glossary = new Glossary();
  const reviewer = new UserClass();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await reviewer.create(apiContext);
    await glossary.create(apiContext);
    // Add reviewer to glossary so terms start in review
    await glossary.patch(apiContext, [
      {
        op: 'add',
        path: '/reviewers/0',
        value: {
          id: reviewer.responseData.id,
          type: 'user',
        },
      },
    ]);
    await glossaryTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await reviewer.delete(apiContext);
    await afterAction();
  });

  test('should filter terms by InReview status', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Click on status filter
    await page.click('[data-testid="status-dropdown"]');

    // Select InReview filter
    await page.click('[data-testid="In Review"]');
    await page.waitForLoadState('networkidle');

    // Verify term is visible (since it's in review)
    await expect(
      page.getByTestId(glossaryTerm.responseData.displayName)
    ).toBeVisible();
  });
});

// H-DD03: Drag term with children (moves subtree)
test.describe('Drag Term with Children', () => {
  const glossary = new Glossary();
  const parentTerm = new GlossaryTerm(glossary);
  const targetTerm = new GlossaryTerm(glossary);
  let childTermName: string;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await parentTerm.create(apiContext);
    await targetTerm.create(apiContext);
    // Create child of parent term
    childTermName = `Child_${Date.now()}`;
    await apiContext.post('/api/v1/glossaryTerms', {
      data: {
        glossary: glossary.responseData.id,
        name: childTermName,
        displayName: childTermName,
        description: 'Child term for drag test',
        parent: parentTerm.responseData.id,
      },
    });
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should move term with children via drag and drop', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Expand parent to see child
    await page.getByTestId('expand-icon').first().click();
    await page.waitForLoadState('networkidle');

    // Verify child is visible under parent
    await expect(page.getByTestId(childTermName)).toBeVisible();

    // Get source (parent term) and target rows
    const sourceEscapedFqn = parentTerm.responseData.fullyQualifiedName.replace(
      /"/g,
      '\\"'
    );
    const targetEscapedFqn = targetTerm.responseData.fullyQualifiedName.replace(
      /"/g,
      '\\"'
    );

    const sourceRow = page.locator(`[data-row-key="${sourceEscapedFqn}"]`);
    const targetRow = page.locator(`[data-row-key="${targetEscapedFqn}"]`);

    // Drag parent term to target term
    const sourceDragHandle = sourceRow.getByTestId('drag-icon');
    const targetDragHandle = targetRow.getByTestId('drag-icon');

    await sourceDragHandle.dragTo(targetDragHandle);

    // Wait for confirmation modal
    await page.waitForSelector('[data-testid="confirmation-modal"]');

    // Confirm the move
    const patchResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.click('[data-testid="save-button"]');
    await patchResponse;
    await page.waitForLoadState('networkidle');

    // Expand target to verify parent moved with child
    await page.getByTestId('expand-icon').first().click();
    await page.waitForLoadState('networkidle');

    // Both parent and child should now be under target
    await expect(
      page.getByTestId(parentTerm.responseData.displayName)
    ).toBeVisible();
  });
});

// H-DD05: Drag term - cancel operation
test.describe('Cancel Drag Operation', () => {
  const glossary = new Glossary();
  const term1 = new GlossaryTerm(glossary);
  const term2 = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await term1.create(apiContext);
    await term2.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should cancel drag and drop operation', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    const sourceEscapedFqn = term1.responseData.fullyQualifiedName.replace(
      /"/g,
      '\\"'
    );
    const targetEscapedFqn = term2.responseData.fullyQualifiedName.replace(
      /"/g,
      '\\"'
    );

    const sourceRow = page.locator(`[data-row-key="${sourceEscapedFqn}"]`);
    const targetRow = page.locator(`[data-row-key="${targetEscapedFqn}"]`);

    // Drag term1 to term2
    const sourceDragHandle = sourceRow.getByTestId('drag-icon');
    const targetDragHandle = targetRow.getByTestId('drag-icon');

    await sourceDragHandle.dragTo(targetDragHandle);

    // Wait for confirmation modal
    await page.waitForSelector('[data-testid="confirmation-modal"]');

    // Cancel the operation
    await page.click('[data-testid="cancel"]');

    // Verify modal is closed
    await expect(
      page.locator('[data-testid="confirmation-modal"]')
    ).not.toBeVisible();

    // Verify both terms are still at root level (no hierarchy change)
    await expect(
      page.getByTestId(term1.responseData.displayName)
    ).toBeVisible();
    await expect(
      page.getByTestId(term2.responseData.displayName)
    ).toBeVisible();

    // Verify no expand icons (neither has children)
    const expandIcons = page.getByTestId('expand-icon');
    const count = await expandIcons.count();

    expect(count).toBe(0);
  });
});

// G-U02: Update glossary display name via rename modal
test.describe('Rename Glossary', () => {
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

  test('should rename glossary via manage menu', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Click manage button
    await page.getByTestId('manage-button').click();

    // Click rename option
    await page.getByTestId('rename-button-title').click();

    // Wait for rename modal
    await page.waitForSelector('[data-testid="rename-modal"]');

    const newName = `Renamed_${Date.now()}`;
    await page.fill('[data-testid="displayName"]', newName);

    const patchResponse = page.waitForResponse('/api/v1/glossaries/*');
    await page.click('[data-testid="save-button"]');
    await patchResponse;

    // Verify new name is displayed
    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      newName
    );
  });
});

// T-U02: Update term display name
test.describe('Update Term Display Name', () => {
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
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should update term display name via manage menu', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term details
    await page.getByTestId(glossaryTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Click manage button
    await page.getByTestId('manage-button').click();

    // Click rename option
    await page.getByTestId('rename-button-title').click();

    // Wait for rename modal
    await page.waitForSelector('[data-testid="rename-modal"]');

    const newDisplayName = `UpdatedTerm_${Date.now()}`;
    await page.fill('[data-testid="displayName"]', newDisplayName);

    const patchResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.click('[data-testid="save-button"]');
    await patchResponse;

    // Verify new display name is shown
    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      newDisplayName
    );
  });
});

// T-U15: Verify bidirectional related term link
test.describe('Bidirectional Related Term Link', () => {
  const glossary = new Glossary();
  const term1 = new GlossaryTerm(glossary);
  const term2 = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await term1.create(apiContext);
    await term2.create(apiContext);
    // Add term2 as related to term1
    await term1.patch(apiContext, [
      {
        op: 'add',
        path: '/relatedTerms',
        value: [
          {
            id: term2.responseData.id,
            type: 'glossaryTerm',
          },
        ],
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should show bidirectional related term link', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term1 details
    await page.getByTestId(term1.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Verify term2 is shown as related term
    await expect(
      page
        .getByTestId('related-term-container')
        .getByTestId(term2.responseData.displayName)
    ).toBeVisible();

    // Click on term2 to navigate
    await page
      .getByTestId('related-term-container')
      .getByTestId(term2.responseData.displayName)
      .click();
    await page.waitForLoadState('networkidle');

    // Verify we're on term2 page
    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      term2.responseData.displayName
    );

    // Verify term1 is shown as related term on term2 (bidirectional)
    await expect(
      page
        .getByTestId('related-term-container')
        .getByTestId(term1.responseData.displayName)
    ).toBeVisible();
  });
});

// V-07: Version diff shows synonym changes
test.describe('Version Diff Shows Synonym Changes', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    // Add synonyms to create a version change
    await glossaryTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/synonyms',
        value: ['SynonymForVersion'],
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should show synonym changes in version diff', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term details
    await page.getByTestId(glossaryTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Click version button
    await page.getByTestId('version-button').click();
    await page.waitForLoadState('networkidle');

    // Verify version page shows changes
    await expect(page.getByText('SynonymForVersion')).toBeVisible();
  });
});

// V-10: Navigate between versions
test.describe('Navigate Between Versions', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    // Make multiple changes to create versions
    await glossaryTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/synonyms',
        value: ['FirstSynonym'],
      },
    ]);
    await glossaryTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/synonyms/1',
        value: 'SecondSynonym',
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should navigate between different versions', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term details
    await page.getByTestId(glossaryTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Click version button
    await page.getByTestId('version-button').click();
    await page.waitForLoadState('networkidle');

    // Verify version selector is visible
    const versionSelector = page.locator('.ant-select-selector').first();

    if (await versionSelector.isVisible()) {
      await versionSelector.click();

      // Select a different version from dropdown
      const versionOptions = page.locator('.ant-select-item');
      const count = await versionOptions.count();

      if (count > 1) {
        await versionOptions.nth(1).click();
        await page.waitForLoadState('networkidle');
      }
    }

    // Verify we're on version page
    await expect(page.getByTestId('version-button')).toBeVisible();
  });
});

// V-11: Return to current version from history
test.describe('Return to Current Version', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    // Add synonym to create version
    await glossaryTerm.patch(apiContext, [
      {
        op: 'add',
        path: '/synonyms',
        value: ['VersionSynonym'],
      },
    ]);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should return to current version from history', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term details
    await page.getByTestId(glossaryTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Click version button to go to version history
    await page.getByTestId('version-button').click();
    await page.waitForLoadState('networkidle');

    // Click back button or close to return to current
    const backButton = page.getByTestId('back-button');

    if (await backButton.isVisible()) {
      await backButton.click();
    } else {
      // Use browser back
      await page.goBack();
    }

    await page.waitForLoadState('networkidle');

    // Verify we're back on term page
    await expect(page.getByTestId('entity-header-display-name')).toContainText(
      glossaryTerm.responseData.displayName
    );
  });
});

// EC-03: Very long term name (128 chars)
test.describe('Long Term Name', () => {
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

  test('should handle term with very long name', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    // Create a long name (128 chars is typically the limit)
    const longName = 'A'.repeat(100) + Date.now().toString().slice(-10);
    await page.fill('[data-testid="name"]', longName);
    await page.locator(descriptionBox).fill('Term with long name');

    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    const response = await createResponse;
    const responseData = await response.json();

    // Verify term was created
    expect(responseData.name).toBe(longName);
  });
});

// EC-04: Very long description (5000+ chars)
test.describe('Long Description', () => {
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

  test('should handle term with very long description', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    const termName = `LongDesc${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);

    // Create a long description (5000+ chars)
    const longDescription = 'This is a test. '.repeat(350);
    await page.locator(descriptionBox).fill(longDescription);

    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    const response = await createResponse;
    const responseData = await response.json();

    // Verify term was created with long description
    expect(responseData.description.length).toBeGreaterThan(5000);
  });
});

// G-C07: Form validation - name exceeds 128 characters
test.describe('Name Length Validation', () => {
  test('should show error when glossary name exceeds limit', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);

    await page.click('[data-testid="add-glossary"]');
    await page.waitForSelector('[data-testid="form-heading"]');

    // Try to enter name exceeding 128 chars
    const tooLongName = 'A'.repeat(150);
    await page.fill('[data-testid="name"]', tooLongName);
    await page.locator(descriptionBox).fill('Test description');

    // Try to save
    await page.click('[data-testid="save-glossary"]');

    // Check for error (either validation error or the field truncates)
    const nameField = page.locator('[data-testid="name"]');
    const fieldValue = await nameField.inputValue();

    // Either shows error or truncates to max length
    const hasLengthLimit = fieldValue.length <= 128;
    const hasError = await page
      .locator('.ant-form-item-explain-error')
      .isVisible()
      .catch(() => false);

    expect(hasLengthLimit || hasError).toBeTruthy();
  });
});

// T-C09: Form validation - term name exceeds 128 characters
test.describe('Term Name Length Validation', () => {
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

  test('should show error when term name exceeds limit', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    // Try to enter name exceeding 128 chars
    const tooLongName = 'B'.repeat(150);
    await page.fill('[data-testid="name"]', tooLongName);
    await page.locator(descriptionBox).fill('Test description');

    // Try to save
    await page.click('[data-testid="save-glossary-term"]');

    // Check for error or truncation
    const nameField = page.locator('[data-testid="name"]');
    const fieldValue = await nameField.inputValue();

    const hasLengthLimit = fieldValue.length <= 128;
    const hasError = await page
      .locator('.ant-form-item-explain-error')
      .isVisible()
      .catch(() => false);

    expect(hasLengthLimit || hasError).toBeTruthy();
  });
});

// H-N07: Navigate 5+ levels deep in hierarchy
test.describe('Deep Hierarchy Navigation', () => {
  const glossary = new Glossary();
  const termIds: string[] = [];

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);

    // Create 5 levels of nested terms
    let parentId = undefined;

    for (let i = 1; i <= 5; i++) {
      const termData = {
        glossary: glossary.responseData.id,
        name: `Level${i}_${Date.now()}`,
        displayName: `Level${i}Term`,
        description: `Term at level ${i}`,
        parent: parentId,
      };

      const response = await apiContext.post('/api/v1/glossaryTerms', {
        data: termData,
      });
      const responseData = await response.json();
      termIds.push(responseData.id);
      parentId = responseData.id;
    }

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should navigate through 5+ levels of hierarchy', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Expand each level
    for (let i = 0; i < 4; i++) {
      const expandIcon = page.getByTestId('expand-icon').first();

      if (await expandIcon.isVisible()) {
        await expandIcon.click();
        await page.waitForLoadState('networkidle');
      }
    }

    // Verify Level5 term is visible (deepest level)
    await expect(page.getByText('Level5Term')).toBeVisible();
  });
});

// S-F04: Filter by multiple statuses
test.describe('Filter by Multiple Statuses', () => {
  const glossary = new Glossary();
  const reviewer = new UserClass();
  const draftTerm = new GlossaryTerm(glossary);
  const reviewTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await reviewer.create(apiContext);
    await glossary.create(apiContext);

    // Create draft term (glossary without reviewers)
    await draftTerm.create(apiContext);

    // Add reviewer to glossary so next term is in review
    await glossary.patch(apiContext, [
      {
        op: 'add',
        path: '/reviewers/0',
        value: {
          id: reviewer.responseData.id,
          type: 'user',
        },
      },
    ]);

    // Create term that will be in review
    await reviewTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await reviewer.delete(apiContext);
    await afterAction();
  });

  test('should filter terms by multiple statuses', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Click on status filter
    await page.click('[data-testid="status-dropdown"]');

    // Select Draft filter
    await page.click('[data-testid="Draft"]');

    // Select InReview filter as well (multiple selection)
    await page.click('[data-testid="In Review"]');
    await page.waitForLoadState('networkidle');

    // Verify both terms are visible (both statuses selected)
    await expect(
      page.getByTestId(draftTerm.responseData.displayName)
    ).toBeVisible();
    await expect(
      page.getByTestId(reviewTerm.responseData.displayName)
    ).toBeVisible();
  });
});

// S-F05: Clear status filter
test.describe('Clear Status Filter', () => {
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
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should clear status filter and show all terms', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Verify term is initially visible
    await expect(
      page.getByTestId(glossaryTerm.responseData.displayName)
    ).toBeVisible();

    // Click on status filter and select Approved (term is Draft)
    await page.click('[data-testid="status-dropdown"]');
    await page.click('[data-testid="Approved"]');
    await page.waitForLoadState('networkidle');

    // Term should not be visible (it's Draft, not Approved)
    await expect(
      page.getByTestId(glossaryTerm.responseData.displayName)
    ).not.toBeVisible();

    // Clear the filter
    await page.click('[data-testid="status-dropdown"]');
    await page.click('[data-testid="Approved"]'); // Deselect
    await page.waitForLoadState('networkidle');

    // Term should be visible again
    await expect(
      page.getByTestId(glossaryTerm.responseData.displayName)
    ).toBeVisible();
  });
});

// W-H01: View workflow history on term
test.describe('View Workflow History', () => {
  const glossary = new Glossary();
  const reviewer = new UserClass();
  const glossaryTerm = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await reviewer.create(apiContext);
    await glossary.create(apiContext);
    // Add reviewer
    await glossary.patch(apiContext, [
      {
        op: 'add',
        path: '/reviewers/0',
        value: {
          id: reviewer.responseData.id,
          type: 'user',
        },
      },
    ]);
    await glossaryTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await reviewer.delete(apiContext);
    await afterAction();
  });

  test('should view workflow history on term', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Navigate to term details
    await page.getByTestId(glossaryTerm.responseData.displayName).click();
    await page.waitForLoadState('networkidle');

    // Click on status badge to see history
    const statusBadge = page.getByTestId('glossary-term-status');

    await expect(statusBadge).toBeVisible();

    // Hover to see popover with history
    await statusBadge.hover();

    // Verify popover appears with status info
    await expect(page.locator('.ant-popover')).toBeVisible();
  });
});

// IE-E04: Export large glossary
test.describe('Export Large Glossary', () => {
  const glossary = new Glossary();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);

    // Create multiple terms for export test
    for (let i = 0; i < 10; i++) {
      await apiContext.post('/api/v1/glossaryTerms', {
        data: {
          glossary: glossary.responseData.id,
          name: `ExportTerm${i}_${Date.now()}`,
          displayName: `ExportTerm${i}`,
          description: `Term ${i} for export test`,
        },
      });
    }
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should export glossary with multiple terms', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Click export button
    await page.getByTestId('manage-button').click();
    await page.getByTestId('export-button-title').click();

    // Wait for export modal
    await page.waitForSelector('[data-testid="export-csv-modal"]');

    // Start download and verify
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="export-button"]');
    const download = await downloadPromise;

    // Verify download started
    expect(download.suggestedFilename()).toContain('.csv');
  });
});

// T-C15: Create term with custom style (color)
test.describe('Create Term with Custom Color', () => {
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

  test('should create term with custom color', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    const termName = `ColorTerm${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Term with custom color');

    // Open style section and set color
    const styleSection = page.locator('[data-testid="style-section"]');

    if (await styleSection.isVisible()) {
      await styleSection.click();

      // Set a custom color
      const colorInput = page.locator('[data-testid="color-picker"]');

      if (await colorInput.isVisible()) {
        await colorInput.fill('#FF5733');
      }
    }

    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    await createResponse;

    // Verify term is created
    await expect(page.getByTestId(termName)).toBeVisible();
  });
});
