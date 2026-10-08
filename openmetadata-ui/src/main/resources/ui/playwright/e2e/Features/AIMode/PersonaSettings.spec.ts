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

import { expect, Page, Response } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { PersonaClass } from '../../../support/persona/PersonaClass';
import { UserClass } from '../../../support/user/UserClass';
import { performAdminLogin } from '../../../utils/admin';
import { selectOption } from '../../../utils/advancedSearch';
import { deleteFixtureEntity, settleAll } from '../../../utils/apiResponse';
import { fillDescriptionBox, uuid } from '../../../utils/common';
import {
  selectAssetTypes,
  waitForLandingPageWidget,
} from '../../../utils/customizeLandingPage';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { waitForSearchIndexed } from '../../../utils/polling';
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
  // Home page and entity customize links open full page, without the modal.
  await expect(
    page
      .getByTestId('ai-profile-page')
      .or(page.getByTestId('persona-fullscreen-view'))
  ).toBeVisible();
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

      await test.step('another entity opened in the same session shows its default widgets', async () => {
        // Regression: the shared customize store still held Table, so the
        // next entity mounted with an empty layout until a page refresh.
        await page.getByTestId('sub-category-card-APIEndpoint').click();
        await expectFullscreenView(page, 'entity-customize-overlay');

        await expect(
          page
            .getByTestId('entity-customize-overlay')
            .getByTestId('remove-widget-button')
        ).not.toHaveCount(0);
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

const isPersonaPatch = (personaId: string) => (response: Response) =>
  response.url().includes(`/api/v1/personas/${personaId}`) &&
  response.request().method() === 'PATCH';

// The first save of a persona's layout creates its document, later ones patch it.
const isLayoutSave = (response: Response) =>
  response.url().includes('/api/v1/docStore') &&
  ['POST', 'PATCH'].includes(response.request().method());

const buildPersona = (prefix: string) => {
  const id = uuid();

  return new PersonaClass({
    name: `pw-${prefix}-${id}`,
    displayName: `PW ${prefix} ${id}`,
    description: 'playwright persona settings',
    users: [],
  });
};

/**
 * Save from the current customize view and prove the layout request went out
 * for this page, then reload and let the caller assert the persisted state.
 */
const saveLayoutAndReload = async (
  page: Page,
  saveButtonTestId: string,
  expectedPayloadFragment: string
) => {
  const saveResponse = waitForResponseWithStatus(
    page,
    isLayoutSave,
    [200, 201]
  );
  await page.getByTestId(saveButtonTestId).click();
  const response = await saveResponse;

  expect(response.request().postData() ?? '').toContain(
    expectedPayloadFragment
  );

  // Callers assert the persisted state on page-specific elements; the entity
  // previews keep a placeholder loader, so a global loader wait never settles.
  await page.reload();
};

test.describe(
  'Persona settings — persona management actions',
  { tag: [DOMAIN_TAGS.PLATFORM] },
  () => {
    let persona: PersonaClass;
    let personaToDelete: PersonaClass;
    let user: UserClass;
    // Personas created through the UI by this worker, deleted in afterAll.
    const createdPersonaNames: string[] = [];

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      persona = buildPersona('manage');
      personaToDelete = buildPersona('delete');
      user = new UserClass();
      await settleAll([
        persona.create(apiContext),
        personaToDelete.create(apiContext),
        user.create(apiContext),
      ]);
      // The users picker and the users table both read the search index.
      await waitForSearchIndexed(
        apiContext,
        user.responseData.fullyQualifiedName,
        'user_search_index'
      );
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await settleAll([
        persona.delete(apiContext),
        personaToDelete.delete(apiContext),
        user.delete(apiContext),
        ...createdPersonaNames.map((name) =>
          deleteFixtureEntity(
            apiContext,
            `/api/v1/personas/name/${name}?hardDelete=true`
          )
        ),
      ]);
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await enableAiAppMode(page);
    });

    test('creates a persona from the add form', async ({ page }) => {
      const createdPersonaName = `pw-created-${uuid()}`;
      const displayName = `PW Created ${createdPersonaName}`;
      createdPersonaNames.push(createdPersonaName);

      await page.goto('/#personas');
      await expect(page.getByTestId('personas-landing')).toBeVisible();
      await page.getByTestId('add-persona-button').click();

      await expect(page.getByTestId('add-persona-container')).toBeVisible();

      await page
        .getByTestId('persona-name-input')
        .getByRole('textbox')
        .fill(createdPersonaName);
      await page
        .getByTestId('persona-display-name-input')
        .getByRole('textbox')
        .fill(displayName);

      const createResponse = waitForResponseWithStatus(
        page,
        (response) =>
          response.url().endsWith('/api/v1/personas') &&
          response.request().method() === 'POST',
        201
      );
      await page.getByTestId('submit-btn').click();
      const response = await createResponse;

      expect(response.request().postDataJSON()).toEqual(
        expect.objectContaining({ name: createdPersonaName, displayName })
      );
      await expect(page.getByTestId('personas-landing')).toBeVisible();
    });

    test('renames the persona and keeps it after a reload', async ({
      page,
    }) => {
      const newName = `PW Renamed ${uuid()}`;

      await openPersonaSettings(page, persona.data.name);
      await page.getByTestId('rename-persona-btn').click();
      await page
        .getByTestId('persona-rename-input')
        .getByRole('textbox')
        .fill(newName);

      const patchResponse = waitForResponseWithStatus(
        page,
        isPersonaPatch(persona.responseData.id ?? ''),
        200
      );
      await page
        .getByTestId('profile-content-header')
        .getByRole('button', { name: 'Save' })
        .click();
      const response = await patchResponse;

      expect(response.request().postData()).toContain(newName);
      await expect(page.getByTestId('profile-content-header')).toContainText(
        newName
      );

      await page.reload();

      await expect(page.getByTestId('profile-content-header')).toContainText(
        newName
      );
    });

    test('edits the persona description', async ({ page }) => {
      const description = `PW description ${uuid()}`;

      await openPersonaSettings(page, persona.data.name);
      await page.getByTestId('edit-persona-description-btn').click();
      await fillDescriptionBox(
        page.getByTestId('persona-detail-container'),
        description
      );

      const patchResponse = waitForResponseWithStatus(
        page,
        isPersonaPatch(persona.responseData.id ?? ''),
        200
      );
      await page
        .getByTestId('persona-detail-container')
        .getByRole('button', { name: 'Save' })
        .click();
      const response = await patchResponse;

      expect(response.request().postData()).toContain(description);
      await expect(page.getByTestId('persona-detail-container')).toContainText(
        description
      );
    });

    test('sets and removes the default persona', async ({ page }) => {
      await openPersonaSettings(page, persona.data.name);
      const defaultButton = page.getByTestId('set-default-persona-btn');

      await expect(defaultButton).toHaveText('Set as Default');

      try {
        const setResponse = waitForResponseWithStatus(
          page,
          isPersonaPatch(persona.responseData.id ?? ''),
          200
        );
        await defaultButton.click();

        expect((await setResponse).request().postData()).toContain('default');
        await expect(defaultButton).toHaveText('Remove Default');
      } finally {
        // The default persona is server-wide; always hand it back.
        const removeResponse = waitForResponseWithStatus(
          page,
          isPersonaPatch(persona.responseData.id ?? ''),
          200
        );
        await defaultButton.click();
        await removeResponse;
      }

      await expect(defaultButton).toHaveText('Set as Default');
    });

    test('adds a user to the persona and removes it again', async ({
      page,
    }) => {
      const userName =
        user.responseData.displayName ?? user.responseData.name ?? '';

      await openPersonaSettings(page, persona.data.name, '?tab=users');
      await expect(page.getByTestId('persona-users-tab')).toBeVisible();

      await test.step('add', async () => {
        await page.getByTestId('add-persona-user').click();
        const picker = page
          .getByTestId('add-persona-users-select')
          .getByRole('combobox');
        await picker.fill(user.responseData.name ?? '');
        await page.getByRole('option', { name: userName }).click();

        const addResponse = waitForResponseWithStatus(
          page,
          isPersonaPatch(persona.responseData.id ?? ''),
          200
        );
        await page.getByTestId('save-persona-users').click();
        const response = await addResponse;

        expect(response.request().postData()).toContain(
          user.responseData.id ?? ''
        );
        await expect(page.getByTestId('persona-users-table')).toContainText(
          userName
        );
      });

      await test.step('remove', async () => {
        const removeResponse = waitForResponseWithStatus(
          page,
          isPersonaPatch(persona.responseData.id ?? ''),
          200
        );
        await page.getByTestId(`remove-user-${userName}`).click();
        await removeResponse;

        await expect(page.getByTestId('persona-users-table')).not.toContainText(
          userName
        );
      });
    });

    test('deletes a persona and returns to the personas list', async ({
      page,
    }) => {
      await openPersonaSettings(page, personaToDelete.data.name);
      await page.getByTestId('delete-persona-btn').click();

      await expect(page.getByTestId('delete-modal')).toBeVisible();

      const deleteResponse = waitForResponseWithStatus(
        page,
        (response) =>
          response
            .url()
            .includes(`/api/v1/personas/${personaToDelete.responseData.id}`) &&
          response.request().method() === 'DELETE',
        200
      );
      await page
        .getByTestId('delete-modal')
        .getByTestId('confirm-button')
        .click();
      await deleteResponse;

      await expect(page.getByTestId('personas-landing')).toBeVisible();
    });
  }
);

test.describe(
  'Persona settings — customize saves',
  { tag: [DOMAIN_TAGS.PLATFORM] },
  () => {
    // One persona per editor: every save writes the same persona document, so
    // sharing one across parallel workers would race on its version.
    const personas: Record<string, PersonaClass> = {};
    const EDITORS = [
      'navigation',
      'appLayout',
      'aiSidebar',
      'marketplace',
      'home',
      'homeTheme',
      'curated',
      'table',
      'domain',
    ];

    test.beforeAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      EDITORS.forEach((key) => {
        personas[key] = buildPersona(`save-${key}`);
      });
      await settleAll(
        Object.values(personas).map((item) => item.create(apiContext))
      );
      await afterAction();
    });

    test.afterAll(async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await settleAll(
        Object.values(personas).map((item) => item.delete(apiContext))
      );
      await afterAction();
    });

    test.beforeEach(async ({ page }) => {
      await enableAiAppMode(page);
    });

    test('Navigation: hiding an item is saved', async ({ page }) => {
      await openPersonaSettings(
        page,
        personas.navigation.data.name,
        '/customize/navigation'
      );
      const exploreSwitch = page
        .getByTestId('navigation-switch-/explore')
        .getByRole('switch');

      await expect(exploreSwitch).toBeChecked();

      // react-aria keeps the input under its label; the label takes the press.
      await page.getByTestId('navigation-switch-/explore').click();

      await expect(exploreSwitch).not.toBeChecked();

      await saveLayoutAndReload(page, 'customize-save', '/explore');

      await expect(
        page.getByTestId('navigation-switch-/explore').getByRole('switch')
      ).not.toBeChecked();
    });

    test('App Layout: the default app mode is saved', async ({ page }) => {
      await openPersonaSettings(
        page,
        personas.appLayout.data.name,
        '/customize/app-layout'
      );
      await page.getByTestId('app-mode-option-classic').click();

      await expect(
        page.getByTestId('app-mode-option-classic').getByRole('radio')
      ).toBeChecked();

      await saveLayoutAndReload(page, 'customize-save', 'classic');

      await expect(
        page.getByTestId('app-mode-option-classic').getByRole('radio')
      ).toBeChecked();
    });

    test('AI sidebar: hiding a module is saved', async ({ page }) => {
      await openPersonaSettings(
        page,
        personas.aiSidebar.data.name,
        '/customize/askCollateSidebar'
      );
      const exploreSwitch = page
        .getByTestId('ai-sidebar-switch-explore')
        .getByRole('switch');

      await expect(exploreSwitch).toBeChecked();

      await page.getByTestId('ai-sidebar-switch-explore').click();

      await expect(exploreSwitch).not.toBeChecked();

      await saveLayoutAndReload(page, 'customize-save', 'explore');

      await expect(
        page.getByTestId('ai-sidebar-switch-explore').getByRole('switch')
      ).not.toBeChecked();
    });

    test('Data Marketplace: the layout is saved', async ({ page }) => {
      await openPersonaSettings(
        page,
        personas.marketplace.data.name,
        '/customize/DataMarketplace'
      );
      const saveButton = page.getByTestId('customize-save');

      await expect(saveButton).toBeDisabled();

      await page.getByTestId('customize-reset').click();

      await expect(saveButton).toBeEnabled();

      await saveLayoutAndReload(page, 'customize-save', 'DataMarketplace');

      await expect(page.getByTestId('marketplace-editor')).toBeVisible();
      await expect(page.getByTestId('customize-save')).toBeDisabled();
    });

    test('Home page: the layout is saved', async ({ page }) => {
      await openPersonaSettings(
        page,
        personas.home.data.name,
        '/customize/LandingPage'
      );

      await expect(
        page.getByTestId('landing-page-editor-overlay')
      ).toBeVisible();
      // A fresh persona has no saved layout, so the seeded default is unsaved.
      await expect(page.getByTestId('save-button')).toBeEnabled();

      await saveLayoutAndReload(page, 'save-button', 'LandingPage');

      await expect(
        page.getByTestId('landing-page-editor-overlay')
      ).toBeVisible();
      await expect(page.getByTestId('save-button')).toBeDisabled();
    });

    test('Home page: a header theme colour is saved', async ({ page }) => {
      // Loads the full Home page (every widget's API calls) twice.
      test.slow();
      await openPersonaSettings(
        page,
        personas.homeTheme.data.name,
        '/customize/LandingPage'
      );
      await page
        .getByTestId('customize-landing-page-header')
        .getByTestId('add-widget-button')
        .click();
      const customizeHome = page.getByRole('dialog', {
        name: 'Customize Home',
      });

      await expect(customizeHome).toBeVisible();

      await customizeHome.getByTestId('sidebar-option-header-theme').click();
      await customizeHome.getByRole('button', { name: 'Green' }).click();

      // The colour is persona-level and is saved as soon as it is applied.
      const colourSave = waitForResponseWithStatus(
        page,
        isLayoutSave,
        [200, 201]
      );
      await customizeHome.getByTestId('apply-btn').click();
      const response = await colourSave;

      expect(response.request().postData()).toContain('#099250');
      await expect(customizeHome).not.toBeVisible();

      await page.reload();
      await page
        .getByTestId('customize-landing-page-header')
        .getByTestId('add-widget-button')
        .click();
      await customizeHome.getByTestId('sidebar-option-header-theme').click();

      await expect(
        customizeHome.getByRole('button', { name: 'Green' })
      ).toHaveAttribute('aria-pressed', 'true');
    });

    test('Home page: a configured Curated Assets widget is saved', async ({
      page,
    }) => {
      const widgetTitle = `PW Curated ${uuid()}`;

      await openPersonaSettings(
        page,
        personas.curated.data.name,
        '/customize/LandingPage'
      );

      await test.step('add the Curated Assets placeholder', async () => {
        await page
          .getByTestId('customize-landing-page-header')
          .getByTestId('add-widget-button')
          .click();
        const customizeHome = page.getByRole('dialog', {
          name: 'Customize Home',
        });
        await customizeHome.getByTestId('KnowledgePanel.CuratedAssets').click();
        await customizeHome.getByTestId('apply-btn').click();

        await expect(customizeHome).not.toBeVisible();
      });

      await test.step('configure it in the Create Widget modal', async () => {
        const widget = await waitForLandingPageWidget(
          page,
          'KnowledgePanel.CuratedAssets'
        );
        await widget.getByText('Create').click();

        await expect(
          page.getByTestId('curated-assets-modal-container')
        ).toBeVisible();

        await page.getByTestId('title-input').fill(widgetTitle);
        await selectAssetTypes(page, ['Table']);

        // Save needs a valid query: add one Display Name rule.
        const rule = page.getByTestId('query-builder-rule-0');
        await selectOption(
          page,
          rule.getByTestId('advanced-search-field-select'),
          'Display Name',
          true
        );
        await selectOption(
          page,
          rule.getByTestId('advanced-search-operator-select'),
          'Contains'
        );
        await rule
          .getByTestId('advanced-search-value')
          .locator('input')
          .fill('pw');

        await expect(page.getByTestId('saveButton')).toBeEnabled();
      });

      await test.step('saving the widget persists the layout', async () => {
        // The widget's Save writes the page layout straight away.
        await saveLayoutAndReload(page, 'saveButton', widgetTitle);

        await expect(
          await waitForLandingPageWidget(page, 'KnowledgePanel.CuratedAssets')
        ).toContainText(widgetTitle);
        await expect(page.getByTestId('save-button')).toBeDisabled();
      });
    });

    test('Data Assets → Table: a new tab is saved', async ({ page }) => {
      const tabName = `pw-tab-${uuid()}`;

      await openPersonaSettings(
        page,
        personas.table.data.name,
        '/customize/data-assets/Table'
      );
      await expect(page.getByTestId('customize-tab-card')).toBeVisible();

      await page
        .getByTestId('customize-tab-card')
        .getByRole('button', { name: 'Add Tab' })
        .click();
      const addTabDialog = page.getByRole('dialog', { name: 'Add Tab' });
      await addTabDialog.getByTestId('add-tab-input').fill(tabName);
      await addTabDialog
        .getByRole('button', { name: 'Add', exact: true })
        .click();

      await expect(addTabDialog).not.toBeVisible();

      await saveLayoutAndReload(page, 'save-button', tabName);

      await expect(page.getByTestId('customize-tab-card')).toContainText(
        tabName
      );
      await expect(page.getByTestId('save-button')).toBeDisabled();
    });

    test('Governance → Domain: the layout is saved', async ({ page }) => {
      await openPersonaSettings(
        page,
        personas.domain.data.name,
        '/customize/governance/Domain'
      );
      await expect(page.getByTestId('customize-tab-card')).toBeVisible();
      // A fresh persona has no saved layout, so the seeded default is unsaved.
      await expect(page.getByTestId('save-button')).toBeEnabled();

      await saveLayoutAndReload(page, 'save-button', 'Domain');

      await expect(page.getByTestId('customize-tab-card')).toBeVisible();
      await expect(page.getByTestId('save-button')).toBeDisabled();
    });
  }
);
