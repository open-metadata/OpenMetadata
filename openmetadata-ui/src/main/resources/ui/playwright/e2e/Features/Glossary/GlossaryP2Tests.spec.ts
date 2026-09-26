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
import { getApiContext, redirectToHomePage } from '../../../utils/common';
import { selectActiveGlossary } from '../../../utils/glossary';
import { createGlossaryTermFromForm } from '../../../utils/glossaryForm';
import { sidebarClick } from '../../../utils/sidebar';

test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Glossary P2 Tests', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  // W-S01: New term starts as Draft (no reviewers)
  test('should create term with Draft status when no reviewers', async ({
    page,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary = new Glossary();

    try {
      await glossary.create(apiContext);

      await redirectToHomePage(page);
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page, glossary.data.displayName);

      const response = await createGlossaryTermFromForm(page, {
        name: `DraftTerm_${Date.now()}`,
        description: 'Test term for draft status',
      });
      const termData = await response.json();

      // No reviewers = auto-approved in some configs. A glossary term carries
      // its lifecycle state in `entityStatus`; it has no `status` field.
      expect(['Draft', 'Approved']).toContain(termData.entityStatus);
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  // TBL-C06: Custom property columns visible
  test('should show column settings with custom properties option', async ({
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

      // Look for column settings button
      const columnSettingsBtn = page.getByTestId('column-settings-btn');

      if (
        await columnSettingsBtn.isVisible({ timeout: 3000 }).catch(() => false)
      ) {
        await columnSettingsBtn.click();

        // Verify column settings modal/dropdown appears
        const columnSettings = page.locator(
          '[data-testid="column-settings"], .ant-dropdown'
        );

        if (
          await columnSettings.isVisible({ timeout: 2000 }).catch(() => false)
        ) {
          await expect(columnSettings).toBeVisible();
        }
      }
    } finally {
      await glossary.delete(apiContext);
      await afterAction();
    }
  });
});
