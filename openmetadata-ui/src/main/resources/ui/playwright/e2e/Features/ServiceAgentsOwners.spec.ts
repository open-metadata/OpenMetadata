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
import { PLAYWRIGHT_INGESTION_TAG_OBJ } from '../../constant/config';
import { DatabaseServiceClass } from '../../support/entity/service/DatabaseServiceClass';
import { expect, test } from '../../support/fixtures/base';
import { UserClass } from '../../support/user/UserClass';
import { createNewPage, uuid } from '../../utils/common';
import {
  assignServiceOwner,
  clearAgentOwners,
  openAddAgentForm,
  openEditAgentForm,
  selectAgentOwner,
} from '../../utils/serviceIngestion';

test.use({ storageState: 'playwright/.auth/admin.json' });

// The create and edit flows each own a service so they stay independent and can
// run in any order. Constructed in `beforeAll` so each fixture is built by the
// same hook that creates it, and torn down by its pair in `afterAll`.
let createFlowService: DatabaseServiceClass;
let editFlowService: DatabaseServiceClass;
let serviceOwner: UserClass;
let newOwner: UserClass;

let editPipelineFqn = '';

test.describe('Service agents owners', PLAYWRIGHT_INGESTION_TAG_OBJ, () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await createNewPage(browser);

    createFlowService = new DatabaseServiceClass();
    editFlowService = new DatabaseServiceClass();
    serviceOwner = new UserClass();
    newOwner = new UserClass();

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

      const createResult = await createResponse;

      expect(createResult.status()).toBe(201);

      const created = await createResult.json();

      expect(created.owners).toHaveLength(1);
      expect(created.owners[0].id).toBe(newOwner.responseData.id);
    });
  });

  test('edit form shows the saved owners and replaces them on save', async ({
    page,
  }) => {
    await openEditAgentForm(page, editFlowService, editPipelineFqn);

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
          response.url().includes('/services/ingestionPipelines/')
      );

      await page.getByTestId('next-button').click();

      const updateResult = await updateResponse;

      expect(updateResult.status()).toBe(200);

      const updated = await updateResult.json();

      expect(updated.owners).toHaveLength(1);
      expect(updated.owners[0].id).toBe(serviceOwner.responseData.id);
    });

    await test.step('Reopening the agent shows the persisted owners', async () => {
      await openEditAgentForm(page, editFlowService, editPipelineFqn);

      await expect(
        page
          .getByTestId('ingestion-owners')
          .getByTestId(serviceOwner.getUserDisplayName())
      ).toBeVisible();
    });
  });
});
