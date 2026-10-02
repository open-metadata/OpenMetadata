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
import { SidebarItem } from '../../constant/sidebar';
import { Glossary } from '../../support/glossary/Glossary';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import { selectActiveGlossary } from '../../utils/glossary';
import {
  fillGlossaryForm,
  fillGlossaryTermForm,
  openAddGlossaryForm,
  openAddGlossaryTermForm,
  saveGlossaryFormExpectingError,
} from '../../utils/glossaryForm';
import { sidebarClick } from '../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary Form Validation', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should show error when glossary name is empty', async ({ page }) => {
    await sidebarClick(page, SidebarItem.GLOSSARY);

    const form = await openAddGlossaryForm(page);

    await fillGlossaryForm(page, form, { description: 'Test description' });

    await saveGlossaryFormExpectingError(page, 'glossary', 'Name is required');
  });

  test('should show error when glossary description is empty', async ({
    page,
  }) => {
    await sidebarClick(page, SidebarItem.GLOSSARY);

    const form = await openAddGlossaryForm(page);

    await fillGlossaryForm(page, form, { name: 'TestGlossary' });

    await saveGlossaryFormExpectingError(page, 'glossary');

    await expect(form.getByTestId('description')).toContainText(
      'Description is required'
    );
  });

  test('should show error when creating glossary with duplicate name', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);

      const form = await openAddGlossaryForm(page);

      await fillGlossaryForm(page, form, {
        name: glossary.data.name,
        description: 'Test description',
      });

      await saveGlossaryFormExpectingError(page, 'glossary');

      // A duplicate name is surfaced inline on the name field
      await expect(form.getByText(/already exists/i)).toBeVisible({
        timeout: 10000,
      });
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('should show error when term name is empty', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      const form = await openAddGlossaryTermForm(page);

      await fillGlossaryTermForm(page, form, {
        description: 'Test term description',
      });

      await saveGlossaryFormExpectingError(
        page,
        'glossaryTerm',
        'Name is required'
      );
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('should show error when term description is empty', async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      const form = await openAddGlossaryTermForm(page);

      await fillGlossaryTermForm(page, form, { name: 'TestTerm' });

      await saveGlossaryFormExpectingError(page, 'glossaryTerm');

      await expect(form.getByTestId('description')).toContainText(
        'Description is required'
      );
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});
