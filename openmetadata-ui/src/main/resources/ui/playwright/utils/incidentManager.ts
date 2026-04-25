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
import { getEncodedFqn } from '../../src/utils/StringsUtils';
import { SidebarItem } from '../constant/sidebar';
import { ResponseDataType } from '../support/entity/Entity.interface';
import { TableClass } from '../support/entity/TableClass';
import { waitForAllLoadersToDisappear } from './entity';
import { sidebarClick } from './sidebar';
import { waitForTaskResolveResponse } from './task';

export const visitProfilerTab = async (page: Page, table: TableClass) => {
  await page.goto(
    `/table/${getEncodedFqn(
      table.entityResponseData.fullyQualifiedName ?? ''
    )}/profiler/data-quality`
  );
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByRole('tab', { name: 'Data Quality' })).toBeVisible();
};

export const acknowledgeTask = async (data: {
  testCase: string;
  page: Page;
  table: TableClass;
}) => {
  const { testCase, page, table } = data;
  await visitProfilerTab(page, table);
  await page.getByRole('tab', { name: 'Data Quality' }).click();

  await expect(
    page.locator(`[data-testid="status-badge-${testCase}"]`)
  ).toContainText('Failed');

  await page
    .locator(`[data-testid="${testCase}-status"] >> text=New`)
    .waitFor();
  await page.click(`[data-testid="${testCase}"] >> text=${testCase}`);
  await waitForAllLoadersToDisappear(page);
  await page.click('[data-testid="edit-resolution-icon"]');
  await page.click('[data-testid="test-case-resolution-status-type"]');
  await page.click('[title="Ack"]');
  const statusChangeResponse = waitForTaskResolveResponse(page);
  await page.click('#update-status-button');
  await statusChangeResponse;
  await page
    .locator(`[data-testid="${testCase}-status"] >> text=Ack`)
    .waitFor();

  await expect(
    page.locator(
      `[data-testid="${testCase}-status"] [data-testid="badge-container"]`
    )
  ).toContainText('Ack');
};

export const addAssigneeFromPopoverWidget = async (data: {
  page: Page;
  user: { name: string; displayName: string };
  testCaseName?: string;
}) => {
  const { page, user, testCaseName } = data;
  const taskTabEditAssigneesButton = page.getByTestId('edit-assignees').last();

  if (testCaseName) {
    const incidentRow = page
      .getByRole('row', { name: new RegExp(testCaseName, 'i') })
      .first();
    const editOwnerButton = incidentRow.getByTestId('edit-owner');

    if (await editOwnerButton.isVisible().catch(() => false)) {
      await editOwnerButton.click();
    } else {
      await incidentRow.locator('td').last().getByRole('button').click();
    }
  } else if (await taskTabEditAssigneesButton.isVisible().catch(() => false)) {
    await taskTabEditAssigneesButton.click();
    await waitForAllLoadersToDisappear(page);

    const assigneeModal = page.locator('.ant-modal-content').last();
    const assigneeSelect = assigneeModal.getByTestId('select-assignee');
    const assigneeSelector = assigneeSelect.locator('.ant-select-selector');
    const assigneeInput = assigneeSelect.locator('input').last();
    const assigneeOption = page.getByTestId(user.name).first();
    const normalizedAssigneeOption = page
      .getByTestId(user.name.toLowerCase())
      .first();

    await expect(assigneeModal).toBeVisible();
    await expect(assigneeSelector).toBeVisible();

    await assigneeSelector.click();
    await assigneeInput.fill(user.displayName);

    if (await assigneeOption.isVisible().catch(() => false)) {
      await assigneeOption.click();
    } else {
      await expect(normalizedAssigneeOption).toBeVisible({ timeout: 30_000 });
      await normalizedAssigneeOption.click();
    }

    const updateIncident = waitForTaskResolveResponse(page);
    await assigneeModal.getByRole('button', { name: 'Save' }).click();
    await updateIncident;

    await waitForAllLoadersToDisappear(page);
    await expect(assigneeModal).not.toBeVisible();
    const taskHeaderAssignee = page.getByTestId(
      'incident-manager-task-header-container'
    );
    const incidentAssignee = page
      .getByTestId('incident-manager-details-page-container')
      .getByTestId('assignee');

    await expect(
      (await taskHeaderAssignee.isVisible().catch(() => false))
        ? taskHeaderAssignee
        : (await incidentAssignee.isVisible().catch(() => false))
        ? incidentAssignee
        : page.getByTestId('assignee').first()
    ).toContainText(user.displayName, {
      timeout: 30_000,
    });

    return;
  } else {
    // direct assignment from edit assignee icon
    await page.getByTestId('assignee').getByTestId('edit-owner').click();
  }

  await waitForAllLoadersToDisappear(page);

  await page.getByRole('tab', { name: 'Users' }).click();

  await waitForAllLoadersToDisappear(page);

  const searchUserResponse = page.waitForResponse('/api/v1/search/query?q=*');
  await page.fill(
    '[data-testid="owner-select-users-search-bar"]',
    user.displayName
  );
  await searchUserResponse;

  const updateIncident = waitForTaskResolveResponse(page);
  await page.click(`.ant-popover [title="${user.displayName}"]`);
  await updateIncident;

  await page
    .getByTestId('assignee')
    .getByTestId('owner-link')
    .first()
    .waitFor();

  const taskHeaderAssignee = page.getByTestId(
    'incident-manager-task-header-container'
  );

  await expect(
    (await taskHeaderAssignee.isVisible().catch(() => false))
      ? taskHeaderAssignee
      : page.getByTestId('assignee').first()
  ).toContainText(user.displayName);
};

export const assignIncident = async (data: {
  testCaseName: string;
  page: Page;
  user: { name: string; displayName: string };
  direct?: boolean; // Whether to update from edit assignee icon or from status dropdown
}) => {
  const { testCaseName, page, user, direct = false } = data;
  await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);
  await expect
    .poll(
      async () => {
        const incidentRow = page
          .getByRole('row', { name: new RegExp(testCaseName, 'i') })
          .first();
        const incidentLink = page
          .getByRole('link', { name: testCaseName })
          .first();

        return (
          (await incidentRow.isVisible().catch(() => false)) ||
          (await incidentLink.isVisible().catch(() => false))
        );
      },
      {
        message: `Wait for incident ${testCaseName} to appear in Incident Manager`,
        timeout: 60_000,
        intervals: [1_000, 2_000, 5_000],
      }
    )
    .toBe(true);
  await page.reload();
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId(`test-case-${testCaseName}`).waitFor();
  if (direct) {
    // direct assignment from edit assignee icon
    await addAssigneeFromPopoverWidget({ page, user, testCaseName });
  } else {
    await page.click(`[data-testid="${testCaseName}-status"]`);
    await page.getByRole('menuitem', { name: 'Assigned' }).click();
    await page.getByTestId(`${testCaseName}-assignee-popover`).waitFor();
    await page.click('[data-testid="assignee-search-input"]');

    const searchUserResponse = page.waitForResponse(
      'api/v1/search/query?q=*&index=user*'
    );
    await page.fill(
      '[data-testid="assignee-search-input"] input',
      user.displayName
    );
    await searchUserResponse;
    await page.click(`[data-testid="${user.name.toLocaleLowerCase()}"]`);
    const updateIncident = waitForTaskResolveResponse(page);
    await page.click('[data-testid="submit-assignee-popover-button"]');
    await updateIncident;
  }
  await page
    .locator(`[data-testid="${testCaseName}-status"] >> text=Assigned`)
    .waitFor();

  await expect(
    page.locator(`[data-testid="${testCaseName}-status"]`)
  ).toContainText('Assigned');
};

export const triggerTestSuitePipelineAndWaitForSuccess = async (data: {
  page: Page;
  apiContext: APIRequestContext;
  pipeline: ResponseDataType;
}) => {
  const { page, apiContext, pipeline } = data;
  const executePipelineRequest = async (
    label: string,
    request: () => Promise<Awaited<ReturnType<APIRequestContext['post']>>>
  ) => {
    let lastStatus: number | undefined;
    let lastBody = '';

    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await request();

      if (response.ok()) {
        return response;
      }

      lastStatus = response.status();
      lastBody = await response.text();

      if (attempt < 3) {
        // eslint-disable-next-line playwright/no-wait-for-timeout -- bounded retry for transient pipeline readiness
        await page.waitForTimeout(1000 * attempt);
      }
    }

    throw new Error(
      `${label} failed for ingestion pipeline ${pipeline?.['id']} (${pipeline?.['fullyQualifiedName']}): HTTP ${lastStatus} ${lastBody}`
    );
  };

  // eslint-disable-next-line playwright/no-wait-for-timeout -- pipeline deployment settling time
  await page.waitForTimeout(5000);
  const response = await apiContext.post(
    `/api/v1/services/ingestionPipelines/trigger/${pipeline?.['id']}`
  );

  if (response.status() !== 200) {
    // re-deploy the pipeline then trigger it
    await executePipelineRequest('Pipeline deploy', () =>
      apiContext.post(
        `/api/v1/services/ingestionPipelines/deploy/${pipeline?.['id']}`
      )
    );

    // eslint-disable-next-line playwright/no-wait-for-timeout -- pipeline deployment settling time
    await page.waitForTimeout(5000);

    await executePipelineRequest('Pipeline trigger', () =>
      apiContext.post(
        `/api/v1/services/ingestionPipelines/trigger/${pipeline?.['id']}`
      )
    );
  }

  // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for pipeline run to complete
  await page.waitForTimeout(2000);

  await expect
    .poll(
      async () => {
        const pipelineStatusResponse = await apiContext.get(
          `/api/v1/services/ingestionPipelines/${encodeURIComponent(
            pipeline?.['fullyQualifiedName']
          )}/pipelineStatus?limit=1`
        );

        if (pipelineStatusResponse.ok()) {
          const body = await pipelineStatusResponse.json();
          const statuses = Array.isArray(body?.data) ? body.data : [];

          if (statuses[0]?.pipelineState) {
            return statuses[0].pipelineState;
          }
        }

        const ingestionPipelineResponse = await apiContext.get(
          `/api/v1/services/ingestionPipelines/name/${encodeURIComponent(
            pipeline?.['fullyQualifiedName']
          )}?fields=pipelineStatuses`
        );

        if (!ingestionPipelineResponse.ok()) {
          return 'running';
        }

        const ingestionPipeline = await ingestionPipelineResponse.json();

        return ingestionPipeline?.pipelineStatuses?.pipelineState ?? 'running';
      },
      {
        // Custom expect message for reporting, optional.
        message: 'Wait for the pipeline to be successful',
        timeout: 300_000,
        intervals: [5_000, 10_000, 15_000],
      }
    )
    .toBe('success');
};
