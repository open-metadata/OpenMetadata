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

/**
 * E2E tests for Settings → Personas → [persona] → AI Context → Rule builder.
 *
 * Coverage:
 *  - Rule CRUD (create / edit / delete)
 *  - Filter validation: incomplete condition blocks save, complete condition passes
 *  - Regression for issue #31564 / PR #31565: a fully-filled single-value condition
 *    on a normal field (Description Contains "…") was incorrectly rejected with
 *    "Finish or remove the unfinished condition before saving" before the fix.
 *    Root cause: `elasticSearchFormat` passed raw `config` instead of `extendedConfig`
 *    to `buildEsRule` in the single-value branch, causing widget resolution to fail.
 *  - Entity-type change resets an incomplete filter and unblocks save
 *  - Duplicate name validation
 *  - Max-assets clamping (> 1000 → 1000 on blur)
 *  - Match-preview and "View in Explore" link visible in the drawer
 *  - Always in context and Fully rendered toggles
 */

import { Locator, Page } from '@playwright/test';
import { expect, test as base } from '../../support/fixtures/base';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { AdminClass } from '../../support/user/AdminClass';
import { performAdminLogin } from '../../utils/admin';
import { selectOption } from '../../utils/advancedSearch';
import { toastNotification } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  navigateToPersonaSettings,
  navigateToPersonaWithPagination,
} from '../../utils/persona';

// ---------------------------------------------------------------------------
// Fixtures and shared state
// ---------------------------------------------------------------------------

const persona = new PersonaClass();

const test = base.extend<{ adminPage: Page }>({
  adminPage: async ({ browser }, use) => {
    const admin = new AdminClass();
    const page = await browser.newPage();
    await admin.login(page);
    await use(page);
    await page.close();
  },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Post antd->core migration each rule field/operator renders a core
// Select.ComboBox (OMFieldSelect). The default "owners" rule leaves an empty,
// hidden `<div class="rule--field">` first in the DOM, so scope to the
// container that actually holds a combobox — the pre-migration
// `.rule--field .ant-select` selector filtered these out implicitly.
const comboboxField = (scope: Page | Locator, className: string): Locator =>
  scope
    .locator(className)
    .filter({ has: scope.locator('input[role="combobox"]') });

const navigateToAIContextTab = async (page: Page) => {
  await navigateToPersonaSettings(page);
  await navigateToPersonaWithPagination(page, persona.data.name, true);
  await page.getByRole('tab', { name: 'AI Context' }).click();
  await waitForAllLoadersToDisappear(page);
};

/**
 * Opens the Add Rule drawer. Before any rules exist the empty-state button is
 * shown; once rules exist the header button is used instead.
 */
const openAddRuleDrawer = async (page: Page) => {
  const emptyBtn = page.getByTestId('empty-add-context-rule');
  const headerBtn = page.getByTestId('add-context-rule');
  // locator.isVisible() ignores the timeout option and returns synchronously.
  // Wait for whichever button is present, then check which one it was.
  await emptyBtn.or(headerBtn).first().waitFor({ state: 'visible' });
  if (await emptyBtn.isVisible()) {
    await emptyBtn.click();
  } else {
    await headerBtn.click();
  }
  await expect(page.getByTestId('form-heading')).toBeVisible();
};

/** Clicks Save Rule and waits for the API to respond with 200. */
const saveRule = async (page: Page) => {
  const saved = page.waitForResponse(
    (r) =>
      r.url().includes('/api/v1/personas/') &&
      r.url().includes('/aiContext/rules') &&
      ['POST', 'PUT'].includes(r.request().method()) &&
      r.status() === 200
  );
  await page.getByRole('button', { name: 'Save Rule' }).click();
  await saved;
};

/** Deletes the rule card whose visible text contains `ruleName`. */
const deleteRuleByName = async (page: Page, ruleName: string) => {
  await page
    .getByTestId('context-rule-card')
    .filter({ hasText: ruleName })
    .getByTestId('delete-context-rule')
    .click();
  await expect(page.getByTestId('delete-modal')).toBeVisible();
  const deleted = page.waitForResponse(
    (r) =>
      r.url().includes('/api/v1/personas/') &&
      r.url().includes('/aiContext/rules/') &&
      r.request().method() === 'DELETE' &&
      r.status() === 200
  );
  await page.getByTestId('confirm-button').click();
  await deleted;
};

// ---------------------------------------------------------------------------
// All tests are wrapped in describe.serial because they share a single
// PersonaClass instance. Running tests in parallel would cause the CRUD
// test's "empty state" assertion to race against filter/editor tests that
// concurrently create rules on the same persona, producing flaky failures.
// This matches the pattern used in PersonaAIContext.spec.ts.
// ---------------------------------------------------------------------------

test.describe.serial('Persona AI Context — Rule Builder', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await persona.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await persona.delete(apiContext);
    await afterAction();
  });

  // -------------------------------------------------------------------------
  // Rule CRUD — one test with steps because the flow is inherently sequential:
  // edit and delete depend on the rule created in earlier steps.
  // -------------------------------------------------------------------------

  test('Persona AI Context — Rule CRUD: empty state → create → edit → delete', async ({
    adminPage: page,
  }) => {
    const RULE_NAME = 'ai-context-crud-rule';
    const RULE_NAME_EDITED = 'ai-context-crud-rule-edited';

    await navigateToAIContextTab(page);

    await test.step('empty state shows Add Rule button before any rules exist', async () => {
      await expect(page.getByTestId('empty-add-context-rule')).toBeVisible();
      await expect(page.getByText('No AI context rules yet')).toBeVisible();
    });

    await test.step('open Add Rule drawer', async () => {
      await openAddRuleDrawer(page);
      await expect(page.getByTestId('form-heading')).toContainText('Add Rule');
    });

    await test.step('fill in rule name and verify drawer anatomy', async () => {
      await page.getByTestId('context-rule-name').fill(RULE_NAME);
      await expect(
        page.getByTestId('context-rule-match-preview')
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'View in Explore' })
      ).toBeVisible();
    });

    await test.step('save succeeds and rule card appears', async () => {
      await saveRule(page);
      await toastNotification(page, /AI context rule saved\./);
      await expect(
        page.getByTestId('context-rule-card').filter({ hasText: RULE_NAME })
      ).toBeVisible();
    });

    await test.step('edit rule name', async () => {
      await page
        .getByTestId('context-rule-card')
        .filter({ hasText: RULE_NAME })
        .getByTestId('edit-context-rule')
        .click();
      await expect(page.getByTestId('form-heading')).toContainText('Edit Rule');
      await page.getByTestId('context-rule-name').clear();
      await page.getByTestId('context-rule-name').fill(RULE_NAME_EDITED);
      await saveRule(page);
      await toastNotification(page, /AI context rule saved\./);
      await expect(
        page
          .getByTestId('context-rule-card')
          .filter({ hasText: RULE_NAME_EDITED })
      ).toBeVisible();
    });

    await test.step('delete rule and return to empty state', async () => {
      await deleteRuleByName(page, RULE_NAME_EDITED);
      await toastNotification(page, /AI context rule deleted\./);
      await expect(page.getByTestId('empty-add-context-rule')).toBeVisible();
    });
  });

  // -------------------------------------------------------------------------
  // Filter validation
  // -------------------------------------------------------------------------

  test.describe('Persona AI Context — Filter validation', () => {
    test('incomplete condition (no field selected) blocks save with an error message', async ({
      adminPage: page,
    }) => {
      await navigateToAIContextTab(page);
      await openAddRuleDrawer(page);
      await page
        .getByTestId('context-rule-name')
        .fill('filter-validation-test');

      await test.step('add an empty condition row', async () => {
        await page.getByTestId('add-context-condition').click();
        // Wait for the condition row's field selector to appear instead of a fixed delay
        await expect(comboboxField(page, '.rule--field').first()).toBeVisible();
      });

      await test.step('click Save Rule — must be blocked', async () => {
        await page.getByRole('button', { name: 'Save Rule' }).click();
        await expect(
          page.getByTestId('context-rule-filter-error')
        ).toBeVisible();
        await expect(
          page.getByTestId('context-rule-filter-error')
        ).toContainText(
          'Finish or remove the unfinished condition before saving'
        );
      });

      await page.keyboard.press('Escape');
    });

    /**
     * Regression for issue #31564 / PR #31565.
     *
     * Before the fix, `elasticSearchFormat` forwarded the raw `config` (not
     * `extendedConfig`) to `buildEsRule` in the single-value path, so
     * `getWidgetForFieldOp` returned `undefined` and the rule appeared "empty" to
     * `hasUnfinishedRule`. This caused any fully-completed normal field condition
     * (Description Contains, Service Is, Owner Is, …) to be rejected at save time
     * with the "unfinished condition" message.
     *
     * We use the `Description` field (type: 'text', operator: 'Contains') because
     * its value is a plain text input — no async dropdown fetch — so the test is
     * deterministic across environments regardless of what entities exist.
     */
    test('fully-completed Description Contains condition allows save — regression #31564', async ({
      adminPage: page,
    }) => {
      await navigateToAIContextTab(page);
      await openAddRuleDrawer(page);
      await page
        .getByTestId('context-rule-name')
        .fill('filter-regression-31564');

      await test.step('add a condition row', async () => {
        await page.getByTestId('add-context-condition').click();
        // Wait for the condition row's field selector to appear instead of a fixed delay
        await expect(comboboxField(page, '.rule--field').first()).toBeVisible();
      });

      await test.step('select the Description field (text type, no async fetch)', async () => {
        // Scope to the container that actually holds a combobox — the default
        // "owners" rule leaves an empty hidden .rule--field first in the DOM.
        await selectOption(
          page,
          comboboxField(page, '.rule--field').first(),
          'Description',
          true
        );
      });

      await test.step('select Contains operator (required before text widget appears)', async () => {
        // Description field uses match_phrase operators; text widget only renders
        // after an operator is chosen — select "Contains" (match_phrase)
        const operatorLocator = comboboxField(page, '.rule--operator').first();
        await expect(operatorLocator).toBeVisible({ timeout: 5000 });
        await selectOption(page, operatorLocator, 'Contains', false);
      });

      await test.step('type a value in the text widget', async () => {
        const textInput = page
          .locator('.rule--widget--TEXT input[type="text"]')
          .first();
        await textInput.waitFor({ state: 'visible' });
        await textInput.fill('important data asset');
      });

      await test.step('Save Rule must NOT show the filter error — condition is complete', async () => {
        await page.getByRole('button', { name: 'Save Rule' }).click();
        // If the pre-fix bug is present the error testid appears; with the fix it must not.
        await expect(
          page.getByTestId('context-rule-filter-error')
        ).not.toBeVisible();
      });

      await test.step('rule saves successfully', async () => {
        await toastNotification(page, /AI context rule saved\./);
      });

      await deleteRuleByName(page, 'filter-regression-31564');
    });

    test('changing entity type clears an incomplete filter and unblocks save', async ({
      adminPage: page,
    }) => {
      await navigateToAIContextTab(page);
      await openAddRuleDrawer(page);
      await page
        .getByTestId('context-rule-name')
        .fill('entity-type-switch-test');

      await test.step('add an empty condition — save must be blocked', async () => {
        await page.getByTestId('add-context-condition').click();
        // Wait for the condition row's field selector to appear instead of a fixed delay
        await expect(comboboxField(page, '.rule--field').first()).toBeVisible();
        await page.getByRole('button', { name: 'Save Rule' }).click();
        await expect(
          page.getByTestId('context-rule-filter-error')
        ).toBeVisible();
      });

      await test.step('switch entity type — filter must reset and unblock save', async () => {
        await page.getByTestId('context-rule-entity-type').click();
        await page
          .getByRole('listbox')
          .getByRole('option', { name: /metric/i })
          .first()
          .click();
        await saveRule(page);
        await toastNotification(page, /AI context rule saved\./);
      });

      await deleteRuleByName(page, 'entity-type-switch-test');
    });

    test('duplicate rule name is rejected with a validation error', async ({
      adminPage: page,
    }) => {
      const DUPE_NAME = 'duplicate-name-test';

      await navigateToAIContextTab(page);

      await test.step('create first rule', async () => {
        await openAddRuleDrawer(page);
        await page.getByTestId('context-rule-name').fill(DUPE_NAME);
        await saveRule(page);
        await toastNotification(page, /AI context rule saved\./);
      });

      await test.step('try to create a second rule with the same name', async () => {
        await openAddRuleDrawer(page);
        await page.getByTestId('context-rule-name').fill(DUPE_NAME);
        await page.getByRole('button', { name: 'Save Rule' }).click();
        await expect(page.getByText('Name already exists')).toBeVisible();
      });

      await page.keyboard.press('Escape');
      await deleteRuleByName(page, DUPE_NAME);
    });
  });

  // -------------------------------------------------------------------------
  // Rule editor — individual field behaviours
  // -------------------------------------------------------------------------

  test.describe('Persona AI Context — Rule editor fields', () => {
    test('max assets input clamps values above 1000 to 1000 on blur', async ({
      adminPage: page,
    }) => {
      await navigateToAIContextTab(page);
      await openAddRuleDrawer(page);

      const maxAssetsInput = page.getByTestId('context-rule-max-assets');

      await test.step('type 9999 — displayed while typing', async () => {
        await maxAssetsInput.fill('9999');
        await expect(maxAssetsInput).toHaveValue('9999');
      });

      await test.step('blur clamps to 1000', async () => {
        await maxAssetsInput.blur();
        await expect(maxAssetsInput).toHaveValue('1000');
      });

      await page.keyboard.press('Escape');
    });

    test('Always in context and Fully rendered toggles are visible and interactable', async ({
      adminPage: page,
    }) => {
      await navigateToAIContextTab(page);
      await openAddRuleDrawer(page);

      const alwaysToggle = page.getByTestId('context-rule-always-in-context');
      const fullyToggle = page.getByTestId('context-rule-fully-rendered');

      await expect(alwaysToggle).toBeVisible();
      await expect(fullyToggle).toBeVisible();

      // Toggle on then back off — verifies the controls are interactive
      await alwaysToggle.click();
      await alwaysToggle.click();

      await page.keyboard.press('Escape');
    });

    test(
      'knowledge entity type forces Fully rendered on and disables it',
      { tag: '@quarantine' },
      async ({ adminPage: page }) => {
        await navigateToAIContextTab(page);
        await openAddRuleDrawer(page);

        await test.step('switch to a knowledge entity type', async () => {
          await page.getByTestId('context-rule-entity-type').click();
          await page
            .getByRole('listbox')
            .getByText(/knowledge/i)
            .first()
            .click();
        });

        await test.step('Fully rendered switch must be checked and disabled', async () => {
          const fullyRenderedSwitch = page
            .getByTestId('context-rule-fully-rendered')
            .getByRole('switch')
            .first();
          // toBeChecked() reads the checkbox `checked` property — react-aria Switch
          // does not always set the aria-checked attribute, so attribute checks fail
          await expect(fullyRenderedSwitch).toBeChecked();
          await expect(fullyRenderedSwitch).toBeDisabled();
        });

        await page.keyboard.press('Escape');
      }
    );
  });
});
