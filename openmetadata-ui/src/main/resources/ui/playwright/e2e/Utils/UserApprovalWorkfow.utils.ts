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

import { APIRequestContext, expect, Page } from '@playwright/test';
import { randomUUID } from 'crypto';
const uuidv4 = () => randomUUID();
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { TagClass } from '../../support/tag/TagClass';
import {
  redirectToHomePage,
  toastNotification,
} from '../../utils/common';
import { selectDataProduct } from '../../utils/domain';
import { sidebarClick } from '../../utils/sidebar';
import { TASK_OPEN_FETCH_LINK } from '../../utils/task';
import { WorkflowDefinition } from '../../../src/generated/governance/workflows/workflowDefinition';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

export type OwnerInfo = {
  id: string;
  name: string;
  displayName: string;
};

type EntityWithFQN = DataProduct | TagClass | { fullyQualifiedName: string };

const getFQN = (entity: EntityWithFQN): string => {
  if (entity instanceof TagClass && entity.responseData) {
    return entity.responseData.fullyQualifiedName || '';
  }
  if (entity instanceof DataProduct && entity.data) {
    return entity.data.fullyQualifiedName || '';
  }
  if ('fullyQualifiedName' in entity) {
    return entity.fullyQualifiedName || '';
  }

  return '';
};

export const createUserApprovalWorkflow = async (
  apiContext: APIRequestContext,
  entityType = 'dataProduct',
  workflowName?: string
): Promise<WorkflowDefinition> => {
  const id = uuidv4();
  const name = workflowName ?? `pw-user-approval-${entityType}-${id}`;

  const workflowPayload = {
    name: name,
    displayName: name,
    description: 'Custom workflow created with Workflow Builder',
    type: 'eventBasedEntity',
    trigger: {
      type: 'eventBasedEntity',
      config: {
        entityTypes: [entityType],
        events: ['Created', 'Updated'],
        exclude: [],
      },
      output: ['relatedEntity', 'updatedBy'],
    },
    nodes: [
      {
        type: 'startEvent',
        subType: 'startEvent',
        name: 'start',
        displayName: 'start',
      },
      {
        type: 'automatedTask',
        subType: 'checkEntityAttributesTask',
        name: 'checkEntityAttributesTask_1',
        displayName: 'Check Condition',
        input: ['relatedEntity'],
        output: ['result'],
        branches: ['true', 'false'],
        config: {
          rules: '{"and":[{"!=":[{"var":"description"},null]}]}',
        },
        inputNamespaceMap: {
          relatedEntity: 'global',
        },
      },
      {
        type: 'automatedTask',
        subType: 'setEntityAttributeTask',
        name: 'setEntityAttributeTask_1',
        displayName: 'Set Action',
        input: ['relatedEntity', 'updatedBy'],
        output: [],
        config: {
          fieldName: 'status',
          fieldValue: 'In Review',
        },
        inputNamespaceMap: {
          relatedEntity: 'global',
          updatedBy: 'global',
        },
      },
      {
        type: 'endEvent',
        subType: 'endEvent',
        name: 'endEvent_1',
        displayName: 'End',
      },
      {
        type: 'userTask',
        subType: 'userApprovalTask',
        name: 'userApprovalTask_1',
        displayName: 'Request Approval',
        input: ['relatedEntity'],
        output: ['updatedBy'],
        branches: ['true', 'false'],
        config: {
          assignees: {
            addReviewers: true,
            addOwners: false,
            candidates: [],
          },
          approvalThreshold: 1,
          rejectionThreshold: 1,
        },
        inputNamespaceMap: {
          relatedEntity: 'global',
        },
      },
      {
        type: 'automatedTask',
        subType: 'setEntityAttributeTask',
        name: 'setEntityAttributeTask_2',
        displayName: 'Set Action',
        input: ['relatedEntity', 'updatedBy'],
        output: [],
        config: {
          fieldName: 'status',
          fieldValue: 'Approved',
        },
        inputNamespaceMap: {
          relatedEntity: 'global',
          updatedBy: 'userApprovalTask_1',
        },
      },
      {
        type: 'endEvent',
        subType: 'endEvent',
        name: 'endEvent_2',
        displayName: 'End',
      },
      {
        type: 'endEvent',
        subType: 'endEvent',
        name: 'endEvent_3',
        displayName: 'End',
      },
    ],
    edges: [
      {
        from: 'start',
        to: 'checkEntityAttributesTask_1',
      },
      {
        from: 'checkEntityAttributesTask_1',
        to: 'setEntityAttributeTask_1',
        condition: 'true',
      },
      {
        from: 'checkEntityAttributesTask_1',
        to: 'endEvent_1',
        condition: 'false',
      },
      {
        from: 'setEntityAttributeTask_1',
        to: 'userApprovalTask_1',
      },
      {
        from: 'userApprovalTask_1',
        to: 'setEntityAttributeTask_2',
        condition: 'true',
      },
      {
        from: 'userApprovalTask_1',
        to: 'endEvent_2',
        condition: 'false',
      },
      {
        from: 'setEntityAttributeTask_2',
        to: 'endEvent_3',
      },
    ],
    config: {
      storeStageStatus: true,
    },
  };

  const response = await apiContext.post(
    '/api/v1/governance/workflowDefinitions',
    {
      data: workflowPayload,
    }
  );

  return response.json();
};

export const createSimpleUserApprovalWorkflowViaApi = async (
  apiContext: APIRequestContext,
  entityType = 'dataProduct',
  workflowName?: string
): Promise<WorkflowDefinition> => {
  const id = uuidv4();
  const name = workflowName ?? `pw-simple-user-approval-${entityType}-${id}`;

  const workflowPayload = {
    name,
    displayName: name,
    description:
      'Simple user approval workflow: Start → Request Approval → Set Action → End',
    type: 'eventBasedEntity',
    trigger: {
      type: 'eventBasedEntity',
      config: {
        entityTypes: [entityType],
        events: ['Created', 'Updated'],
        exclude: [],
      },
      output: ['relatedEntity', 'updatedBy'],
    },
    nodes: [
      {
        type: 'startEvent',
        subType: 'startEvent',
        name: 'start',
        displayName: 'Start',
      },
      {
        type: 'userTask',
        subType: 'userApprovalTask',
        name: 'userApprovalTask_1',
        displayName: 'Request Approval',
        input: ['relatedEntity'],
        output: ['updatedBy'],
        branches: ['true', 'false'],
        config: {
          assignees: {
            addReviewers: true,
            addOwners: false,
            candidates: [],
          },
          approvalThreshold: 1,
          rejectionThreshold: 1,
        },
        inputNamespaceMap: {
          relatedEntity: 'global',
        },
      },
      {
        type: 'automatedTask',
        subType: 'setEntityAttributeTask',
        name: 'setEntityAttributeTask_1',
        displayName: 'Set Action',
        input: ['relatedEntity', 'updatedBy'],
        output: [],
        config: {
          fieldName: 'status',
          fieldValue: 'Approved',
        },
        inputNamespaceMap: {
          relatedEntity: 'global',
          updatedBy: 'userApprovalTask_1',
        },
      },
      {
        type: 'endEvent',
        subType: 'endEvent',
        name: 'endEvent_1',
        displayName: 'End',
      },
      {
        type: 'endEvent',
        subType: 'endEvent',
        name: 'endEvent_2',
        displayName: 'End',
      },
    ],
    edges: [
      { from: 'start', to: 'userApprovalTask_1' },
      {
        from: 'userApprovalTask_1',
        to: 'setEntityAttributeTask_1',
        condition: 'true',
      },
      {
        from: 'userApprovalTask_1',
        to: 'endEvent_1',
        condition: 'false',
      },
      { from: 'setEntityAttributeTask_1', to: 'endEvent_2' },
    ],
    config: {
      storeStageStatus: true,
    },
  };

  const response = await apiContext.post(
    '/api/v1/governance/workflowDefinitions',
    { data: workflowPayload }
  );

  return response.json();
};

export const addReviewerToEntity = async (
  page: Page,
  name: string,
  displayName: string,
  entityType: string,
  isDataProduct?: boolean
): Promise<void> => {
  if (isDataProduct) {
    await page.getByTestId('glossary-reviewer').getByTestId('Add').click();
  } else {
    await page.getByTestId('Add').click();
  }

  await page.waitForSelector(
    '[data-testid="select-owner-tabs"] [data-testid="loader"]',
    { state: 'detached' }
  );
  await page
    .locator("[data-testid='select-owner-tabs']")
    .getByRole('tab', { name: 'Users' })
    .click();
  const searchOwner = page.waitForResponse(
    'api/v1/search/query?q=*&index=user*'
  );
  await page.fill('[data-testid="owner-select-users-search-bar"]', name);
  await searchOwner;
  await page.waitForSelector(
    '[data-testid="select-owner-tabs"] [data-testid="loader"]',
    { state: 'detached' }
  );
  await page
    .getByText(displayName, {
      exact: true,
    })
    .click();
  const updateDataProductResponse = page.waitForResponse(
    `/api/v1/${entityType}/*`
  );
  await page.getByTestId('selectable-list-update-btn').click();
  await updateDataProductResponse;
};

export const verifyTaskStatus = async (
  page: Page,
  statusBadge: string,
  entity: EntityWithFQN,
  statusLabel: string,
  apiContext: APIRequestContext,
  entityType: 'dataProduct' | 'tag' | 'knowledgeCenter' = 'dataProduct'
): Promise<void> => {
  const entityFQN = encodeURIComponent(getFQN(entity));

  const apiEndpoints = {
    dataProduct: `/api/v1/dataProducts/name/${entityFQN}?fields=reviewers`,
    tag: `/api/v1/tags/name/${entityFQN}?fields=reviewers`,
    knowledgeCenter: `/api/v1/knowledgeCenter/name/${entityFQN}?fields=reviewers`,
  };

  await expect
    .poll(
      async () => {
        const response = await apiContext
          .get(apiEndpoints[entityType])
          .then((res) => res.json());

        return response?.entityStatus;
      },
      {
        message: `Wait for ${entityType} status to be ${statusLabel}`,
        timeout: 60_000,
        intervals: [5_000],
      }
    )
    .toBe(statusLabel);

  await redirectToHomePage(page);

  if (entityType === 'dataProduct') {
    await sidebarClick(page, SidebarItem.DATA_PRODUCT);
    await selectDataProduct(page, (entity as DataProduct).data);
  } else if (entityType === 'tag') {
    await sidebarClick(page, SidebarItem.TAGS);
    await (entity as TagClass).visitPage(page);
  } else {
    await page.goto(`/knowledge-center/${entityFQN}`);
  }
  await waitForAllLoadersToDisappear(page);
  await expect(
    page.locator(`.status-badge.${statusBadge} .status-badge-label`)
  ).toContainText(statusLabel);
};

export const checkNotificationAndApproveTask = async (
  dataConsumerPage: Page,
  navigateToEntity: () => Promise<void>
): Promise<void> => {
  await redirectToHomePage(dataConsumerPage);
  await navigateToEntity();

  await dataConsumerPage.getByTestId('activity_feed').click();
  const taskFeeds = dataConsumerPage.waitForResponse(TASK_OPEN_FETCH_LINK);
  await dataConsumerPage
    .getByTestId('global-setting-left-panel')
    .getByText('Tasks')
    .click();
  await taskFeeds;

  const taskApprovalResponse = dataConsumerPage.waitForResponse(
    '/api/v1/feed/tasks/*/resolve'
  );
  await dataConsumerPage
    .getByTestId('approve-button')
    .first()
    .waitFor({ state: 'visible', timeout: 15_000 });
  await dataConsumerPage.getByTestId('approve-button').first().click();

  await taskApprovalResponse;
  await toastNotification(dataConsumerPage, /Task resolved successfully/);
};

export const approveTaskFromUserProfilePage = async (
  page: Page,
  username: string,
  entityFqn: string
): Promise<void> => {
  await page.goto(`/users/${username}/task`);
  await page.reload();

  const leftNavBar = page.locator('[data-testid="left-sidebar"]');
  const hasOpenClass = await leftNavBar.evaluate((el) =>
    el.classList.contains('sidebar-open')
  );
  if (hasOpenClass) {
    await page.getByTestId('sidebar-toggle').click();
  }

  const taskCards = page.getByTestId('task-feed-card');
  await taskCards.first().waitFor({ state: 'visible', timeout: 30_000 });
  const count = await taskCards.count();

  // Click each card and verify the full entity FQN in the right-panel detail view,
  // then approve from the right panel (no strict-mode violation: only one right-panel at a time)
  for (let i = 0; i < count; i++) {
    await taskCards.nth(i).click();

    const taskTab = page.getByTestId('task-tab');
    await taskTab.waitFor({ state: 'visible', timeout: 10_000 });

    const panelEntityText = await taskTab
      .getByTestId('entity-link')
      .textContent();

    if (panelEntityText && panelEntityText.includes(entityFqn)) {
      const taskApprovalResponse = page.waitForResponse(
        '/api/v1/feed/tasks/*/resolve'
      );
      await taskTab
        .getByTestId('glossary-accept-reject-task-dropdown')
        .waitFor({ state: 'visible', timeout: 15_000 });
      await taskTab.getByTestId('glossary-accept-reject-task-dropdown').click();

      await taskApprovalResponse;
      await toastNotification(page, /Task resolved successfully/);

      return;
    }
  }
};

export const deleteWorkflow = async (page: Page, workflowName: string) => {
  await page.getByTestId('delete-workflow-button').click();

  const deleteResponse = page.waitForResponse(
    `/api/v1/governance/workflowDefinitions/name/${workflowName}?hardDelete=true`
  );
  await page.getByTestId('confirm-button').click();
  await deleteResponse;
};

export const createUserApprovalWorkflowWithOwners = async (
  apiContext: APIRequestContext,
  entityType = 'table',
  workflowName?: string
): Promise<WorkflowDefinition> => {
  const id = uuidv4();
  const name = workflowName ?? `pw-user-approval-owners-${entityType}-${id}`;

  const workflowPayload = {
    name,
    displayName: name,
    description: 'User approval workflow for data asset entities using owners',
    type: 'eventBasedEntity',
    trigger: {
      type: 'eventBasedEntity',
      config: {
        entityTypes: [entityType],
        events: ['Created', 'Updated'],
        exclude: [],
      },
      output: ['relatedEntity', 'updatedBy'],
    },
    nodes: [
      {
        type: 'startEvent',
        subType: 'startEvent',
        name: 'start',
        displayName: 'start',
      },
      {
        type: 'automatedTask',
        subType: 'checkEntityAttributesTask',
        name: 'checkEntityAttributesTask_1',
        displayName: 'Check Condition',
        input: ['relatedEntity'],
        output: ['result'],
        branches: ['true', 'false'],
        config: {
          rules: '{"and":[{"!=":[{"var":"description"},null]}]}',
        },
        inputNamespaceMap: {
          relatedEntity: 'global',
        },
      },
      {
        type: 'automatedTask',
        subType: 'setEntityAttributeTask',
        name: 'setEntityAttributeTask_1',
        displayName: 'Set Action',
        input: ['relatedEntity', 'updatedBy'],
        output: [],
        config: {
          fieldName: 'status',
          fieldValue: 'In Review',
        },
        inputNamespaceMap: {
          relatedEntity: 'global',
          updatedBy: 'global',
        },
      },
      {
        type: 'endEvent',
        subType: 'endEvent',
        name: 'endEvent_1',
        displayName: 'End',
      },
      {
        type: 'userTask',
        subType: 'userApprovalTask',
        name: 'userApprovalTask_1',
        displayName: 'Request Approval',
        input: ['relatedEntity'],
        output: ['updatedBy'],
        branches: ['true', 'false'],
        config: {
          assignees: {
            addReviewers: false,
            addOwners: true,
            candidates: [],
          },
          approvalThreshold: 1,
          rejectionThreshold: 1,
        },
        inputNamespaceMap: {
          relatedEntity: 'global',
        },
      },
      {
        type: 'automatedTask',
        subType: 'setEntityAttributeTask',
        name: 'setEntityAttributeTask_2',
        displayName: 'Set Action',
        input: ['relatedEntity', 'updatedBy'],
        output: [],
        config: {
          fieldName: 'status',
          fieldValue: 'Approved',
        },
        inputNamespaceMap: {
          relatedEntity: 'global',
          updatedBy: 'userApprovalTask_1',
        },
      },
      {
        type: 'endEvent',
        subType: 'endEvent',
        name: 'endEvent_2',
        displayName: 'End',
      },
      {
        type: 'endEvent',
        subType: 'endEvent',
        name: 'endEvent_3',
        displayName: 'End',
      },
    ],
    edges: [
      {
        from: 'start',
        to: 'checkEntityAttributesTask_1',
      },
      {
        from: 'checkEntityAttributesTask_1',
        to: 'setEntityAttributeTask_1',
        condition: 'true',
      },
      {
        from: 'checkEntityAttributesTask_1',
        to: 'endEvent_1',
        condition: 'false',
      },
      {
        from: 'setEntityAttributeTask_1',
        to: 'userApprovalTask_1',
      },
      {
        from: 'userApprovalTask_1',
        to: 'setEntityAttributeTask_2',
        condition: 'true',
      },
      {
        from: 'userApprovalTask_1',
        to: 'endEvent_2',
        condition: 'false',
      },
      {
        from: 'setEntityAttributeTask_2',
        to: 'endEvent_3',
      },
    ],
    config: {
      storeStageStatus: true,
    },
  };

  const response = await apiContext.post(
    '/api/v1/governance/workflowDefinitions',
    { data: workflowPayload }
  );

  return response.json();
};

export const addOwnerToEntityViaApi = async (
  apiContext: APIRequestContext,
  apiPath: string,
  fqn: string,
  owner: OwnerInfo
): Promise<void> => {
  const response = await apiContext.patch(
    `/api/v1/${apiPath}/name/${encodeURIComponent(fqn)}`,
    {
      data: [
        {
          op: 'add',
          path: '/owners',
          value: [
            {
              id: owner.id,
              type: 'user',
              name: owner.name,
              displayName: owner.displayName,
            },
          ],
        },
      ],
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    }
  );

  if (!response.ok()) {
    const body = await response.text();
    throw new Error(
      `addOwnerToEntityViaApi: PATCH /api/v1/${apiPath} returned ${response.status()} – ${body}`
    );
  }
};

/**
 * Polls the entity API (no UI) until entityStatus changes away from
 * "Unprocessed" — meaning the workflow has processed the event and the
 * approval task now exists in the feed.  Used to gate the approve step
 * without rendering an intermediate UI badge.
 */
export const waitForApprovalTaskCreated = async (
  apiContext: APIRequestContext,
  apiPath: string,
  fqn: string
): Promise<void> => {
  const encodedFqn = encodeURIComponent(fqn);

  await expect
    .poll(
      async () => {
        const response = await apiContext
          .get(`/api/v1/${apiPath}/name/${encodedFqn}?fields=owners`)
          .then((res) => res.json());

        return response?.entityStatus;
      },
      {
        message: `Wait for ${apiPath} workflow to process the entity (status != Unprocessed)`,
        timeout: 60_000,
        intervals: [5_000],
      }
    )
    .toBe('In Review');
};

export const verifyDataAssetTaskStatus = async (
  page: Page,
  apiContext: APIRequestContext,
  apiPath: string,
  fqn: string,
  statusBadge: string,
  statusLabel: string,
  navigateToEntity: () => Promise<void>
): Promise<void> => {
  const encodedFqn = encodeURIComponent(fqn);

  await expect
    .poll(
      async () => {
        const response = await apiContext
          .get(`/api/v1/${apiPath}/name/${encodedFqn}?fields=owners`)
          .then((res) => res.json());

        return response?.entityStatus;
      },
      {
        message: `Wait for ${apiPath} entity status to be ${statusLabel}`,
        timeout: 60_000,
        intervals: [5_000],
      }
    )
    .toBe(statusLabel);

  await navigateToEntity();

  const statusBadgeLocator = page.locator(
    `.status-badge.${statusBadge} .status-badge-label`
  );
  await statusBadgeLocator.waitFor({ state: 'visible', timeout: 15_000 });
  await expect(statusBadgeLocator).toContainText(statusLabel);
};
