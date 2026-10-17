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

import { APIRequestContext, expect, Page } from '@playwright/test';
import { DOMAIN_TAGS } from '../../../constant/config';
import { installServerLoadReducers } from '../../../support/fixtures/serverLoad';
import { test as base } from '../../../support/fixtures/userPages';
import { PersonaClass } from '../../../support/persona/PersonaClass';
import { UserClass } from '../../../support/user/UserClass';
import {
  getWorkerAdminAPIContext,
  toastNotification,
} from '../../../utils/common';
import { redirectToAiModeHomePage } from '../../Utils/appMode';

// Each test gets its own persona and user, so a test starts from the default
// layout and nothing it saves can leak into another test. That keeps the tests
// independent: they run in parallel, and a failure in one neither skips the
// others nor spends their retry.
type PersonaFixture = { persona: PersonaClass; user: UserClass };

const toPersonaReference = (persona: PersonaClass) => ({
  id: persona.responseData.id,
  name: persona.responseData.name,
  displayName: persona.responseData.displayName,
  fullyQualifiedName: persona.responseData.fullyQualifiedName,
  type: 'persona',
});

// Fixtures share the test's 60s timeout by default, and `test.slow()` in a
// test body only applies once every fixture is ready. Creating the persona
// and user plus a sign-in can outlast 60s on CI, so each fixture gets its
// own budget, which does not count against the test's.
const FIXTURE_TIMEOUT = { timeout: 120_000 };

// The admin page (`adminPage`) drives the customization editor; `userPage`
// verifies the live persona sidebar.
const test = base.extend<{ personaData: PersonaFixture; userPage: Page }>({
  personaData: [
    // eslint-disable-next-line no-empty-pattern -- Seeded through the worker's admin API context, not a browser.
    async ({}, use) => {
      const apiContext = await getWorkerAdminAPIContext();
      const persona = new PersonaClass();
      const user = new UserClass();

      await persona.create(apiContext);
      await user.create(apiContext);

      // Make the persona this user's default so `selectedPersona` (and thus
      // `useCustomizedMainNav`) resolves to it on sign-in without extra UI steps.
      await user.patch({
        apiContext,
        patchData: [
          {
            op: 'add',
            path: '/personas/0',
            value: toPersonaReference(persona),
          },
          {
            op: 'add',
            path: '/defaultPersona',
            value: toPersonaReference(persona),
          },
        ],
      });

      await use({ persona, user });

      await user.delete(apiContext);
      await persona.delete(apiContext);
    },
    FIXTURE_TIMEOUT,
  ],
  userPage: [
    async ({ browser, personaData }, use) => {
      const page = await browser.newPage();
      // browser.newPage() bypasses the `context` fixture that installs these.
      await installServerLoadReducers(page.context());
      await personaData.user.signIn(page);
      await use(page);
      await page.close();
    },
    FIXTURE_TIMEOUT,
  ],
});

// A full app boot on the CI backend can outlast the default loader wait (a
// slow ingestion-pipeline status call holds it up), so give the boot longer
// than the default.
const APP_BOOT_TIMEOUT = 90_000;

// The customize page loads the persona from its URL, so open the editor
// directly rather than clicking through the persona page and its Customize UI
// tab — one app boot and no client-side route change to wait on.
const openAppModeSidebarCustomizePage = async (
  page: Page,
  persona: PersonaClass
) => {
  await page.goto(
    `/customize-page/${encodeURIComponent(
      persona.data.name
    )}/askCollateSidebar`,
    { waitUntil: 'domcontentloaded' }
  );
  // The switches render only once the persona's layout has loaded.
  await expect(page.getByTestId('ask-sidebar-switch-home')).toBeVisible({
    timeout: APP_BOOT_TIMEOUT,
  });
};

const saveAppModeSidebarCustomization = async (page: Page) => {
  const saveResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/docStore') &&
      ['POST', 'PATCH'].includes(response.request().method())
  );
  await page.getByTestId('save-button').click();
  await saveResponse;

  await toastNotification(
    page,
    /^Page layout (created|updated) successfully\.$/
  );
};

// The OSS modules in `navOrder`. All of them fit within the default visible
// count, so the default layout renders every one directly and nothing under
// "More".
const DEFAULT_NAV_KEYS = [
  'home',
  'explore',
  'lineage',
  'connections',
  'observability',
  'govern',
  'marketplace',
  'context-center',
];

const toNavigationItem = (id: string) => ({
  id,
  pageId: id,
  title: id,
  isHidden: false,
});

// Seed the layout the editor persists after Context Center is dragged under
// "More". Every item is listed: the editor starts unlisted items hidden.
const seedSidebarWithContextCenterUnderMore = async (
  apiContext: APIRequestContext,
  persona: PersonaClass
) => {
  const personaFqn =
    persona.responseData.fullyQualifiedName ?? persona.responseData.name;
  const response = await apiContext.post('/api/v1/docStore', {
    data: {
      name: `${persona.responseData.name}-${personaFqn}`,
      fullyQualifiedName: `persona.${personaFqn}`,
      entityType: 'Page',
      data: {
        askCollateSidebar: [
          ...DEFAULT_NAV_KEYS.filter((key) => key !== 'context-center').map(
            toNavigationItem
          ),
          {
            ...toNavigationItem('more'),
            children: [toNavigationItem('context-center')],
          },
        ],
      },
    },
  });

  expect(response.ok(), await response.text()).toBeTruthy();
};

test.describe(
  'App mode sidebar persona customization',
  { tag: [DOMAIN_TAGS.PLATFORM] },
  () => {
    test("hiding an item removes it from that persona's live sidebar", async ({
      adminPage: page,
      userPage,
      personaData,
    }) => {
      test.slow();

      await test.step('open the AI sidebar customize page for the persona', async () => {
        await openAppModeSidebarCustomizePage(page, personaData.persona);
      });

      await test.step('hide Explore and save', async () => {
        await page.getByTestId('ask-sidebar-switch-explore').click();
        await expect(page.getByTestId('save-button')).toBeEnabled();
        await saveAppModeSidebarCustomization(page);
      });

      await test.step('the persona sees Explore hidden and Home still visible', async () => {
        await redirectToAiModeHomePage(userPage);

        await expect(userPage.getByTestId('ask-nav-item-home')).toBeVisible();
        await expect(userPage.getByTestId('ask-nav-item-explore')).toHaveCount(
          0
        );
      });
    });

    // The empty default "More" group renders no trigger. This locks the
    // shipped default order/visibility; the editor -> live round-trip is
    // covered by the hide tests, and the tree serialization by the Jest specs.
    test('the default persona sidebar shows every default item visible in order, with no More trigger', async ({
      userPage,
    }) => {
      test.slow();

      await redirectToAiModeHomePage(userPage);

      const visibleNav = userPage.getByTestId('ask-main-panel-nav');
      await expect(visibleNav).toBeVisible();

      // Exclude the "More" trigger itself: it shares the `ask-nav-item-` prefix.
      const visibleItemKeys = await visibleNav
        .getByTestId(/^ask-nav-item-(?!more$)/)
        .evaluateAll((nodes) =>
          nodes.map((node) =>
            node.getAttribute('data-testid')?.replace('ask-nav-item-', '')
          )
        );

      expect(visibleItemKeys).toEqual(DEFAULT_NAV_KEYS);
      await expect(userPage.getByTestId('ask-nav-item-more')).toHaveCount(0);
    });

    // The "More" node is a normal, hideable item. Hiding it removes the whole
    // overflow group from the live sidebar — the trigger disappears and its
    // children become inaccessible — while the top-level items stay.
    test('hiding the More node removes the overflow trigger from the live sidebar', async ({
      adminPage: page,
      userPage,
      personaData,
    }) => {
      test.slow();

      await seedSidebarWithContextCenterUnderMore(
        await getWorkerAdminAPIContext(),
        personaData.persona
      );

      await test.step('the persona sees Context Center under the More overflow group', async () => {
        await redirectToAiModeHomePage(userPage);

        await expect(
          userPage.getByTestId('ask-nav-item-context-center')
        ).toHaveCount(0);
        await userPage.getByTestId('ask-nav-item-more').click();
        await expect(
          userPage.getByTestId('ask-more-nav-item-context-center')
        ).toBeVisible();
      });

      await test.step('toggle the More node off and save', async () => {
        await openAppModeSidebarCustomizePage(page, personaData.persona);
        await page.getByTestId('ask-sidebar-switch-more').click();
        await expect(page.getByTestId('save-button')).toBeEnabled();
        await saveAppModeSidebarCustomization(page);
      });

      await test.step('the persona no longer sees the More trigger or its overflow items', async () => {
        await redirectToAiModeHomePage(userPage);

        await expect(userPage.getByTestId('ask-main-panel-nav')).toBeVisible();
        await expect(userPage.getByTestId('ask-nav-item-more')).toHaveCount(0);
        await expect(
          userPage.getByTestId('ask-nav-item-context-center')
        ).toHaveCount(0);
        await expect(userPage.getByTestId('ask-nav-item-home')).toBeVisible();
        await expect(
          userPage.getByTestId('ask-nav-item-observability')
        ).toBeVisible();
      });
    });
  }
);
