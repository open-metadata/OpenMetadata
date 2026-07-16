import { APIRequestContext, expect, Page } from '@playwright/test';
import { SidebarItem } from '../constant/sidebar';
import { DataProduct } from '../support/domain/DataProduct';
import { TagClass } from '../support/tag/TagClass';
import { redirectToHomePage, toastNotification, uuid } from './common';
import { selectDataProduct } from './domain';
import { waitForAllLoadersToDisappear } from './entity';
import { sidebarClick } from './sidebar';
import { TASK_OPEN_FETCH_LINK } from './task';
import { approveTaskFromDetails } from './taskWorkflow';

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
) => {
  const id = uuid();
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

export const addReviewerToEntity = async (
  page: Page,
  name: string,
  displayName: string,
  entityType: string,
  isDataProduct?: boolean
): Promise<void> => {
  if (isDataProduct || entityType === 'contextCenter') {
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
    entityType === 'contextCenter'
      ? '/api/v1/contextCenter/pages/*'
      : `/api/v1/${entityType}/*`
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
  entityType: 'dataProduct' | 'tag' | 'contextCenter' = 'dataProduct'
): Promise<void> => {
  const entityFQN = encodeURIComponent(getFQN(entity));

  const apiEndpoints = {
    dataProduct: `/api/v1/dataProducts/name/${entityFQN}?fields=reviewers`,
    tag: `/api/v1/tags/name/${entityFQN}?fields=reviewers`,
    contextCenter: `/api/v1/contextCenter/pages/name/${entityFQN}?fields=reviewers`,
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
        timeout: 300_000,
        intervals: [60_000, 40_000, 20_000],
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
    await page.goto(`/context-center/articles/${entityFQN}`);
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

  const taskCard = dataConsumerPage.getByTestId('task-feed-card').first();
  await taskCard.waitFor({ state: 'visible', timeout: 15_000 });
  await taskCard.click();

  await approveTaskFromDetails(dataConsumerPage);
  await toastNotification(dataConsumerPage, /Task resolved successfully/);
};
