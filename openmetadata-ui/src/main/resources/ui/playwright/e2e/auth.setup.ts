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
  let dataConsumerPage: Page;
  let dataStewardPage: Page;
  let editDescriptionPage: Page;
  let editTagsPage: Page;
  let editGlossaryTermPage: Page;
  let ownerPage: Page;

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

    // Create separate pages for each user
    const [
      dataConsumerPage,
      dataStewardPage,
      editDescriptionPage,
      editTagsPage,
      editGlossaryTermPage,
      ownerPage,
    ] = await Promise.all([
      browser.newPage(),
      browser.newPage(),
      browser.newPage(),
      browser.newPage(),
      browser.newPage(),
      browser.newPage(),
    ]);

    // Save states for each user sequentially to avoid file operation conflicts
    await dataConsumer.login(dataConsumerPage);
    await dataConsumerPage.waitForLoadState('networkidle');
    await dataConsumerPage.context().storageState({ path: dataConsumerFile });

    await dataSteward.login(dataStewardPage);
    await dataStewardPage.waitForLoadState('networkidle');
    await dataStewardPage.context().storageState({ path: dataStewardFile });

    await editDescriptionUser.login(editDescriptionPage);
    await editDescriptionPage.waitForLoadState('networkidle');
    await editDescriptionPage
      .context()
      .storageState({ path: editDescriptionFile });

    await editTagsUser.login(editTagsPage);
    await editTagsPage.waitForLoadState('networkidle');
    await editTagsPage.context().storageState({ path: editTagsFile });

    await editGlossaryTermUser.login(editGlossaryTermPage);
    await editGlossaryTermPage.waitForLoadState('networkidle');
    await editGlossaryTermPage
      .context()
      .storageState({ path: editGlossaryTermFile });

    await ownerUser.login(ownerPage);
    await ownerPage.waitForLoadState('networkidle');
    await ownerPage.context().storageState({ path: ownerFile });

    await afterAction();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error during authentication setup:', error);

    throw error;
  } finally {
    // Close pages sequentially to avoid conflicts
    if (dataConsumerPage) {
      await dataConsumerPage.close();
    }
    if (dataStewardPage) {
      await dataStewardPage.close();
    }
    if (editDescriptionPage) {
      await editDescriptionPage.close();
    }
    if (editTagsPage) {
      await editTagsPage.close();
    }
    if (editGlossaryTermPage) {
      await editGlossaryTermPage.close();
    }
    if (ownerPage) {
      await ownerPage.close();
    }
  }
});
