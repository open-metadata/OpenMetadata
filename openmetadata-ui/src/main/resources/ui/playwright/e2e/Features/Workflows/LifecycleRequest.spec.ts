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
 * A lifecycle with on-request exits to Deprecated and Archived offers them from the stage badge of
 * the assets it owns, and only those. Requesting one shows the pending request next to the stage
 * until the owner decides: approving moves the asset, rejecting leaves it where it was. Only the
 * requester or an admin can withdraw a request. The domains belong to the data steward, since
 * nobody approves their own request.
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

// Owns the stage of one domain and moves it to Deprecated or Archived once its owner approves a
// request. The name sorts before other stage workflows and stays short for Flowable's
// 64-character ids.
const createExitOnRequestLifecycle = async (
  apiContext: APIRequestContext,
  name: string,
  domainName: string
) =>
  okJson<{ id: string }>(
    await apiContext.post('/api/v1/governance/workflowDefinitions', {
      data: {
        name,
        description:
          'Offers one domain Deprecated or Archived on request, approved by its owners.',
        config: {
          storeStageStatus: true,
          lifecycle: {
            version: 1,
            entityType: 'domain',
            gates: [],
            transitions: ['Deprecated', 'Archived'].map((to) => ({
              to,
              trigger: 'onRequest',
              approval: { assignees: ['owners'] },
            })),
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
            name: 'Never',
            type: 'automatedTask',
            subType: 'checkEntityAttributesTask',
            config: { rules: JSON.stringify({ '==': [1, 0] }) },
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
          { from: 'start', to: 'Never' },
          { from: 'Never', to: 'SetDraft', condition: 'true' },
          { from: 'Never', to: 'end', condition: 'false' },
          { from: 'SetDraft', to: 'end' },
        ],
      },
    }),
    'createExitOnRequestLifecycle'
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
  domain: Domain
) =>
  (
    await okJson<{ data: Task[] }>(
      await apiContext.get('/api/v1/tasks', {
        params: {
          aboutEntity: domain.fullyQualifiedName,
          type: 'StatusUpdate',
          status: 'Open',
          limit: 20,
        },
      }),
      'openTasks'
    )
  ).data;

const requestStage = async (
  apiContext: APIRequestContext,
  domain: Domain,
  stage: string
) =>
  okJson<Task>(
    await apiContext.post('/api/v1/tasks', {
      data: {
        category: 'MetadataUpdate',
        type: 'StatusUpdate',
        about: `<#E::domain::${domain.fullyQualifiedName}>`,
        description: 'No longer used',
        payload: { newStatus: stage, reason: 'No longer used' },
      },
    }),
    'requestStage'
  );

const decideOpenRequest = async (
  apiContext: APIRequestContext,
  domain: Domain,
  resolutionType: 'Approved' | 'Rejected'
) => {
  await expect
    .poll(async () => (await openRequestTasks(apiContext, domain)).length, {
      timeout: 60_000,
    })
    .toBe(1);
  const [request] = await openRequestTasks(apiContext, domain);
  await okJson(
    await apiContext.post(`/api/v1/tasks/${request.id}/resolve`, {
      data: { resolutionType, comment: 'Decided by the owner' },
    }),
    'resolveRequest'
  );
};

const submitRequestFromChip = async (
  page: Page,
  stage: 'deprecated' | 'archived',
  reason: string
) => {
  await openStageMenu(page);
  await page.getByTestId(`request-${stage}-button`).click();
  await expect(page.getByTestId('status-request-modal')).toBeVisible();
  await page.getByRole('textbox', { name: /Reason/ }).fill(reason);
  const requestResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/v1/tasks') &&
      response.request().method() === 'POST'
  );
  await page.getByTestId('status-request-submit').click();
  expect((await requestResponse).status()).toBe(201);
  await expect(page.getByTestId('lifecycle-request-badge')).toBeVisible();
};

const openPendingRequestMenu = async (page: Page) => {
  await page.getByTestId('lifecycle-request-trigger').click();
  await expect(page.getByTestId('lifecycle-request-menu')).toBeVisible();
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
    ({ id: lifecycleId } = await createExitOnRequestLifecycle(
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

    await page.getByTestId('request-deprecated-button').click();
    await expect(page.getByTestId('status-request-modal')).toBeVisible();
    await page
      .getByRole('textbox', { name: /Reason/ })
      .fill('Replaced by a newer domain');
    const requestResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/v1/tasks') &&
        response.request().method() === 'POST'
    );
    await page.getByTestId('status-request-submit').click();

    expect((await requestResponse).status()).toBe(201);
    await expect(page.getByTestId('lifecycle-request-badge')).toBeVisible();
    await expect(page.getByTestId('entity-status-request-trigger')).toHaveCount(
      0
    );

    const { apiContext, afterAction } = await getApiContext(dataStewardPage);
    await decideOpenRequest(apiContext, offered, 'Approved');
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
    // A Deprecated domain can still be archived, but not deprecated again.
    await openStageMenu(page);
    await expect(page.getByTestId('request-archived-button')).toBeVisible();
    await expect(page.getByTestId('request-deprecated-button')).toHaveCount(0);
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

  test('the stage menu offers each on-request exit, and an approved Archived request archives the domain', async ({
    page,
    dataStewardPage,
  }) => {
    await openDomain(page, offered);
    await openStageMenu(page);
    await expect(page.getByTestId('request-deprecated-button')).toBeVisible();
    await expect(page.getByTestId('request-archived-button')).toBeVisible();
    await page.keyboard.press('Escape');

    await submitRequestFromChip(page, 'archived', 'Data moved to the archive');
    const { apiContext, afterAction } = await getApiContext(dataStewardPage);
    await decideOpenRequest(apiContext, offered, 'Approved');
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
    await expect(page.getByText('Archived', { exact: true })).toBeVisible();
  });

  test('a rejected request leaves the stage and offers the request again', async ({
    page,
    dataStewardPage,
  }) => {
    await openDomain(page, offered);
    const stageBefore = await page
      .getByTestId('entity-status-request-trigger')
      .innerText();
    await submitRequestFromChip(page, 'deprecated', 'No longer used');

    const { apiContext, afterAction } = await getApiContext(dataStewardPage);
    await decideOpenRequest(apiContext, offered, 'Rejected');
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
    await expect(page.getByTestId('entity-status-request-trigger')).toHaveText(
      stageBefore
    );
    await openStageMenu(page);
    await expect(page.getByTestId('request-deprecated-button')).toBeVisible();
  });

  test('the owner can view a request but only the requester can withdraw it', async ({
    page,
    dataStewardPage,
  }) => {
    const { apiContext, afterAction } = await getApiContext(page);
    const request = await requestStage(apiContext, offered, 'Deprecated');
    await afterAction();

    await openDomain(dataStewardPage, offered);
    await openPendingRequestMenu(dataStewardPage);
    await expect(
      dataStewardPage.getByTestId('view-lifecycle-request')
    ).toBeVisible();
    await expect(
      dataStewardPage.getByTestId('withdraw-lifecycle-request')
    ).toHaveCount(0);

    await openDomain(page, offered);
    await openPendingRequestMenu(page);
    const withdrawn = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/v1/tasks/${request.id}`) && response.ok()
    );
    await page.getByTestId('withdraw-lifecycle-request').click();
    const confirmation = page.getByTestId('confirmation-modal');
    await expect(confirmation).toContainText('Withdraw request?');
    await confirmation.getByTestId('save-button').click();
    await withdrawn;
    await expect(confirmation).toHaveCount(0);

    await expect(page.getByTestId('lifecycle-request-badge')).toHaveCount(0);
    await expect(
      page.getByTestId('entity-status-request-trigger')
    ).toBeVisible();
    const { apiContext: check, afterAction: done } = await getApiContext(page);
    expect(await openRequestTasks(check, offered)).toHaveLength(0);
    await done();
  });
});
