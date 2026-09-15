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
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { expect, test } from '../../support/fixtures/base';
import { UserClass } from '../../support/user/UserClass';
import { createNewPage, redirectToHomePage, uuid } from '../../utils/common';
import { addMultiOwner } from '../../utils/entity';
import { waitForIngestionWorkflowForm } from '../../utils/serviceIngestion';

test.use({ storageState: 'playwright/.auth/admin.json' });

// Each describe owns its own service so the create and edit flows stay
// independent and can run in any order.
const createFlowService = new DatabaseServiceClass();
const editFlowService = new DatabaseServiceClass();
const serviceOwner = new UserClass();
const newOwner = new UserClass();

let editPipelineFqn = '';

const assignServiceOwner = async (
  apiContext: APIRequestContext,
  service: DatabaseServiceClass,
  owner: UserClass
) => {
  const response = await apiContext.patch(
    `/api/v1/services/databaseServices/${service.entityResponseData.id}`,
    {
      data: [
        {
          op: 'add',
          path: '/owners',
          value: [{ id: owner.responseData.id, type: 'user' }],
        },
      ],
      headers: { 'Content-Type': 'application/json-patch+json' },
    }
  );

  expect(response.status()).toBe(200);
};

const openAgentsTab = async (page: Page, service: DatabaseServiceClass) => {
  await redirectToHomePage(page);
  await service.visitEntityPage(page);
  await page.getByTestId('data-assets-header').waitFor();
  await page.click('[role="tab"] [data-testid="agents"]');

  const metadataSubTab = page.getByTestId('metadata-sub-tab');
  if (await metadataSubTab.isVisible()) {
    await metadataSubTab.click();
  }
};

const openAddAgentForm = async (page: Page, service: DatabaseServiceClass) => {
  await openAgentsTab(page, service);

  await page.getByTestId('add-new-ingestion-button').waitFor();
  await page.click('[data-testid="add-new-ingestion-button"]');
  await page
    .locator('.ant-dropdown:visible [data-menu-id*="metadata"]')
    .waitFor();
  await page.click('.ant-dropdown:visible [data-menu-id*="metadata"]');

  await waitForIngestionWorkflowForm(page);
};

const openEditAgentForm = async (page: Page, service: DatabaseServiceClass) => {
  await openAgentsTab(page, service);

  await page
    .getByTestId(`agent-card-${editPipelineFqn}`)
    .getByTestId('more-actions')
    .click();
  await page.getByTestId('edit-button').click();

  await waitForIngestionWorkflowForm(page);
};

/**
 * Deselects every owner through the picker. Owners are mandatory, so this is
 * the only empty state a user can actually produce.
 */
const clearAgentOwners = async (page: Page) => {
  await page.getByTestId('add-ingestion-owners').click();

  await expect(page.getByTestId('select-owner-tabs')).toBeVisible();

  await page
    .getByTestId('select-owner-tabs')
    .getByRole('tab', { name: 'Users' })
    .click();

  const usersPanel = page.locator('[data-testid="owner-select-users-panel"]');

  // The list loads async; the clear button only renders once it has, so waiting
  // on it covers the load without reaching for a loader locator.
  const clearAllButton = usersPanel.getByTestId('clear-all-button');
  await expect(clearAllButton).toBeVisible();
  await clearAllButton.click();

  await usersPanel.getByTestId('selectable-list-update-btn').click();

  await expect(page.getByTestId('select-owner-tabs')).not.toBeVisible();
};

const selectAgentOwner = async (
  page: Page,
  service: DatabaseServiceClass,
  owner: UserClass
) => {
  await addMultiOwner({
    page,
    ownerNames: [owner.getUserDisplayName()],
    activatorBtnDataTestId: 'add-ingestion-owners',
    resultTestId: 'ingestion-owners',
    endpoint: service.endpoint,
    isSelectableInsideForm: true,
    type: 'Users',
  });
};

test.describe('Service agents owners', PLAYWRIGHT_INGESTION_TAG_OBJ, () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await serviceOwner.create(apiContext);
    await newOwner.create(apiContext);
    await createFlowService.create(apiContext);
    await editFlowService.create(apiContext);

    await assignServiceOwner(apiContext, createFlowService, serviceOwner);
    await assignServiceOwner(apiContext, editFlowService, serviceOwner);

    const pipelineResponse = await apiContext.post(
      '/api/v1/services/ingestionPipelines',
      {
        data: {
          airflowConfig: { scheduleInterval: '0 0 * * *' },
          loggerLevel: 'INFO',
          name: `pw-agent-owners-${uuid()}`,
          owners: [{ id: newOwner.responseData.id, type: 'user' }],
          pipelineType: 'metadata',
          service: {
            id: editFlowService.entityResponseData.id,
            type: 'databaseService',
          },
          sourceConfig: { config: { type: 'DatabaseMetadata' } },
        },
      }
    );

    expect(pipelineResponse.status()).toBe(201);

    editPipelineFqn = (await pipelineResponse.json()).fullyQualifiedName;

    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    await createFlowService.delete(apiContext);
    await editFlowService.delete(apiContext);
    await serviceOwner.delete(apiContext);
    await newOwner.delete(apiContext);
    await afterAction();
  });

  test('create form prefills the service owners and requires them', async ({
    page,
  }) => {
    test.slow();

    await openAddAgentForm(page, createFlowService);

    await test.step('Owners default to the service owners', async () => {
      await expect(
        page
          .getByTestId('ingestion-owners')
          .getByTestId(serviceOwner.getUserDisplayName())
      ).toBeVisible();
    });

    await test.step('Clearing owners blocks the next step', async () => {
      await clearAgentOwners(page);

      await page.getByTestId('next-button').click();

      await expect(page.getByTestId('owners-error')).toBeVisible();
      await expect(page.getByTestId('ingestion-name-card')).toBeVisible();
    });

    await test.step('Selecting an owner clears the error', async () => {
      await selectAgentOwner(page, createFlowService, newOwner);

      await expect(page.getByTestId('owners-error')).not.toBeVisible();
    });

    await test.step('Selected owners are sent in the create payload', async () => {
      await page.getByTestId('next-button').click();

      const createResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          response.url().endsWith('/services/ingestionPipelines')
      );

      await page.getByTestId('next-button').click();

      const created = await (await createResponse).json();

      expect(created.owners).toHaveLength(1);
      expect(created.owners[0].id).toBe(newOwner.responseData.id);
    });
  });

  test('edit form shows the saved owners and replaces them on save', async ({
    page,
  }) => {
    test.slow();

    await openEditAgentForm(page, editFlowService);

    await test.step('Saved owners are loaded into the form', async () => {
      await expect(
        page
          .getByTestId('ingestion-owners')
          .getByTestId(newOwner.getUserDisplayName())
      ).toBeVisible();
    });

    await test.step('Changed owners are persisted on save', async () => {
      await clearAgentOwners(page);
      await selectAgentOwner(page, editFlowService, serviceOwner);

      await page.getByTestId('next-button').click();

      const updateResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          response.url().includes('/services/ingestionPipelines/') &&
          response.status() === 200
      );

      await page.getByTestId('next-button').click();

      const updated = await (await updateResponse).json();

      expect(updated.owners).toHaveLength(1);
      expect(updated.owners[0].id).toBe(serviceOwner.responseData.id);
    });

    await test.step('Reopening the agent shows the persisted owners', async () => {
      await openEditAgentForm(page, editFlowService);

      await expect(
        page
          .getByTestId('ingestion-owners')
          .getByTestId(serviceOwner.getUserDisplayName())
      ).toBeVisible();
    });
  });
});
