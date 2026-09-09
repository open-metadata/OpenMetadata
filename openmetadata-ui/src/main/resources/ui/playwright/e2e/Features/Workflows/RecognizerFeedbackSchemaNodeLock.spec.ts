/*
 *  Copyright 2026 Collate.
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

import { type Locator, type Page } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { expect, test as base } from '../../../support/fixtures/base';
import { performAdminLogin } from '../../../utils/admin';
import { clickOutside, redirectToHomePage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { clickAndWaitFor } from '../../../utils/waitHelpers';

/**
 * End-to-end reachability for the Workflow Builder "schema-based node name/
 * description locked" defect on the seeded non-NoOp governance workflow
 * `RecognizerFeedbackReviewWorkflow` (trigger.type = eventBasedEntity). All
 * three task nodes are schema-based subtypes that fall through the
 * `TaskNodeFormRenderer` default branch to `SchemaBasedNodeForm`; in Edit mode
 * `isFormDisabled === false`, so the fix (`lockFields`) is what must keep the
 * name/description inputs disabled here.
 */
const SEEDED_WORKFLOW_NAME = 'RecognizerFeedbackReviewWorkflow';

const WORKFLOW_LIST_API = /\/api\/v1\/governance\/workflowDefinitions/;

const SCHEMA_BASED_NODE_DISPLAY_NAMES = [
  'Review Recognizer Feedback',
  'Apply Feedback (Approved)',
  'Reject Feedback',
];

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const { page, afterAction } = await performAdminLogin(browser, {
      navigate: true,
    });
    await use(page);
    await afterAction();
  },
});

async function navigateToWorkflowsListPage(page: Page) {
  await page.hover('[data-testid="left-sidebar"]');
  await page.click(`[data-testid="${SidebarItem.GOVERNANCE}"]`);

  const listResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/governance/workflowDefinitions') &&
      response.request().method() === 'GET'
  );

  await page.click('[data-testid="app-bar-item-workflows"]');
  await listResponse;
  await waitForAllLoadersToDisappear(page);
}

async function navigateToSeededWorkflowDetailPage(page: Page) {
  await navigateToWorkflowsListPage(page);
  await clickOutside(page);

  const workflowCard = page.getByTestId(SEEDED_WORKFLOW_NAME);
  const nextButton = page.getByTestId('next');

  // The seeded workflow can land on a later page of the paginated list. Walk
  // the pages until its card is on the current page or pagination runs out.
  while (
    !(await workflowCard.isVisible()) &&
    !(await nextButton.isDisabled())
  ) {
    await clickAndWaitFor(page, nextButton, WORKFLOW_LIST_API);
    await waitForAllLoadersToDisappear(page);
  }

  await expect(workflowCard).toBeVisible();

  const detailResponse = page.waitForResponse(
    '/api/v1/governance/workflowDefinitions/name/*'
  );

  await workflowCard.click();
  await detailResponse;
  await waitForAllLoadersToDisappear(page);
}

async function enterEditMode(page: Page) {
  await expect(page.getByTestId('edit-workflow-button')).toBeVisible();
  await page.getByTestId('edit-workflow-button').click();
  await waitForAllLoadersToDisappear(page);
}

async function openSchemaBasedNodeSidebar(
  page: Page,
  displayName: string
): Promise<Locator> {
  const fitViewButton = page.getByTestId('fit-view-button');

  await expect(fitViewButton).toBeVisible();
  await fitViewButton.click();

  const node = page
    .locator('.react-flow__node')
    .filter({ hasText: displayName });

  await expect(node).toBeVisible();
  await node.click();

  const sidebar = page.getByTestId('node-config-sidebar');

  await expect(sidebar).toBeVisible();
  await waitForAllLoadersToDisappear(page);

  return sidebar;
}

test.describe('Seeded RecognizerFeedbackReviewWorkflow — schema-based node lock', () => {
  test('edit-workflow-button is visible (seeding surfaces a non-NoOp flow with no seeded/API filter)', async ({
    page,
  }) => {
    await redirectToHomePage(page);
    await navigateToSeededWorkflowDetailPage(page);

    await expect(page.getByTestId('edit-workflow-button')).toBeVisible();
  });

  for (const displayName of SCHEMA_BASED_NODE_DISPLAY_NAMES) {
    test(`Edit mode: ${displayName} node name and description inputs are disabled with no Save button`, async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await navigateToSeededWorkflowDetailPage(page);
      await enterEditMode(page);

      const sidebar = await openSchemaBasedNodeSidebar(page, displayName);

      await expect(sidebar.getByTestId('metadata-form-section')).toBeVisible();
      // G1 — the fix: both inputs disabled in Edit mode (isFormDisabled=false).
      await expect(
        sidebar.getByTestId('workflow-name-input').locator('input')
      ).toBeDisabled();
      await expect(
        sidebar.getByTestId('workflow-description-input').locator('textarea')
      ).toBeDisabled();
      // G5 — no Save on this display-only form, only Close.
      await expect(
        sidebar.getByTestId('save-node-configuration-button')
      ).not.toBeVisible();
      await expect(sidebar.getByTestId('delete-node-button')).not.toBeVisible();
    });

    test(`View mode: ${displayName} node name and description inputs are disabled`, async ({
      page,
    }) => {
      await redirectToHomePage(page);
      await navigateToSeededWorkflowDetailPage(page);

      const sidebar = await openSchemaBasedNodeSidebar(page, displayName);

      await expect(sidebar.getByTestId('metadata-form-section')).toBeVisible();
      // G2 — both inputs disabled in View mode too.
      await expect(
        sidebar.getByTestId('workflow-name-input').locator('input')
      ).toBeDisabled();
      await expect(
        sidebar.getByTestId('workflow-description-input').locator('textarea')
      ).toBeDisabled();
      await expect(
        sidebar.getByTestId('save-node-configuration-button')
      ).not.toBeVisible();
    });
  }
});
