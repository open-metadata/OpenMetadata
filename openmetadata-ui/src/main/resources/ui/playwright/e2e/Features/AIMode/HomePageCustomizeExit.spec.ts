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
 * In AI mode the home page's Customize button opens the standalone
 * `/customize-page/<persona>/LandingPage` route. Closing it must return to the
 * home page — asking first when there are unsaved changes — and must never
 * open the settings modal over the editor.
 */

import { expect, Page, Response } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { test as isolatedUserTest } from '../../../support/fixtures/isolatedUser';
import { PersonaClass } from '../../../support/persona/PersonaClass';
import { getWorkerAdminAPIContext, uuid } from '../../../utils/common';
import { waitForResponseWithStatus } from '../../../utils/waitHelpers';
import { redirectToAiModeHomePage } from '../../Utils/appMode';

const toPersonaReference = (persona: PersonaClass) => ({
  id: persona.responseData.id,
  name: persona.responseData.name,
  displayName: persona.responseData.displayName,
  fullyQualifiedName: persona.responseData.fullyQualifiedName,
  type: 'persona',
});

// The home page offers Customize only to a user with a default persona, and
// that persona is server-side state on the user, so the user is the worker's
// isolated admin rather than the shared one.
const test = isolatedUserTest.extend<{ defaultPersona: PersonaClass }>({
  defaultPersona: async ({ isolatedUser }, use) => {
    const apiContext = await getWorkerAdminAPIContext();
    const id = uuid();
    const defaultPersona = new PersonaClass({
      name: `pw-home-exit-${id}`,
      displayName: `PW home exit ${id}`,
      description: 'playwright home customize exit',
      users: [],
    });
    await defaultPersona.create(apiContext);
    await isolatedUser.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/personas/0',
          value: toPersonaReference(defaultPersona),
        },
        {
          op: 'add',
          path: '/defaultPersona',
          value: toPersonaReference(defaultPersona),
        },
      ],
    });

    await use(defaultPersona);

    await defaultPersona.delete(apiContext);
  },
});

test.use({ isolatedUserOptions: { isAdmin: true } });

// The landing-page editor's widgets load before Save reflects the layout.
const CUSTOMIZE_BOOT_TIMEOUT = 60_000;

const isLayoutSave = (response: Response) =>
  response.url().includes('/api/v1/docStore') &&
  ['POST', 'PATCH'].includes(response.request().method());

const openHomeCustomize = async (page: Page, persona: PersonaClass) => {
  await redirectToAiModeHomePage(page);
  await page.getByTestId('customize-home-page').click();

  await expect(page).toHaveURL(
    new RegExp(`/customize-page/${persona.data.name}/LandingPage`)
  );
  // A fresh persona has no saved layout, so the seeded default is unsaved.
  await expect(page.getByTestId('save-button')).toBeEnabled({
    timeout: CUSTOMIZE_BOOT_TIMEOUT,
  });
};

const expectOnHomeWithoutSettings = async (page: Page) => {
  await expect(page.getByTestId('topics-to-catch-up-on')).toBeVisible();
  await expect(page).toHaveURL((url) => url.pathname === '/');
  await expect(page.getByTestId('ai-profile-page')).not.toBeVisible();
  await expect(page.getByTestId('unsaved-changes-modal')).not.toBeVisible();
};

test.describe(
  'Home page customize — closing returns to the home page',
  { tag: [DOMAIN_TAGS.PLATFORM] },
  () => {
    test('close without changes goes straight home', async ({
      isolatedUserPage: page,
      defaultPersona,
    }) => {
      test.slow();
      await openHomeCustomize(page, defaultPersona);

      // Save the seeded layout so the page has nothing left to lose.
      const saveResponse = waitForResponseWithStatus(
        page,
        isLayoutSave,
        [200, 201]
      );
      await page.getByTestId('save-button').click();
      await saveResponse;

      await expect(page.getByTestId('save-button')).toBeDisabled();

      await page.getByTestId('cancel-button').click();

      await expectOnHomeWithoutSettings(page);
    });

    test('close with unsaved changes asks, and Discard goes home', async ({
      isolatedUserPage: page,
      defaultPersona,
    }) => {
      test.slow();
      await openHomeCustomize(page, defaultPersona);

      await page.getByTestId('cancel-button').click();

      await expect(page.getByTestId('unsaved-changes-modal')).toBeVisible();
      await expect(page.getByTestId('ai-profile-page')).not.toBeVisible();

      await page.getByTestId('unsaved-changes-modal-discard').click();

      await expectOnHomeWithoutSettings(page);
    });
  }
);
