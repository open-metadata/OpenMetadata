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

/**
 * Persona settings inside the AI-mode personal-space modal (`#personas/...`).
 *
 * Home page and entity-level (Governance / Data Assets → entity) customization
 * leave the modal for a full-page view rendered in normal document flow, so
 * every dialog it opens must sit on top and be usable. Leaving that view —
 * including discarding unsaved changes — must land back in the modal, never on
 * the legacy `/settings/persona/...` page.
 */

import { expect, Page } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { PersonaClass } from '../../../support/persona/PersonaClass';
import { performAdminLogin } from '../../../utils/admin';
import { uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { test } from '../../fixtures/pages';
import { enableAiAppMode } from '../../Utils/appMode';

/**
 * Open the persona settings straight from its hash deep link — the same link
 * the copy-link button produces — and wait for the persona to load.
 */
const openPersonaSettings = async (
  page: Page,
  personaName: string,
  subPath = ''
) => {
  const personaResponse = waitForResponseWithStatus(
    page,
    (response) =>
      response.url().includes(`/api/v1/personas/name/${personaName}`) &&
      response.request().method() === 'GET',
    200
  );
  await page.goto(`/#personas/${personaName}${subPath}`);
  await personaResponse;
  await expect(page.getByTestId('ai-profile-page')).toBeVisible();
  await waitForAllLoadersToDisappear(page);
};

const expectFullscreenView = async (page: Page, contentTestId: string) => {
  await expect(page.getByTestId('persona-fullscreen-view')).toBeVisible();
  await expect(page.getByTestId(contentTestId)).toBeVisible();
  // The modal and the app shell step aside instead of being stacked over.
  await expect(page.getByTestId('ai-profile-page')).not.toBeVisible();
  await expect(page.getByTestId('app-shell')).not.toBeVisible();
};

/**
 * A fresh persona has no saved layout, so the customize page seeds the default
 * one and (as on the legacy route) treats it as unsaved: leaving asks first.
 */
const discardUnsavedDefaultLayout = async (page: Page) => {
  await expect(page.getByTestId('unsaved-changes-modal')).toBeVisible();
  await page.getByTestId('unsaved-changes-modal-discard').click();
};

test.describe(
  'Persona settings in the personal-space modal',
  { tag: [DOMAIN_TAGS.PLATFORM] },
  () => {
    let persona: PersonaClass;

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      const id = uuid();
      // A plain name: it travels in the URL hash, where `%` would be decoded.
      persona = new PersonaClass({
        name: `pw-persona-${id}`,
        displayName: `PW Persona ${id}`,
        description: 'playwright persona settings',
        users: [],
      });
      await persona.create(apiContext);
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await persona.delete(apiContext);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await enableAiAppMode(page);
    });

    test('copy link puts a deep link to the persona on the clipboard', async ({
      page,
    }) => {
      const personaName = persona.data.name;
      await page
        .context()
        .grantPermissions(['clipboard-read', 'clipboard-write']);

      await openPersonaSettings(page, personaName);
      await expect(page.getByTestId('persona-detail-container')).toBeVisible();

      await page.getByTestId('copy-persona-link').click();

      await expect
        .poll(() => page.evaluate(() => navigator.clipboard.readText()))
        .toContain(`#personas/${personaName}`);
    });

    test('Governance keeps the persona detail tabs and opens an entity full page', async ({
      page,
    }) => {
      await openPersonaSettings(
        page,
        persona.data.name,
        '/customize/governance'
      );

      await test.step('sub-grid keeps Customize UI / Users tabs', async () => {
        await expect(
          page.getByTestId('persona-detail-container')
        ).toBeVisible();
        await expect(
          page.getByRole('tab', { name: 'Customize UI' })
        ).toBeVisible();
        await expect(page.getByRole('tab', { name: /Users/ })).toBeVisible();
        await expect(
          page.getByTestId('persona-sub-category-grid')
        ).toBeVisible();
      });

      await test.step('an entity tile replaces the modal with a full page', async () => {
        await page.getByTestId('sub-category-card-Domain').click();

        await expectFullscreenView(page, 'entity-customize-overlay');
        await expect(
          page.getByTestId('customize-page-breadcrumbs')
        ).toContainText(persona.data.displayName);
      });

      await test.step('minimize returns to the Governance sub-grid in the modal', async () => {
        await page.getByTestId('customize-minimize-button').click();
        await discardUnsavedDefaultLayout(page);

        await expect(
          page.getByTestId('persona-sub-category-grid')
        ).toBeVisible();
        await expect(
          page.getByTestId('persona-fullscreen-view')
        ).not.toBeVisible();
      });
    });

    test('Data Assets entity page opens dialogs on top and discards back into the modal', async ({
      page,
    }) => {
      test.slow();

      await openPersonaSettings(
        page,
        persona.data.name,
        '/customize/data-assets'
      );
      await page.getByTestId('sub-category-card-Table').click();
      await expectFullscreenView(page, 'entity-customize-overlay');
      await expect(page.getByTestId('customize-tab-card')).toBeVisible();

      await test.step('Add Tab dialog is on top and usable', async () => {
        await page
          .getByTestId('customize-tab-card')
          .getByRole('button', { name: 'Add Tab' })
          .click();

        const addTabDialog = page.getByRole('dialog', { name: 'Add Tab' });

        await expect(addTabDialog).toBeVisible();

        await addTabDialog
          .getByTestId('add-tab-input')
          .fill(`pw-tab-${uuid()}`);
        await addTabDialog
          .getByRole('button', { name: 'Add', exact: true })
          .click();

        await expect(addTabDialog).not.toBeVisible();
        await expect(page.getByTestId('save-button')).toBeEnabled();
      });

      await test.step('discarding unsaved changes returns to the modal, not the legacy page', async () => {
        await page.getByTestId('cancel-button').click();

        const unsavedDialog = page.getByTestId('unsaved-changes-modal');

        await expect(unsavedDialog).toBeVisible();

        await page.getByTestId('unsaved-changes-modal-discard').click();

        await expect(
          page.getByTestId('persona-sub-category-grid')
        ).toBeVisible();
        await expect(page.getByTestId('ai-profile-page')).toBeVisible();
        await expect(page).toHaveURL(
          new RegExp(`#personas/${persona.data.name}/customize/data-assets$`)
        );
        await expect(page).not.toHaveURL(/\/settings\/persona/);
      });
    });

    test('Home page opens full page and Add Widget stays a modal', async ({
      page,
    }) => {
      await openPersonaSettings(page, persona.data.name);
      await page.getByTestId('customize-card-LandingPage').click();

      await expectFullscreenView(page, 'landing-page-editor-overlay');

      await test.step('Add Widget opens the Customize Home dialog', async () => {
        await page
          .getByTestId('customize-landing-page-header')
          .getByTestId('add-widget-button')
          .click();

        const customizeHomeDialog = page.getByRole('dialog', {
          name: 'Customize Home',
        });

        await expect(customizeHomeDialog).toBeVisible();

        await customizeHomeDialog.getByTestId('cancel-btn').click();

        await expect(customizeHomeDialog).not.toBeVisible();
        await expect(
          page.getByTestId('landing-page-editor-overlay')
        ).toBeVisible();
      });

      await test.step('closing returns to the persona detail in the modal', async () => {
        await page.getByTestId('cancel-button').click();
        await discardUnsavedDefaultLayout(page);

        await expect(
          page.getByTestId('persona-detail-container')
        ).toBeVisible();
        await expect(
          page.getByTestId('persona-fullscreen-view')
        ).not.toBeVisible();
      });
    });

    test('Data Marketplace is customized inside the modal', async ({
      page,
    }) => {
      await openPersonaSettings(page, persona.data.name);
      await page.getByTestId('customize-card-DataMarketplace').click();

      const profilePage = page.getByTestId('ai-profile-page');

      await expect(profilePage.getByTestId('marketplace-editor')).toBeVisible();
      await expect(
        profilePage.getByTestId('marketplace-overview-header')
      ).toBeVisible();
      // The preview header is read-only: search is disabled, Add New is hidden.
      await expect(
        profilePage
          .getByTestId('marketplace-overview-header')
          .getByRole('textbox')
      ).toBeDisabled();
      await expect(profilePage.getByTestId('customize-save')).toBeDisabled();
      await expect(
        page.getByTestId('persona-fullscreen-view')
      ).not.toBeVisible();
    });
  }
);
