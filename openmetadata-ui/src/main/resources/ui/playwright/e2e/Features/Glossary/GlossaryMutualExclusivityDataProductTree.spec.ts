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
import { expect, test } from '@playwright/test';
import { Domain } from '../../../support/domain/Domain';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import { openDataProductDrawer } from '../../../utils/domain';
import {
  clickTreeNode,
  expandToGlossaryTermChildren,
  expectCheckbox,
  expectChecked,
  expectNotChecked,
  expectRadio,
} from '../../../utils/glossary';

test.use({ storageState: 'playwright/.auth/admin.json' });

test.describe('Glossary Mutual Exclusivity Feature - Data Product Tree', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test.describe('Suite 1: Radio/Checkbox Rendering', () => {
    test('ME-R01: Children of ME parent should render Radio buttons', async ({
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
          'RadioChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'RadioChild2'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);

        await redirectToHomePage(page);
        await openDataProductDrawer(page, domain);
        await expandToGlossaryTermChildren(
          page,
          glossary.responseData.displayName,
          parentTerm.responseData.displayName
        );

        await expectRadio(page, child1.responseData.fullyQualifiedName);
        await expectRadio(page, child2.responseData.fullyQualifiedName);
      } finally {
        await glossary.delete(apiContext);
        await domain.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-R02: Children of non-ME parent should render Checkboxes', async ({
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
          'CheckChild1'
        );
        const child2 = new GlossaryTerm(
          glossary,
          parentTerm.responseData.fullyQualifiedName,
          'CheckChild2'
        );
        await child1.create(apiContext);
        await child2.create(apiContext);

        await redirectToHomePage(page);
        await openDataProductDrawer(page, domain);
        await expandToGlossaryTermChildren(
          page,
          glossary.responseData.displayName,
          parentTerm.responseData.displayName
        );

        await expectCheckbox(page, child1.responseData.fullyQualifiedName);
        await expectCheckbox(page, child2.responseData.fullyQualifiedName);
      } finally {
        await glossary.delete(apiContext);
        await domain.delete(apiContext);
        await afterAction();
      }
    });
  });

  test.describe('Suite 2: Selection Behavior', () => {
    test('ME-S01: Selecting ME child should auto-deselect siblings', async ({
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

        await redirectToHomePage(page);
        await openDataProductDrawer(page, domain);
        await expandToGlossaryTermChildren(
          page,
          glossary.responseData.displayName,
          parentTerm.responseData.displayName
        );

        const id1 = child1.responseData.fullyQualifiedName;
        const id2 = child2.responseData.fullyQualifiedName;
        const id3 = child3.responseData.fullyQualifiedName;

        await clickTreeNode(page, id1);
        await expectChecked(page, id1);

        await clickTreeNode(page, id2);
        await expectChecked(page, id2);
        await expectNotChecked(page, id1);

        await clickTreeNode(page, id3);
        await expectChecked(page, id3);
        await expectNotChecked(page, id2);
        await expectNotChecked(page, id1);
      } finally {
        await glossary.delete(apiContext);
        await domain.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-S02: Can select multiple children under non-ME parent', async ({
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

        await redirectToHomePage(page);
        await openDataProductDrawer(page, domain);
        await expandToGlossaryTermChildren(
          page,
          glossary.responseData.displayName,
          parentTerm.responseData.displayName
        );

        const id1 = child1.responseData.fullyQualifiedName;
        const id2 = child2.responseData.fullyQualifiedName;
        const id3 = child3.responseData.fullyQualifiedName;

        await clickTreeNode(page, id1);
        await expectChecked(page, id1);

        await clickTreeNode(page, id2);
        await expectChecked(page, id2);

        await clickTreeNode(page, id3);
        await expectChecked(page, id3);

        await expectChecked(page, id1);
        await expectChecked(page, id2);
        await expectChecked(page, id3);
      } finally {
        await glossary.delete(apiContext);
        await domain.delete(apiContext);
        await afterAction();
      }
    });

    test('ME-S03: Can deselect currently selected ME term', async ({
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
          'DeselectChild'
        );
        await child1.create(apiContext);

        await redirectToHomePage(page);
        await openDataProductDrawer(page, domain);
        await expandToGlossaryTermChildren(
          page,
          glossary.responseData.displayName,
          parentTerm.responseData.displayName
        );

        const id = child1.responseData.fullyQualifiedName;

        await clickTreeNode(page, id);
        await expectChecked(page, id);

        await clickTreeNode(page, id);
        await expectNotChecked(page, id);
      } finally {
        await glossary.delete(apiContext);
        await domain.delete(apiContext);
        await afterAction();
      }
    });
  });

  test.describe('Suite 3: Data Product Save Integration', () => {
    test('ME-T01: Apply single ME glossary term and save Data Product', async ({
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
          'SaveChild'
        );
        await child.create(apiContext);

        await redirectToHomePage(page);
        await openDataProductDrawer(page, domain);
        await expandToGlossaryTermChildren(
          page,
          glossary.responseData.displayName,
          parentTerm.responseData.displayName
        );

        const childId = child.responseData.fullyQualifiedName;
        await clickTreeNode(page, childId);
        await expectChecked(page, childId);

        await page.getByTestId('name').locator('input').click();

        const createResponse = page.waitForResponse(
          (response) =>
            response.url().includes('/api/v1/dataProducts') &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('save-btn').click();
        const response = await createResponse;
        const responseBody = await response.json();

        expect(responseBody.tags).toBeDefined();
        const glossaryTags = responseBody.tags.filter(
          (tag: { source: string }) => tag.source === 'Glossary'
        );
        expect(glossaryTags.length).toBeGreaterThan(0);
        expect(glossaryTags[0].tagFQN).toBe(
          child.responseData.fullyQualifiedName
        );

        await apiContext.delete(
          `/api/v1/dataProducts/name/${encodeURIComponent(
            responseBody.fullyQualifiedName
          )}?hardDelete=true`
        );
      } finally {
        await glossary.delete(apiContext);
        await domain.delete(apiContext);
        await afterAction();
      }
    });
  });

  test.describe('Suite 4: Hierarchy & Edge Cases', () => {
    test('ME-H01: ME glossary (top level) children render Radio with ME behavior', async ({
      page,
    }) => {
      const { apiContext, afterAction } = await getApiContext(page);
      const domain = new Domain();

      const glossary = new Glossary();
      glossary.data.mutuallyExclusive = true;

      try {
        await domain.create(apiContext);
        await glossary.create(apiContext);

        const term1 = new GlossaryTerm(glossary);
        term1.data.name = 'GlossaryChild1';
        term1.data.displayName = 'GlossaryChild1';
        const term2 = new GlossaryTerm(glossary);
        term2.data.name = 'GlossaryChild2';
        term2.data.displayName = 'GlossaryChild2';
        await term1.create(apiContext);
        await term2.create(apiContext);

        await redirectToHomePage(page);
        await openDataProductDrawer(page, domain);
        await expandToGlossaryTermChildren(
          page,
          glossary.responseData.displayName
        );

        const id1 = term1.responseData.fullyQualifiedName;
        const id2 = term2.responseData.fullyQualifiedName;

        await expectRadio(page, id1);
        await expectRadio(page, id2);

        await clickTreeNode(page, id1);
        await expectChecked(page, id1);

        await clickTreeNode(page, id2);
        await expectChecked(page, id2);
        await expectNotChecked(page, id1);
      } finally {
        await glossary.delete(apiContext);
        await domain.delete(apiContext);
        await afterAction();
      }
    });
  });
});
