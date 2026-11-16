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
import { APIRequestContext, Page } from '@playwright/test';
import { okJson } from '../../../utils/apiResponse';
import { getApiContext, redirectToHomePage, uuid } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { expect, test } from '../../fixtures/pages';

/**
 * A lifecycle with an on-request exit to Deprecated offers "Deprecate" from the stage badge of the
 * assets it owns, and only those. Requesting it shows the pending request next to the stage until
 * the owner approves, after which the asset is Deprecated and the request is gone. The domains
 * belong to the data steward, since nobody approves their own request.
 */

type Domain = { id: string; name: string; fullyQualifiedName: string };
type Task = { id: string; workflowDefinitionId?: string };

const createDomain = async (
  apiContext: APIRequestContext,
  name: string,
  ownerId: string
) =>
  okJson<Domain>(
    await apiContext.post('/api/v1/domains', {
      data: {
        name,
        description: 'Domain a user can ask to deprecate',
        domainType: 'Aggregate',
        owners: [{ id: ownerId, type: 'user' }],
      },
    }),
    'createDomain'
  );

// Owns the stage of one domain and moves it to Deprecated once its owner approves a request.
// The name sorts before other stage workflows and stays short for Flowable's 64-character ids.
const createDeprecateOnRequestLifecycle = async (
  apiContext: APIRequestContext,
  name: string,
  domainName: string
) =>
  okJson<{ id: string }>(
    await apiContext.post('/api/v1/governance/workflowDefinitions', {
      data: {
        name,
        description: 'Moves one domain to Deprecated when a user requests it.',
        config: {
          storeStageStatus: true,
          lifecycle: {
            version: 1,
            entityType: 'domain',
            gates: [],
            exits: [{ stage: 'Deprecated', trigger: 'onRequest' }],
          },
        },
        trigger: {
          type: 'eventBasedEntity',
          config: {
            entityTypes: ['domain'],
            events: ['Created', 'Updated'],
            exclude: ['entityStatus'],
            filter: {
              domain: JSON.stringify({ '!=': [{ var: 'name' }, domainName] }),
            },
          },
          output: ['relatedEntity', 'updatedBy'],
        },
        nodes: [
          { name: 'start', type: 'startEvent', subType: 'startEvent' },
          {
            name: 'ExitCheck0',
            type: 'automatedTask',
            subType: 'checkEntityAttributesTask',
            config: {
              rules: JSON.stringify({
                '==': [{ var: 'lifecycleRequest' }, 'Deprecated'],
              }),
            },
            inputNamespaceMap: { relatedEntity: 'global' },
          },
          {
            name: 'ExitApprove0',
            type: 'userTask',
            subType: 'userApprovalTask',
            config: {
              assignees: { addOwners: true, emptyAssigneeStrategy: 'wait' },
              approvalThreshold: 1,
              rejectionThreshold: 1,
              lifecycleMove: { targetStage: 'Deprecated' },
            },
            inputNamespaceMap: { relatedEntity: 'global' },
            output: ['updatedBy'],
          },
          {
            name: 'ExitSet0',
            type: 'automatedTask',
            subType: 'setEntityAttributeTask',
            config: { fieldName: 'status', fieldValue: 'Deprecated' },
            inputNamespaceMap: {
              relatedEntity: 'global',
              updatedBy: 'ExitApprove0',
            },
          },
          {
            name: 'ExitClear0',
            type: 'automatedTask',
            subType: 'setEntityAttributeTask',
            config: { fieldName: 'lifecycleRequest', fieldValue: '' },
            inputNamespaceMap: { relatedEntity: 'global', updatedBy: 'global' },
          },
          { name: 'end', type: 'endEvent', subType: 'endEvent' },
        ],
        edges: [
          { from: 'start', to: 'ExitCheck0' },
          { from: 'ExitCheck0', to: 'ExitApprove0', condition: 'true' },
          { from: 'ExitCheck0', to: 'end', condition: 'false' },
          { from: 'ExitApprove0', to: 'ExitSet0', condition: 'approve' },
          { from: 'ExitApprove0', to: 'ExitClear0', condition: 'reject' },
          { from: 'ExitSet0', to: 'ExitClear0' },
          { from: 'ExitClear0', to: 'end' },
        ],
      },
    }),
    'createDeprecateOnRequestLifecycle'
  );

// Owns the stage of one domain without any exit, so the domain is offered no request whatever
// other lifecycle the server runs. The name sorts before other stage workflows.
const createLifecycleWithoutExits = async (
  apiContext: APIRequestContext,
  name: string,
  domainName: string
) =>
  okJson<{ id: string }>(
    await apiContext.post('/api/v1/governance/workflowDefinitions', {
      data: {
        name,
        description: "Owns one domain's stage and takes no requests.",
        config: {
          storeStageStatus: true,
          lifecycle: { version: 1, entityType: 'domain', gates: [] },
        },
        trigger: {
          type: 'eventBasedEntity',
          config: {
            entityTypes: ['domain'],
            events: ['Created', 'Updated'],
            exclude: ['entityStatus'],
            filter: {
              domain: JSON.stringify({ '!=': [{ var: 'name' }, domainName] }),
            },
          },
          output: ['relatedEntity', 'updatedBy'],
        },
        nodes: [
          { name: 'start', type: 'startEvent', subType: 'startEvent' },
          {
            name: 'Unstaged',
            type: 'automatedTask',
            subType: 'checkEntityAttributesTask',
            config: {
              rules: JSON.stringify({ '==': [{ var: 'entityStatus' }, null] }),
            },
            inputNamespaceMap: { relatedEntity: 'global' },
          },
          {
            name: 'SetDraft',
            type: 'automatedTask',
            subType: 'setEntityAttributeTask',
            config: { fieldName: 'status', fieldValue: 'Draft' },
            inputNamespaceMap: { relatedEntity: 'global', updatedBy: 'global' },
          },
          { name: 'end', type: 'endEvent', subType: 'endEvent' },
        ],
        edges: [
          { from: 'start', to: 'Unstaged' },
          { from: 'Unstaged', to: 'SetDraft', condition: 'true' },
          { from: 'Unstaged', to: 'end', condition: 'false' },
          { from: 'SetDraft', to: 'end' },
        ],
      },
    }),
    'createLifecycleWithoutExits'
  );

const openDomain = async (page: Page, domain: Domain) => {
  await page.goto(`/domain/${encodeURIComponent(domain.fullyQualifiedName)}`);
  await waitForAllLoadersToDisappear(page);
};

const openStageMenu = async (page: Page) => {
  await page.getByTestId('entity-status-request-trigger').click();
  await expect(page.getByTestId('entity-status-request-menu')).toBeVisible();
};

const openRequestTasks = async (
  apiContext: APIRequestContext,
  domain: Domain,
  lifecycleId: string
) =>
  (
    await okJson<{ data: Task[] }>(
      await apiContext.get('/api/v1/tasks', {
        params: {
          aboutEntity: domain.fullyQualifiedName,
          statusGroup: 'open',
          limit: 20,
        },
      }),
      'openTasks'
    )
  ).data.filter((task) => task.workflowDefinitionId === lifecycleId);

const approveOpenRequest = async (
  apiContext: APIRequestContext,
  domain: Domain,
  lifecycleId: string
) => {
  await expect
    .poll(
      async () =>
        (
          await openRequestTasks(apiContext, domain, lifecycleId)
        ).length,
      { timeout: 60_000 }
    )
    .toBe(1);
  const [request] = await openRequestTasks(apiContext, domain, lifecycleId);
  await okJson(
    await apiContext.post(`/api/v1/tasks/${request.id}/resolve`, {
      data: { resolutionType: 'Approved' },
    }),
    'resolveRequest'
  );
};

test.describe('Lifecycle request', () => {
  const suffix = uuid();
  let offered: Domain;
  let notOffered: Domain;
  let lifecycleId: string;
  let noExitsLifecycleId: string;

  test.beforeEach(async ({ page, dataStewardPage }) => {
    await redirectToHomePage(dataStewardPage);
    const steward = await getApiContext(dataStewardPage);
    const owner = await okJson<{ id: string }>(
      await steward.apiContext.get('/api/v1/users/loggedInUser'),
      'loggedInUser'
    );
    await steward.afterAction();
    await redirectToHomePage(page);
    const { apiContext, afterAction } = await getApiContext(page);
    offered = await createDomain(apiContext, `pwOffered${uuid()}`, owner.id);
    notOffered = await createDomain(
      apiContext,
      `pwNotOffered${uuid()}`,
      owner.id
    );
    ({ id: lifecycleId } = await createDeprecateOnRequestLifecycle(
      apiContext,
      `ALcPw_${suffix}${uuid()}`,
      offered.name
    ));
    ({ id: noExitsLifecycleId } = await createLifecycleWithoutExits(
      apiContext,
      `ALcPwNo_${suffix}${uuid()}`,
      notOffered.name
    ));
    await afterAction();
  });

  test.afterEach(async ({ page }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    for (const id of [lifecycleId, noExitsLifecycleId]) {
      await apiContext.delete(
        `/api/v1/governance/workflowDefinitions/${id}?hardDelete=true`
      );
    }
    for (const domain of [offered, notOffered]) {
      await apiContext.delete(
        `/api/v1/domains/${domain.id}?hardDelete=true&recursive=true`
      );
    }
    await afterAction();
  });

  test('requesting Deprecate shows the request until the owner approves it', async ({
    page,
    dataStewardPage,
  }) => {
    await openDomain(page, offered);
    await openStageMenu(page);

    const requestResponse = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/domains/${offered.id}`) &&
        response.request().method() === 'PATCH'
    );
    await page.getByTestId('request-deprecated-button').click();

    expect((await requestResponse).status()).toBe(200);
    await expect(page.getByTestId('lifecycle-request-badge')).toBeVisible();
    await expect(page.getByTestId('entity-status-request-trigger')).toHaveCount(
      0
    );

    const { apiContext, afterAction } = await getApiContext(dataStewardPage);
    await approveOpenRequest(apiContext, offered, lifecycleId);
    await afterAction();

    await expect
      .poll(
        async () => {
          await openDomain(page, offered);

          return page.getByTestId('lifecycle-request-badge').count();
        },
        { timeout: 60_000 }
      )
      .toBe(0);
    await expect(page.getByText('Deprecated', { exact: true })).toBeVisible();
    await expect(page.getByTestId('entity-status-request-trigger')).toHaveCount(
      0
    );
  });

  test('a domain its lifecycle does not offer Deprecate to shows no request entry', async ({
    page,
  }) => {
    // The offer is read after the page renders; wait for it before checking the chip is absent.
    const offer = page.waitForResponse((response) =>
      response
        .url()
        .includes(
          `/api/v1/metadata/types/lifecycleStages/domain/${notOffered.id}/requestableStages`
        )
    );
    await openDomain(page, notOffered);

    expect(await (await offer).json()).toEqual([]);
    await expect(page.getByTestId('entity-status-request-trigger')).toHaveCount(
      0
    );
    await expect(page.getByTestId('lifecycle-request-badge')).toHaveCount(0);
  });
});
