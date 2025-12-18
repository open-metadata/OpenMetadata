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
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import {
  createNewPage,
  descriptionBox,
  redirectToHomePage,
} from '../../../utils/common';
import {
  addReferences,
  addRelatedTerms,
  addSynonyms,
  selectActiveGlossary,
} from '../../../utils/glossary';
import { sidebarClick } from '../../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary Term Details Operations', () => {
  const glossary = new Glossary();
  const glossaryTerm1 = new GlossaryTerm(glossary);
  const glossaryTerm2 = new GlossaryTerm(glossary);

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.create(apiContext);
    await glossaryTerm1.create(apiContext);
    await glossaryTerm2.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossaryTerm1.delete(apiContext);
    await glossaryTerm2.delete(apiContext);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should add and remove synonyms from glossary term', async ({
    page,
  }) => {
    await glossaryTerm1.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    const synonym1 = 'TestSynonym1';
    const synonym2 = 'TestSynonym2';

    // Add synonyms
    await addSynonyms(page, [synonym1, synonym2]);

    // Verify synonyms are visible
    await expect(page.getByTestId(synonym1)).toBeVisible();
    await expect(page.getByTestId(synonym2)).toBeVisible();

    // Remove first synonym by clicking edit button (shown when synonyms exist)
    await page
      .getByTestId('synonyms-container')
      .getByTestId('edit-button')
      .click();

    // Find and remove the first synonym
    const synonym1Tag = page.locator(
      `.ant-select-selection-item[title="${synonym1}"] .ant-select-selection-item-remove`
    );
    await synonym1Tag.click();

    const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.getByTestId('save-synonym-btn').click();
    await saveRes;

    // Verify first synonym is removed, second still exists
    await expect(page.getByTestId(synonym1)).not.toBeVisible();
    await expect(page.getByTestId(synonym2)).toBeVisible();
  });

  test('should add and remove references from glossary term', async ({
    page,
  }) => {
    await glossaryTerm1.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    const reference1 = { name: 'RefName1', url: 'http://example1.com' };
    const reference2 = { name: 'RefName2', url: 'http://example2.com' };

    // Add references
    await addReferences(page, [reference1, reference2]);

    // Verify references are visible
    await expect(
      page.getByTestId(`reference-link-${reference1.name}`)
    ).toBeVisible();
    await expect(
      page.getByTestId(`reference-link-${reference2.name}`)
    ).toBeVisible();

    // Click edit button (shown when references exist)
    await page
      .getByTestId('references-container')
      .getByTestId('edit-button')
      .click();

    await expect(
      page.getByTestId('glossary-term-references-modal').getByText('References')
    ).toBeVisible();

    // Remove first reference using the delete button in the row
    // The delete button is the only button with IconDelete in the modal rows
    await page
      .getByTestId('glossary-term-references-modal')
      .locator('.reference-edit-form button[type="button"]')
      .first()
      .click();

    const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.getByTestId('save-btn').click();
    await saveRes;

    // Verify first reference is removed, second still exists
    await expect(
      page.getByTestId(`reference-link-${reference1.name}`)
    ).not.toBeVisible();
    await expect(
      page.getByTestId(`reference-link-${reference2.name}`)
    ).toBeVisible();
  });

  test('should add and remove related terms from glossary term', async ({
    page,
  }) => {
    await glossaryTerm1.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    // Add related term
    await addRelatedTerms(page, [glossaryTerm2]);

    // Verify related term is visible
    const relatedTermName = glossaryTerm2.responseData?.displayName;

    await expect(page.getByTestId(relatedTermName)).toBeVisible();

    // Click edit button (shown when related terms exist)
    await page
      .getByTestId('related-term-container')
      .getByTestId('edit-button')
      .click();

    // Remove the related term by clicking the close icon on the tag
    // Use a more robust selector that doesn't rely on FQN in attribute
    await page.locator('.ant-tag-close-icon').first().click();

    const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.getByTestId('saveAssociatedTag').click();
    await saveRes;

    // Verify related term is removed
    await expect(page.getByTestId(relatedTermName)).not.toBeVisible();
  });

  test('should verify bidirectional related term link', async ({ page }) => {
    await glossaryTerm1.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    // Add related term
    await addRelatedTerms(page, [glossaryTerm2]);

    // Verify related term is visible on term1
    const relatedTermName = glossaryTerm2.responseData?.displayName;

    await expect(page.getByTestId(relatedTermName)).toBeVisible();

    // Navigate to term2 and verify term1 is shown as related
    await glossaryTerm2.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    const term1Name = glossaryTerm1.responseData?.displayName;

    await expect(page.getByTestId(term1Name)).toBeVisible();

    // Clean up: remove the related term from term2's page - use edit button since term exists
    await page
      .getByTestId('related-term-container')
      .getByTestId('edit-button')
      .click();

    // Use a more robust selector
    await page.locator('.ant-tag-close-icon').first().click();

    const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.getByTestId('saveAssociatedTag').click();
    await saveRes;
  });
});

test.describe('Edit Term via Table Modal', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

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

  test('should edit term via pencil icon in table row', async ({ page }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.waitForLoadState('networkidle');

    // Find the term row and hover to reveal edit button
    const termRow = page.locator(
      `[data-row-key*="${glossaryTerm.responseData.name}"]`
    );

    await expect(termRow).toBeVisible();

    // Hover over the term name cell to reveal edit button
    await termRow.hover();

    // Click the edit (pencil) icon button in the row
    // The edit button appears on hover in the term name cell
    const editButton = termRow.getByTestId('edit-button');
    await editButton.click();

    // Wait for edit modal to open
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    // Verify the modal has the term name pre-filled
    await expect(page.locator('[data-testid="name"]')).toHaveValue(
      glossaryTerm.data.name
    );

    // Update the description
    const newDescription = 'Updated description via table edit modal';
    await page.locator(descriptionBox).clear();
    await page.locator(descriptionBox).fill(newDescription);

    // Add a synonym
    const newSynonym = 'TableEditSynonym';
    await page
      .locator('[data-testid="synonyms"] input[type="search"]')
      .fill(newSynonym);
    await page
      .locator('[data-testid="synonyms"] input[type="search"]')
      .press('Enter');

    // Save the changes
    const updateResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
    await page.click('[data-testid="save-glossary-term"]');
    await updateResponse;

    // Wait for modal to close
    await expect(
      page.locator('[role="dialog"].edit-glossary-modal')
    ).not.toBeVisible();

    await page.waitForLoadState('networkidle');

    // Verify the description was updated in the table row
    const updatedTermRow = page.locator(
      `[data-row-key*="${glossaryTerm.responseData.name}"]`
    );

    await expect(updatedTermRow).toBeVisible();

    // Verify description column shows updated text
    await expect(updatedTermRow).toContainText('Updated description');

    // Navigate to term details page using direct navigation
    await glossaryTerm.visitEntityPage(page);
    await page.waitForLoadState('networkidle');

    // Verify the description was updated on the term details page
    await expect(
      page.locator('[data-testid="asset-description-container"]')
    ).toContainText(newDescription);

    // Verify the synonym was added
    await expect(page.getByTestId(newSynonym)).toBeVisible();
  });
});

test.describe('Term Creation with All Fields', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

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

  test('should create term with all optional fields populated', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Click add term button
    await openAddGlossaryTermModal(page);

    // Fill required fields
    const termName = `FullTerm${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('A comprehensive test term');

    // Add synonyms
    const synonyms = ['synonym1', 'synonym2', 'alternative'];
    for (const synonym of synonyms) {
      await page
        .locator('[data-testid="synonyms"] input[type="search"]')
        .fill(synonym);
      await page
        .locator('[data-testid="synonyms"] input[type="search"]')
        .press('Enter');
    }

    // Add reference
    await page.click('[data-testid="add-reference"]');
    await page.locator('#name-0').fill('Documentation');
    await page.locator('#url-0').fill('https://docs.example.com');

    // Add icon URL (custom style)
    const iconUrl = 'https://example.com/icon.png';
    await page.locator('[data-testid="icon-url"]').fill(iconUrl);

    // Submit the term
    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    await createResponse;

    // Wait for modal to close
    await expect(
      page.locator('[role="dialog"].edit-glossary-modal')
    ).not.toBeVisible();

    // Wait for the table to update
    await page.waitForLoadState('networkidle');

    // Verify term is created and visible in the table
    const termRow = page.locator(`[data-row-key*="${termName}"]`);

    await expect(termRow).toBeVisible();

    // Click on the term to view its details
    await page.click(`[data-testid="${termName}"]`);
    await page.waitForLoadState('networkidle');

    // Verify synonyms are present on the term page
    for (const synonym of synonyms) {
      await expect(page.getByTestId(synonym)).toBeVisible();
    }

    // Verify reference is present
    await expect(
      page.getByTestId('reference-link-Documentation')
    ).toBeVisible();

    // Verify description
    await expect(
      page.locator('[data-testid="asset-description-container"]')
    ).toContainText('A comprehensive test term');
  });
});
