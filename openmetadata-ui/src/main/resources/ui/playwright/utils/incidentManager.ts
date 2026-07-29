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
import {
  PipelineState,
  PipelineStatus,
} from '../../src/generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getEncodedFqn } from '../../src/utils/StringUtils';
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

  await expect(
    page.locator(`[data-testid="${testCase}-status"]`)
  ).toContainText('New');
  await page.getByTestId(testCase).getByText(testCase).click();
  await waitForAllLoadersToDisappear(page);
  await page.click('[data-testid="edit-resolution-icon"]');
  await page.click('[data-testid="test-case-resolution-status-type"]');
  await page.click('[title="Ack"]');
  const statusChangeResponse = waitForTaskResolveResponse(page);
  await page.click('#update-status-button');
  await statusChangeResponse;
  await expect(
    page.locator(`[data-testid="${testCase}-status"]`)
  ).toContainText('Ack');

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
      .locator('tr')
      .filter({ has: page.getByTestId(`test-case-${testCaseName}`) })
      .first();
    const editOwnerButton = incidentRow.getByTestId('edit-owner');

    await expect(editOwnerButton).toBeVisible();
    await editOwnerButton.click();
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
          .getByTestId(`test-case-${testCaseName}`)
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
    await page.getByTestId('status-item-Assigned').click();
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

// Attempts at 0s, +1s, +2s, +3s — the 6s worst case covers the settling time
// the previous fixed sleep was guessing at, without paying it on every run.
const PIPELINE_REQUEST_ATTEMPTS = 4;

export const triggerTestSuitePipelineAndWaitForSuccess = async (data: {
  page: Page;
  apiContext: APIRequestContext;
  pipeline: ResponseDataType;
}) => {
  const { page, apiContext, pipeline } = data;
  const encodedPipelineFqn = encodeURIComponent(
    pipeline?.['fullyQualifiedName']
  );

  // `fetched` separates "the pipeline has not run yet" from "the status read
  // failed" — both yield no run, but only the former is a safe baseline.
  const fetchLatestPipelineStatus = async (): Promise<{
    fetched: boolean;
    run?: PipelineStatus;
  }> => {
    const pipelineStatusResponse = await apiContext.get(
      `/api/v1/services/ingestionPipelines/${encodedPipelineFqn}/pipelineStatus?limit=1`
    );

    if (pipelineStatusResponse.ok()) {
      const body = await pipelineStatusResponse.json();
      const statuses: PipelineStatus[] = Array.isArray(body?.data)
        ? body.data
        : [];

      if (statuses[0]) {
        return { fetched: true, run: statuses[0] };
      }
    }

    const ingestionPipelineResponse = await apiContext.get(
      `/api/v1/services/ingestionPipelines/name/${encodedPipelineFqn}?fields=pipelineStatuses`
    );

    if (!ingestionPipelineResponse.ok()) {
      return { fetched: false };
    }

    const ingestionPipeline = await ingestionPipelineResponse.json();

    return { fetched: true, run: ingestionPipeline?.pipelineStatuses?.[0] };
  };

  const requestWithRetry = async (
    request: () => Promise<Awaited<ReturnType<APIRequestContext['post']>>>
  ) => {
    let response = await request();

    for (
      let attempt = 1;
      attempt < PIPELINE_REQUEST_ATTEMPTS && !response.ok();
      attempt++
    ) {
      // eslint-disable-next-line playwright/no-wait-for-timeout -- bounded backoff before retrying a rejected request
      await page.waitForTimeout(1000 * attempt);
      response = await request();
    }

    return response;
  };

  const executePipelineRequest = async (
    label: string,
    request: () => Promise<Awaited<ReturnType<APIRequestContext['post']>>>
  ) => {
    const response = await requestWithRetry(request);

    if (!response.ok()) {
      throw new Error(
        `${label} failed for ingestion pipeline ${pipeline?.['id']} (${
          pipeline?.['fullyQualifiedName']
        }): HTTP ${response.status()} ${await response.text()}`
      );
    }

    return response;
  };

  const triggerPipeline = () =>
    apiContext.post(
      `/api/v1/services/ingestionPipelines/trigger/${pipeline?.['id']}`
    );

  // Airflow queues the DAG asynchronously, so the previous run's `success`
  // record stays the latest one for a while after triggering. Remember it here
  // so the poll below waits for a genuinely new run instead of reading the old
  // one and letting the caller assert on stale results. A baseline we failed to
  // read would defeat that, so retry and then fail loudly rather than silently
  // treating the previous run as new.
  const fetchBaselineRun = async () => {
    for (let attempt = 1; attempt <= PIPELINE_REQUEST_ATTEMPTS; attempt++) {
      const { fetched, run } = await fetchLatestPipelineStatus();

      if (fetched) {
        return run;
      }

      if (attempt < PIPELINE_REQUEST_ATTEMPTS) {
        // eslint-disable-next-line playwright/no-wait-for-timeout -- bounded backoff before re-reading the baseline status
        await page.waitForTimeout(1000 * attempt);
      }
    }

    throw new Error(
      `Unable to read the status baseline for ingestion pipeline ${pipeline?.['id']} (${pipeline?.['fullyQualifiedName']})`
    );
  };

  const previousRun = await fetchBaselineRun();
  const isNewRun = (latestRun: PipelineStatus) =>
    latestRun.runId !== previousRun?.runId &&
    (latestRun.timestamp ?? 0) >= (previousRun?.timestamp ?? 0);

  // The orchestrator rejects the trigger until a freshly deployed workflow is
  // registered, so retry until it is accepted rather than sleeping for a
  // guessed settling time.
  const response = await requestWithRetry(triggerPipeline);

  if (!response.ok()) {
    // re-deploy the pipeline then trigger it
    await executePipelineRequest('Pipeline deploy', () =>
      apiContext.post(
        `/api/v1/services/ingestionPipelines/deploy/${pipeline?.['id']}`
      )
    );

    await executePipelineRequest('Pipeline trigger', triggerPipeline);
  }

  await expect
    .poll(
      async () => {
        const { run: latestRun } = await fetchLatestPipelineStatus();

        if (!latestRun || !isNewRun(latestRun)) {
          return PipelineState.Queued;
        }

        return latestRun.pipelineState ?? PipelineState.Queued;
      },
      {
        message: `Wait for a new run of ingestion pipeline ${
          pipeline?.['fullyQualifiedName']
        } to be successful (run recorded before trigger: ${
          previousRun?.runId ?? 'none'
        })`,
        timeout: 300_000,
        intervals: [2_000, 5_000, 10_000],
      }
    )
    .toBe(PipelineState.Success);
};
