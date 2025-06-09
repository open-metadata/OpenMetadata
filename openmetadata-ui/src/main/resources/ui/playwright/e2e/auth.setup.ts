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
import { test as setup } from '@playwright/test';
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

setup('authenticate all users', async ({ browser }) => {
  // Set timeout to 5 minutes (300000ms) for this setup test
  setup.setTimeout(300000);

  let adminPage;
  let dataConsumerPage;
  let dataStewardPage;
  let editDescriptionPage;
  let editTagsPage;
  let editGlossaryTermPage;

  try {
    // Create admin page and context
    adminPage = await browser.newPage();
    const admin = new AdminClass();
    await loginAsAdmin(adminPage, admin);
    const { apiContext, afterAction } = await getApiContext(adminPage);

    // Create and setup all users
    const dataConsumer = new UserClass({
      firstName: 'PW ',
      lastName: 'DataConsumer',
      email: `pw-data-consumer-${uuid()}@gmail.com`,
      password: 'User@OMD123',
    });
    const dataSteward = new UserClass({
      firstName: 'PW ',
      lastName: 'DataSteward',
      email: `pw-data-steward-${uuid()}@gmail.com`,
      password: 'User@OMD123',
    });
    const editDescriptionUser = new UserClass({
      firstName: 'PW ',
      lastName: 'EditDescription',
      email: `pw-edit-description-${uuid()}@gmail.com`,
      password: 'User@OMD123',
    });
    const editTagsUser = new UserClass({
      firstName: 'PW ',
      lastName: 'EditTags',
      email: `pw-edit-tags-${uuid()}@gmail.com`,
      password: 'User@OMD123',
    });
    const editGlossaryTermUser = new UserClass({
      firstName: 'PW ',
      lastName: 'EditGlossaryTerm',
      email: `pw-edit-glossary-term-${uuid()}@gmail.com`,
      password: 'User@OMD123',
    });

    // Create all users
    await Promise.all([
      dataConsumer.create(apiContext, false),
      dataSteward.create(apiContext, false),
      editDescriptionUser.create(apiContext, false),
      editTagsUser.create(apiContext, false),
      editGlossaryTermUser.create(apiContext, false),
    ]);

    // Set up roles and policies
    await Promise.all([
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
    ] = await Promise.all([
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

    await afterAction();
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Error during authentication setup:', error);

    throw error;
  } finally {
    // Close pages sequentially to avoid conflicts
    if (adminPage) {
      await adminPage.close();
    }
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
  }
});
