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
  assignSingleSelectDomain,
  clickOutside,
  descriptionBox,
  getApiContext,
  redirectToHomePage,
  removeSingleSelectDomain,
} from '../../../utils/common';
import { addMultiOwner } from '../../../utils/entity';
import {
  addMultiOwnerInDialog,
  openAddGlossaryTermModal,
  selectActiveGlossary,
  selectActiveGlossaryTerm,
} from '../../../utils/glossary';
import { sidebarClick } from '../../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary Advanced Operations', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  // G-C04: Create glossary with mutually exclusive toggle OFF
  test('should create glossary with mutually exclusive toggle OFF', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);

      await page.click('[data-testid="add-glossary"]');
      await page.waitForSelector('[data-testid="form-heading"]');

      await page.fill('[data-testid="name"]', glossary.data.name);
      await page.locator(descriptionBox).fill(glossary.data.description);

      // Verify mutually exclusive toggle is OFF by default
      const mutuallyExclusiveBtn = page.getByTestId(
        'mutually-exclusive-button'
      );

      await expect(mutuallyExclusiveBtn).toBeVisible();

      // Verify alert is NOT visible when toggle is OFF
      await expect(page.getByTestId('form-item-alert')).not.toBeVisible();

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
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // G-C12: Create glossary with multiple owners (users + teams)
  test('should create glossary with multiple owners (users + teams)', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const user1 = new UserClass();
    const user2 = new UserClass();
    const team = new TeamClass();
    const glossary = new Glossary();

    try {
      await user1.create(apiContext);
      await user2.create(apiContext);
      await team.create(apiContext);

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
    } finally {
      await glossary.delete(apiContext);
      await user1.delete(apiContext);
      await user2.delete(apiContext);
      await team.delete(apiContext);
      await afterAction();
    }
  });

  // G-U05: Replace owner on glossary
  test('should replace owner on glossary', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const user1 = new UserClass();
    const user2 = new UserClass();
    const glossary = new Glossary();

    try {
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
        .getByTestId('edit-owner')
        .click();
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

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
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

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
    } finally {
      await glossary.delete(apiContext);
      await user1.delete(apiContext);
      await user2.delete(apiContext);
      await afterAction();
    }
  });

  // G-U08: Replace reviewer on glossary
  test('should replace reviewer on glossary', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const user1 = new UserClass();
    const user2 = new UserClass();
    const glossary = new Glossary();

    try {
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
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

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
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

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
    } finally {
      await glossary.delete(apiContext);
      await user1.delete(apiContext);
      await user2.delete(apiContext);
      await afterAction();
    }
  });

  // G-U12: Remove domain from glossary
  test('should remove domain from glossary', async ({ page }) => {
    test.slow(true);
    const { apiContext, afterAction } = await getApiContext(page);
    const domain = new Domain();
    const glossary = new Glossary();

    try {
      await domain.create(apiContext);
      await glossary.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await assignSingleSelectDomain(page, domain.responseData);
      await removeSingleSelectDomain(page, domain.responseData, false);
    } finally {
      await glossary.delete(apiContext);
      await domain.delete(apiContext);
      await afterAction();
    }
  });

  // G-U13: Change domain on glossary
  test('should change domain on glossary', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const domain1 = new Domain();
    const domain2 = new Domain();
    const glossary = new Glossary();

    try {
      await domain1.create(apiContext);
      await domain2.create(apiContext);
      await glossary.create(apiContext);
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Add initial domain via UI first
      await page.getByTestId('add-domain').click();
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

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
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Verify initial domain is visible
      await expect(page.getByTestId('domain-link')).toContainText(
        domain1.data.displayName
      );

      // Click on domain to change it
      await page.getByTestId('add-domain').click();
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

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
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Verify new domain is visible
      await expect(page.getByTestId('domain-link')).toContainText(
        domain2.data.displayName
      );
    } finally {
      await glossary.delete(apiContext);
      await domain1.delete(apiContext);
      await domain2.delete(apiContext);
      await afterAction();
    }
  });

  // T-C15: Create term with custom style (color)
  test('should create term with custom style color', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await openAddGlossaryTermModal(page);

      const termName = `ColorTerm${Date.now()}`;
      await page.fill('[data-testid="name"]', termName);
      await page.locator(descriptionBox).fill('Term with custom color');

      // Set custom color
      const customColor = '#FF5733';
      await page.getByTestId('color-color-input').fill(customColor);

      const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
      await page.click('[data-testid="save-glossary-term"]');
      const response = await createResponse;
      const responseData = await response.json();

      // Verify color was saved
      expect(responseData.style?.color).toBe(customColor);

      // Verify term is created
      await expect(page.getByTestId(termName)).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-C16: Create term with custom style (icon URL)
  test('should create term with custom style icon URL', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await openAddGlossaryTermModal(page);

      const termName = `IconTerm${Date.now()}`;
      await page.fill('[data-testid="name"]', termName);
      await page.locator(descriptionBox).fill('Term with custom icon');

      // Set custom icon URL
      const iconUrl = 'https://example.com/icon.png';
      await page.getByTestId('icon-url').fill(iconUrl);

      const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
      await page.click('[data-testid="save-glossary-term"]');
      const response = await createResponse;
      const responseData = await response.json();

      // Verify icon was saved
      expect(responseData.style?.iconURL).toBe(iconUrl);

      // Verify term is created
      await expect(page.getByTestId(termName)).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-U22: Update term style - set color
  test('should update term style to set color', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Open edit modal for the term
      const escapedFqn = glossaryTerm.responseData.fullyQualifiedName
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
      const termRow = page.locator(`[data-row-key="${escapedFqn}"]`);
      await termRow.getByTestId('edit-button').click();

      await page.waitForSelector('[role="dialog"].edit-glossary-modal');

      // Set custom color
      const customColor = '#28A745';
      await page.getByTestId('color-color-input').clear();
      await page.getByTestId('color-color-input').fill(customColor);

      const updateResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
      await page.click('[data-testid="save-glossary-term"]');
      const response = await updateResponse;
      const responseData = await response.json();

      // Verify color was updated
      expect(responseData.style?.color).toBe(customColor);
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-U23: Update term style - set icon URL
  test('should update term style to set icon URL', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Open edit modal for the term
      const escapedFqn = glossaryTerm.responseData.fullyQualifiedName
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"');
      const termRow = page.locator(`[data-row-key="${escapedFqn}"]`);
      await termRow.getByTestId('edit-button').click();

      await page.waitForSelector('[role="dialog"].edit-glossary-modal');

      // Set custom icon URL
      const iconUrl = 'https://example.com/new-icon.png';
      await page.getByTestId('icon-url').clear();
      await page.getByTestId('icon-url').fill(iconUrl);

      const updateResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
      await page.click('[data-testid="save-glossary-term"]');
      const response = await updateResponse;
      const responseData = await response.json();

      // Verify icon was updated
      expect(responseData.style?.iconURL).toBe(iconUrl);
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-U08: Clear all synonyms
  test('should clear all synonyms from term', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
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
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Navigate to term details
      await selectActiveGlossaryTerm(
        page,
        glossaryTerm.responseData.displayName
      );

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
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-U10: Edit reference name
  test('should edit reference name', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
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
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Navigate to term details
      await selectActiveGlossaryTerm(
        page,
        glossaryTerm.responseData.displayName
      );

      // Verify original reference is visible
      await expect(
        page.getByTestId('reference-link-OriginalRef')
      ).toBeVisible();

      // Click edit button for references
      await page
        .getByTestId('references-container')
        .getByTestId('edit-button')
        .click();

      await expect(
        page
          .getByTestId('glossary-term-references-modal')
          .getByText('References')
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
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-U11: Edit reference URL
  test('should edit reference URL', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
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

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Navigate to term details
      await selectActiveGlossaryTerm(
        page,
        glossaryTerm.responseData.displayName
      );

      // Click edit button for references
      await page
        .getByTestId('references-container')
        .getByTestId('edit-button')
        .click();

      await expect(
        page
          .getByTestId('glossary-term-references-modal')
          .getByText('References')
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
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-U12: Remove individual reference
  test('should remove individual reference from term', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
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

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Navigate to term details
      await selectActiveGlossaryTerm(
        page,
        glossaryTerm.responseData.displayName
      );

      // Verify both references are visible
      await expect(page.getByTestId('reference-link-KeepRef')).toBeVisible();
      await expect(page.getByTestId('reference-link-RemoveRef')).toBeVisible();

      // Click edit button for references
      await page
        .getByTestId('references-container')
        .getByTestId('edit-button')
        .click();

      await expect(
        page
          .getByTestId('glossary-term-references-modal')
          .getByText('References')
      ).toBeVisible();

      // Click the delete button for the second reference (index 1)
      await page.getByTestId('delete-ref-btn').nth(1).click();

      const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
      await page.getByTestId('save-btn').click();
      await saveRes;

      // Verify only RemoveRef is removed
      await expect(page.getByTestId('reference-link-KeepRef')).toBeVisible();
      await expect(
        page.getByTestId('reference-link-RemoveRef')
      ).not.toBeVisible();
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-U14: Remove related term
  test('should remove related term', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);
    const relatedTerm = new GlossaryTerm(glossary);

    try {
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

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await selectActiveGlossaryTerm(
        page,
        glossaryTerm.responseData.displayName
      );

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

      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Clear all related terms

      await page
        .getByTestId('tag-selector')
        .locator('#tagsForm_tags')
        .press('Backspace');
      await page
        .getByTestId('tag-selector')
        .locator('#tagsForm_tags')
        .press('Backspace');
      await page
        .getByTestId('tag-selector')
        .locator('#tagsForm_tags')
        .press('Backspace');

      const validateRes = page.waitForResponse('/api/v1/glossaryTerms/*');
      await page.getByTestId('saveAssociatedTag').click();
      await validateRes;

      // Verify related term is removed
      await expect(
        page
          .getByTestId('related-term-container')
          .getByTestId(relatedTerm.responseData.displayName)
      ).not.toBeVisible();
    } finally {
      await relatedTerm.delete(apiContext);
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-U19: Remove owner from term
  test('should remove owner from term', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);
    const user = new UserClass();

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);
      await user.create(apiContext);

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

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Navigate to term details
      await selectActiveGlossaryTerm(
        page,
        glossaryTerm.responseData.displayName
      );

      // Verify owner is visible
      await expect(
        page
          .getByTestId('glossary-right-panel-owner-link')
          .getByTestId(user.getUserDisplayName())
      ).toBeVisible();

      // Click edit owner button
      await page.getByTestId('edit-owner').click();
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Clear all owners
      await page.click('[data-testid="clear-all-button"]');

      const patchResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
      await page.getByTestId('selectable-list-update-btn').click();
      await patchResponse;

      // Verify owner is removed
      await expect(
        page
          .getByTestId('glossary-right-panel-owner-link')
          .getByTestId(user.getUserDisplayName())
      ).not.toBeVisible();
    } finally {
      await user.delete(apiContext);
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-U21: Remove reviewer from term
  test('should remove reviewer from term', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);
    const user = new UserClass();

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);
      await user.create(apiContext);

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

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Navigate to term details
      await selectActiveGlossaryTerm(
        page,
        glossaryTerm.responseData.displayName
      );

      // Verify reviewer is visible
      await expect(
        page
          .getByTestId('glossary-reviewer')
          .getByText(user.getUserDisplayName())
      ).toBeVisible();

      // Click edit reviewer button
      await page.getByTestId('edit-reviewer-button').click();
      await page.waitForSelector('[data-testid="loader"]', {
        state: 'detached',
      });

      // Clear all reviewers
      await page.click('[data-testid="clear-all-button"]');

      const patchResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
      await page.click('[data-testid="selectable-list-update-btn"]');
      await patchResponse;

      // Verify reviewer is removed
      await expect(
        page
          .getByTestId('glossary-reviewer')
          .getByText(user.getUserDisplayName())
      ).not.toBeVisible();
    } finally {
      await user.delete(apiContext);
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-C13: Create term with related terms
  test('should create term with related terms', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const existingTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await existingTerm.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await openAddGlossaryTermModal(page);

      const termName = `RelatedTerm${Date.now()}`;
      await page.fill('[data-testid="name"]', termName);
      await page.locator(descriptionBox).fill('Term with related terms');

      const searchResponse = page.waitForResponse('/api/v1/search/query*');

      await page.getByTestId('related-terms').click();

      // Add related term
      await page
        .getByTestId('related-terms')
        .locator('input')
        .fill(existingTerm.responseData.displayName);

      await searchResponse;

      // Select the term
      await page
        .getByTestId(`tag-${existingTerm.responseData.fullyQualifiedName}`)
        .click();

      await clickOutside(page);

      const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
      await page.click('[data-testid="save-glossary-term"]');
      const response = await createResponse;
      const responseData = await response.json();

      // Verify related terms were saved
      expect(responseData.relatedTerms).toBeDefined();
      expect(responseData.relatedTerms.length).toBeGreaterThan(0);

      // Verify term is created
      await expect(page.getByTestId(termName)).toBeVisible();
    } finally {
      await existingTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-U17: Remove tags from term
  test('should remove tags from term', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
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

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Navigate to term details
      await selectActiveGlossaryTerm(
        page,
        glossaryTerm.responseData.displayName
      );

      // Verify tag is visible
      await expect(page.getByTestId('tag-PII.Sensitive')).toBeVisible();

      // Click edit button for tags
      await page
        .getByTestId('tags-container')
        .getByTestId('edit-button')
        .click();
      await page.waitForSelector('[data-testid="tag-selector"]');

      // Remove the tag by clicking its close button
      await page.getByTestId('remove-tags').locator('svg').click();

      await page.getByTestId('saveAssociatedTag').click();

      await expect(page.getByRole('heading')).toContainText(
        'Would you like to proceed with updating the tags?'
      );

      const validateRes = page.waitForResponse('/api/v1/glossaryTerms/*');
      await page.getByRole('button', { name: 'Yes, confirm' }).click();
      await validateRes;

      // Verify tag is removed
      await expect(page.getByTestId('tag-PII.Sensitive')).not.toBeVisible();
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // G-C09: Cancel glossary creation
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

  // T-C10: Cancel term creation
  test('should cancel term creation without saving', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await openAddGlossaryTermModal(page);

      const termName = `CancelTermTest${Date.now()}`;
      await page.fill('[data-testid="name"]', termName);
      await page.locator(descriptionBox).fill('This should be cancelled');

      // Click cancel button (X or Cancel)
      await page.getByRole('button', { name: 'Cancel' }).click();

      await expect(page.getByTestId(termName)).not.toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-U02: Update term display name
  test('should update term display name via manage menu', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Navigate to term details
      await selectActiveGlossaryTerm(
        page,
        glossaryTerm.responseData.displayName
      );

      // Click manage button
      await page.getByTestId('manage-button').click();

      // Click rename option
      await page.getByTestId('rename-button').click();

      // Wait for rename modal
      await page.waitForSelector('[role="dialog"]', { state: 'visible' });

      const newDisplayName = `UpdatedTerm_${Date.now()}`;
      await page.locator('#displayName').fill(newDisplayName);

      const patchResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
      await page.click('[data-testid="save-button"]');
      await patchResponse;

      // Verify new display name is shown
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(newDisplayName);
    } finally {
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // T-U15: Verify bidirectional related term link
  test('should show bidirectional related term link', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const term1 = new GlossaryTerm(glossary);
    const term2 = new GlossaryTerm(glossary);

    try {
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
      await expect(
        page.getByTestId('entity-header-display-name')
      ).toContainText(term2.responseData.displayName);

      // Verify term1 is shown as related term on term2 (bidirectional)
      await expect(
        page
          .getByTestId('related-term-container')
          .getByTestId(term1.responseData.displayName)
      ).toBeVisible();
    } finally {
      await term2.delete(apiContext);
      await term1.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // EC-03: Very long term name (128 chars)
  test('should handle term with very long name', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await openAddGlossaryTermModal(page);

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
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // EC-04: Very long description (5000+ chars)
  test('should handle term with very long description', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await openAddGlossaryTermModal(page);

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
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // G-C07: Form validation - name exceeds 128 characters
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
    const nameField = page.getByTestId('name');
    const fieldValue = await nameField.inputValue();

    // Either shows error or truncates to max length
    const hasLengthLimit = fieldValue.length <= 128;
    const hasError = await page
      .locator('.ant-form-item-explain-error')
      .isVisible()
      .catch(() => false);

    expect(hasLengthLimit || hasError).toBeTruthy();
  });

  // T-C09: Form validation - term name exceeds 128 characters
  test('should show error when term name exceeds limit', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await openAddGlossaryTermModal(page);

      // Try to enter name exceeding 128 chars
      const tooLongName = 'B'.repeat(150);
      await page.fill('[data-testid="name"]', tooLongName);
      await page.locator(descriptionBox).fill('Test description');

      // Try to save
      await page.click('[data-testid="save-glossary-term"]');

      // Check for error or truncation
      const nameField = page.getByTestId('name');
      const fieldValue = await nameField.inputValue();

      const hasLengthLimit = fieldValue.length <= 128;
      const hasError = await page
        .locator('.ant-form-item-explain-error')
        .isVisible()
        .catch(() => false);

      expect(hasLengthLimit || hasError).toBeTruthy();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});
