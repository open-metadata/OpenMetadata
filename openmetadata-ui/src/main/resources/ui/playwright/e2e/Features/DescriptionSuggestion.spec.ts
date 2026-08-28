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
import { APIRequestContext, expect, test } from '@playwright/test';
import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { ApiEndpointClass } from '../../support/entity/ApiEndpointClass';
import { ContainerClass } from '../../support/entity/ContainerClass';
import { TableClass } from '../../support/entity/TableClass';
import { TopicClass } from '../../support/entity/TopicClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext } from '../../utils/common';
import {
  addCommentToTask,
  buildTaskRoute,
  closeTaskFromDetails,
  createDescriptionTaskFromForm,
  editDescriptionAndAccept,
  openEntityTasksTab,
  openTaskDetails,
  openTaskForm,
} from '../../utils/taskWorkflow';

const requesterUser = new UserClass();
const reviewerUser = new UserClass();
const table = new TableClass();
const topic = new TopicClass();
const container = new ContainerClass();
const apiEndpoint = new ApiEndpointClass();
const createdTaskIds: string[] = [];

const ENTITY_ENDPOINTS = {
  table: '/api/v1/tables/name/',
  topic: '/api/v1/topics/name/',
  container: '/api/v1/containers/name/',
  apiEndpoint: '/api/v1/apiEndpoints/name/',
} as const;

const findFieldByPath = (
  fields: Array<{
    name: string;
    children?: unknown[];
    description?: string;
  }> = [],
  pathSegments: string[]
): { description?: string } | undefined => {
  const [currentField, ...remainingSegments] = pathSegments;
  const matchedField = fields.find((field) => field.name === currentField);

  if (!matchedField) {
    return undefined;
  }

  if (remainingSegments.length === 0) {
    return matchedField;
  }

  return findFieldByPath(
    (matchedField.children as Array<{
      name: string;
      children?: unknown[];
      description?: string;
    }>) ?? [],
    remainingSegments
  );
};

const fetchEntityDetails = async (
  apiContext: APIRequestContext,
  entityType: keyof typeof ENTITY_ENDPOINTS,
  fqn: string
) => {
  const response = await apiContext.get(
    `${ENTITY_ENDPOINTS[entityType]}${encodeURIComponent(fqn)}?fields=*`
  );

  return response.json();
};

const getPlainTextDescription = (description?: string) =>
  (description ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

test.describe.serial(
  'Description Task Workflows',
  PLAYWRIGHT_BASIC_TEST_TAG_OBJ,
  () => {
    test.slow(true);

    test.beforeAll('Setup users and entities', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await requesterUser.create(apiContext);
        await requesterUser.setAdminRole(apiContext);
        await reviewerUser.create(apiContext);
        await reviewerUser.setAdminRole(apiContext);

        await table.create(apiContext);
        await table.patch({
          apiContext,
          patchData: [
            {
              op: 'replace',
              path: '/description',
              value: '',
            },
          ],
        });

        await topic.create(apiContext);
        await container.create(apiContext);
        await apiEndpoint.create(apiContext);
      } finally {
        await afterAction();
      }
    });

    test.afterAll('Cleanup users and entities', async ({ browser }) => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        for (const taskId of createdTaskIds) {
          await apiContext
            .delete(`/api/v1/tasks/${taskId}?hardDelete=true`)
            .catch(() => undefined);
        }
        await apiEndpoint.delete(apiContext);
        await container.delete(apiContext);
        await topic.delete(apiContext);
        await table.delete(apiContext);
        await reviewerUser.delete(apiContext);
        await requesterUser.delete(apiContext);
      } finally {
        await afterAction();
      }
    });

    test('should add and accept a requested table description', async ({
      page,
      browser,
    }) => {
      const requestedDescription =
        'Requested description added by the assignee';

      await requesterUser.login(page);
      await openTaskForm(
        page,
        buildTaskRoute({
          action: 'request-description',
          entityType: 'table',
          fqn: table.entityResponseData.fullyQualifiedName,
        })
      );

      const task = await createDescriptionTaskFromForm({
        page,
        assigneeName: reviewerUser.responseData.name,
      });
      createdTaskIds.push(task.id);

      const reviewerPage = await browser.newPage();
      try {
        await reviewerUser.login(reviewerPage);
        await table.visitEntityPage(reviewerPage);
        await openEntityTasksTab(reviewerPage);
        await openTaskDetails(reviewerPage, task);
        await editDescriptionAndAccept(reviewerPage, requestedDescription);

        const { apiContext, afterAction } = await getApiContext(reviewerPage);
        try {
          await expect
            .poll(async () => {
              const entity = await fetchEntityDetails(
                apiContext,
                'table',
                table.entityResponseData.fullyQualifiedName
              );

              return getPlainTextDescription(entity.description);
            })
            .toBe(requestedDescription);
        } finally {
          await afterAction();
        }
      } finally {
        await reviewerPage.close();
      }
    });

    test('should edit and accept a suggested table column description', async ({
      page,
      browser,
    }) => {
      const columnPath = table.entityLinkColumnsName[5];
      const editedSuggestion =
        'Edited suggestion accepted for the nested table column';

      await requesterUser.login(page);
      await openTaskForm(
        page,
        buildTaskRoute({
          action: 'update-description',
          entityType: 'table',
          fqn: table.entityResponseData.fullyQualifiedName,
          field: 'columns',
          value: columnPath,
        })
      );

      const task = await createDescriptionTaskFromForm({
        page,
        assigneeName: reviewerUser.responseData.name,
        description: 'Initial suggestion for the nested table column',
      });
      createdTaskIds.push(task.id);

      const reviewerPage = await browser.newPage();
      try {
        await reviewerUser.login(reviewerPage);
        await table.visitEntityPage(reviewerPage);
        await openEntityTasksTab(reviewerPage);
        await openTaskDetails(reviewerPage, task);
        await editDescriptionAndAccept(reviewerPage, editedSuggestion);

        const { apiContext, afterAction } = await getApiContext(reviewerPage);
        try {
          await expect
            .poll(async () => {
              const entity = await fetchEntityDetails(
                apiContext,
                'table',
                table.entityResponseData.fullyQualifiedName
              );
              const field = findFieldByPath(
                entity.columns ?? [],
                columnPath.split('.')
              );

              return getPlainTextDescription(field?.description);
            })
            .toBe(editedSuggestion);
        } finally {
          await afterAction();
        }
      } finally {
        await reviewerPage.close();
      }
    });

    test('should add and accept a requested topic schema field description', async ({
      page,
      browser,
    }) => {
      const topicFieldPath = [
        topic.children[0].name,
        topic.children[0].children?.[0].name ?? '',
        'last_name',
      ].join('.');
      const addedDescription =
        'Assignee-added description for the topic schema field';

      await requesterUser.login(page);
      await openTaskForm(
        page,
        buildTaskRoute({
          action: 'request-description',
          entityType: 'topic',
          fqn: topic.entityResponseData.fullyQualifiedName,
          field: 'messageSchema.schemaFields',
          value: topicFieldPath,
        })
      );

      const task = await createDescriptionTaskFromForm({
        page,
        assigneeName: reviewerUser.responseData.name,
      });
      createdTaskIds.push(task.id);

      const reviewerPage = await browser.newPage();
      try {
        await reviewerUser.login(reviewerPage);
        await topic.visitEntityPage(reviewerPage);
        await openEntityTasksTab(reviewerPage);
        await openTaskDetails(reviewerPage, task);
        await editDescriptionAndAccept(reviewerPage, addedDescription);

        const { apiContext, afterAction } = await getApiContext(reviewerPage);
        try {
          await expect
            .poll(async () => {
              const entity = await fetchEntityDetails(
                apiContext,
                'topic',
                topic.entityResponseData.fullyQualifiedName
              );
              const field = findFieldByPath(
                entity.messageSchema?.schemaFields ?? [],
                topicFieldPath.split('.')
              );

              return getPlainTextDescription(field?.description);
            })
            .toBe(addedDescription);
        } finally {
          await afterAction();
        }
      } finally {
        await reviewerPage.close();
      }
    });

    test('should add and accept a requested api endpoint request schema field description', async ({
      page,
      browser,
    }) => {
      const requestFieldPath = 'default.name.last_name';
      const addedDescription =
        'Assignee-added description for the api request schema field';

      await requesterUser.login(page);
      await openTaskForm(
        page,
        buildTaskRoute({
          action: 'request-description',
          entityType: 'apiEndpoint',
          fqn: apiEndpoint.entityResponseData.fullyQualifiedName,
          field: 'requestSchema.schemaFields',
          value: requestFieldPath,
        })
      );

      const task = await createDescriptionTaskFromForm({
        page,
        assigneeName: reviewerUser.responseData.name,
      });
      createdTaskIds.push(task.id);

      const reviewerPage = await browser.newPage();
      try {
        await reviewerUser.login(reviewerPage);
        await apiEndpoint.visitEntityPage(reviewerPage);
        await openEntityTasksTab(reviewerPage);
        await openTaskDetails(reviewerPage, task);
        await editDescriptionAndAccept(reviewerPage, addedDescription);

        const { apiContext, afterAction } = await getApiContext(reviewerPage);
        try {
          await expect
            .poll(async () => {
              const entity = await fetchEntityDetails(
                apiContext,
                'apiEndpoint',
                apiEndpoint.entityResponseData.fullyQualifiedName
              );
              const field = findFieldByPath(
                entity.requestSchema?.schemaFields ?? [],
                requestFieldPath.split('.')
              );

              return getPlainTextDescription(field?.description);
            })
            .toBe(addedDescription);
        } finally {
          await afterAction();
        }
      } finally {
        await reviewerPage.close();
      }
    });

    test('should edit and accept a suggested api endpoint response schema field description', async ({
      page,
      browser,
    }) => {
      const responseFieldPath = 'default.name.last_name';
      const editedSuggestion =
        'Edited suggestion accepted for the api response schema field';

      await requesterUser.login(page);
      await openTaskForm(
        page,
        buildTaskRoute({
          action: 'update-description',
          entityType: 'apiEndpoint',
          fqn: apiEndpoint.entityResponseData.fullyQualifiedName,
          field: 'responseSchema.schemaFields',
          value: responseFieldPath,
        })
      );

      const task = await createDescriptionTaskFromForm({
        page,
        assigneeName: reviewerUser.responseData.name,
        description: 'Initial suggestion for the api response schema field',
      });
      createdTaskIds.push(task.id);

      const reviewerPage = await browser.newPage();
      try {
        await reviewerUser.login(reviewerPage);
        await apiEndpoint.visitEntityPage(reviewerPage);
        await openEntityTasksTab(reviewerPage);
        await openTaskDetails(reviewerPage, task);
        await editDescriptionAndAccept(reviewerPage, editedSuggestion);

        const { apiContext, afterAction } = await getApiContext(reviewerPage);
        try {
          await expect
            .poll(async () => {
              const entity = await fetchEntityDetails(
                apiContext,
                'apiEndpoint',
                apiEndpoint.entityResponseData.fullyQualifiedName
              );
              const field = findFieldByPath(
                entity.responseSchema?.schemaFields ?? [],
                responseFieldPath.split('.')
              );

              return getPlainTextDescription(field?.description);
            })
            .toBe(editedSuggestion);
        } finally {
          await afterAction();
        }
      } finally {
        await reviewerPage.close();
      }
    });

    test('should decline a requested api endpoint request schema field description', async ({
      page,
      browser,
    }) => {
      const requestFieldPath = 'default.club_name';
      const originalDescription = '';

      await requesterUser.login(page);
      await openTaskForm(
        page,
        buildTaskRoute({
          action: 'request-description',
          entityType: 'apiEndpoint',
          fqn: apiEndpoint.entityResponseData.fullyQualifiedName,
          field: 'requestSchema.schemaFields',
          value: requestFieldPath,
        })
      );

      const task = await createDescriptionTaskFromForm({
        page,
        assigneeName: reviewerUser.responseData.name,
      });
      createdTaskIds.push(task.id);

      const reviewerPage = await browser.newPage();
      try {
        await reviewerUser.login(reviewerPage);
        await apiEndpoint.visitEntityPage(reviewerPage);
        await openEntityTasksTab(reviewerPage);
        await openTaskDetails(reviewerPage, task);
        await addCommentToTask(
          reviewerPage,
          'Declining the api request schema field description task.'
        );
        await closeTaskFromDetails(reviewerPage);

        const { apiContext, afterAction } = await getApiContext(reviewerPage);
        try {
          await expect
            .poll(async () => {
              const taskResponse = await apiContext.get(
                `/api/v1/tasks/${task.id}`
              );
              const taskDetails = await taskResponse.json();

              return taskDetails.status !== 'Open';
            })
            .toBe(true);

          await expect
            .poll(async () => {
              const entity = await fetchEntityDetails(
                apiContext,
                'apiEndpoint',
                apiEndpoint.entityResponseData.fullyQualifiedName
              );
              const field = findFieldByPath(
                entity.requestSchema?.schemaFields ?? [],
                requestFieldPath.split('.')
              );

              return getPlainTextDescription(field?.description);
            })
            .toBe(originalDescription);
        } finally {
          await afterAction();
        }
      } finally {
        await reviewerPage.close();
      }
    });

    test('should decline a suggested container column description', async ({
      page,
      browser,
    }) => {
      const containerColumnName =
        container.entityResponseData.dataModel?.columns?.[0].name ?? '';
      const originalDescription = getPlainTextDescription(
        container.entityResponseData.dataModel?.columns?.[0].description
      );

      await requesterUser.login(page);
      await openTaskForm(
        page,
        buildTaskRoute({
          action: 'update-description',
          entityType: 'container',
          fqn: container.entityResponseData.fullyQualifiedName,
          field: 'dataModel.columns',
          value: containerColumnName,
        })
      );

      const task = await createDescriptionTaskFromForm({
        page,
        assigneeName: reviewerUser.responseData.name,
        description: 'Suggestion that should be declined for the container',
      });
      createdTaskIds.push(task.id);

      const reviewerPage = await browser.newPage();
      try {
        await reviewerUser.login(reviewerPage);
        await container.visitEntityPage(reviewerPage);
        await openEntityTasksTab(reviewerPage);
        await openTaskDetails(reviewerPage, task);
        await addCommentToTask(
          reviewerPage,
          'Declining the container description task.'
        );
        await closeTaskFromDetails(reviewerPage);

        const { apiContext, afterAction } = await getApiContext(reviewerPage);
        try {
          await expect
            .poll(async () => {
              const taskResponse = await apiContext.get(
                `/api/v1/tasks/${task.id}`
              );
              const taskDetails = await taskResponse.json();

              return taskDetails.status !== 'Open';
            })
            .toBe(true);

          await expect
            .poll(async () => {
              const entity = await fetchEntityDetails(
                apiContext,
                'container',
                container.entityResponseData.fullyQualifiedName
              );
              const field = findFieldByPath(entity.dataModel?.columns ?? [], [
                containerColumnName,
              ]);

              return getPlainTextDescription(field?.description);
            })
            .toBe(originalDescription);
        } finally {
          await afterAction();
        }
      } finally {
        await reviewerPage.close();
      }
    });
  }
);
