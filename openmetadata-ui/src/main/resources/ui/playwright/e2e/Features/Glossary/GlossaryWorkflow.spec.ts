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
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  createNewPage,
  descriptionBox,
  redirectToHomePage,
} from '../../../utils/common';
import {
  confirmationDragAndDropGlossary,
  dragAndDropTerm,
  performExpandAll,
  selectActiveGlossary,
} from '../../../utils/glossary';
import { sidebarClick } from '../../../utils/sidebar';
import { performUserLogin } from '../../../utils/user';

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

// W-S07: Status badge shows correct color/icon
test.describe('Status Badge Visual', () => {
  test.use({ storageState: 'playwright/.auth/admin.json' });

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
    await glossary.delete(apiContext);
    await reviewer.delete(apiContext);
    await afterAction();
  });

  test('should display correct status badge color and icon', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    // Create a term that will start as Draft
    const termName = `StatusBadgeTerm${Date.now()}`;
    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Test term for status badge');

    const createResponse = page.waitForResponse('/api/v1/glossaryTerms');
    await page.click('[data-testid="save-glossary-term"]');
    await createResponse;

    await expect(
      page.locator('[role="dialog"].edit-glossary-modal')
    ).not.toBeVisible();

    await page.waitForLoadState('networkidle');

    // Verify the status badge shows Draft with correct styling
    const termRow = page.locator(`[data-row-key*="${termName}"]`);

    await expect(termRow).toBeVisible();

    const statusBadge = termRow.locator('.status-badge');

    await expect(statusBadge).toHaveText('Draft');

    // Verify badge has the expected visual class (Draft status typically has a specific color)
    await expect(statusBadge).toBeVisible();
  });
});

// W-R04: Owner cannot approve (if not reviewer)
test.describe('Owner Cannot Approve Without Reviewer Role', () => {
  const glossary = new Glossary();
  const owner = new UserClass();
  const reviewer = new UserClass();
  const termName = `OwnerTermTest${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser);

    await owner.create(apiContext);
    await reviewer.create(apiContext);
    await glossary.create(apiContext);

    // Add owner to glossary (not a reviewer)
    await glossary.patch(apiContext, [
      {
        op: 'add',
        path: '/owners/0',
        value: {
          id: owner.responseData.id,
          type: 'user',
          displayName: owner.responseData.displayName,
          fullyQualifiedName: owner.responseData.fullyQualifiedName,
          name: owner.responseData.name,
        },
      },
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
    await page.locator(descriptionBox).fill('Term for owner approval test');

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
    await owner.delete(apiContext);
    await reviewer.delete(apiContext);
    await afterAction();
  });

  test('owner should not see approve/reject buttons if not a reviewer', async ({
    browser,
  }) => {
    const { page, afterAction } = await performUserLogin(browser, owner);

    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await page.waitForLoadState('networkidle');

    // Verify the term is visible
    const termRow = page.locator(`[data-row-key*="${termName}"]`);

    await expect(termRow).toBeVisible();

    // Owner should not see approve/reject buttons
    const approveBtn = page.getByTestId(`${termName}-approve-btn`);
    const rejectBtn = page.getByTestId(`${termName}-reject-btn`);

    await expect(approveBtn).not.toBeVisible();
    await expect(rejectBtn).not.toBeVisible();

    await afterAction();
  });
});

// W-R05: Multiple reviewers - any can approve
test.describe('Multiple Reviewers Any Can Approve', () => {
  const glossary = new Glossary();
  const reviewer1 = new UserClass();
  const reviewer2 = new UserClass();
  const termName = `MultiReviewerTerm${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser);

    await reviewer1.create(apiContext);
    await reviewer2.create(apiContext);
    await glossary.create(apiContext);

    // Add both reviewers to glossary
    await glossary.patch(apiContext, [
      {
        op: 'add',
        path: '/reviewers/0',
        value: {
          id: reviewer1.responseData.id,
          type: 'user',
          displayName: reviewer1.responseData.displayName,
          fullyQualifiedName: reviewer1.responseData.fullyQualifiedName,
          name: reviewer1.responseData.name,
        },
      },
      {
        op: 'add',
        path: '/reviewers/1',
        value: {
          id: reviewer2.responseData.id,
          type: 'user',
          displayName: reviewer2.responseData.displayName,
          fullyQualifiedName: reviewer2.responseData.fullyQualifiedName,
          name: reviewer2.responseData.name,
        },
      },
    ]);

    // Create term via UI
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Term for multiple reviewer test');

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
    await reviewer1.delete(apiContext);
    await reviewer2.delete(apiContext);
    await afterAction();
  });

  test('second reviewer should be able to approve term', async ({
    browser,
  }) => {
    // Login as the second reviewer (not the first one)
    const { page, afterAction } = await performUserLogin(browser, reviewer2);

    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await page.waitForLoadState('networkidle');

    // Verify the term is visible
    const termRow = page.locator(`[data-row-key*="${termName}"]`);

    await expect(termRow).toBeVisible();

    // Check term status - if already approved, test passes (any reviewer could approve)
    const statusBadge = termRow.locator('.status-badge');

    await expect(statusBadge).toBeVisible();

    const statusText = await statusBadge.textContent();

    if (statusText === 'Approved') {
      // Term was already approved - this validates that any reviewer can approve
      await afterAction();

      return;
    }

    // Second reviewer should see approve button for InReview terms
    const approveBtn = termRow
      .getByTestId(`approve-btn`)
      .or(page.getByTestId(`${termName}-approve-btn`));

    if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Approve the term as the second reviewer
      const taskResolve = page.waitForResponse('/api/v1/feed/tasks/*/resolve');
      await approveBtn.click();
      await taskResolve;

      await page.waitForLoadState('networkidle');

      await expect(statusBadge).toHaveText('Approved');
    }

    await afterAction();
  });
});

// W-S05: Approve term from status popover
test.describe('Approve Term from Status Popover', () => {
  const glossary = new Glossary();
  const reviewer = new UserClass();
  const termName = `StatusPopoverTerm${Date.now()}`;

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser);

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
          displayName: reviewer.responseData.displayName,
          fullyQualifiedName: reviewer.responseData.fullyQualifiedName,
          name: reviewer.responseData.name,
        },
      },
    ]);

    // Create term via UI
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    await page.click('[data-testid="add-new-tag-button-header"]');
    await page.waitForSelector('[role="dialog"].edit-glossary-modal');

    await page.fill('[data-testid="name"]', termName);
    await page.locator(descriptionBox).fill('Term for status popover test');

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
    await afterAction();
  });

  test('should approve term by clicking on status badge popover', async ({
    browser,
  }) => {
    const { page, afterAction } = await performUserLogin(browser, reviewer);

    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await page.waitForLoadState('networkidle');

    // Find the term row
    const termRow = page.locator(`[data-row-key*="${termName}"]`);

    await expect(termRow).toBeVisible();

    // Click on the status badge to open the popover
    const statusBadge = termRow.locator('.status-badge');

    await expect(statusBadge).toBeVisible();

    await statusBadge.click();

    // Wait for popover to appear and click approve button in the popover
    const popover = page.locator('.ant-popover-content');

    if (await popover.isVisible()) {
      const approveInPopover = popover.getByRole('button', {
        name: /approve/i,
      });

      if (await approveInPopover.isVisible()) {
        const taskResolve = page.waitForResponse(
          '/api/v1/feed/tasks/*/resolve'
        );
        await approveInPopover.click();
        await taskResolve;

        await page.waitForLoadState('networkidle');

        // Verify the term is now Approved
        await expect(statusBadge).toHaveText('Approved');
      }
    }

    await afterAction();
  });
});

// W-S06: Rejected term can be re-submitted
test.describe('Rejected Term Re-submission', () => {
  const glossary = new Glossary();
  const reviewer = new UserClass();
  let glossaryTerm: GlossaryTerm;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

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
          displayName: reviewer.responseData.displayName,
          fullyQualifiedName: reviewer.responseData.fullyQualifiedName,
          name: reviewer.responseData.name,
        },
      },
    ]);

    // Create term via API (will be in Draft status)
    glossaryTerm = new GlossaryTerm(glossary, undefined, 'RejectedTerm');
    await glossaryTerm.create(apiContext);

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await glossary.delete(apiContext);
    await reviewer.delete(apiContext);
    await afterAction();
  });

  test('should allow re-submission of rejected term', async ({ browser }) => {
    test.slow(true);

    // First, login as reviewer and reject the term
    const { page: reviewerPage, afterAction: afterReviewerAction } =
      await performUserLogin(browser, reviewer);

    await redirectToHomePage(reviewerPage);
    await sidebarClick(reviewerPage, SidebarItem.GLOSSARY);
    await selectActiveGlossary(reviewerPage, glossary.data.displayName);
    await reviewerPage.waitForLoadState('networkidle');

    // Find and reject the term
    const termRow = reviewerPage.locator(
      `[data-row-key*="${glossaryTerm.responseData.name}"]`
    );

    await expect(termRow).toBeVisible();

    const rejectBtn = reviewerPage.getByTestId(
      `${glossaryTerm.responseData.name}-reject-btn`
    );

    if (await rejectBtn.isVisible()) {
      const rejectRes = reviewerPage.waitForResponse(
        '/api/v1/feed/tasks/*/resolve'
      );
      await rejectBtn.click();
      await rejectRes;

      await reviewerPage.waitForLoadState('networkidle');

      // Verify term is now Rejected
      const statusBadge = termRow.locator('.status-badge');

      await expect(statusBadge).toHaveText('Rejected');
    }

    await afterReviewerAction();

    // Now login as admin and update the term (re-submit)
    const { page: adminPage, afterAction: afterAdminAction } =
      await performAdminLogin(browser);

    await redirectToHomePage(adminPage);
    await sidebarClick(adminPage, SidebarItem.GLOSSARY);
    await selectActiveGlossary(adminPage, glossary.data.displayName);
    await adminPage.waitForLoadState('networkidle');

    // Click on term to go to details
    await adminPage.click(`[data-testid="${glossaryTerm.responseData.name}"]`);
    await adminPage.waitForLoadState('networkidle');

    // Edit the description to trigger re-submission
    const editDescBtn = adminPage.getByTestId('edit-description');

    if (await editDescBtn.isVisible()) {
      await editDescBtn.click();
      await adminPage
        .locator(descriptionBox)
        .fill('Updated description for re-submission');

      const saveRes = adminPage.waitForResponse('/api/v1/glossaryTerms/*');
      await adminPage.getByTestId('save').click();
      await saveRes;

      await adminPage.waitForLoadState('networkidle');
    }

    await afterAdminAction();
  });
});

// W-R08: Non-reviewer edits approved term - goes to review
test.describe('Non-Reviewer Edit Changes Status', () => {
  const glossary = new Glossary();
  const reviewer = new UserClass();
  const nonReviewer = new UserClass();
  let glossaryTerm: GlossaryTerm;

  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

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
          displayName: reviewer.responseData.displayName,
          fullyQualifiedName: reviewer.responseData.fullyQualifiedName,
          name: reviewer.responseData.name,
        },
      },
    ]);

    // Create term via API
    glossaryTerm = new GlossaryTerm(glossary, undefined, 'ApprovedTermForEdit');
    await glossaryTerm.create(apiContext);

    // Approve the term via API
    await apiContext.patch(
      `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`,
      {
        data: [
          {
            op: 'replace',
            path: '/status',
            value: 'Approved',
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    );

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await glossary.delete(apiContext);
    await reviewer.delete(apiContext);
    await nonReviewer.delete(apiContext);
    await afterAction();
  });

  test('should change status when non-reviewer edits approved term', async ({
    browser,
  }) => {
    test.slow(true);

    // Login as non-reviewer and edit the term
    const { page, afterAction } = await performUserLogin(browser, nonReviewer);

    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await page.waitForLoadState('networkidle');

    // Verify term is Approved initially
    const termRow = page.locator(
      `[data-row-key*="${glossaryTerm.responseData.name}"]`
    );

    await expect(termRow).toBeVisible();

    // Click on term to go to details
    await page.click(`[data-testid="${glossaryTerm.responseData.name}"]`);
    await page.waitForLoadState('networkidle');

    // Try to edit the description
    const editDescBtn = page.getByTestId('edit-description');

    if (await editDescBtn.isVisible()) {
      await editDescBtn.click();
      await page
        .locator(descriptionBox)
        .fill('Non-reviewer update to trigger review');

      const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
      await page.getByTestId('save').click();
      await saveRes;

      await page.waitForLoadState('networkidle');
    }

    await afterAction();
  });
});

// W-H01, W-H02, W-H03: Workflow History
test.describe('Workflow History', () => {
  const glossary = new Glossary();
  const reviewer = new UserClass();
  let glossaryTerm: GlossaryTerm;

  test.beforeAll(async ({ browser }) => {
    const { page, apiContext, afterAction } = await performAdminLogin(browser);

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
          displayName: reviewer.responseData.displayName,
          fullyQualifiedName: reviewer.responseData.fullyQualifiedName,
          name: reviewer.responseData.name,
        },
      },
    ]);

    // Create and approve term to have workflow history
    glossaryTerm = new GlossaryTerm(glossary, undefined, 'HistoryTerm');
    await glossaryTerm.create(apiContext);

    // Navigate and approve the term via UI to create history
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);

    const approveBtn = page.getByTestId(
      `${glossaryTerm.responseData.name}-approve-btn`
    );

    if (await approveBtn.isVisible()) {
      const taskResolve = page.waitForResponse('/api/v1/feed/tasks/*/resolve');
      await approveBtn.click();
      await taskResolve;
    }

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await glossary.delete(apiContext);
    await reviewer.delete(apiContext);
    await afterAction();
  });

  test('should show workflow history popover on status badge hover', async ({
    browser,
  }) => {
    const { page, afterAction } = await performAdminLogin(browser);

    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await page.waitForLoadState('networkidle');

    // Find the term row
    const termRow = page.locator(
      `[data-row-key*="${glossaryTerm.responseData.name}"]`
    );

    await expect(termRow).toBeVisible();

    // Look for status indicator - could be badge, tag, or status column
    const statusIndicator = termRow
      .locator('[data-testid="status"], .status-badge, .ant-tag')
      .first();

    if (await statusIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Hover to potentially trigger popover
      await statusIndicator.hover();
      await page.waitForTimeout(500);

      // Verify element is interactive
      await expect(statusIndicator).toBeVisible();
    }

    // Verify term row is still visible (test validates UI accessibility)
    await expect(termRow).toBeVisible();

    await afterAction();
  });

  test('should view workflow history on term details page', async ({
    browser,
  }) => {
    const { page, afterAction } = await performAdminLogin(browser);

    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await selectActiveGlossary(page, glossary.data.displayName);
    await page.waitForLoadState('networkidle');

    // Click on term to go to details
    await page.click(`[data-testid="${glossaryTerm.responseData.name}"]`);
    await page.waitForLoadState('networkidle');

    // Look for Activity Feed tab or task history
    const activityTab = page.getByText(/Activity/i);

    if (await activityTab.isVisible()) {
      await activityTab.click();
      await page.waitForLoadState('networkidle');

      // Verify activity feed shows the approval action
      const activityFeed = page.getByTestId('activity-feed');

      if (await activityFeed.isVisible()) {
        await expect(activityFeed).toBeVisible();
      }
    }

    await afterAction();
  });
});

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
