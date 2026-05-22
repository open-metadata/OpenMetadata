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
/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
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
  createTagTaskFromForm,
  editTagsAndAccept,
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
    tags?: Array<{ tagFQN: string }>;
  }> = [],
  pathSegments: string[]
): { tags?: Array<{ tagFQN: string }> } | undefined => {
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
      tags?: Array<{ tagFQN: string }>;
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

const getTagFqns = (tags?: Array<{ tagFQN: string }>) =>
  (tags ?? []).map((tag) => tag.tagFQN).sort();

test.describe.serial(
  'Tag Task Workflows',
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

    test('should add and accept requested tags for a table asset', async ({
      page,
      browser,
    }) => {
      await requesterUser.login(page);
      await openTaskForm(
        page,
        buildTaskRoute({
          action: 'request-tags',
          entityType: 'table',
          fqn: table.entityResponseData.fullyQualifiedName,
        })
      );

      const task = await createTagTaskFromForm({
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
        await editTagsAndAccept({
          page: reviewerPage,
          searchText: 'PII.None',
          tagTestId: 'tag-PII.None',
        });

        const { apiContext, afterAction } = await getApiContext(reviewerPage);
        try {
          await expect
            .poll(async () => {
              const entity = await fetchEntityDetails(
                apiContext,
                'table',
                table.entityResponseData.fullyQualifiedName
              );

              return getTagFqns(entity.tags).includes('PII.None');
            })
            .toBe(true);
        } finally {
          await afterAction();
        }
      } finally {
        await reviewerPage.close();
      }
    });

    test('should edit and accept suggested tags for a table column', async ({
      page,
      browser,
    }) => {
      const columnPath = table.entityLinkColumnsName[0];

      await requesterUser.login(page);
      await openTaskForm(
        page,
        buildTaskRoute({
          action: 'update-tags',
          entityType: 'table',
          fqn: table.entityResponseData.fullyQualifiedName,
          field: 'columns',
          value: columnPath,
        })
      );

      const task = await createTagTaskFromForm({
        page,
        assigneeName: reviewerUser.responseData.name,
        searchText: 'PII.Sensitive',
        tagTestId: 'tag-PII.Sensitive',
      });
      createdTaskIds.push(task.id);

      const reviewerPage = await browser.newPage();
      try {
        await reviewerUser.login(reviewerPage);
        await table.visitEntityPage(reviewerPage);
        await openEntityTasksTab(reviewerPage);
        await openTaskDetails(reviewerPage, task);
        await editTagsAndAccept({
          page: reviewerPage,
          searchText: 'PersonalData.Personal',
          tagTestId: 'tag-PersonalData.Personal',
        });

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

              return getTagFqns(field?.tags);
            })
            .toEqual(['PII.Sensitive', 'PersonalData.Personal']);
        } finally {
          await afterAction();
        }
      } finally {
        await reviewerPage.close();
      }
    });

    test('should add and accept requested tags for a topic schema field', async ({
      page,
      browser,
    }) => {
      const topicFieldPath = [
        topic.children[0].name,
        topic.children[0].children?.[0].name ?? '',
        'first_name',
      ].join('.');

      await requesterUser.login(page);
      await openTaskForm(
        page,
        buildTaskRoute({
          action: 'request-tags',
          entityType: 'topic',
          fqn: topic.entityResponseData.fullyQualifiedName,
          field: 'messageSchema.schemaFields',
          value: topicFieldPath,
        })
      );

      const task = await createTagTaskFromForm({
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
        await editTagsAndAccept({
          page: reviewerPage,
          searchText: 'PII.None',
          tagTestId: 'tag-PII.None',
        });

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

              return getTagFqns(field?.tags).includes('PII.None');
            })
            .toBe(true);
        } finally {
          await afterAction();
        }
      } finally {
        await reviewerPage.close();
      }
    });

    test('should add and accept requested tags for an api endpoint request schema field', async ({
      page,
      browser,
    }) => {
      const requestFieldPath = 'default.name.last_name';

      await requesterUser.login(page);
      await openTaskForm(
        page,
        buildTaskRoute({
          action: 'request-tags',
          entityType: 'apiEndpoint',
          fqn: apiEndpoint.entityResponseData.fullyQualifiedName,
          field: 'requestSchema.schemaFields',
          value: requestFieldPath,
        })
      );

      const task = await createTagTaskFromForm({
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
        await editTagsAndAccept({
          page: reviewerPage,
          searchText: 'PII.None',
          tagTestId: 'tag-PII.None',
        });

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

              return getTagFqns(field?.tags).includes('PII.None');
            })
            .toBe(true);
        } finally {
          await afterAction();
        }
      } finally {
        await reviewerPage.close();
      }
    });

    test('should edit and accept suggested tags for an api endpoint response schema field', async ({
      page,
      browser,
    }) => {
      const responseFieldPath = 'default.name.first_name';

      await requesterUser.login(page);
      await openTaskForm(
        page,
        buildTaskRoute({
          action: 'update-tags',
          entityType: 'apiEndpoint',
          fqn: apiEndpoint.entityResponseData.fullyQualifiedName,
          field: 'responseSchema.schemaFields',
          value: responseFieldPath,
        })
      );

      const task = await createTagTaskFromForm({
        page,
        assigneeName: reviewerUser.responseData.name,
        searchText: 'PII.Sensitive',
        tagTestId: 'tag-PII.Sensitive',
      });
      createdTaskIds.push(task.id);

      const reviewerPage = await browser.newPage();
      try {
        await reviewerUser.login(reviewerPage);
        await apiEndpoint.visitEntityPage(reviewerPage);
        await openEntityTasksTab(reviewerPage);
        await openTaskDetails(reviewerPage, task);
        await editTagsAndAccept({
          page: reviewerPage,
          searchText: 'PersonalData.Personal',
          tagTestId: 'tag-PersonalData.Personal',
        });

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

              return getTagFqns(field?.tags);
            })
            .toEqual(['PII.Sensitive', 'PersonalData.Personal']);
        } finally {
          await afterAction();
        }
      } finally {
        await reviewerPage.close();
      }
    });

    test('should decline requested tags for an api endpoint request schema field', async ({
      page,
      browser,
    }) => {
      const requestFieldPath = 'default.club_name';

      await requesterUser.login(page);
      await openTaskForm(
        page,
        buildTaskRoute({
          action: 'request-tags',
          entityType: 'apiEndpoint',
          fqn: apiEndpoint.entityResponseData.fullyQualifiedName,
          field: 'requestSchema.schemaFields',
          value: requestFieldPath,
        })
      );

      const task = await createTagTaskFromForm({
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
          'Declining the requested api request schema field tags.'
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

              return getTagFqns(field?.tags).length;
            })
            .toBe(0);
        } finally {
          await afterAction();
        }
      } finally {
        await reviewerPage.close();
      }
    });

    test('should decline suggested tags for a container column', async ({
      page,
      browser,
    }) => {
      const containerColumnName =
        container.entityResponseData.dataModel?.columns?.[0].name ?? '';

      await requesterUser.login(page);
      await openTaskForm(
        page,
        buildTaskRoute({
          action: 'update-tags',
          entityType: 'container',
          fqn: container.entityResponseData.fullyQualifiedName,
          field: 'dataModel.columns',
          value: containerColumnName,
        })
      );

      const task = await createTagTaskFromForm({
        page,
        assigneeName: reviewerUser.responseData.name,
        searchText: 'PII.Sensitive',
        tagTestId: 'tag-PII.Sensitive',
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
          'Declining the suggested container tags.'
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

              return getTagFqns(field?.tags).includes('PII.Sensitive');
            })
            .toBe(false);
        } finally {
          await afterAction();
        }
      } finally {
        await reviewerPage.close();
      }
    });
  }
);
