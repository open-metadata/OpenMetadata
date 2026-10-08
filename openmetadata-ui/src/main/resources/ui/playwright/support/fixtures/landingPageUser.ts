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
import {
  APIRequestContext,
  Browser,
  BrowserContext,
  Page,
} from '@playwright/test';
import { okJson } from '../../utils/apiResponse';
import {
  disableEtagConditionalReads,
  getWorkerAdminAPIContext,
} from '../../utils/common';
import { PersonaClass } from '../persona/PersonaClass';
import { UserClass } from '../user/UserClass';
import { test as base } from './base';
import { installServerLoadReducers } from './serverLoad';

/**
 * A landing-page viewer whose layout nobody else can change.
 *
 * The home page renders whatever layout `currentUser.defaultPersona` resolves
 * to. Signed in as the shared admin, that is whichever persona another spec
 * (PersonaFlow, DomainWidgetFilter, CustomizeWidgets) most recently attached to
 * admin -- or the organisation's default persona, which those specs can also
 * set -- so a landing spec could find widgets missing, added, or moved by a
 * test it shares nothing with.
 *
 * The account here gets a persona of its own, attached as its default, with no
 * saved landing-page document. With no document the page falls back to
 * `DEFAULT_LANDING_PAGE_LAYOUT`, so these specs see exactly the default layout
 * every time, and the only writer of that persona is the spec using it.
 */
export interface LandingPageAccount {
  user: UserClass;
  persona: PersonaClass;
}

export interface LandingPageAccountOptions {
  /** Grant the account admin. Defaults to a plain DataConsumer. */
  isAdmin?: boolean;
  /** Further roles to attach, e.g. one carrying a deny policy. */
  roles?: { id: string; type: 'role'; name: string }[];
}

type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>;

export const createLandingPageAccount = async (
  apiContext: APIRequestContext,
  { isAdmin = false, roles = [] }: LandingPageAccountOptions = {}
): Promise<LandingPageAccount> => {
  const user = new UserClass(undefined, isAdmin);
  await user.create(apiContext);

  const persona = new PersonaClass();
  await persona.create(apiContext, [user.responseData.id]);

  const personaReference = {
    id: persona.responseData.id,
    type: 'persona',
    name: persona.responseData.name,
    fullyQualifiedName: persona.responseData.fullyQualifiedName,
  };

  await okJson(
    await apiContext.patch(`/api/v1/users/${user.responseData.id}`, {
      data: [
        { op: 'add', path: '/defaultPersona', value: personaReference },
        ...roles.map((role) => ({ op: 'add', path: '/roles/-', value: role })),
      ],
      headers: { 'Content-Type': 'application/json-patch+json' },
    }),
    'Landing page account default persona'
  );

  return { user, persona };
};

export const deleteLandingPageAccount = async (
  apiContext: APIRequestContext,
  { user, persona }: LandingPageAccount
) => {
  await persona.delete(apiContext);
  await user.delete(apiContext);
};

const preparePage = async (page: Page) => {
  await installServerLoadReducers(page.context());
  await disableEtagConditionalReads(page);

  return page;
};

/** A fresh page signed in as `account`, for a test-scoped account. */
export const openLandingPageAccountPage = async (
  browser: Browser,
  account: LandingPageAccount
) => {
  const page = await preparePage(await browser.newPage());
  await account.user.signIn(page);

  return page;
};

export type LandingPageTestFixtures = {
  /** Signed in as the worker's landing-page admin. */
  page: Page;
  landingPageUser: UserClass;
  landingPagePersona: PersonaClass;
};

export type LandingPageWorkerFixtures = {
  landingPageSession: LandingPageAccount & { storageState: StorageState };
};

/**
 * `page` is an admin signed in as the worker's own landing-page account.
 *
 * Worker-scoped because nothing in these specs writes to the account or its
 * persona -- collapse and list/grid state are not persisted -- so one sign-in
 * per worker is enough, and each test still gets its own page. A spec that
 * edits the layout must not use this fixture: create a per-test account with
 * `createLandingPageAccount` instead (see CustomizeWidgets.spec.ts).
 */
export const test = base.extend<
  LandingPageTestFixtures,
  LandingPageWorkerFixtures
>({
  landingPageSession: [
    async ({ browser }, use) => {
      const apiContext = await getWorkerAdminAPIContext();
      const account = await createLandingPageAccount(apiContext, {
        isAdmin: true,
      });

      try {
        const loginPage = await preparePage(await browser.newPage());
        let storageState: StorageState;

        try {
          await account.user.signIn(loginPage);
          storageState = await loginPage
            .context()
            .storageState({ indexedDB: true });
        } finally {
          await loginPage.close();
        }

        await use({ ...account, storageState });
      } finally {
        await deleteLandingPageAccount(apiContext, account);
      }
    },
    { scope: 'worker' },
  ],

  landingPageUser: async ({ landingPageSession }, use) => {
    await use(landingPageSession.user);
  },

  landingPagePersona: async ({ landingPageSession }, use) => {
    await use(landingPageSession.persona);
  },

  page: async ({ browser, landingPageSession }, use) => {
    const page = await preparePage(
      await browser.newPage({ storageState: landingPageSession.storageState })
    );

    await use(page);
    await page.close();
  },
});

export { expect } from '@playwright/test';
