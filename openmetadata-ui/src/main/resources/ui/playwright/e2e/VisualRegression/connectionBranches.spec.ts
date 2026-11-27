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
import { Locator, Page } from '@playwright/test';
import recipes from '../../fixtures/visual/connection-branches.json';
import { expect, test } from '../../support/fixtures/base';
import { installVisualData } from '../../utils/visualData';
import { expectVisualMenuScreenshots } from '../../utils/visualMenus';
import {
  expectVisualScreenshot,
  gotoForScreenshot,
  prepareVisualTheme,
  VISUAL_THEMES,
  withFullVisualTarget,
} from '../../utils/visualRegression';

interface BranchAction {
  kind: 'auth' | 'tabs' | 'select';
  id: string;
  value: string;
  label: string;
  testId?: string;
}

interface ConnectionScene {
  kind: 'branch' | 'menu';
  id: string;
  category: string;
  connector: string;
  actions: BranchAction[];
  control?: { id: string; testId: string; options: string[] };
}

const branchField = (form: Locator, action: BranchAction) =>
  action.kind === 'auth'
    ? form.locator(
        `[data-testid="auth-select-field"]:has([id=${JSON.stringify(
          action.id
        )}])`
      )
    : form.locator(`[data-field-id=${JSON.stringify(action.id)}]`);

const chooseBranch = async (
  page: Page,
  form: Locator,
  action: BranchAction
) => {
  const field = branchField(form, action);
  if (action.kind === 'select') {
    if (!action.testId) throw new Error('Schema selectors require a test ID.');
    await field.getByTestId(action.testId).getByRole('button').click();
    await page.getByRole('option', { name: action.label, exact: true }).click();
    await expect(
      page.locator(
        '.core-select-widget-popover, .core-one-of-field-select-popover'
      )
    ).toHaveCount(0);
    // FocusScope restores focus on a later frame after removing the portal.
    // Wait for that handoff before a structural capture moves focus outside.
    await expect(
      field.getByTestId(action.testId).getByRole('button')
    ).toBeFocused();
    await expect(field.getByTestId(action.testId)).toContainText(action.label);
  } else if (action.kind === 'auth') {
    const method = field.getByTestId(`auth-method-${action.value}`);
    await method.click();
    await expect(method.locator('input[type="radio"]')).toBeChecked();
  } else {
    const tab = field.getByTestId(`oneof-option-${action.value}`);
    await tab.click();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
  }
};

for (const theme of VISUAL_THEMES) {
  test.describe(`Connection branches ${theme}`, { tag: '@Platform' }, () => {
    for (const scene of recipes as ConnectionScene[]) {
      test(scene.id, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await prepareVisualTheme(page, theme);
        await installVisualData(page);
        await gotoForScreenshot(
          page,
          `/connections/add-service/${scene.category}`,
          {
            readyTestId: 'select-service',
          }
        );
        await page.getByTestId(scene.connector).click();
        await page.getByTestId('service-name').fill('visual_connection');
        await expect(page.getByTestId('connection-schema-loader')).toBeHidden();
        const form = page.getByTestId('connection-grouped-form');
        await expect(form).toBeVisible();
        for (const key of ['scope', 'advanced']) {
          const section = form.getByTestId(`connection-section-${key}`);
          if (await section.count())
            await section.locator('button.connection-section-header').click();
        }

        // Parent choices expose nested selectors. Independent fields retain
        // their defaults instead of multiplying equivalent combinations.
        for (const action of scene.actions) {
          // A parent branch can enlarge the form and move the next popup's anchor.
          await withFullVisualTarget(page, form, () =>
            chooseBranch(page, form, action)
          );
        }

        // A schema change must not hide an optional section's fields from capture.
        for (const key of ['scope', 'advanced']) {
          const section = form.getByTestId(`connection-section-${key}`);
          if (await section.count())
            await expect(section.getByRole('separator')).not.toHaveCount(0);
        }

        if (scene.kind === 'menu') {
          if (!scene.control)
            throw new Error('Menu scenarios require a selector.');
          const control = scene.control;
          // Expanding sections can scroll a trigger and dismiss its popup.
          // Reveal the settled form before opening an anchored menu.
          await withFullVisualTarget(page, form, async () => {
            // The field test ID includes its hint; only the trigger opens the menu.
            await form.getByTestId(control.testId).getByRole('button').click();
            const menu = page.getByRole('listbox');
            const popup = page
              .locator(
                '.core-select-widget-popover, .core-one-of-field-select-popover'
              )
              .filter({ has: menu });
            await expect(menu.getByRole('option')).toHaveCount(
              control.options.length
            );
            await expect(popup).toBeInViewport({ ratio: 1 });
            for (const label of control.options) {
              await expect(
                menu.getByRole('option', { name: label, exact: true })
              ).toHaveCount(1);
            }
            await expectVisualMenuScreenshots(
              page,
              scene.id,
              theme,
              menu,
              popup
            );
          });
        } else {
          // Select restores focus after closing; give structural form captures a stable focus target outside their crop.
          await page.getByTestId('service-name').focus();
          await expect(page.getByTestId('service-name')).toBeFocused();
          await expect(
            form.locator('input:visible, textarea:visible, button:visible')
          ).not.toHaveCount(0);
          await withFullVisualTarget(page, form, () =>
            expectVisualScreenshot(page, scene.id, theme, {
              target: form,
              maxDiffPixelRatio: 0,
            })
          );
        }
        expect(
          errors,
          'Connection branches must render without runtime errors'
        ).toEqual([]);
      });
    }
  });
}
