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
import { expect, Page, test } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { Domain } from '../../../support/domain/Domain';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import { sidebarClick } from '../../../utils/sidebar';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('MUI Glossary Mutual Exclusivity Feature', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  const openDataProductDrawer = async (page: Page, domain: Domain) => {
    await sidebarClick(page, SidebarItem.DATA_PRODUCT);
    await page.getByTestId('add-entity-button').click();
    await expect(page.getByTestId('form-heading')).toContainText(
      'Add Data Product'
    );

    // Fill name field - use pattern from existing specs
    await page.getByTestId('name').locator('input').fill(`test-dp-${Date.now()}`);

    // Fill description field - use contenteditable pattern
    const descriptionEditor = page.locator('[contenteditable="true"]').first();
    await descriptionEditor.waitFor({ state: 'visible', timeout: 10000 });
    await descriptionEditor.click();
    await page.keyboard.type('Test data product description');

    // Select domain - use pattern from existing specs
    const domainInput = page.getByTestId('domain-select');
    await domainInput.scrollIntoViewIfNeeded();
    await domainInput.waitFor({ state: 'visible' });
    await domainInput.click();

    const searchDomain = page.waitForResponse(
      /\/api\/v1\/search\/query\?q=.*index=domain_search_index.*/
    );
    await domainInput.fill(domain.data.displayName);
    await searchDomain;

    const domainOption = page.getByText(domain.data.displayName);
    await domainOption.waitFor({ state: 'visible', timeout: 5000 });
    await domainOption.click();
  };

  const openGlossaryTermsDropdown = async (page: Page) => {
    // Click on the glossary terms field to open dropdown
    const glossaryField = page.getByTestId('glossary-terms');
    await expect(glossaryField).toBeVisible();
    await glossaryField.click();
    // Wait for dropdown tree to be visible
    await page.waitForSelector('.MuiTreeItem-root', {
      state: 'visible',
      timeout: 10000,
    });
  };

  const searchAndExpandGlossaryTerm = async (
    page: Page,
    glossaryName: string,
    termDisplayName: string
  ) => {
    // Type in the glossary terms field to search
    const glossaryField = page.getByTestId('glossary-terms');
    await expect(glossaryField).toBeVisible();

    // Wait for search API response before proceeding
    const searchGlossary = page.waitForResponse(
      /\/api\/v1\/search\/query\?q=.*index=glossary_term_search_index.*/
    );
    await glossaryField.fill(glossaryName);
    await searchGlossary;

    await waitForAllLoadersToDisappear(page);
 
    // Click on the expand icon - navigate up to find TreeItem icon container
    const expandIcon = page
    .getByRole('tooltip')
      .locator('.MuiSvgIcon-root')
      .first();
    await expandIcon.click();

    // Wait for children to load
    await waitForAllLoadersToDisappear(page);

    const expandIcon2 = page
      .getByRole('tooltip')
      .locator('.MuiSvgIcon-root')
      .nth(1);
    await expandIcon2.click();
  };

  test.describe('Suite 1: Radio/Checkbox Rendering', () => {
    test('MUI-ME-R01: Children of ME parent should render Radio buttons', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const domain = new Domain();
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = true;

      try {
        await domain.create(apiContext);
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        // Create children under ME parent
        const child1 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MUIRadioChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MUIRadioChild2'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);

        await redirectToHomePage(page);
        await openDataProductDrawer(page, domain);
        await openGlossaryTermsDropdown(page);
        await searchAndExpandGlossaryTerm(
          page,
          glossary.responseData.name,
          parentTerm.responseData.name
        );

        // Verify children have Radio buttons (not Checkboxes)
        const child1Node = page.getByText(child1.responseData.displayName, {
          exact: true,
        });
        const child1Radio = child1Node.locator('..').locator('.MuiRadio-root');
        await expect(child1Radio).toBeVisible();

        const child2Node = page.getByText(child2.responseData.displayName, {
          exact: true,
        });
        const child2Radio = child2Node.locator('..').locator('.MuiRadio-root');
        await expect(child2Radio).toBeVisible();

        // Verify no checkboxes present for these children
        await expect(
          child1Node.locator('..').locator('.MuiCheckbox-root')
        ).toHaveCount(0);
        await expect(
          child2Node.locator('..').locator('.MuiCheckbox-root')
        ).toHaveCount(0);
      } finally {
        await glossary.delete(apiContext);
        await domain.delete(apiContext);
        await afterAction();
      }
    });

    test('MUI-ME-R02: Children of non-ME parent should render Checkboxes', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const domain = new Domain();
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = false;

      try {
        await domain.create(apiContext);
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child1 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MUICheckChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MUICheckChild2'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);

        await redirectToHomePage(page);
        await openDataProductDrawer(page, domain);
        await openGlossaryTermsDropdown(page);
        await searchAndExpandGlossaryTerm(
          page,
          glossary.responseData.displayName,
          parentTerm.responseData.displayName
        );

        // Verify children have Checkboxes (not Radio buttons)
        const child1Node = page.getByText(child1.responseData.displayName, {
          exact: true,
        });
        const child1Checkbox = child1Node
          .locator('..')
          .locator('.MuiCheckbox-root');
        await expect(child1Checkbox).toBeVisible();

        const child2Node = page.getByText(child2.responseData.displayName, {
          exact: true,
        });
        const child2Checkbox = child2Node
          .locator('..')
          .locator('.MuiCheckbox-root');
        await expect(child2Checkbox).toBeVisible();

        // Verify no radio buttons present for these children
        await expect(
          child1Node.locator('..').locator('.MuiRadio-root')
        ).toHaveCount(0);
        await expect(
          child2Node.locator('..').locator('.MuiRadio-root')
        ).toHaveCount(0);
      } finally {
        await glossary.delete(apiContext);
        await domain.delete(apiContext);
        await afterAction();
      }
    });
  });

  test.describe('Suite 2: Selection Behavior', () => {
    test('MUI-ME-S01: Selecting ME child should auto-deselect siblings', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const domain = new Domain();
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = true;

      try {
        await domain.create(apiContext);
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child1 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MUISelectChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MUISelectChild2'
        );
        const child3 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MUISelectChild3'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);
        await child3.create(apiContext);

        await redirectToHomePage(page);
        await openDataProductDrawer(page, domain);
        await openGlossaryTermsDropdown(page);
        await searchAndExpandGlossaryTerm(
          page,
          glossary.responseData.displayName,
          parentTerm.responseData.displayName
        );

        const child1Node = page.getByText(child1.responseData.displayName, {
          exact: true,
        });
        const child2Node = page.getByText(child2.responseData.displayName, {
          exact: true,
        });
        const child3Node = page.getByText(child3.responseData.displayName, {
          exact: true,
        });

        const child1Radio = child1Node.locator('..').locator('.MuiRadio-root');
        const child2Radio = child2Node.locator('..').locator('.MuiRadio-root');
        const child3Radio = child3Node.locator('..').locator('.MuiRadio-root');

        // Select first child
        await child1Node.click();
        await expect(child1Radio).toHaveClass(/Mui-checked/);

        // Select second child - first should be deselected
        await child2Node.click();
        await expect(child2Radio).toHaveClass(/Mui-checked/);
        await expect(child1Radio).not.toHaveClass(/Mui-checked/);

        // Select third child - second should be deselected
        await child3Node.click();
        await expect(child3Radio).toHaveClass(/Mui-checked/);
        await expect(child2Radio).not.toHaveClass(/Mui-checked/);
        await expect(child1Radio).not.toHaveClass(/Mui-checked/);
      } finally {
        await glossary.delete(apiContext);
        await domain.delete(apiContext);
        await afterAction();
      }
    });

    test('MUI-ME-S02: Can select multiple children under non-ME parent', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const domain = new Domain();
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = false;

      try {
        await domain.create(apiContext);
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child1 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MUIMultiChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MUIMultiChild2'
        );
        const child3 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MUIMultiChild3'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);
        await child3.create(apiContext);

        await redirectToHomePage(page);
        await openDataProductDrawer(page, domain);
        await openGlossaryTermsDropdown(page);
        await searchAndExpandGlossaryTerm(
          page,
          glossary.responseData.displayName,
          parentTerm.responseData.displayName
        );

        const child1Node = page.getByText(child1.responseData.displayName, {
          exact: true,
        });
        const child2Node = page.getByText(child2.responseData.displayName, {
          exact: true,
        });
        const child3Node = page.getByText(child3.responseData.displayName, {
          exact: true,
        });

        const child1Checkbox = child1Node
          .locator('..')
          .locator('.MuiCheckbox-root');
        const child2Checkbox = child2Node
          .locator('..')
          .locator('.MuiCheckbox-root');
        const child3Checkbox = child3Node
          .locator('..')
          .locator('.MuiCheckbox-root');

        // Select all three children
        await child1Node.click();
        await expect(child1Checkbox).toHaveClass(/Mui-checked/);

        await child2Node.click();
        await expect(child2Checkbox).toHaveClass(/Mui-checked/);

        await child3Node.click();
        await expect(child3Checkbox).toHaveClass(/Mui-checked/);

        // Verify all three remain selected
        await expect(child1Checkbox).toHaveClass(/Mui-checked/);
        await expect(child2Checkbox).toHaveClass(/Mui-checked/);
        await expect(child3Checkbox).toHaveClass(/Mui-checked/);
      } finally {
        await glossary.delete(apiContext);
        await domain.delete(apiContext);
        await afterAction();
      }
    });

    test('MUI-ME-S03: Can deselect currently selected ME term', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const domain = new Domain();
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = true;

      try {
        await domain.create(apiContext);
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child1 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MUIDeselectChild'
        );
        await child1.create(apiContext);

        await redirectToHomePage(page);
        await openDataProductDrawer(page, domain);
        await openGlossaryTermsDropdown(page);
        await searchAndExpandGlossaryTerm(
          page,
          glossary.responseData.displayName,
          parentTerm.responseData.displayName
        );

        // Scope to tooltip to avoid matching chip in input field
        const child1Node = page
          .getByRole('tooltip')
          .getByText(child1.responseData.displayName, { exact: true });
        const child1Radio = child1Node.locator('..').locator('.MuiRadio-root');

        // Select child
        await child1Node.click();
        await expect(child1Radio).toHaveClass(/Mui-checked/);

        // Click again to deselect
        await child1Node.click();
        await expect(child1Radio).not.toHaveClass(/Mui-checked/);
      } finally {
        await glossary.delete(apiContext);
        await domain.delete(apiContext);
        await afterAction();
      }
    });
  });

  test.describe('Suite 3: Data Product Save Integration', () => {
    test('MUI-ME-T01: Apply single ME glossary term and save Data Product', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const domain = new Domain();
      const glossary = new Glossary();
      const parentTerm = new GlossaryTerm(glossary);
      parentTerm.data.mutuallyExclusive = true;

      try {
        await domain.create(apiContext);
        await glossary.create(apiContext);
        await parentTerm.create(apiContext);

        const child = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'MUISaveChild'
        );
        await child.create(apiContext);

        await redirectToHomePage(page);
        await openDataProductDrawer(page, domain);
        await openGlossaryTermsDropdown(page);
        await searchAndExpandGlossaryTerm(
          page,
          glossary.responseData.displayName,
          parentTerm.responseData.displayName
        );

        // Select the child term
        const childNode = page.getByText(child.responseData.displayName, {
          exact: true,
        });
        const childRadio = childNode.locator('..').locator('.MuiRadio-root');
        await childNode.click();
        await expect(childRadio).toHaveClass(/Mui-checked/);

        // Click outside the dropdown to close it
        await page.getByTestId('name').locator('input').click();

        // Save the data product
        const createResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataProducts') &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('save-btn').click();
        const response = await createResponse;
        const responseBody = await response.json();

        // Verify the glossary term is in the response
        expect(responseBody.tags).toBeDefined();
        const glossaryTags = responseBody.tags.filter(
          (tag: { source: string }) => tag.source === 'Glossary'
        );
        expect(glossaryTags.length).toBeGreaterThan(0);
        expect(glossaryTags[0].tagFQN).toBe(
          child.responseData.fullyQualifiedName
        );

        // Clean up the created data product
        await apiContext.delete(
          `/api/v1/dataProducts/name/${encodeURIComponent(responseBody.fullyQualifiedName)}?hardDelete=true`
        );
      } finally {
        await glossary.delete(apiContext);
        await domain.delete(apiContext);
        await afterAction();
      }
    });
  });

  test.describe('Suite 4: Hierarchy & Edge Cases', () => {
    test('MUI-ME-H01: ME glossary (top level) children render Radio with ME behavior', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const domain = new Domain();

      // Create glossary with ME flag at glossary level
      const glossary = new Glossary();
      glossary.data.mutuallyExclusive = true;

      try {
        await domain.create(apiContext);
        await glossary.create(apiContext);

        // Create terms directly under ME glossary
        const term1 = new GlossaryTerm(glossary);
        term1.data.name = 'MUIGlossaryChild1';
        term1.data.displayName = 'MUIGlossaryChild1';
        const term2 = new GlossaryTerm(glossary);
        term2.data.name = 'MUIGlossaryChild2';
        term2.data.displayName = 'MUIGlossaryChild2';
        await term1.create(apiContext);
        await term2.create(apiContext);

        await redirectToHomePage(page);
        await openDataProductDrawer(page, domain);
        await openGlossaryTermsDropdown(page);

        // Search for the glossary
        const glossaryField = page.getByTestId('glossary-terms');
        await expect(glossaryField).toBeVisible();

        const searchGlossary = page.waitForResponse(
          /\/api\/v1\/search\/query\?q=.*index=glossary_term_search_index.*/
        );
        await glossaryField.fill(glossary.responseData.displayName);
        await searchGlossary;

        await waitForAllLoadersToDisappear(page);
        const expandIcon = page
        .getByRole('tooltip')
          .locator('.MuiSvgIcon-root')
          .first();
        await expandIcon.click();
    
        // Wait for children to load
        await waitForAllLoadersToDisappear(page);

        // Terms directly under ME glossary should have Radio buttons
        const term1Node = page.getByText(term1.responseData.displayName, {
          exact: true,
        });
        const term2Node = page.getByText(term2.responseData.displayName, {
          exact: true,
        });

        const term1Radio = term1Node.locator('..').locator('.MuiRadio-root');
        const term2Radio = term2Node.locator('..').locator('.MuiRadio-root');

        await expect(term1Radio).toBeVisible();
        await expect(term2Radio).toBeVisible();

        // Verify mutual exclusivity works
        await term1Node.click();
        await expect(term1Radio).toHaveClass(/Mui-checked/);

        await term2Node.click();
        await expect(term2Radio).toHaveClass(/Mui-checked/);
        await expect(term1Radio).not.toHaveClass(/Mui-checked/);
      } finally {
        await glossary.delete(apiContext);
        await domain.delete(apiContext);
        await afterAction();
      }
    });
  });
});
