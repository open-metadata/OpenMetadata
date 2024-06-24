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
  performAdminLogin,
  performUserLogin,
  redirectToHomePage,
} from '../../utils/common';
import {
  approveGlossaryTermTask,
  createGlossary,
  createGlossaryTerms,
  selectActiveGlossary,
  validateGlossaryTerm,
  verifyGlossaryDetails,
} from '../../utils/glossary';
import { sidebarClick } from '../../utils/sidebar';

const user1 = new UserClass();
const user2 = new UserClass();
const team = new TeamClass();

test.describe('Glossary tests', () => {
  test.beforeAll(async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);
    await user2.create(apiContext);
    await user1.create(apiContext);
    team.data.users = [user2.responseData.id];
    await team.create(apiContext);
    await afterAction();
  });

  test('Glossary & terms creation for reviewer as user', async ({
    browser,
  }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const { page: page1, afterAction: afterActionUser1 } =
      await performUserLogin(browser, user1);
    const glossary1 = new Glossary();
    glossary1.data.owner = { name: 'admin', type: 'user' };
    glossary1.data.mutuallyExclusive = true;
    glossary1.data.reviewers = [{ name: user1.getUserName(), type: 'user' }];
    glossary1.data.terms = [new GlossaryTerm(glossary1)];

    await test.step('Create Glossary', async () => {
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await createGlossary(page, glossary1.data, false);
      await verifyGlossaryDetails(page, glossary1.data);
    });

    await test.step('Create Glossary Terms', async () => {
      await sidebarClick(page, SidebarItem.GLOSSARY);
      await createGlossaryTerms(page, glossary1.data);
    });

    await test.step('Approve Glossary Term from Glossary Listing', async () => {
      await redirectToHomePage(page1);
      await sidebarClick(page1, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page1, glossary1.data.name);

      await approveGlossaryTermTask(page1, glossary1.data.terms[0].data);
      await redirectToHomePage(page1);
      await sidebarClick(page1, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page1, glossary1.data.name);
      await validateGlossaryTerm(
        page1,
        glossary1.data.terms[0].data,
        'Approved'
      );

      await afterActionUser1();
    });

    await glossary1.delete(apiContext);
    await afterAction();
  });

  test('Glossary & terms creation for reviewer as team', async ({
    browser,
  }) => {
    const { page, afterAction, apiContext } = await performAdminLogin(browser);
    const { page: page1, afterAction: afterActionUser1 } =
      await performUserLogin(browser, user2);

    const glossary2 = new Glossary();
    glossary2.data.owner = { name: 'admin', type: 'user' };
    glossary2.data.reviewers = [{ name: team.data.displayName, type: 'team' }];
    glossary2.data.terms = [new GlossaryTerm(glossary2)];

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

    await test.step('Approve Glossary Term from Glossary Listing', async () => {
      await redirectToHomePage(page1);
      await sidebarClick(page1, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page1, glossary2.data.name);
      await approveGlossaryTermTask(page1, glossary2.data.terms[0].data);

      await redirectToHomePage(page1);
      await sidebarClick(page1, SidebarItem.GLOSSARY);
      await selectActiveGlossary(page1, glossary2.data.name);
      await validateGlossaryTerm(
        page1,
        glossary2.data.terms[0].data,
        'Approved'
      );

      await afterActionUser1();
    });

    await glossary2.delete(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);
    await user1.delete(apiContext);
    await user2.delete(apiContext);
    await team.delete(apiContext);
    await afterAction();
  });
});
