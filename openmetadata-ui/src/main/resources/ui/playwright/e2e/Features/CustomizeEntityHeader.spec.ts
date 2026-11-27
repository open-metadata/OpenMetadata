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
import { Browser, BrowserContext, Locator, Page } from '@playwright/test';
import { PageType } from '../../../src/generated/system/ui/page';
import { DOMAIN_TAGS } from '../../constant/config';
import { EntityTypeEndpoint } from '../../support/entity/Entity.interface';
import { TableClass } from '../../support/entity/TableClass';
import { installServerLoadReducers } from '../../support/fixtures/serverLoad';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { settleAll } from '../../utils/apiResponse';
import { uuid } from '../../utils/common';
import {
  createCustomPropertyForEntity,
  CustomPropertyTypeByName,
  removeCustomPropertyViaApi,
} from '../../utils/customProperty';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  createPersonaEntityHeaderDoc,
  deletePersonaDocument,
  setDefaultPersona,
} from '../../utils/persona';
import { captureRecoverableStorageState } from '../../utils/storageStateRecovery';
import { performUserLogin } from '../../utils/user';
import { waitForResponseWithStatus } from '../../utils/waitHelpers';
import { expect, test as base } from '../fixtures/pages';

type SessionState = Awaited<ReturnType<BrowserContext['storageState']>>;

// Filled by beforeAll once the persona user has signed in.
let viewerSession: SessionState;

const signInAndSaveSession = async (browser: Browser, user: UserClass) => {
  const { page, afterAction } = await performUserLogin(browser, user);
  const session = await captureRecoverableStorageState(page.context());
  await afterAction();

  return session;
};

const test = base.extend<{ personaUserPage: Page }>({
  personaUserPage: async ({ browser }, use) => {
    const context = await browser.newContext({ storageState: viewerSession });
    await installServerLoadReducers(context);
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

// The core Toggle's label sits over its switch input, so the label is what a click reaches.
const setSwitch = async (toggle: Locator, control: Locator, on: boolean) => {
  await expect(control).toBeChecked({ checked: !on });
  await toggle.click();
  await expect(control).toBeChecked({ checked: on });
};

const setInHeader = (panel: Locator, id: string, label: string, on: boolean) =>
  setSwitch(
    panel.getByTestId(`header-property-toggle-${id}`),
    panel.getByRole('switch', { name: `Show ${label} in header` }),
    on
  );

const setShowEmpty = (panel: Locator, on: boolean) =>
  setSwitch(
    panel.getByTestId('show-empty-header-properties'),
    panel.getByRole('switch', { name: 'Show empty properties' }),
    on
  );

const openCustomizeHeader = async (page: Page, persona: PersonaClass) => {
  await page.goto(
    `/customize-page/${encodeURIComponent(
      persona.responseData.fullyQualifiedName ?? persona.responseData.name
    )}/Table`,
    { waitUntil: 'domcontentloaded' }
  );
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('customize-header-button').click();
  const panel = page.getByRole('dialog', { name: 'Customize Header' });
  await expect(panel).toBeVisible();

  return panel;
};

test.describe(
  'Customize the entity header for a persona',
  { tag: [DOMAIN_TAGS.PLATFORM] },
  () => {
    let table: TableClass;
    let viewer: UserClass;
    // Customized through the customize page by the tests below.
    let editorPersona: PersonaClass;
    // Holds a header written through the API, for the persona user's view.
    let viewerPersona: PersonaClass;
    let propertyName: string;
    let propertyValue: string;

    test.beforeAll(
      'Create the personas, the persona user and a table with a custom property',
      async ({ browser }) => {
        test.setTimeout(120_000);
        const { apiContext, afterAction } = await performAdminLogin(browser);
        table = new TableClass();
        viewer = new UserClass();
        editorPersona = new PersonaClass();
        viewerPersona = new PersonaClass();
        propertyValue = `pw-header-value-${uuid()}`;

        await settleAll([
          table.create(apiContext),
          viewer.create(apiContext),
          editorPersona.create(apiContext),
        ]);
        await viewerPersona.create(apiContext, [viewer.responseData.id]);

        const { customProperties } = await createCustomPropertyForEntity(
          apiContext,
          EntityTypeEndpoint.Table,
          [CustomPropertyTypeByName.STRING]
        );
        propertyName = Object.values(customProperties)[0].property.name;

        // The persona user owns the table, so it may edit the custom property.
        await table.patch({
          apiContext,
          patchData: [
            {
              op: 'add',
              path: '/extension',
              value: { [propertyName]: propertyValue },
            },
            {
              op: 'add',
              path: '/owners',
              value: [{ id: viewer.responseData.id, type: 'user' }],
            },
          ],
        });
        await createPersonaEntityHeaderDoc(
          apiContext,
          viewerPersona,
          PageType.Table,
          {
            properties: [`extension.${propertyName}`, 'tier', 'domains'],
            showEmptyProperties: false,
          }
        );
        await setDefaultPersona(apiContext, viewer, viewerPersona);
        viewerSession = await signInAndSaveSession(browser, viewer);

        await afterAction();
      }
    );

    test.afterAll('Remove the test data', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);
      await settleAll([
        deletePersonaDocument(apiContext, editorPersona),
        deletePersonaDocument(apiContext, viewerPersona),
        table.delete(apiContext),
      ]);
      await removeCustomPropertyViaApi(apiContext, 'table', propertyName);
      await viewer.delete(apiContext);
      await settleAll([
        editorPersona.delete(apiContext),
        viewerPersona.delete(apiContext),
      ]);
      await afterAction();
    });

    test('pins, reorders and saves the header properties of a persona', async ({
      page,
    }) => {
      const customId = `extension.${propertyName}`;
      const panel = await openCustomizeHeader(page, editorPersona);
      const pinned = (id: string) =>
        panel.getByTestId(`pinned-header-property-${id}`);
      const unpinned = (id: string) =>
        panel.getByTestId(`unpinned-header-property-${id}`);

      await test.step('the Custom filter lists the custom property outside the header', async () => {
        await panel.getByTestId('header-property-filter-custom').click();

        await expect(unpinned(customId)).toBeVisible();
        await expect(pinned('owners')).not.toBeAttached();

        await panel.getByTestId('header-property-filter-all').click();

        await expect(pinned('owners')).toBeVisible();
      });

      await test.step('search finds the custom property and pins it last', async () => {
        await panel.getByTestId('header-property-search').fill(propertyName);

        await expect(unpinned(customId)).toBeVisible();
        await expect(pinned('owners')).not.toBeAttached();

        await setInHeader(panel, customId, propertyName, true);
        await panel.getByTestId('header-property-search').fill('');

        await expect(pinned(customId)).toContainText(/^12(?!\d)/);
      });

      await test.step('the keyboard moves it to the top of the header', async () => {
        // A key press first puts react-aria in keyboard mode, where Enter on the handle
        // starts a keyboard drag rather than a press.
        await page.keyboard.press('Shift');
        await pinned(customId)
          .getByRole('button', { name: `Move the ${propertyName}` })
          .focus();
        await page.keyboard.press('Enter');

        await expect(page.locator(':focus')).toHaveAttribute(
          'aria-roledescription',
          'drop indicator'
        );

        await page.keyboard.press('Home');
        await expect(page.locator(':focus')).toHaveAttribute(
          'aria-label',
          'Insert before Domains'
        );
        await page.keyboard.press('Enter');

        await expect(pinned(customId)).toContainText(/^1(?!\d)/);
        await expect(pinned('domains')).toContainText(/^2(?!\d)/);
      });

      await test.step('unpin Owners, hide empty properties and apply', async () => {
        await setInHeader(panel, 'owners', 'Owners', false);
        await setShowEmpty(panel, false);

        await expect(unpinned('owners')).toBeVisible();

        await panel.getByTestId('apply-header-properties').click();

        await expect(panel).not.toBeAttached();

        const preview = page.getByTestId('data-asset-header-metadata');

        await expect(preview.getByTestId('header-property-type')).toBeVisible();
        await expect(
          preview.getByTestId('header-property-owners')
        ).not.toBeAttached();
      });

      await test.step('the saved header comes back after a reload', async () => {
        const save = waitForResponseWithStatus(
          page,
          (response) =>
            response.url().includes('/api/v1/docStore') &&
            ['POST', 'PATCH'].includes(response.request().method()),
          [200, 201]
        );
        await page.getByTestId('save-button').click();
        await save;

        const reopened = await openCustomizeHeader(page, editorPersona);

        await expect(
          reopened.getByTestId(`pinned-header-property-${customId}`)
        ).toContainText(/^1(?!\d)/);
        await expect(
          reopened.getByTestId('unpinned-header-property-owners')
        ).toBeVisible();
        await expect(
          reopened.getByRole('switch', { name: 'Show empty properties' })
        ).not.toBeChecked();
      });
    });

    test('the persona sees its header and edits the pinned custom property', async ({
      personaUserPage,
    }) => {
      const newValue = `pw-header-edited-${uuid()}`;
      await table.visitEntityPage(personaUserPage);
      const header = personaUserPage.getByTestId('data-asset-header-metadata');
      const property = header.getByTestId(
        `header-custom-property-${propertyName}`
      );

      await test.step('only the pinned properties with a value show', async () => {
        await expect(property).toContainText(propertyValue);
        await expect(
          header.getByTestId('header-property-tier')
        ).not.toBeAttached();
        await expect(
          header.getByTestId('header-property-owners')
        ).not.toBeAttached();
        await expect(
          header.getByTestId('header-properties-toggle')
        ).not.toBeAttached();
      });

      await test.step('the pencil edits the value, which survives a reload', async () => {
        await property.getByTestId('edit-custom-property-value').click();
        const dialog = personaUserPage.getByTestId(
          'custom-property-edit-modal'
        );
        await expect(dialog).toBeVisible();
        await dialog.getByTestId('value-input').fill(newValue);

        const patch = waitForResponseWithStatus(
          personaUserPage,
          (response) =>
            response
              .url()
              .includes(`/api/v1/tables/${table.entityResponseData.id}`) &&
            response.request().method() === 'PATCH',
          200
        );
        await dialog.getByTestId('inline-save-btn').click();
        await patch;

        await expect(property).toContainText(newValue);

        await personaUserPage.reload();
        await waitForAllLoadersToDisappear(personaUserPage);

        await expect(property).toContainText(newValue);
      });
    });
  }
);
