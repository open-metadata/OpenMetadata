/*
 *  Copyright 2024 Collate.
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
import test from '@playwright/test';
import { SidebarItem } from '../../constant/sidebar';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { TeamClass } from '../../support/team/TeamClass';
import { UserClass } from '../../support/user/UserClass';
import {
  createNewPage,
  getApiContext,
  redirectToHomePage,
} from '../../utils/common';
import {
  createGlossary,
  createGlossaryTerms,
  verifyGlossaryDetails,
} from '../../utils/glossary';
import { sidebarClick } from '../../utils/sidebar';

// use the admin user to login
test.use({ storageState: 'playwright/.auth/admin.json' });

const user1 = new UserClass();
const user2 = new UserClass();
const team = new TeamClass();

const glossary1 = new Glossary();
glossary1.data.owner = { name: 'admin', type: 'user' };
glossary1.data.mutuallyExclusive = true;
glossary1.data.reviewers = [{ name: user1.getUserName(), type: 'user' }];

glossary1.data.terms = [
  new GlossaryTerm(glossary1),
  new GlossaryTerm(glossary1),
  new GlossaryTerm(glossary1),
];

const glossary2 = new Glossary();
glossary2.data.owner = { name: 'admin', type: 'user' };
glossary2.data.reviewers = [{ name: team.data.displayName, type: 'team' }];

glossary2.data.terms = [
  new GlossaryTerm(glossary2),
  new GlossaryTerm(glossary2),
];

test.beforeAll(async ({ browser }) => {
  const { afterAction, apiContext } = await createNewPage(browser);
  await user1.create(apiContext);
  await user2.create(apiContext);
  await team.create(apiContext);
  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
});

test('Glossary & terms creation for reviewer as user', async ({ page }) => {
  const { afterAction, apiContext } = await getApiContext(page);

  await test.step('Create Glossary', async () => {
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await createGlossary(page, glossary2.data, false);
    await verifyGlossaryDetails(page, glossary2.data);
  });

  await test.step('Create Glossary Terms', async () => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await createGlossaryTerms(page, glossary2.data);
  });

  await glossary1.delete(apiContext);
  await afterAction();
});

test('Glossary & terms creation for reviewer as team', async ({ page }) => {
  const { afterAction, apiContext } = await getApiContext(page);

  await test.step('Create Glossary', async () => {
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await createGlossary(page, glossary2.data, false);
    await verifyGlossaryDetails(page, glossary2.data);
  });

  await test.step('Create Glossary Terms', async () => {
    await redirectToHomePage(page);
    await sidebarClick(page, SidebarItem.GLOSSARY);
    await createGlossaryTerms(page, glossary2.data);
  });

  await glossary2.delete(apiContext);
  await afterAction();
});

test.afterAll(async ({ browser }) => {
  const { afterAction, apiContext } = await createNewPage(browser);

  await user1.delete(apiContext);
  await user2.delete(apiContext);
  await team.delete(apiContext);

  await afterAction();
});
