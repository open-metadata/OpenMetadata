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
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { UserClass } from '../../support/user/UserClass';
import { createNewPage, redirectToHomePage } from '../../utils/common';
import { addMultiOwner, assignTag, removeTag } from '../../utils/entity';
import { removeReviewer } from '../../utils/glossary';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary Remove Operations', () => {
  const glossary = new Glossary();
  const glossaryTerm = new GlossaryTerm(glossary);
  const user = new UserClass();

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await user.create(apiContext);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossaryTerm.delete(apiContext);
    await glossary.delete(apiContext);
    await user.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should add and remove owner from glossary', async ({ page }) => {
    await glossary.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    // Add owner
    await addMultiOwner({
      page,
      ownerNames: [user.getUserDisplayName()],
      activatorBtnDataTestId: 'add-owner',
      resultTestId: 'glossary-right-panel-owner-link',
      endpoint: EntityTypeEndpoint.Glossary,
      isSelectableInsideForm: false,
      type: 'Users',
    });

    // Verify owner is added
    await expect(
      page
        .getByTestId('glossary-right-panel-owner-link')
        .getByTestId(user.getUserDisplayName())
    ).toBeVisible();

    // Remove owner - click the owner link to edit
    await page
      .getByTestId('glossary-right-panel-owner-link')
      .locator('[data-testid="edit-owner"]')
      .click();
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    const patchResponse = page.waitForResponse('/api/v1/glossaries/*');
    await page.click('[data-testid="clear-all-button"]');
    await page.click('[data-testid="selectable-list-update-btn"]');
    await patchResponse;

    // Verify owner is removed - Add button should be visible again
    await expect(page.getByTestId('add-owner')).toBeVisible();
  });

  test('should add and remove reviewer from glossary', async ({ page }) => {
    await glossary.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    // Add reviewer using the Add button
    await addMultiOwner({
      page,
      ownerNames: [user.getUserDisplayName()],
      activatorBtnDataTestId: 'Add',
      resultTestId: 'glossary-reviewer-name',
      endpoint: EntityTypeEndpoint.Glossary,
      type: 'Users',
    });

    // Verify reviewer is added
    await expect(
      page
        .getByTestId('glossary-reviewer-name')
        .getByText(user.getUserDisplayName())
    ).toBeVisible();

    // Remove reviewer
    await removeReviewer(page, EntityTypeEndpoint.Glossary);

    // Verify reviewer is removed (Add button is shown)
    await expect(
      page.locator('[data-testid="glossary-reviewer"] [data-testid="Add"]')
    ).toBeVisible();
  });

  test('should add and remove owner from glossary term', async ({ page }) => {
    await glossaryTerm.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    // Add owner
    await addMultiOwner({
      page,
      ownerNames: [user.getUserDisplayName()],
      activatorBtnDataTestId: 'add-owner',
      resultTestId: 'glossary-right-panel-owner-link',
      endpoint: EntityTypeEndpoint.GlossaryTerm,
      isSelectableInsideForm: false,
      type: 'Users',
    });

    // Verify owner is added
    await expect(
      page
        .getByTestId('glossary-right-panel-owner-link')
        .getByTestId(user.getUserDisplayName())
    ).toBeVisible();

    // Remove owner - click the edit icon
    await page
      .getByTestId('glossary-right-panel-owner-link')
      .locator('[data-testid="edit-owner"]')
      .click();
    await page.waitForSelector('[data-testid="loader"]', { state: 'detached' });

    const patchResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.click('[data-testid="clear-all-button"]');
    await page.click('[data-testid="selectable-list-update-btn"]');
    await patchResponse;

    // Verify owner is removed - Add button should be visible again
    await expect(page.getByTestId('add-owner')).toBeVisible();
  });

  test('should add and remove reviewer from glossary term', async ({
    page,
  }) => {
    await glossaryTerm.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    // Add reviewer using Add button
    await addMultiOwner({
      page,
      ownerNames: [user.getUserDisplayName()],
      activatorBtnDataTestId: 'Add',
      resultTestId: 'glossary-reviewer-name',
      endpoint: EntityTypeEndpoint.GlossaryTerm,
      type: 'Users',
    });

    // Verify reviewer is added
    await expect(
      page
        .getByTestId('glossary-reviewer-name')
        .getByText(user.getUserDisplayName())
    ).toBeVisible();

    // Remove reviewer
    await removeReviewer(page, EntityTypeEndpoint.GlossaryTerm);

    // Verify reviewer is removed (Add button is shown)
    await expect(
      page.locator('[data-testid="glossary-reviewer"] [data-testid="Add"]')
    ).toBeVisible();
  });

  test('should add and remove tags from glossary', async ({ page }) => {
    await glossary.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    const tagFqn = 'PersonalData.Personal';

    // Add tag to glossary
    await assignTag(
      page,
      'Personal',
      'Add',
      EntityTypeEndpoint.Glossary,
      'KnowledgePanel.Tags',
      tagFqn
    );

    // Verify tag is added
    await expect(
      page
        .getByTestId('KnowledgePanel.Tags')
        .getByTestId('tags-container')
        .getByTestId(`tag-${tagFqn}`)
    ).toBeVisible();

    // Remove the tag
    await removeTag(page, [tagFqn]);

    // Verify tag is removed
    await expect(
      page
        .getByTestId('KnowledgePanel.Tags')
        .getByTestId('tags-container')
        .getByTestId(`tag-${tagFqn}`)
    ).not.toBeVisible();
  });

  test('should add and remove tags from glossary term', async ({ page }) => {
    await glossaryTerm.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    const tagFqn = 'PII.Sensitive';
    const tagName = 'Sensitive';

    // On glossary term page, tags are in the main content area, not KnowledgePanel
    // Click add tag button in tags section
    await page.getByTestId('tags-container').getByTestId('add-tag').click();

    // Wait for tag selector form
    await page.locator('#tagsForm_tags').waitFor({ state: 'visible' });

    // Search and select tag
    const searchTags = page.waitForResponse(
      `/api/v1/search/query?q=*${encodeURIComponent(tagName)}*`
    );
    await page.locator('#tagsForm_tags').fill(tagName);
    await searchTags;

    await page.getByTestId(`tag-${tagFqn}`).click();

    // Wait for save button and click
    await page.waitForSelector(
      '.ant-select-dropdown [data-testid="saveAssociatedTag"]',
      { state: 'visible' }
    );

    await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

    await page.getByTestId('saveAssociatedTag').click();

    // Handle confirmation modal for glossary term tag updates
    await expect(
      page.getByText('Would you like to proceed with updating the tags?')
    ).toBeVisible();

    const patchRequest = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.getByRole('button', { name: 'Yes, confirm' }).click();
    await patchRequest;

    // Verify tag is added
    await expect(
      page.getByTestId('tags-container').getByTestId(`tag-${tagFqn}`)
    ).toBeVisible();

    // Remove the tag - click edit button
    await page.getByTestId('tags-container').getByTestId('edit-button').click();

    // Remove tag by clicking the X icon
    await page
      .getByTestId(`selected-tag-${tagFqn}`)
      .getByTestId('remove-tags')
      .locator('svg')
      .click();

    // Save the changes
    await page.waitForSelector(
      '.ant-select-dropdown [data-testid="saveAssociatedTag"]',
      { state: 'visible' }
    );

    await expect(page.getByTestId('saveAssociatedTag')).toBeEnabled();

    await page.getByTestId('saveAssociatedTag').click();

    // Handle confirmation modal for glossary term tag updates
    await expect(
      page.getByText('Would you like to proceed with updating the tags?')
    ).toBeVisible();

    const patchRequest2 = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.getByRole('button', { name: 'Yes, confirm' }).click();
    await patchRequest2;

    // Verify tag is removed
    await expect(
      page.getByTestId('tags-container').getByTestId(`tag-${tagFqn}`)
    ).not.toBeVisible();
  });
});
