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
import test, { expect } from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import {
  createNewPage,
  descriptionBox,
  redirectToHomePage,
} from '../../utils/common';
import {
  confirmationDragAndDropGlossary,
  dragAndDropTerm,
  performExpandAll,
  selectActiveGlossary,
} from '../../utils/glossary';
import { sidebarClick } from '../../utils/sidebar';
import { performUserLogin } from '../../utils/user';

test.describe('Term Status Transitions', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  const glossaryNoReviewers = new Glossary();
  const glossaryWithReviewer = new Glossary();
  const reviewer = new UserClass();

  test.beforeAll(async ({ browser }) => {
    // Use createNewPage which works with the storageState
    const { apiContext, afterAction } = await createNewPage(browser);

    await reviewer.create(apiContext);
    await glossaryNoReviewers.create(apiContext);
    await glossaryWithReviewer.create(apiContext);

    // Add reviewer to glossary via patch API
    await glossaryWithReviewer.patch(apiContext, [
      {
        op: 'add',
        path: '/reviewers/0',
        value: {
          id: reviewer.responseData.id,
          type: 'user',
          displayName: reviewer.responseData.displayName,
          fullyQualifiedName: reviewer.responseData.fullyQualifiedName,
          name: reviewer.responseData.name,
        },
      },
    ]);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossaryNoReviewers.delete(apiContext);
    await glossaryWithReviewer.delete(apiContext);
    await reviewer.delete(apiContext);
    await afterAction();
  });

  test('should start term as Approved when glossary has no reviewers', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossaryNoReviewers.data.displayName);

    // Click add term button
    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    // Fill in term details
    const termName = `ApprovedTerm${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Test description for status');

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

    // Check the term shows in the table with Approved status
    const termRow = page.locator(`[data-row-key*="${termName}"]`);

    await expect(termRow).toBeVisible();

    // Look for status badge - should be Approved
    const statusBadge = termRow.locator('.status-badge');

    await expect(statusBadge).toHaveText('Approved');
  });

  test('should start term as Draft when glossary has reviewers', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossaryWithReviewer.data.displayName);

    // Click add term button
    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    // Fill in term details
    const termName = `DraftTerm${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Test description for draft');

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

    // Check the term shows in the table with Draft status
    const termRow = page.locator(`[data-row-key*="${termName}"]`);

    await expect(termRow).toBeVisible();

    // Look for status badge - should be Draft
    const statusBadge = termRow.locator('.status-badge');

    await expect(statusBadge).toHaveText('Draft');
  });

  // T-C18: Create term - inherits glossary reviewers
  test('should inherit reviewers from glossary when term is created', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossaryWithReviewer.data.displayName);

    // Click add term button
    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    // Fill in term details
    const termName = `InheritReviewerTerm${Date.now()}`;
    await page.fill('[data-testid="name"]', termName);
    await page
      .locator(descriptionBox)
      .fill('Test term to verify reviewer inheritance');

    // Submit the term
    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    await createResponse;

    // Wait for modal to close
    await expect(
      page.locator('[role="dialog"].edit-glossary-modal')
    ).not.toBeVisible();

    await page.waitForLoadState('networkidle');

    // Click on the term name to navigate to term details
    await page.click(`[data-testid="${termName}"]`);
    await page.waitForLoadState('networkidle');

    // Verify the reviewer section shows the inherited reviewer
    const reviewerSection = page.getByTestId('glossary-reviewer');

    await expect(reviewerSection).toBeVisible();

    // Check that the reviewer name is displayed (inherited from glossary)
    await expect(
      reviewerSection.getByText(reviewer.getUserDisplayName())
    ).toBeVisible();
  });
});

test.describe('Hierarchy Drag and Drop', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  const glossary = new Glossary();
  let parentTerm: GlossaryTerm;
  let childTerm: GlossaryTerm;
  let targetTerm: GlossaryTerm;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    // Create glossary
    await glossary.create(apiContext);

    // Create parent term at root level
    parentTerm = new GlossaryTerm(glossary, undefined, 'ParentWithChild');
    await parentTerm.create(apiContext);

    // Create child term under parent
    childTerm = new GlossaryTerm(
      glossary,
      parentTerm.responseData.fullyQualifiedName,
      'ChildOfParent'
    );
    await childTerm.create(apiContext);

    // Create target term at root level (where we'll drag parent+child to)
    targetTerm = new GlossaryTerm(glossary, undefined, 'TargetTerm');
    await targetTerm.create(apiContext);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should move term with children (subtree) via drag and drop', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Expand all to see the hierarchy
    await performExpandAll(page);

    // Verify initial hierarchy - child is under parent
    // Use .first() since child row's data-row-key also contains parent name
    const parentRow = page
      .locator(`[data-row-key*="${parentTerm.responseData.name}"]`)
      .first();

    await expect(parentRow).toBeVisible();

    const childRow = page.locator(
      `[data-row-key*="${childTerm.responseData.name}"]`
    );

    await expect(childRow).toBeVisible();

    // Drag parent term (with child) to target term
    await dragAndDropTerm(
      page,
      parentTerm.data.displayName,
      targetTerm.data.displayName
    );

    // Confirm the drag and drop
    await confirmationDragAndDropGlossary(
      page,
      parentTerm.data.name,
      targetTerm.data.name
    );

    // Wait for the table to update after drag-drop
    await page.waitForLoadState('networkidle');

    // After drag-drop, the tree structure changed - need to expand TargetTerm to see its new children
    // First collapse all, then expand all to refresh the tree state
    const expandButton = page.getByTestId('expand-collapse-all-button');
    const buttonText = await expandButton.textContent();

    // If showing "Collapse All", collapse first to reset state
    if (buttonText?.includes('Collapse All')) {
      await expandButton.click();

      await expect(expandButton).toContainText('Expand All', {
        timeout: 10000,
      });

      await page.waitForLoadState('networkidle');
    }

    // Now expand all to see the new hierarchy
    await performExpandAll(page);
    await page.waitForLoadState('networkidle');

    // Verify parent is now visible under target (subtree moved)
    const movedParentRow = page
      .locator(`[data-row-key*="${parentTerm.responseData.name}"]`)
      .first();

    await expect(movedParentRow).toBeVisible();

    // Verify child is still visible (moved with parent as part of subtree)
    const movedChildRow = page.locator(
      `[data-row-key*="${childTerm.responseData.name}"]`
    );

    await expect(movedChildRow).toBeVisible();

    // Verify the hierarchy structure - target term is also visible
    // Use .first() since child FQNs also contain the target term name
    const targetRow = page
      .locator(`[data-row-key*="${targetTerm.responseData.name}"]`)
      .first();

    await expect(targetRow).toBeVisible();
  });
});

test.describe('Reviewer Permissions', () => {
  const glossary = new Glossary();
  const reviewer = new UserClass();
  const nonReviewer = new UserClass();
  const termName = `TermForReview${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser);

    // Create users
    await reviewer.create(apiContext);
    await nonReviewer.create(apiContext);

    // Create glossary via API
    await glossary.create(apiContext);

    // Add reviewer to glossary
    await glossary.patch(apiContext, [
      {
        op: 'add',
        path: '/reviewers/0',
        value: {
          id: reviewer.responseData.id,
          type: 'user',
          displayName: reviewer.responseData.displayName,
          fullyQualifiedName: reviewer.responseData.fullyQualifiedName,
          name: reviewer.responseData.name,
        },
      },
    ]);

    // Create term via UI to trigger approval workflow
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Term for review testing');

    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    await createResponse;

    await expect(
      page.locator('[role="dialog"].edit-glossary-modal')
    ).not.toBeVisible();

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await glossary.delete(apiContext);
    await reviewer.delete(apiContext);
    await nonReviewer.delete(apiContext);
    await afterAction();
  });

  // W-R03: Non-reviewer cannot see approve/reject buttons
  test('non-reviewer should not see approve/reject buttons', async ({
    browser,
  }) => {
    const { page, afterAction } = await performUserLogin(browser, nonReviewer);

    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Wait for terms to load
    await page.waitForLoadState('networkidle');

    // Verify the term is visible
    const termRow = page.locator(`[data-row-key*="${termName}"]`);

    await expect(termRow).toBeVisible();

    // Verify approve/reject buttons are NOT visible for non-reviewer
    const approveBtn = page.getByTestId(`${termName}-approve-btn`);
    const rejectBtn = page.getByTestId(`${termName}-reject-btn`);

    await expect(approveBtn).not.toBeVisible();
    await expect(rejectBtn).not.toBeVisible();

    await afterAction();
  });

  // Note: "Reviewer should see approve/reject buttons" is covered in Glossary.spec.ts
  // Tests: "Glossary & terms creation for reviewer as user/team" and
  // "Approve and reject glossary term from Glossary Listing"
});

// T-D02: Delete parent term (cascade children)
test.describe('Term Deletion Cascade', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

  const glossary = new Glossary();
  let parentTerm: GlossaryTerm;
  let childTerm: GlossaryTerm;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    // Create glossary
    await glossary.create(apiContext);

    // Create parent term
    parentTerm = new GlossaryTerm(glossary, undefined, 'ParentToDelete');
    await parentTerm.create(apiContext);

    // Create child term under parent
    childTerm = new GlossaryTerm(
      glossary,
      parentTerm.responseData.fullyQualifiedName,
      'ChildToDelete'
    );
    await childTerm.create(apiContext);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);
    // Glossary deletion will clean up any remaining terms
    await glossary.delete(apiContext);
    await afterAction();
  });

  test('should delete parent term and cascade delete children', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Expand all to see both terms
    await performExpandAll(page);
    await page.waitForLoadState('networkidle');

    // Verify both parent and child are visible
    const parentRow = page
      .locator(`[data-row-key*="${parentTerm.responseData.name}"]`)
      .first();

    await expect(parentRow).toBeVisible();

    const childRow = page.locator(
      `[data-row-key*="${childTerm.responseData.name}"]`
    );

    await expect(childRow).toBeVisible();

    // Click on parent term to navigate to its details page
    await page.click(`[data-testid="${parentTerm.responseData.name}"]`);
    await page.waitForLoadState('networkidle');

    // Click manage button and delete
    await page.getByTestId('manage-button').click();
    await page.getByTestId('delete-button').click();

    // Wait for delete confirmation modal
    await expect(page.locator('[role="dialog"]')).toBeVisible();

    // Confirm deletion - type DELETE in the confirmation input
    await page.getByTestId('confirmation-text-input').fill('DELETE');

    // Click confirm button
    const deleteRes = page.waitForResponse('/api/v1/glossaryTerms/async/*');
    await page.getByTestId('confirm-button').click();
    await deleteRes;

    // Wait for redirect back to glossary page
    await page.waitForLoadState('networkidle');

    // Navigate back to glossary to verify both terms are deleted
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await page.waitForLoadState('networkidle');

    // Verify parent term is no longer visible
    await expect(
      page.locator(`[data-row-key*="${parentTerm.responseData.name}"]`)
    ).not.toBeVisible();

    // Verify child term is also deleted (cascaded)
    await expect(
      page.locator(`[data-row-key*="${childTerm.responseData.name}"]`)
    ).not.toBeVisible();
  });
});
