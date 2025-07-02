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
import { Page, test as setup } from '@playwright/test';
import {
  EDIT_DESCRIPTION_RULE,
  EDIT_GLOSSARY_TERM_RULE,
  EDIT_TAGS_RULE,
} from '../constant/permission';
import { AdminClass } from '../support/user/AdminClass';
import { UserClass } from '../support/user/UserClass';
import { getApiContext, uuid } from '../utils/common';
import { loginAsAdmin } from '../utils/initialSetup';

const adminFile = 'playwright/.auth/admin.json';
const dataConsumerFile = 'playwright/.auth/dataConsumer.json';
const dataStewardFile = 'playwright/.auth/dataSteward.json';
const editDescriptionFile = 'playwright/.auth/editDescription.json';
const editTagsFile = 'playwright/.auth/editTags.json';
const editGlossaryTermFile = 'playwright/.auth/editGlossaryTerm.json';
const ownerFile = 'playwright/.auth/owner.json';

const userUUID = uuid();

// Create and setup all users
const dataConsumer = new UserClass({
  firstName: 'PW ',
  lastName: `DataConsumer ${userUUID}`,
  email: `pw-data-consumer-${userUUID}@gmail.com`,
  password: 'User@OMD123',
});
const dataSteward = new UserClass({
  firstName: 'PW ',
  lastName: `DataSteward ${userUUID}`,
  email: `pw-data-steward-${userUUID}@gmail.com`,
  password: 'User@OMD123',
});
const editDescriptionUser = new UserClass({
  firstName: 'PW ',
  lastName: `EditDescription ${userUUID}`,
  email: `pw-edit-description-${userUUID}@gmail.com`,
  password: 'User@OMD123',
});
const editTagsUser = new UserClass({
  firstName: 'PW ',
  lastName: `EditTags ${userUUID}`,
  email: `pw-edit-tags-${userUUID}@gmail.com`,
  password: 'User@OMD123',
});
const editGlossaryTermUser = new UserClass({
  firstName: 'PW ',
  lastName: `EditGlossaryTerm ${userUUID}`,
  email: `pw-edit-glossary-term-${userUUID}@gmail.com`,
  password: 'User@OMD123',
});
const ownerUser = new UserClass({
  firstName: 'PW ',
  lastName: `Owner ${userUUID}`,
  email: `pw-owner-${userUUID}@gmail.com`,
  password: 'User@OMD123',
});

setup('authenticate all users', async ({ browser }) => {
  setup.setTimeout(120 * 1000);

  let adminPage: Page;

  try {
    // Create admin page and context
    adminPage = await browser.newPage();
    const admin = new AdminClass();
    await loginAsAdmin(adminPage, admin);
    const { apiContext, afterAction } = await getApiContext(adminPage);

    // Create all users, Using allSettled to avoid failing the setup if one of the users fails to create
    await Promise.allSettled([
      dataConsumer.create(apiContext, false),
      dataSteward.create(apiContext, false),
      editDescriptionUser.create(apiContext, false),
      editTagsUser.create(apiContext, false),
      editGlossaryTermUser.create(apiContext, false),
      ownerUser.create(apiContext, false),
    ]);

    // Set up roles and policies, Using allSettled to avoid failing the setup if one of the users fails to create
    await Promise.allSettled([
      dataConsumer.setDataConsumerRole(apiContext),
      dataSteward.setDataStewardRole(apiContext),
      editDescriptionUser.setCustomRulePolicy(
        apiContext,
        EDIT_DESCRIPTION_RULE,
        'PW%Edit-Description'
      ),
      editTagsUser.setCustomRulePolicy(
        apiContext,
        EDIT_TAGS_RULE,
        'PW%Edit-Tags'
      ),
      editGlossaryTermUser.setCustomRulePolicy(
        apiContext,
        EDIT_GLOSSARY_TERM_RULE,
        'PW%Edit-Glossary-Term'
      ),
      ownerUser.setDataConsumerRole(apiContext),
    ]);

    // Save admin state
    await adminPage.context().storageState({ path: adminFile });

    // Login and save states for all users in parallel
    const loginPromises = [
      { user: dataConsumer, file: dataConsumerFile },
      { user: dataSteward, file: dataStewardFile },
      { user: editDescriptionUser, file: editDescriptionFile },
      { user: editTagsUser, file: editTagsFile },
      { user: editGlossaryTermUser, file: editGlossaryTermFile },
      { user: ownerUser, file: ownerFile },
    ].map(async ({ user, file }) => {
      const page = await browser.newPage();
      try {
        await user.login(page);
        // Wait for successful navigation instead of network idle
        await page.waitForURL('**/my-data', { timeout: 15000 });
        await page.context().storageState({ path: file });
      } finally {
        await page.close();
      }
    });

    await Promise.all(loginPromises);

    await afterAction();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error during authentication setup:', error);

    throw error;
  } finally {
    // Admin page cleanup
    if (adminPage) {
      await adminPage.close();
    }
  }
});
