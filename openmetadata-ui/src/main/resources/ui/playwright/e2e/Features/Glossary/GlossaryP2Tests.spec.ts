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
import { SidebarItem } from '../../../constant/sidebar';
import { expect, test } from '../../../support/fixtures/base';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { UserClass } from '../../../support/user/UserClass';
import { okJson } from '../../../utils/apiResponse';
import {
  fillDescriptionBox,
  getApiContext,
  redirectToHomePage,
} from '../../../utils/common';
import {
  selectActiveGlossary,
  verifyWorkflowInstanceExists,
} from '../../../utils/glossary';
import { sidebarClick } from '../../../utils/sidebar';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary P2 Tests', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  // G-C10: Create glossary with special characters in name
  test('should create glossary with special characters in name', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const specialName = `Test_Glossary-${Date.now()}`;

    try {
      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);

      await page.click('[data-testid="add-glossary"]');
      await page.getByTestId('form-heading').waitFor();

      // Use name with underscores and hyphens
      await page.fill('[data-testid="name"]', specialName);
      await fillDescriptionBox(page, 'Glossary with special characters');

      const glossaryResponse = page.waitForResponse('/api/v1/glossaries');
      await page.click('[data-testid="save-glossary"]');
      const response = await glossaryResponse;
      glossary.responseData = await response.json();

      // Verify glossary was created
      await expect(page.getByTestId('entity-header-name')).toHaveText(
        specialName
      );
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  for (const view of ['term details', 'status popover'] as const) {
    test(`shows the term workflow stages in ${view}`, async ({ page }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const reviewer = new UserClass();
      const term = new GlossaryTerm(glossary);
      try {
        await reviewer.create(apiContext);
        await glossary.create(apiContext);
        await glossary.patch(apiContext, [
          {
            op: 'add',
            path: '/reviewers',
            value: [{ id: reviewer.responseData.id, type: 'user' }],
          },
        ]);
        await term.create(apiContext);
        await verifyWorkflowInstanceExists(
          page,
          term.responseData.fullyQualifiedName
        );
        const statesResponse = waitForResponseWithStatus(
          page,
          (response) =>
            response.request().method() === 'GET' &&
            new URL(response.url()).pathname.startsWith(
              '/api/v1/governance/workflowInstanceStates/GlossaryTermApprovalWorkflow/'
            ),
          200
        );
        if (view === 'term details') {
          await term.visitEntityPage(page);
        } else {
          await glossary.visitEntityPage(page);
          await page
            .getByTestId(`${term.responseData.fullyQualifiedName}-status`)
            .hover();
        }
        const states = await okJson<{
          data: { stage?: { displayName?: string; name: string } }[];
        }>(await statesResponse, 'Read displayed workflow history');
        const stages = states.data.map((state) => {
          const name = state.stage?.displayName ?? state.stage?.name;
          if (!name)
            throw new Error('Workflow history returned an unnamed stage');
          return name;
        });
        expect(stages.length).toBeGreaterThan(0);
        const widget =
          view === 'term details'
            ? page.getByTestId('workflow-history-widget')
            : page
                .locator('.ant-popover:visible')
                .getByTestId('workflow-history-widget');
        await expect(widget).toBeVisible();
        await expect(widget.locator('.stage-name')).toHaveText(
          stages.reverse()
        );
      } finally {
        await glossary.delete(apiContext);
        await reviewer.delete(apiContext);
        await afterAction();
      }
    });
  }

  test('automatically approves a term created without reviewers', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      // Create a new term
      const addTermButton = page.getByTestId('add-new-tag-button-header');
      await addTermButton.waitFor({ state: 'visible', timeout: 10000 });
      await addTermButton.click();

      // Wait for form dialog
      await page
        .locator('[role="dialog"].edit-glossary-modal')
        .waitFor({ timeout: 10000 });

      const termName = `AutoApprovedTerm_${Date.now()}`;
      await page.fill('[data-testid="name"]', termName);
      await fillDescriptionBox(page, 'Term without reviewers');

      // Set up response listener before clicking save
      const termResponse = waitForResponseWithStatus(
        page,
        (res) =>
          new URL(res.url()).pathname === '/api/v1/glossaryTerms' &&
          res.request().method() === 'POST',
        201
      );

      await page.click('[data-testid="save-glossary-term"]');

      const termData = await (await termResponse).json();
      expect(termData.name).toBe(termName);
      expect(termData.glossary.id).toBe(glossary.responseData.id);
      await expect(
        page.getByTestId(`${termData.fullyQualifiedName}-status`)
      ).toContainText('Approved');
      const persisted = await okJson(
        await apiContext.get(`/api/v1/glossaryTerms/${termData.id}`),
        'Read automatically approved glossary term'
      );
      expect(persisted.entityStatus).toBe('Approved');
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // TBL-C06: Custom property columns visible
  test('persists glossary column visibility and restores the hidden column', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      const table = page.getByTestId('glossary-terms-table');
      const description = table.getByRole('columnheader', {
        name: 'Description',
        exact: true,
      });
      await expect(description).toBeVisible();
      await page.getByTestId('column-dropdown').click();
      const toggle = page
        .getByTestId('column-menu-item-description')
        .getByRole('button');
      await toggle.click();
      await page.keyboard.press('Escape');
      await expect(description).toHaveCount(0);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await expect(
        page.getByTestId(glossaryTerm.data.displayName)
      ).toBeVisible();
      await expect(description).toHaveCount(0);
      await page.getByTestId('column-dropdown').click();
      await toggle.click();
      await page.keyboard.press('Escape');
      await expect(description).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});
