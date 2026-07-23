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
import test, { expect } from '@playwright/test';
import { SidebarItem } from '../../../constant/sidebar';
import { Glossary } from '../../../support/glossary/Glossary';
import { GlossaryTerm } from '../../../support/glossary/GlossaryTerm';
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import {
  addRelatedTermsByRelationType,
  selectActiveGlossary,
  selectActiveGlossaryTerm,
} from '../../../utils/glossary';
import { sidebarClick } from '../../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary Term — Related Terms', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should add multiple different target terms in a single save', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const termA = new GlossaryTerm(glossary);
    const termB = new GlossaryTerm(glossary);
    const termC = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await termA.create(apiContext);
      await termB.create(apiContext);
      await termC.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await selectActiveGlossaryTerm(page, termA.data.displayName);
      await page.getByTestId('related-term-add-button').click();

      const firstRow = page.locator('[data-testid^="relation-row-"]').first();
      const firstInput = firstRow
        .locator('[data-testid^="term-autocomplete-"]')
        .locator('input');

      const termBName =
        termB.responseData?.displayName ?? termB.data.displayName;
      const searchResB = page.waitForResponse(
        '**/api/v1/glossaryTerms/search*'
      );
      await firstInput.fill(termBName);
      await searchResB;
      await page.getByRole('option', { exact: true, name: termBName }).click();
      await page.getByTestId('add-row-button').click();
      const secondRow = page.locator('[data-testid^="relation-row-"]').last();
      const secondInput = secondRow
        .locator('[data-testid^="term-autocomplete-"]')
        .locator('input');

      const termCName =
        termC.responseData?.displayName ?? termC.data.displayName;
      const searchResC = page.waitForResponse(
        '**/api/v1/glossaryTerms/search*'
      );
      await secondInput.fill(termCName);
      await searchResC;
      await page.getByRole('option', { exact: true, name: termCName }).click();

      const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
      await page.getByTestId('save-related-terms').click();
      await saveRes;
      await expect(page.getByTestId(termBName)).toBeVisible();
      await expect(page.getByTestId(termCName)).toBeVisible();
    } finally {
      await termA.delete(apiContext);
      await termB.delete(apiContext);
      await termC.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('should edit the relation type of an existing related term', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const termA = new GlossaryTerm(glossary);
    const termB = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await termA.create(apiContext);
      await termB.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await selectActiveGlossaryTerm(page, termA.data.displayName);
      await addRelatedTermsByRelationType(page, [
        { relationTypeLabel: 'Related To', terms: [termB] },
      ]);

      const termBName =
        termB.responseData?.displayName ?? termB.data.displayName;

      await expect(page.getByTestId(termBName)).toBeVisible();
      await expect(
        page
          .getByTestId('related-term-container')
          .getByText('Related To', { exact: true })
      ).toBeVisible();

      await page
        .getByTestId('related-term-container')
        .getByTestId('edit-button')
        .click();

      const row = page.locator('[data-testid^="relation-row-"]').first();
      await row.getByRole('button').first().click();
      const seeAlsoOption = page.getByRole('option', {
        exact: true,
        name: 'See Also',
      });
      await expect(seeAlsoOption).toBeVisible();
      await seeAlsoOption.click();

      const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
      await page.getByTestId('save-related-terms').click();
      await saveRes;

      // The chip still exists but the relation-type heading changed.
      await expect(page.getByTestId(termBName)).toBeVisible();
      await expect(
        page
          .getByTestId('related-term-container')
          .getByText('See Also', { exact: true })
      ).toBeVisible();
      await expect(
        page
          .getByTestId('related-term-container')
          .getByText('Related To', { exact: true })
      ).not.toBeVisible();
    } finally {
      await termA.delete(apiContext);
      await termB.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('should delete a specific relation while keeping others', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const termA = new GlossaryTerm(glossary);
    const termB = new GlossaryTerm(glossary);
    const termC = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await termA.create(apiContext);
      await termB.create(apiContext);
      await termC.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await selectActiveGlossaryTerm(page, termA.data.displayName);

      const termBName =
        termB.responseData?.displayName ?? termB.data.displayName;
      const termCName =
        termC.responseData?.displayName ?? termC.data.displayName;

      await addRelatedTermsByRelationType(page, [
        { relationTypeLabel: 'Related To', terms: [termB] },
        { relationTypeLabel: 'See Also', terms: [termC] },
      ]);

      await expect(page.getByTestId(termBName)).toBeVisible();
      await expect(page.getByTestId(termCName)).toBeVisible();

      await page
        .getByTestId('related-term-container')
        .getByTestId('edit-button')
        .click();

      await page.locator('[data-testid^="remove-row-"]').first().click();

      const saveRes = page.waitForResponse('/api/v1/glossaryTerms/*');
      await page.getByTestId('save-related-terms').click();
      await saveRes;

      await expect(page.getByTestId(termBName)).not.toBeVisible();
      await expect(page.getByTestId(termCName)).toBeVisible();
    } finally {
      await termA.delete(apiContext);
      await termB.delete(apiContext);
      await termC.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('should add three relations to a single term and persist all after reload', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const termA = new GlossaryTerm(glossary);
    const termB = new GlossaryTerm(glossary);
    const termC = new GlossaryTerm(glossary);
    const termD = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await termA.create(apiContext);
      await termB.create(apiContext);
      await termC.create(apiContext);
      await termD.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await selectActiveGlossaryTerm(page, termA.data.displayName);

      const termBName =
        termB.responseData?.displayName ?? termB.data.displayName;
      const termCName =
        termC.responseData?.displayName ?? termC.data.displayName;
      const termDName =
        termD.responseData?.displayName ?? termD.data.displayName;

      await addRelatedTermsByRelationType(page, [
        { relationTypeLabel: 'Related To', terms: [termB] },
        { relationTypeLabel: 'Synonym', terms: [termC] },
        { relationTypeLabel: 'See Also', terms: [termD] },
      ]);

      await expect(page.getByTestId(termBName)).toBeVisible();
      await expect(page.getByTestId(termCName)).toBeVisible();
      await expect(page.getByTestId(termDName)).toBeVisible();

      const reloadRes = page.waitForResponse(
        `/api/v1/glossaryTerms/name/*${encodeURIComponent(termA.data.name)}*`
      );
      await page.reload();
      await reloadRes;

      await expect(page.getByTestId(termBName)).toBeVisible();
      await expect(page.getByTestId(termCName)).toBeVisible();
      await expect(page.getByTestId(termDName)).toBeVisible();
      await expect(
        page
          .getByTestId('related-term-container')
          .getByText('Related To', { exact: true })
      ).toBeVisible();
      await expect(
        page
          .getByTestId('related-term-container')
          .getByText('Synonym', { exact: true })
      ).toBeVisible();
      await expect(
        page
          .getByTestId('related-term-container')
          .getByText('See Also', { exact: true })
      ).toBeVisible();
    } finally {
      await termA.delete(apiContext);
      await termB.delete(apiContext);
      await termC.delete(apiContext);
      await termD.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('should add Related To, Narrower, and Has Part to the same target term and persist all after reload', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();
    const termBalance = new GlossaryTerm(glossary);
    const termRelated = new GlossaryTerm(glossary);

    try {
      await glossary.create(apiContext);
      await termBalance.create(apiContext);
      await termRelated.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);
      await selectActiveGlossaryTerm(page, termBalance.data.displayName);

      const relatedName =
        termRelated.responseData?.displayName ?? termRelated.data.displayName;
      await addRelatedTermsByRelationType(page, [
        { relationTypeLabel: 'Related To', terms: [termRelated] },
        { relationTypeLabel: 'Narrower', terms: [termRelated] },
        { relationTypeLabel: 'Has Part', terms: [termRelated] },
      ]);

      await expect(page.getByTestId(relatedName)).toHaveCount(3);
      const reloadRes = page.waitForResponse(
        `/api/v1/glossaryTerms/name/*${encodeURIComponent(
          termBalance.data.name
        )}*`
      );
      await page.reload();
      await reloadRes;

      await expect(page.getByTestId(relatedName)).toHaveCount(3);

      await expect(
        page
          .getByTestId('related-term-container')
          .getByText('Related To', { exact: true })
      ).toBeVisible();
      await expect(
        page
          .getByTestId('related-term-container')
          .getByText('Narrower', { exact: true })
      ).toBeVisible();
      await expect(
        page
          .getByTestId('related-term-container')
          .getByText('Has Part', { exact: true })
      ).toBeVisible();
    } finally {
      await termBalance.delete(apiContext);
      await termRelated.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});
