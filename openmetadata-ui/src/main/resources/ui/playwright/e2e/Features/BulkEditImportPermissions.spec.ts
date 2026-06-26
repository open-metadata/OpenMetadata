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
import { Page } from '@playwright/test';
import { PolicyClass } from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { TableClass } from '../../support/entity/TableClass';
import { Glossary } from '../../support/glossary/Glossary';
import { GlossaryTerm } from '../../support/glossary/GlossaryTerm';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { redirectToHomePage, uuid } from '../../utils/common';
import { verifyPageAccess } from '../../utils/testCases';
import { test as base } from '../fixtures/pages';

// Bulk edit & import for every supported entity is gated by EntityImportRouter,
// which renders the page only when the resolved entity permission has EditAll
// and otherwise redirects to 404. These specs assert that gate end-to-end: a
// user with EditAll reaches every bulk edit/import page, while Data Consumer,
// Data Steward and view-only users are blocked from all of them.

const BULK_EDIT_RESOURCES = [
  'glossary',
  'glossaryTerm',
  'table',
  'database',
  'databaseSchema',
  'databaseService',
];

const BULK_EDIT_RULES = [
  {
    name: `bulk-edit-editor-${uuid()}`,
    resources: BULK_EDIT_RESOURCES,
    operations: ['ViewAll', 'ViewBasic', 'Create', 'EditAll', 'Delete'],
    effect: 'allow',
  },
  {
    name: `bulk-edit-view-all-${uuid()}`,
    resources: ['all'],
    operations: ['ViewAll'],
    effect: 'allow',
  },
];

const editorUser = new UserClass();
const editorPolicy = new PolicyClass();
const editorRole = new RolesClass();
const glossary = new Glossary();
const glossaryTerm = new GlossaryTerm(glossary);
const table = new TableClass();

const test = base.extend<{ bulkEditorPage: Page }>({
  bulkEditorPage: async ({ browser }, use) => {
    const page = await browser.newPage();
    await editorUser.login(page);
    await use(page);
    await page.close();
  },
});

const requireFqn = (value: string | undefined, label: string): string => {
  if (!value) {
    throw new Error(`Missing fullyQualifiedName for ${label}`);
  }

  return value;
};

const getBulkEntities = () => [
  {
    type: 'glossary',
    fqn: requireFqn(glossary.responseData.fullyQualifiedName, 'glossary'),
  },
  {
    type: 'glossaryTerm',
    fqn: requireFqn(
      glossaryTerm.responseData.fullyQualifiedName,
      'glossaryTerm'
    ),
  },
  {
    type: 'table',
    fqn: requireFqn(table.entityResponseData.fullyQualifiedName, 'table'),
  },
  {
    type: 'database',
    fqn: requireFqn(table.databaseResponseData.fullyQualifiedName, 'database'),
  },
  {
    type: 'databaseSchema',
    fqn: requireFqn(
      table.schemaResponseData.fullyQualifiedName,
      'databaseSchema'
    ),
  },
  {
    type: 'databaseService',
    fqn: requireFqn(
      table.serviceResponseData.fullyQualifiedName,
      'databaseService'
    ),
  },
];

const bulkEditUrl = (type: string, fqn: string) =>
  `/bulk/edit/${type}/${encodeURIComponent(fqn)}`;

const bulkImportUrl = (type: string, fqn: string) =>
  `/bulk/import/${type}/${encodeURIComponent(fqn)}`;

const verifyAllBulkRoutes = async (page: Page, shouldHaveAccess: boolean) => {
  for (const { type, fqn } of getBulkEntities()) {
    await verifyPageAccess(page, bulkEditUrl(type, fqn), shouldHaveAccess);
    await verifyPageAccess(page, bulkImportUrl(type, fqn), shouldHaveAccess);
  }
};

test.describe('Bulk Edit / Import - Non-admin permissions', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await glossary.create(apiContext);
    await glossaryTerm.create(apiContext);
    await table.create(apiContext);
    await editorUser.create(apiContext, false);
    const policyResponse = await editorPolicy.create(
      apiContext,
      BULK_EDIT_RULES
    );
    const roleResponse = await editorRole.create(apiContext, [
      policyResponse.name,
    ]);
    await editorUser.patch({
      apiContext,
      patchData: [
        {
          op: 'add',
          path: '/roles/0',
          value: {
            id: roleResponse.id,
            type: 'role',
            name: roleResponse.name,
          },
        },
      ],
    });
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    test.setTimeout(120_000);
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await table.delete(apiContext);
    await glossary.delete(apiContext);
    await editorUser.delete(apiContext);
    await editorRole.delete(apiContext);
    await editorPolicy.delete(apiContext);
    await afterAction();
  });

  test('Editor with EditAll can access every bulk edit and import page', async ({
    bulkEditorPage,
  }) => {
    test.setTimeout(150_000);
    await redirectToHomePage(bulkEditorPage);
    await verifyAllBulkRoutes(bulkEditorPage, true);
  });

  test('Data Consumer is blocked from every bulk edit and import page', async ({
    dataConsumerPage,
  }) => {
    test.setTimeout(150_000);
    await redirectToHomePage(dataConsumerPage);
    await verifyAllBulkRoutes(dataConsumerPage, false);
  });

  test('Data Steward is blocked from every bulk edit and import page', async ({
    dataStewardPage,
  }) => {
    test.setTimeout(150_000);
    await redirectToHomePage(dataStewardPage);
    await verifyAllBulkRoutes(dataStewardPage, false);
  });

  test('View-only user is blocked from every bulk edit and import page', async ({
    viewOnlyPage,
  }) => {
    test.setTimeout(150_000);
    await redirectToHomePage(viewOnlyPage);
    await verifyAllBulkRoutes(viewOnlyPage, false);
  });
});
