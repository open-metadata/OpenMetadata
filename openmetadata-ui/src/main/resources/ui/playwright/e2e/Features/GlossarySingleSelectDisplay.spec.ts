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
import { expect, Page } from '@playwright/test';
import { APIRequestContext, Browser } from '@playwright/test';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { performAdminLogin } from '../../utils/admin';
import { DATA_ASSET_RULES } from '../../utils/dataAssetRules';
import { test } from '../fixtures/pages';

// Regression spec for the bug:
// "UI/Glossary: Single-select term editor shows raw FQN and logs TreeSelect
// value-shape warning." When SINGLE_GLOSSARY_TERM_FOR_TABLE is enabled (so the
// glossary selector runs in single-select mode) and a Table already has a
// glossary term assigned, opening the editor must show the friendly display
// name (not the raw FQN) and must NOT log the antd dev-only
// "value should not be array when TreeSelect is single mode" warning.

const SINGLE_GLOSSARY_TERM_FOR_TABLE_RULE =
  'Tables can only have a single Glossary Term';

const setEntityRules = async (
  enableSingleGlossaryRule: boolean,
  browser: Browser
) => {
  const rules = DATA_ASSET_RULES.map((r) => ({
    ...r,
    enabled:
      r.name === SINGLE_GLOSSARY_TERM_FOR_TABLE_RULE
        ? enableSingleGlossaryRule
        : r.enabled,
  }));
  const { apiContext, afterAction } = await performAdminLogin(browser);
  await apiContext.put(`/api/v1/system/settings`, {
    data: {
      config_type: 'entityRulesSettings',
      config_value: { entitySemantics: rules },
    },
    headers: { 'Content-Type': 'application/json' },
  });
  await afterAction();
};

const assignTermViaApi = async (
  apiContext: APIRequestContext,
  table: TableClass,
  glossaryTerm: GlossaryTerm
) => {
  await apiContext.patch(`/api/v1/tables/${table.entityResponseData?.id}`, {
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
  });
};

const openGlossaryEditor = async (page: Page, hasExistingTerm: boolean) => {
  await page
    .getByTestId('KnowledgePanel.GlossaryTerms')
    .getByTestId('glossary-container')
    .getByTestId(hasExistingTerm ? 'edit-button' : 'add-tag')
    .click();
  await page.locator('#tagsForm_tags').waitFor({ state: 'visible' });
};

test.describe('Glossary single-select display regression', () => {
  test('shows the friendly display name on initial render with no array-value warning', async ({
    page,
    browser,
  }) => {
    test.slow(true);
    await setEntityRules(true, browser);
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const glossary = new Glossary();
    const glossaryTerm = new GlossaryTerm(glossary);
    const table = new TableClass();
    try {
      await glossary.create(apiContext);
      await glossaryTerm.create(apiContext);
      await table.create(apiContext);
      await assignTermViaApi(apiContext, table, glossaryTerm);

      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(
        `/table/${encodeURIComponent(
          table.entityResponseData?.fullyQualifiedName ?? ''
        )}`
      );
      await page.waitForLoadState('domcontentloaded');

      await openGlossaryEditor(page, true);

      // The dropdown's selection-item must show the friendly display name, not
      // the raw FQN. Scope to the glossary editor's tag-selector so we don't
      // match the global search type selector in the page header. The editor's
      // selection-item is the `.ant-select-selection-item` rendered inside the
      // antd Select's selector wrapper; reach it as the combobox role exposed
      // on the search input.
      const editorCombobox = page
        .getByTestId('tag-selector')
        .getByRole('combobox');
      const selectionItem = page
        .getByTestId('tag-selector')
        .locator('.ant-select-selector')
        .getByText(glossaryTerm.responseData.displayName, { exact: true });
      await expect(editorCombobox).toBeVisible();
      await expect(selectionItem).toBeVisible();
      await expect(selectionItem).toContainText(
        glossaryTerm.responseData.displayName
      );
      await expect(selectionItem).not.toContainText(
        glossaryTerm.responseData.fullyQualifiedName
      );

      // The form's injected `value` must be a scalar (not an array) so antd's
      // rc-tree-select does not log the array-in-single-mode warning.
      const arrayWarnings = consoleErrors.filter((t) =>
        t.includes('should not be array when')
      );
      expect(arrayWarnings).toHaveLength(0);
    } finally {
      await table.delete(apiContext);
      await glossaryTerm.delete(apiContext);
      await glossary.delete(apiContext);
      await afterAction();
    }
  });

  test('empty single-select (no assigned term) renders without a value and no array-value warning', async ({
    page,
    browser,
  }) => {
    test.slow(true);
    await setEntityRules(true, browser);
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const table = new TableClass();
    try {
      await table.create(apiContext);

      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      await page.goto(
        `/table/${encodeURIComponent(
          table.entityResponseData?.fullyQualifiedName ?? ''
        )}`
      );
      await page.waitForLoadState('domcontentloaded');

      await openGlossaryEditor(page, false);

      // No selection-item should be present (no assigned term).
      await expect(
        page.getByTestId('tag-selector').locator('.ant-select-selection-item')
      ).toHaveCount(0);

      // And no array-value warning (the empty `defaultValue: []` must
      // normalize to `undefined`, not stay an empty array).
      const arrayWarnings = consoleErrors.filter((t) =>
        t.includes('should not be array when')
      );
      expect(arrayWarnings).toHaveLength(0);
    } finally {
      await table.delete(apiContext);
      await afterAction();
    }
  });
});
