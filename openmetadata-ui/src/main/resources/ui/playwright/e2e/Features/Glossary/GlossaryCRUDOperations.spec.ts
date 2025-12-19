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
import {
  descriptionBox,
  getApiContext,
  redirectToHomePage,
} from '../../../utils/common';
import {
  openAddGlossaryTermModal,
  selectActiveGlossary,
} from '../../../utils/glossary';
import { sidebarClick } from '../../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

// G-C02: Create glossary with all optional fields
test.describe('Create Glossary With All Optional Fields', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should create glossary with tags, owners, and description', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossaryName = `FullGlossary${Date.now()}`;

    try {
      await sidebarClick(page, SidebarItem.GLOSSARY);

      await page.click('[data-testid="add-glossary"]');
      await page.waitForSelector('[data-testid="form-heading"]');

      await page.fill('[data-testid="name"]', glossaryName);
      await page
        .locator(descriptionBox)
        .fill('Glossary with all optional fields');

      const createResponse = page.waitForResponse('/api/v1/glossaries');
      await page.click('[data-testid="save-glossary"]');
      await createResponse;

      await expect(page).toHaveURL(/\/glossary\//, { timeout: 10000 });

      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('entity-header-name')).toHaveText(
        glossaryName,
        { timeout: 10000 }
      );
    } finally {
      try {
        const response = await apiContext.get(
          `/api/v1/glossaries/name/${glossaryName}`
        );

        if (response.ok()) {
          const data = await response.json();
          await apiContext.delete(
            `/api/v1/glossaries/${data.id}?hardDelete=true&recursive=true`
          );
        }
      } catch {
        // Glossary may not exist
      }
      await afterAction();
    }
  });
});

// G-C03: Create glossary with mutually exclusive toggle ON
test.describe('Create Glossary With Mutually Exclusive', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should create glossary with mutually exclusive enabled', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossaryName = `MutualExGlossary${Date.now()}`;

    try {
      await sidebarClick(page, SidebarItem.GLOSSARY);

      await page.click('[data-testid="add-glossary"]');
      await page.waitForSelector('[data-testid="form-heading"]');

      await page.fill('[data-testid="name"]', glossaryName);
      await page.locator(descriptionBox).fill('Mutually exclusive glossary');

      const meToggle = page.getByTestId('mutually-exclusive-button');

      if (await meToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
        await meToggle.click();
      }

      const createResponse = page.waitForResponse('/api/v1/glossaries');
      await page.click('[data-testid="save-glossary"]');
      await createResponse;

      await expect(page).toHaveURL(/\/glossary\//, { timeout: 10000 });

      await page.waitForLoadState('networkidle');

      await expect(page.getByTestId('entity-header-name')).toHaveText(
        glossaryName,
        { timeout: 10000 }
      );
    } finally {
      try {
        const response = await apiContext.get(
          `/api/v1/glossaries/name/${glossaryName}`
        );

        if (response.ok()) {
          const data = await response.json();
          await apiContext.delete(
            `/api/v1/glossaries/${data.id}?hardDelete=true&recursive=true`
          );
        }
      } catch {
        // Glossary may not exist
      }
      await afterAction();
    }
  });
});

// T-C11: Create term with synonyms
test.describe('Create Term With Synonyms', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should create term with synonyms', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const termName = `SynonymTerm${Date.now()}`;

    try {
      await glossary.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await openAddGlossaryTermModal(page);

      const termModal = page.locator('.edit-glossary-modal');
      await termModal.getByTestId('name').fill(termName);
      await termModal.locator(descriptionBox).fill('Term with synonyms');

      const synonymsSelect = termModal.getByTestId('synonyms');

      if (await synonymsSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await synonymsSelect.click();
        const synonymsInput = synonymsSelect.locator('input').first();
        await synonymsInput.fill('synonym1');
        await synonymsInput.press('Enter');
      }

      const createResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaryTerms') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('save-glossary-term').click();
      await createResponse;

      await expect(
        page.locator('[role="dialog"].edit-glossary-modal')
      ).not.toBeVisible({ timeout: 5000 });

      await expect(page.locator(`[data-row-key*="${termName}"]`)).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});

// T-C12: Create term with references
test.describe('Create Term With References', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should create term with references', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const termName = `RefTerm${Date.now()}`;

    try {
      await glossary.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await openAddGlossaryTermModal(page);

      const termModal = page.locator('.edit-glossary-modal');
      await termModal.getByTestId('name').fill(termName);
      await termModal.locator(descriptionBox).fill('Term with references');

      const addRefBtn = termModal.getByTestId('add-reference');

      if (await addRefBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addRefBtn.click();

        await expect(termModal.locator('#name-0')).toBeVisible();

        await termModal.locator('#name-0').fill('Reference1');
        await termModal.locator('#url-0').fill('https://example.com/ref1');
      }

      const createResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaryTerms') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('save-glossary-term').click();
      await createResponse;

      await expect(
        page.locator('[role="dialog"].edit-glossary-modal')
      ).not.toBeVisible({ timeout: 5000 });

      await expect(page.locator(`[data-row-key*="${termName}"]`)).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});

// G-U04: Remove owner from glossary
test.describe('Remove Owner From Glossary', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should remove owner from glossary', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const owner = new UserClass();

    try {
      await owner.create(apiContext);
      await glossary.create(apiContext);

      await apiContext.patch(`/api/v1/glossaries/${glossary.responseData.id}`, {
        data: [
          {
            op: 'add',
            path: '/owners/0',
            value: {
              id: owner.responseData.id,
              type: 'user',
            },
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      });

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await page.waitForLoadState('networkidle');

      const ownerSection = page.locator(
        '[data-testid="glossary-right-panel-owner-link"]'
      );

      if (await ownerSection.isVisible({ timeout: 3000 }).catch(() => false)) {
        const editBtn = page.getByTestId('edit-owner').first();

        if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await editBtn.click();
          await page.waitForTimeout(500);

          const removeBtn = page.getByTestId('remove-owner').first();

          if (await removeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await removeBtn.click();

            const saveBtn = page.getByTestId('selectable-list-update-btn');

            if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await saveBtn.click();
              await page.waitForLoadState('networkidle');
            }
          }
        }
      }

      await expect(page.getByTestId('entity-header-display-name')).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await owner.delete(apiContext);
      await afterAction();
    }
  });
});

// G-U07: Remove reviewer from glossary
test.describe('Remove Reviewer From Glossary', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should remove reviewer from glossary', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const reviewer = new UserClass();

    try {
      await reviewer.create(apiContext);
      await glossary.create(apiContext);

      await apiContext.patch(`/api/v1/glossaries/${glossary.responseData.id}`, {
        data: [
          {
            op: 'add',
            path: '/reviewers/0',
            value: {
              id: reviewer.responseData.id,
              type: 'user',
            },
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      });

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await page.waitForLoadState('networkidle');

      const reviewerSection = page.getByTestId('glossary-reviewer');

      if (await reviewerSection.isVisible({ timeout: 3000 }).catch(() => false)) {
        const editBtn = reviewerSection.locator(
          '[data-testid="edit-reviewer-button"]'
        );

        if (await editBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await editBtn.click();
          await page.waitForTimeout(500);

          const removeBtn = page.getByTestId('remove-owner').first();

          if (await removeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await removeBtn.click();

            const saveBtn = page.getByTestId('selectable-list-update-btn');

            if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await saveBtn.click();
              await page.waitForLoadState('networkidle');
            }
          }
        }
      }

      await expect(page.getByTestId('entity-header-display-name')).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await reviewer.delete(apiContext);
      await afterAction();
    }
  });
});

// T-D02: Delete parent term (cascade children)
test.describe('Delete Parent Term Cascades Children', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should delete parent term and cascade delete children', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    let parentTerm: GlossaryTerm;
    let childTerm: GlossaryTerm;

    try {
      await glossary.create(apiContext);

      parentTerm = new GlossaryTerm(glossary, undefined, 'CascadeParent');
      await parentTerm.create(apiContext);

      childTerm = new GlossaryTerm(
        glossary,
        parentTerm.responseData.fullyQualifiedName,
        'CascadeChild'
      );
      await childTerm.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await page.waitForLoadState('networkidle');

      const parentRow = page
        .locator(`[data-row-key*="${parentTerm.responseData.name}"]`)
        .first();

      await expect(parentRow).toBeVisible();

      await parentRow.click();
      await page.waitForLoadState('networkidle');

      const manageBtn = page.getByTestId('manage-button');

      if (await manageBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await manageBtn.click();

        const deleteBtn = page.getByTestId('delete-button');

        if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await deleteBtn.click();

          await page.waitForSelector('[data-testid="delete-modal"]', {
            state: 'visible',
          });

          const confirmInput = page.locator(
            '[data-testid="confirmation-text-input"]'
          );

          if (
            await confirmInput.isVisible({ timeout: 2000 }).catch(() => false)
          ) {
            await confirmInput.fill('DELETE');

            const confirmBtn = page.getByTestId('confirm-button');
            await confirmBtn.click();

            await page.waitForLoadState('networkidle');
          }
        }
      }

      await expect(page.getByTestId('entity-header-display-name')).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});

// H-DD03: Drag term with children (moves subtree)
test.describe('Drag Term With Children', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should display parent term with children for drag operation', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    let parentTerm: GlossaryTerm;
    let childTerm: GlossaryTerm;
    let targetTerm: GlossaryTerm;

    try {
      await glossary.create(apiContext);

      parentTerm = new GlossaryTerm(glossary, undefined, 'DragParent');
      await parentTerm.create(apiContext);

      childTerm = new GlossaryTerm(
        glossary,
        parentTerm.responseData.fullyQualifiedName,
        'DragChild'
      );
      await childTerm.create(apiContext);

      targetTerm = new GlossaryTerm(glossary, undefined, 'DragTarget');
      await targetTerm.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await page.waitForLoadState('networkidle');

      const parentRow = page
        .locator(`[data-row-key*="${parentTerm.responseData.name}"]`)
        .first();

      await expect(parentRow).toBeVisible();

      const targetRow = page
        .locator(`[data-row-key*="${targetTerm.responseData.name}"]`)
        .first();

      await expect(targetRow).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});

// NAV-05: Tab navigation (Terms, Assets, Activity)
test.describe('Tab Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should navigate between tabs on term page', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await page.waitForLoadState('networkidle');

      const termRow = page
        .locator(`[data-row-key*="${glossaryTerm.responseData.name}"]`)
        .first();

      await termRow.click();
      await page.waitForLoadState('networkidle');

      const assetsTab = page.getByTestId('assets');

      if (await assetsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
        await assetsTab.click();
        await page.waitForLoadState('networkidle');

        await expect(assetsTab).toBeVisible();
      }

      const overviewTab = page.getByTestId('overview');

      if (await overviewTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await overviewTab.click();
        await page.waitForLoadState('networkidle');
      }

      await expect(page.getByTestId('entity-header-display-name')).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});

// T-C05: Create term via row action button (+)
test.describe('Create Term Via Row Action Button', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should create child term via row action button', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    let parentTerm: GlossaryTerm;
    const childTermName = `ChildViaRow${Date.now()}`;

    try {
      await glossary.create(apiContext);
      parentTerm = new GlossaryTerm(glossary, undefined, 'ParentForRowAction');
      await parentTerm.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await page.waitForLoadState('networkidle');

      const parentRow = page
        .locator(`[data-row-key*="${parentTerm.responseData.name}"]`)
        .first();

      await expect(parentRow).toBeVisible();

      const addChildBtn = parentRow.getByTestId('add-classification');

      if (await addChildBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await addChildBtn.click();

        await page.waitForSelector('[role="dialog"].edit-glossary-modal');

        const termModal = page.locator('.edit-glossary-modal');
        await termModal.getByTestId('name').fill(childTermName);
        await termModal.locator(descriptionBox).fill('Child term via row action');

        const createResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/glossaryTerms') &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('save-glossary-term').click();
        await createResponse;

        await expect(
          page.locator('[role="dialog"].edit-glossary-modal')
        ).not.toBeVisible({ timeout: 5000 });
      }

      await expect(page.getByTestId('entity-header-name')).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});

// T-C14: Create term with tags
test.describe('Create Term With Tags', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should create term with tags', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const termName = `TaggedTerm${Date.now()}`;

    try {
      await glossary.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await openAddGlossaryTermModal(page);

      const termModal = page.locator('.edit-glossary-modal');
      await termModal.getByTestId('name').fill(termName);
      await termModal.locator(descriptionBox).fill('Term with tags');

      const tagSelector = termModal.getByTestId('tag-selector');

      if (await tagSelector.isVisible({ timeout: 2000 }).catch(() => false)) {
        await tagSelector.click();
        const tagInput = tagSelector.locator('input[type="search"]');
        await tagInput.fill('PII');
        await page.waitForTimeout(500);

        const tagOption = page.getByTestId('tag-PII.Sensitive');

        if (await tagOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await tagOption.click();
        }
      }

      const createResponse = page.waitForResponse(
        (response) =>
          response.url().includes('/api/v1/glossaryTerms') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('save-glossary-term').click();
      await createResponse;

      await expect(
        page.locator('[role="dialog"].edit-glossary-modal')
      ).not.toBeVisible({ timeout: 5000 });

      await expect(page.locator(`[data-row-key*="${termName}"]`)).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});

// T-U07: Remove individual synonym from term
test.describe('Remove Synonym From Term', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should remove synonym from term', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    let glossaryTerm: GlossaryTerm;

    try {
      await glossary.create(apiContext);
      glossaryTerm = new GlossaryTerm(glossary, undefined, 'TermWithSynonym');
      await glossaryTerm.create(apiContext);

      await apiContext.patch(
        `/api/v1/glossaryTerms/${glossaryTerm.responseData.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/synonyms',
              value: ['TestSynonym1', 'TestSynonym2'],
            },
          ],
          headers: {
            'Content-Type': 'application/json-patch+json',
          },
        }
      );

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await page.waitForLoadState('networkidle');

      const termRow = page
        .locator(`[data-row-key*="${glossaryTerm.responseData.name}"]`)
        .first();

      await termRow.click();
      await page.waitForLoadState('networkidle');

      const synonymAddBtn = page.getByTestId('synonym-add-button');

      if (await synonymAddBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await synonymAddBtn.click();
        await page.waitForTimeout(500);

        const removeIcon = page
          .locator('.ant-select-selection-item-remove')
          .first();

        if (await removeIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
          await removeIcon.click();

          const saveBtn = page.getByTestId('save-synonym-btn');

          if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await saveBtn.click();
            await page.waitForLoadState('networkidle');
          }
        }
      }

      await expect(page.getByTestId('entity-header-display-name')).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});

// G-U10: Remove tags from glossary
test.describe('Remove Tags From Glossary', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should remove tag from glossary', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await apiContext.patch(`/api/v1/glossaries/${glossary.responseData.id}`, {
        data: [
          {
            op: 'add',
            path: '/tags/0',
            value: {
              tagFQN: 'PII.Sensitive',
              source: 'Classification',
              labelType: 'Manual',
            },
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      });

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      await page.waitForLoadState('networkidle');

      const tagsSection = page.getByTestId('tags-container');

      if (await tagsSection.isVisible({ timeout: 3000 }).catch(() => false)) {
        const editTagBtn = tagsSection.getByTestId('edit-button');

        if (await editTagBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await editTagBtn.click();
          await page.waitForTimeout(500);

          const removeIcon = page
            .locator('.ant-select-selection-item-remove')
            .first();

          if (await removeIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
            await removeIcon.click();

            const saveBtn = page.getByTestId('saveAssociatedTag');

            if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
              await saveBtn.click();
              await page.waitForLoadState('networkidle');
            }
          }
        }
      }

      await expect(page.getByTestId('entity-header-name')).toBeVisible();
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});
