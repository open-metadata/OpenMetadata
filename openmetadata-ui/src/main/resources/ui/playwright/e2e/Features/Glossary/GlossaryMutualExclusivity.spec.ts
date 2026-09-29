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
import { Page } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { TableClass } from '../../../support/entity/TableClass';
import { expect, test } from '../../../support/fixtures/base';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import {
  closeColumnDetailPanel,
  waitForAllLoadersToDisappear,
} from '../../../utils/entity';
import {
  applyGlossaryPicker,
  openGlossaryPicker,
  searchGlossaryPicker,
  toggleGlossaryTermInPicker,
} from '../../../utils/glossaryPicker';
import { sidebarClick } from '../../../utils/sidebar';

test.use({ storageState: 'playwright/.auth/admin.json' });

const POPOVER = 'glossary-term-picker-popover';

// getByTestId + .or() so FQNs with quotes and percent signs stay escaped.
const selectionControl = (page: Page, fqn: string) => {
  const popover = page.getByTestId(POPOVER);

  return popover
    .getByTestId(`checkbox-${fqn}`)
    .or(popover.getByTestId(`radio-${fqn}`));
};

const treeNode = (page: Page, fqn: string) =>
  page.getByTestId(POPOVER).getByTestId(`tree-node-${fqn}`);

const openAndSearch = async (page: Page, glossaryName: string) => {
  await openGlossaryPicker(
    page,
    page.getByTestId('KnowledgePanel.GlossaryTerms').getByTestId('add-tag')
  );
  await searchGlossaryPicker(page, glossaryName);
};

test.describe('Glossary Mutual Exclusivity Feature', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });
  test.describe('Suite 1: Radio/Checkbox Rendering', () => {
    test('ME-R01: Children of ME parent should render checkboxes', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        // Create children under ME parent
        const child1 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MEChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MEChild2'
        );
        const child3 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MEChild3'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);
        await child3.create(apiContext);

        // Create a table to test tagging
        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await openAndSearch(page, glossary.responseData.name);

        // Verify children have selection controls (checkboxes for ME children)
        await expect(
          selectionControl(page, child1.responseData.fullyQualifiedName)
        ).toBeVisible();
        await expect(
          selectionControl(page, child2.responseData.fullyQualifiedName)
        ).toBeVisible();
        await expect(
          selectionControl(page, child3.responseData.fullyQualifiedName)
        ).toBeVisible();

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });
  });

  test.describe('Suite 2: Selection Behavior', () => {
    test('ME-S01: Selecting ME child should auto-deselect siblings', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child1 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'SelectChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'SelectChild2'
        );
        const child3 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'SelectChild3'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);
        await child3.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await openAndSearch(page, glossary.responseData.name);

        const c1 = selectionControl(
          page,
          child1.responseData.fullyQualifiedName
        );
        const c2 = selectionControl(
          page,
          child2.responseData.fullyQualifiedName
        );
        const c3 = selectionControl(
          page,
          child3.responseData.fullyQualifiedName
        );

        // Select first child
        await treeNode(page, child1.responseData.fullyQualifiedName).click();
        await expect(c1).toHaveAttribute('data-selected', 'true');

        // Select second child — first should auto-deselect (ME)
        await treeNode(page, child2.responseData.fullyQualifiedName).click();
        await expect(c2).toHaveAttribute('data-selected', 'true');
        await expect(c1).toHaveAttribute('data-selected', 'false');

        // Select third child — only third remains selected
        await treeNode(page, child3.responseData.fullyQualifiedName).click();
        await expect(c3).toHaveAttribute('data-selected', 'true');
        await expect(c2).toHaveAttribute('data-selected', 'false');
        await expect(c1).toHaveAttribute('data-selected', 'false');

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-S02: Can select multiple children under non-ME parent', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = false;

      try {
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child1 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MultiChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MultiChild2'
        );
        const child3 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MultiChild3'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);
        await child3.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await openAndSearch(page, glossary.responseData.name);

        const c1 = selectionControl(
          page,
          child1.responseData.fullyQualifiedName
        );
        const c2 = selectionControl(
          page,
          child2.responseData.fullyQualifiedName
        );
        const c3 = selectionControl(
          page,
          child3.responseData.fullyQualifiedName
        );

        await treeNode(page, child1.responseData.fullyQualifiedName).click();
        await expect(c1).toHaveAttribute('data-selected', 'true');

        await treeNode(page, child2.responseData.fullyQualifiedName).click();
        await expect(c2).toHaveAttribute('data-selected', 'true');

        await treeNode(page, child3.responseData.fullyQualifiedName).click();
        await expect(c3).toHaveAttribute('data-selected', 'true');

        // All three should still be selected (non-ME parent allows multi-select)
        await expect(c1).toHaveAttribute('data-selected', 'true');
        await expect(c2).toHaveAttribute('data-selected', 'true');
        await expect(c3).toHaveAttribute('data-selected', 'true');

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-S03: Can deselect currently selected ME term', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child1 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'DeselectChild'
        );
        await child1.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await openAndSearch(page, glossary.responseData.name);

        const c1 = selectionControl(
          page,
          child1.responseData.fullyQualifiedName
        );
        const node = treeNode(page, child1.responseData.fullyQualifiedName);

        // Select child
        await node.click();
        await expect(c1).toHaveAttribute('data-selected', 'true');

        // Click again to deselect
        await node.click();
        await expect(c1).toHaveAttribute('data-selected', 'false');

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-S05: Mixed selection - ME siblings deselect, non-ME remain', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();

      // ME parent
      const meParent = new GlossaryTerm(glossary);
      meParent.data.name = 'MixedMEParent';
      meParent.data.displayName = 'MixedMEParent';
      meParent.data.mutuallyExclusive = true;

      // Non-ME parent
      const nonMeParent = new GlossaryTerm(glossary);
      nonMeParent.data.name = 'MixedNonMEParent';
      nonMeParent.data.displayName = 'MixedNonMEParent';
      nonMeParent.data.mutuallyExclusive = false;

      try {
        await glossary.create(apiContext);
        await meParent.create(apiContext);
        await nonMeParent.create(apiContext);

        const meChild1 = new GlossaryTerm(
          glossary,
          meParent.responseData.fullyQualifiedName,
          'MixedMEChild1'
        );
        const meChild2 = new GlossaryTerm(
          glossary,
          meParent.responseData.fullyQualifiedName,
          'MixedMEChild2'
        );
        const nonMeChild1 = new GlossaryTerm(
          glossary,
          nonMeParent.responseData.fullyQualifiedName,
          'MixedNonMEChild1'
        );
        const nonMeChild2 = new GlossaryTerm(
          glossary,
          nonMeParent.responseData.fullyQualifiedName,
          'MixedNonMEChild2'
        );
        await meChild1.create(apiContext);
        await meChild2.create(apiContext);
        await nonMeChild1.create(apiContext);
        await nonMeChild2.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await openAndSearch(page, glossary.responseData.name);

        const nmc1 = selectionControl(
          page,
          nonMeChild1.responseData.fullyQualifiedName
        );
        const nmc2 = selectionControl(
          page,
          nonMeChild2.responseData.fullyQualifiedName
        );
        const mc1 = selectionControl(
          page,
          meChild1.responseData.fullyQualifiedName
        );
        const mc2 = selectionControl(
          page,
          meChild2.responseData.fullyQualifiedName
        );

        // Select non-ME children first
        await treeNode(
          page,
          nonMeChild1.responseData.fullyQualifiedName
        ).click();
        await expect(nmc1).toHaveAttribute('data-selected', 'true');

        await treeNode(
          page,
          nonMeChild2.responseData.fullyQualifiedName
        ).click();
        await expect(nmc2).toHaveAttribute('data-selected', 'true');

        // Select ME child
        await treeNode(page, meChild1.responseData.fullyQualifiedName).click();
        await expect(mc1).toHaveAttribute('data-selected', 'true');

        // Non-ME children should still be selected
        await expect(nmc1).toHaveAttribute('data-selected', 'true');
        await expect(nmc2).toHaveAttribute('data-selected', 'true');

        // Select another ME child — first ME child should auto-deselect
        await treeNode(page, meChild2.responseData.fullyQualifiedName).click();
        await expect(mc2).toHaveAttribute('data-selected', 'true');
        await expect(mc1).toHaveAttribute('data-selected', 'false');

        // Non-ME children should still be selected
        await expect(nmc1).toHaveAttribute('data-selected', 'true');
        await expect(nmc2).toHaveAttribute('data-selected', 'true');

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });
  });

  test.describe('Suite 3: Tag Application to Entities', () => {
    test('ME-T01: Apply single ME glossary term to table', async ({ page }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'ApplyTermChild'
        );
        await child.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await openAndSearch(page, glossary.responseData.name);

        await treeNode(page, child.responseData.fullyQualifiedName).click();

        await applyGlossaryPicker(
          page,
          (response) =>
            response.url().includes('/api/v1/tables/') &&
            response.request().method() === 'PATCH'
        );

        // Verify tag appears
        await expect(
          page
            .getByTestId('glossary-container')
            .getByTestId(`tag-${child.responseData.fullyQualifiedName}`)
        ).toBeVisible();

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-T02: Apply ME term to table column via detail panel', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'ColumnTermChild'
        );
        await child.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        // Open column detail panel by clicking on the first column name
        const firstColumnName = table.columnsName[0];
        const columnRow = page.locator(`[data-row-key$="${firstColumnName}"]`);
        await columnRow.waitFor({ state: 'visible' });
        const columnNameCell = columnRow.getByTestId('column-name-cell');
        await columnNameCell.waitFor({ state: 'visible' });
        await columnNameCell.click();
        const panelContainer = page.locator('.column-detail-panel');
        await expect(panelContainer).toBeVisible();
        await expect(panelContainer.getByTestId('entity-link')).toBeVisible();

        await openGlossaryPicker(
          page,
          panelContainer.getByTestId('edit-glossary-terms')
        );

        await toggleGlossaryTermInPicker(page, {
          name: child.responseData.name,
          displayName: child.responseData.displayName,
          fullyQualifiedName: child.responseData.fullyQualifiedName,
        });

        await applyGlossaryPicker(page, (response) =>
          Boolean(
            response.url().includes('/api/v1/columns/name/') ||
              response.url().includes('/api/v1/tables/')
          )
        );

        await waitForAllLoadersToDisappear(page);

        // Verify glossary term appears in the column detail panel
        await expect(
          panelContainer.getByTestId(
            `tag-${child.responseData.fullyQualifiedName}`
          )
        ).toBeVisible();

        await closeColumnDetailPanel(page);
        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });
  });

  test.describe('Suite 4: Hierarchy & Edge Cases', () => {
    test('ME-H04: Toggle ME flag via edit after children exist', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = false; // Start as non-ME

      try {
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child1 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'ToggleChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'ToggleChild2'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);

        // Navigate to glossary page
        await redirectToHomePage(page);
        await sidebarClick(page, SidebarItem.GLOSSARY);

        // Select the glossary
        const glossaryResponse = page.waitForResponse('/api/v1/glossaryTerms*');
        await page
          .getByTestId('glossary-left-panel')
          .getByRole('link', { name: glossary.data.displayName })
          .click();
        await glossaryResponse;

        // Expand all terms
        const expandResponse = page.waitForResponse('/api/v1/glossaryTerms*');
        await page.click('[data-testid="expand-collapse-all-button"]');
        await expandResponse;

        // Edit the parent term
        const escapedFqn = parentTerm.responseData.fullyQualifiedName
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"');
        const termRow = page.locator(`[data-row-key="${escapedFqn}"]`);
        await termRow.getByTestId('edit-button').click();

        await page.waitForSelector('[role="dialog"].edit-glossary-modal');

        // Toggle ME to true
        await page.click('[data-testid="mutually-exclusive-button"]');
        await expect(
          page.locator('[data-testid="form-item-alert"]')
        ).toBeVisible();

        // Save
        const updateResponse = page.waitForResponse('/api/v1/glossaryTerms/*');
        await page.click('[data-testid="save-glossary-term"]');
        await updateResponse;

        // Now test in entity tagging
        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await openAndSearch(page, glossary.responseData.name);

        // Children should now have selection controls (ME was toggled on)
        await expect(
          selectionControl(page, child1.responseData.fullyQualifiedName)
        ).toBeVisible();

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-H05: ME glossary (top level) children render checkboxes with ME behavior', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);

      // Create glossary with ME flag at glossary level
      const glossary = new Glossary();
      glossary.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);

        // Create terms directly under ME glossary
        const term1 = new GlossaryTerm(glossary);
        term1.data.name = 'MEGlossaryChild1';
        term1.data.displayName = 'MEGlossaryChild1';
        const term2 = new GlossaryTerm(glossary);
        term2.data.name = 'MEGlossaryChild2';
        term2.data.displayName = 'MEGlossaryChild2';
        await term1.create(apiContext);
        await term2.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await openAndSearch(page, glossary.responseData.name);

        const t1 = selectionControl(
          page,
          term1.responseData.fullyQualifiedName
        );
        const t2 = selectionControl(
          page,
          term2.responseData.fullyQualifiedName
        );

        // Terms directly under ME glossary should have selection controls
        await expect(t1).toBeVisible();
        await expect(t2).toBeVisible();

        // Verify mutual exclusivity works (selecting one deselects the other)
        await treeNode(page, term1.responseData.fullyQualifiedName).click();
        await expect(t1).toHaveAttribute('data-selected', 'true');

        await treeNode(page, term2.responseData.fullyQualifiedName).click();
        await expect(t2).toHaveAttribute('data-selected', 'true');
        await expect(t1).toHaveAttribute('data-selected', 'false');

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-H06: Deep nesting - non-ME parent under ME grandparent allows multi-select', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const glossary = new Glossary();

      // ME grandparent
      const meGrandparent = new GlossaryTerm(glossary);
      meGrandparent.data.name = 'DeepMEGrandparent';
      meGrandparent.data.displayName = 'DeepMEGrandparent';
      meGrandparent.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);
        await meGrandparent.create(apiContext);

        // Non-ME parent under ME grandparent
        const nonMeParent = new GlossaryTerm(
          glossary,
          meGrandparent.responseData.fullyQualifiedName,
          'DeepNonMEParent'
        );
        nonMeParent.data.mutuallyExclusive = false;
        await nonMeParent.create(apiContext);

        // Children under non-ME parent (should allow multi-select)
        const child1 = new GlossaryTerm(
          glossary,
          nonMeParent.responseData.fullyQualifiedName,
          'DeepChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          nonMeParent.responseData.fullyQualifiedName,
          'DeepChild2'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);

        // ME sibling parent under same ME grandparent
        const meSibling = new GlossaryTerm(
          glossary,
          meGrandparent.responseData.fullyQualifiedName,
          'DeepMESibling'
        );
        meSibling.data.mutuallyExclusive = true;
        await meSibling.create(apiContext);

        const sibChild1 = new GlossaryTerm(
          glossary,
          meSibling.responseData.fullyQualifiedName,
          'DeepMESibChild1'
        );
        const sibChild2 = new GlossaryTerm(
          glossary,
          meSibling.responseData.fullyQualifiedName,
          'DeepMESibChild2'
        );
        await sibChild1.create(apiContext);
        await sibChild2.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await openAndSearch(page, glossary.responseData.name);

        const c1 = selectionControl(
          page,
          child1.responseData.fullyQualifiedName
        );
        const c2 = selectionControl(
          page,
          child2.responseData.fullyQualifiedName
        );
        const sc1 = selectionControl(
          page,
          sibChild1.responseData.fullyQualifiedName
        );
        const sc2 = selectionControl(
          page,
          sibChild2.responseData.fullyQualifiedName
        );

        // Non-ME parent children allow multi-select
        await treeNode(page, child1.responseData.fullyQualifiedName).click();
        await expect(c1).toHaveAttribute('data-selected', 'true');

        await treeNode(page, child2.responseData.fullyQualifiedName).click();
        await expect(c2).toHaveAttribute('data-selected', 'true');
        await expect(c1).toHaveAttribute('data-selected', 'true');

        // ME sibling children enforce mutual exclusivity
        await treeNode(page, sibChild1.responseData.fullyQualifiedName).click();
        await expect(sc1).toHaveAttribute('data-selected', 'true');

        await treeNode(page, sibChild2.responseData.fullyQualifiedName).click();
        await expect(sc2).toHaveAttribute('data-selected', 'true');
        await expect(sc1).toHaveAttribute('data-selected', 'false');

        // Non-ME children should still be selected (cross-parent independence)
        await expect(c1).toHaveAttribute('data-selected', 'true');
        await expect(c2).toHaveAttribute('data-selected', 'true');

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-H07: Non-ME parent under ME glossary allows multi-select for its children', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);

      // ME glossary
      const glossary = new Glossary();
      glossary.data.mutuallyExclusive = true;

      try {
        await glossary.create(apiContext);

        // Non-ME parent term under ME glossary
        const nonMeParent = new GlossaryTerm(glossary);
        nonMeParent.data.name = 'NonMEUnderMEGlossary';
        nonMeParent.data.displayName = 'NonMEUnderMEGlossary';
        nonMeParent.data.mutuallyExclusive = false;
        await nonMeParent.create(apiContext);

        const child1 = new GlossaryTerm(
          glossary,
          nonMeParent.responseData.fullyQualifiedName,
          'NonMEChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          nonMeParent.responseData.fullyQualifiedName,
          'NonMEChild2'
        );
        const child3 = new GlossaryTerm(
          glossary,
          nonMeParent.responseData.fullyQualifiedName,
          'NonMEChild3'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);
        await child3.create(apiContext);

        const table = new TableClass();
        await table.create(apiContext);

        await redirectToHomePage(page);
        await table.visitEntityPage(page);

        await openAndSearch(page, glossary.responseData.name);

        const c1 = selectionControl(
          page,
          child1.responseData.fullyQualifiedName
        );
        const c2 = selectionControl(
          page,
          child2.responseData.fullyQualifiedName
        );
        const c3 = selectionControl(
          page,
          child3.responseData.fullyQualifiedName
        );

        await treeNode(page, child1.responseData.fullyQualifiedName).click();
        await treeNode(page, child2.responseData.fullyQualifiedName).click();
        await treeNode(page, child3.responseData.fullyQualifiedName).click();

        // All three should be selected despite glossary being ME
        // because the immediate parent is non-ME
        await expect(c1).toHaveAttribute('data-selected', 'true');
        await expect(c2).toHaveAttribute('data-selected', 'true');
        await expect(c3).toHaveAttribute('data-selected', 'true');

        await table.delete(apiContext);
      } finally {
        await glossary.delete(apiContext);
        await afterAction();
      }
    });
  });
});
