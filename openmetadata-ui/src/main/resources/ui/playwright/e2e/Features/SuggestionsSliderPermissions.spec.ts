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
import { APIRequestContext, expect, Page, test } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import {
  PolicyClass,
  PolicyRulesType,
} from '../../support/access-control/PoliciesClass';
import { RolesClass } from '../../support/access-control/RolesClass';
import { TableClass } from '../../support/entity/TableClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { setupUserWithPolicy } from '../../utils/permission';

const VIEWER_RULES: PolicyRulesType[] = [
  {
    name: 'ViewAll-Rule',
    resources: ['All'],
    operations: ['ViewAll'],
    effect: 'allow',
  },
  {
    name: 'Edit-Deny-Rule',
    resources: ['All'],
    operations: ['EditAll', 'EditDescription', 'EditTags'],
    effect: 'deny',
  },
];

const DESCRIPTION_EDITOR_RULES: PolicyRulesType[] = [
  {
    name: 'ViewAll-Rule',
    resources: ['All'],
    operations: ['ViewAll'],
    effect: 'allow',
  },
  {
    name: 'EditDescription-Allow-Rule',
    resources: ['All'],
    operations: ['EditDescription'],
    effect: 'allow',
  },
  {
    name: 'EditTags-Deny-Rule',
    resources: ['All'],
    operations: ['EditAll', 'EditTags'],
    effect: 'deny',
  },
];

const adminUser = new UserClass();
const suggesterUser = new UserClass();
const viewerUser = new UserClass();
const descriptionEditorUser = new UserClass();
const viewerPolicy = new PolicyClass();
const viewerRole = new RolesClass();
const descriptionEditorPolicy = new PolicyClass();
const descriptionEditorRole = new RolesClass();
const mixedSuggestionsTable = new TableClass();
const descriptionOnlyTable = new TableClass();
const createdTaskIds: string[] = [];

const createSuggestionTask = async (
  apiContext: APIRequestContext,
  table: TableClass,
  payload: Record<string, string>
) => {
  const response = await apiContext.post('/api/v1/tasks', {
    data: {
      about: `<#E::table::${table.entityResponseData.fullyQualifiedName}>`,
      type: 'Suggestion',
      category: 'MetadataUpdate',
      assignees: [suggesterUser.responseData.name],
      payload: { source: 'Agent', ...payload },
    },
  });

  expect(response.ok()).toBe(true);

  const task = await response.json();
  createdTaskIds.push(task.id);
};

const openSuggesterSuggestions = async (page: Page, table: TableClass) => {
  const suggestionsResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/v1/tasks') &&
      response.url().includes('type=Suggestion') &&
      response.status() === 200
  );
  await table.visitEntityPage(page);
  await suggestionsResponse;
  await waitForAllLoadersToDisappear(page);

  const suggesterAvatar = page.getByTestId(
    `avatar-carousel-item-${suggesterUser.responseData.id}`
  );
  await expect(suggesterAvatar).toBeVisible();
  await suggesterAvatar.click();
  await expect(page.getByTestId('close-suggestion')).toBeVisible();
};

test.describe(
  'Suggestions slider bulk-action permissions',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test.beforeAll(
      'Setup users, tables and suggestions',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        try {
          await adminUser.create(apiContext);
          await adminUser.setAdminRole(apiContext);
          await suggesterUser.create(apiContext);
          await suggesterUser.setAdminRole(apiContext);
          await setupUserWithPolicy(
            apiContext,
            viewerUser,
            viewerPolicy,
            viewerRole,
            VIEWER_RULES
          );
          await setupUserWithPolicy(
            apiContext,
            descriptionEditorUser,
            descriptionEditorPolicy,
            descriptionEditorRole,
            DESCRIPTION_EDITOR_RULES
          );
          await mixedSuggestionsTable.create(apiContext);
          await descriptionOnlyTable.create(apiContext);
        } finally {
          await afterAction();
        }

        // Suggestions are created as the suggester so their avatar drives the carousel
        const suggesterPage = await browser.newPage();
        try {
          await suggesterUser.login(suggesterPage);
          const { apiContext: suggesterContext, afterAction: disposeContext } =
            await getApiContext(suggesterPage);

          try {
            await createSuggestionTask(
              suggesterContext,
              mixedSuggestionsTable,
              {
                suggestionType: 'Description',
                fieldPath: 'description',
                suggestedValue: 'Suggested description for the mixed table',
              }
            );
            await createSuggestionTask(
              suggesterContext,
              mixedSuggestionsTable,
              {
                suggestionType: 'Tag',
                fieldPath: 'tags',
                suggestedValue: JSON.stringify([
                  {
                    tagFQN: 'PersonalData.Personal',
                    source: 'Classification',
                    labelType: 'Manual',
                    state: 'Suggested',
                  },
                ]),
              }
            );
            await createSuggestionTask(suggesterContext, descriptionOnlyTable, {
              suggestionType: 'Description',
              fieldPath: 'description',
              suggestedValue: 'Suggested description for the description table',
            });
          } finally {
            await disposeContext();
          }
        } finally {
          await suggesterPage.close();
        }
      }
    );

    test.afterAll(
      'Cleanup users, tables and suggestions',
      async ({ browser }) => {
        const { apiContext, afterAction } = await performAdminLogin(browser);

        try {
          for (const taskId of createdTaskIds) {
            await apiContext
              .delete(`/api/v1/tasks/${taskId}?hardDelete=true`)
              .catch(() => undefined);
          }
          await descriptionOnlyTable.delete(apiContext);
          await mixedSuggestionsTable.delete(apiContext);
          await descriptionEditorRole.delete(apiContext);
          await descriptionEditorPolicy.delete(apiContext);
          await viewerRole.delete(apiContext);
          await viewerPolicy.delete(apiContext);
          await descriptionEditorUser.delete(apiContext);
          await viewerUser.delete(apiContext);
          await suggesterUser.delete(apiContext);
          await adminUser.delete(apiContext);
        } finally {
          await afterAction();
        }
      }
    );

    test('admin sees bulk accept and reject for every suggestion type', async ({
      page,
    }) => {
      test.slow();

      await adminUser.login(page);

      await test.step('Open the suggester suggestions', async () => {
        await openSuggesterSuggestions(page, mixedSuggestionsTable);
      });

      await test.step('Bulk actions are available', async () => {
        const acceptAllButton = page.getByTestId('accept-all-suggestions');
        const rejectAllButton = page.getByTestId('reject-all-suggestions');

        await expect(acceptAllButton).toBeVisible();
        await expect(acceptAllButton).toBeEnabled();
        await expect(rejectAllButton).toBeVisible();
        await expect(rejectAllButton).toBeEnabled();
      });
    });

    test('user without edit permission keeps the read-only suggestions view', async ({
      page,
    }) => {
      test.slow();

      await viewerUser.login(page);

      await test.step('Open the suggester suggestions', async () => {
        await openSuggesterSuggestions(page, mixedSuggestionsTable);
      });

      await test.step('Bulk actions are hidden, dismissal stays', async () => {
        await expect(
          page.getByTestId('accept-all-suggestions')
        ).not.toBeVisible();
        await expect(
          page.getByTestId('reject-all-suggestions')
        ).not.toBeVisible();
        await expect(page.getByTestId('close-suggestion')).toBeVisible();
        await expect(
          page.getByTestId(
            `avatar-carousel-item-${suggesterUser.responseData.id}`
          )
        ).toBeVisible();
      });
    });

    test('user with partial edit permission cannot bulk act on mixed suggestions', async ({
      page,
    }) => {
      test.slow();

      await descriptionEditorUser.login(page);

      await test.step('Open the suggester suggestions', async () => {
        await openSuggesterSuggestions(page, mixedSuggestionsTable);
      });

      await test.step('Bulk actions are hidden for the mixed set', async () => {
        await expect(
          page.getByTestId('accept-all-suggestions')
        ).not.toBeVisible();
        await expect(
          page.getByTestId('reject-all-suggestions')
        ).not.toBeVisible();
      });
    });

    test('user with the matching edit permission sees the bulk actions', async ({
      page,
    }) => {
      test.slow();

      await descriptionEditorUser.login(page);

      await test.step('Open the suggester suggestions', async () => {
        await openSuggesterSuggestions(page, descriptionOnlyTable);
      });

      await test.step('Bulk actions are available', async () => {
        await expect(page.getByTestId('accept-all-suggestions')).toBeVisible();
        await expect(page.getByTestId('reject-all-suggestions')).toBeVisible();
      });
    });
  }
);
