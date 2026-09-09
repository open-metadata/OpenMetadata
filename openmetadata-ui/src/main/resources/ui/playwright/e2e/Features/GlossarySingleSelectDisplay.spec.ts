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
import { expect } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { authenticateAdminPage, performAdminLogin } from '../../utils/admin';
import { DATA_ASSET_RULES } from '../../utils/dataAssetRules';
import { test } from '../fixtures/pages';

const SINGLE_GLOSSARY_TERM_FOR_TABLE_RULE =
  'Tables can only have a single Glossary Term';

const glossary = new Glossary();
const glossaryTerm = new GlossaryTerm(glossary);
const tableWithTerm = new TableClass();
const tableWithoutTerm = new TableClass();

test.describe(
  'Glossary single-select display regression',
  { tag: ['@Features', '@Governance'] },
  () => {
    test.beforeAll('Setup entities and enable single-select rule', async ({
      browser,
    }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);
      await tableWithTerm.create(apiContext);
      await tableWithoutTerm.create(apiContext);

      // Assign glossary term to the first table via JSON-Patch
      await apiContext.patch(
        `/api/v1/tables/${tableWithTerm.entityResponseData?.id}`,
        {
          data: [
            {
              op: 'add',
              path: '/tags',
              value: [
                {
                  tagFQN: glossaryTerm.responseData.fullyQualifiedName,
                  source: 'Glossary',
                  labelType: 'Manual',
                  state: 'Confirmed',
                },
              ],
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );

      // Enable the single-glossary-term rule
      const rules = DATA_ASSET_RULES.map((r) => ({
        ...r,
        enabled:
          r.name === SINGLE_GLOSSARY_TERM_FOR_TABLE_RULE
            ? true
            : r.enabled,
      }));
      await apiContext.put('/api/v1/system/settings', {
        data: {
          config_type: 'entityRulesSettings',
          config_value: { entitySemantics: rules },
        },
        headers: { 'Content-Type': 'application/json' },
      });

      await afterAction();
    });

    test.afterAll('Cleanup entities and reset rule', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      await tableWithoutTerm.delete(apiContext);
      await tableWithTerm.delete(apiContext);
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);

      // Reset the single-glossary-term rule to its default state
      const rules = DATA_ASSET_RULES.map((r) => ({
        ...r,
        enabled:
          r.name === SINGLE_GLOSSARY_TERM_FOR_TABLE_RULE
            ? true
            : r.enabled,
      }));
      await apiContext.put('/api/v1/system/settings', {
        data: {
          config_type: 'entityRulesSettings',
          config_value: { entitySemantics: rules },
        },
        headers: { 'Content-Type': 'application/json' },
      });

      await afterAction();
    });

    test('shows the friendly display name on initial render with no array-value warning', async ({
      page,
    }) => {
      test.slow();

      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await test.step('Navigate to table page', async () => {
        await authenticateAdminPage(page);
        await page.goto(
          `/table/${encodeURIComponent(
            tableWithTerm.entityResponseData?.fullyQualifiedName ?? ''
          )}`
        );
        await page.waitForLoadState('domcontentloaded');
      });

      await test.step('Open glossary editor', async () => {
        await page
          .getByTestId('KnowledgePanel.GlossaryTerms')
          .getByTestId('glossary-container')
          .getByTestId('edit-button')
          .click();
        await page.locator('#tagsForm_tags').waitFor({ state: 'visible' });
      });

      await test.step('Verify display name is shown, not raw FQN', async () => {
        const selectionItem = page
          .getByTestId('tag-selector')
          .locator('.ant-select-selector')
          .getByText(glossaryTerm.responseData.displayName, { exact: true });

        await expect(
          page.getByTestId('tag-selector').getByRole('combobox')
        ).toBeVisible();
        await expect(selectionItem).toBeVisible();
        await expect(selectionItem).toContainText(
          glossaryTerm.responseData.displayName
        );
        await expect(selectionItem).not.toContainText(
          glossaryTerm.responseData.fullyQualifiedName
        );
      });

      await test.step('Verify no array-value warning was emitted', async () => {
        const arrayWarnings = consoleErrors.filter((t) =>
          t.includes('should not be array when')
        );

        expect(arrayWarnings).toHaveLength(0);
      });
    });

    test('empty single-select (no assigned term) renders without a value and no array-value warning', async ({
      page,
    }) => {
      test.slow();

      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await test.step('Navigate to table page', async () => {
        await authenticateAdminPage(page);
        await page.goto(
          `/table/${encodeURIComponent(
            tableWithoutTerm.entityResponseData?.fullyQualifiedName ?? ''
          )}`
        );
        await page.waitForLoadState('domcontentloaded');
      });

      await test.step('Open glossary editor via add-tag', async () => {
        await page
          .getByTestId('KnowledgePanel.GlossaryTerms')
          .getByTestId('glossary-container')
          .getByTestId('add-tag')
          .click();
        await page.locator('#tagsForm_tags').waitFor({ state: 'visible' });
      });

      await test.step('Verify no selection is present', async () => {
        await expect(
          page
            .getByTestId('tag-selector')
            .locator('.ant-select-selection-item')
        ).toHaveCount(0);
      });

      await test.step('Verify no array-value warning was emitted', async () => {
        const arrayWarnings = consoleErrors.filter((t) =>
          t.includes('should not be array when')
        );

        expect(arrayWarnings).toHaveLength(0);
      });
    });
  }
);
