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
import { SidebarItem } from '../constant/sidebar';
import { ResponseDataType } from '../support/entity/Entity.interface';
import { TableClass } from '../support/entity/TableClass';
import { getCurrentMillis } from './dateTime';
import { getEncodedFqn, waitForAllLoadersToDisappear } from './entity';
import {
  triggerIngestionPipeline,
  waitForIngestionResult,
} from './ingestionExecution';
import { sidebarClick } from './sidebar';
import { waitForTaskResolveResponse } from './task';

/**
 * Seeds `count` failing test cases on `table`, each of which produces an
 * incident, WITHOUT deploying or running an ingestion pipeline. A failed test
 * case result is posted directly via the API, which is what actually creates an
 * incident — the pipeline is only one way to produce that result.
 *
 * Use this for tests that just need incidents to exist (UI, pagination,
 * filters). It is deterministic and takes seconds, so those tests no longer
 * depend on Airflow or queue behaviour. Tests that verify pipeline behaviour
 * (e.g. re-running a pipeline resolves an incident) must still use a real
 * pipeline via triggerTestSuitePipelineAndWaitForSuccess.
 *
 * Returns the created test cases (in creation order).
 */
export const seedFailedIncidents = async (data: {
  apiContext: APIRequestContext;
  table: TableClass;
  count: number;
}): Promise<ResponseDataType[]> => {
  const { apiContext, table, count } = data;
  const failTimestamp = getCurrentMillis();
  const testCases: ResponseDataType[] = [];

  for (let i = 0; i < count; i++) {
    const testCase = await table.createTestCase(apiContext);
    await table.addTestCaseResult(apiContext, testCase['fullyQualifiedName'], {
      result: 'Seeded failing result to create an incident.',
      testResultValue: [{ name: 'seeded', value: '0' }],
      testCaseStatus: 'Failed',
      timestamp: failTimestamp,
    });
    testCases.push(testCase);
  }

  // Wait until ALL seeded incidents are indexed, not just the last — Elasticsearch
  // indexing is not ordered, so an earlier incident can still be missing when the
  // last one is searchable, which would under-fill the list and defeat the point.
  const seededFqns = new Set(
    testCases.map((testCase) => testCase['fullyQualifiedName'])
  );
  await expect
    .poll(
      async () => {
        const response = await apiContext.get(
          `/api/v1/dataQuality/testCases/testCaseIncidentStatus?latest=true` +
            `&startTs=${failTimestamp - 60_000}` +
            `&endTs=${failTimestamp + 120_000}` +
            `&limit=${count + 50}`
        );

        if (!response.ok()) {
          return 0;
        }

        const body = await response.json();
        const indexedFqns = new Set(
          (body.data ?? []).map(
            (incident: {
              testCaseReference?: { fullyQualifiedName?: string };
            }) => incident.testCaseReference?.fullyQualifiedName
          )
        );

        return [...seededFqns].filter((fqn) => indexedFqns.has(fqn)).length;
      },
      { timeout: 90_000, intervals: [2_000, 3_000, 5_000] }
    )
    .toBeGreaterThanOrEqual(count);

  return testCases;
};

export const visitProfilerTab = async (page: Page, table: TableClass) => {
  await page.goto(
    `/table/${getEncodedFqn(
      table.entityResponseData.fullyQualifiedName ?? ''
    )}/profiler/data-quality`
  );
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByRole('tab', { name: 'Data Quality' })).toBeVisible();
};

/**
 * Asserts a failed test case's incident sits at `status`, then opens the test
 * case details page. Drives no transition, but leaves the page where
 * {@link acknowledgeTask} does so callers can go on to the Incident tab.
 */
export const verifyIncidentStatus = async (data: {
  testCase: string;
  page: Page;
  table: TableClass;
  status: string;
}) => {
  const { testCase, page, table, status } = data;
  await visitProfilerTab(page, table);
  await page.getByRole('tab', { name: 'Data Quality' }).click();

  await expect(
    page.locator(`[data-testid="status-badge-${testCase}"]`)
  ).toContainText('Failed');

  await expect(
    page.locator(`[data-testid="${testCase}-status"]`)
  ).toContainText(status);
  await page.getByTestId(testCase).getByText(testCase).click();
  await waitForAllLoadersToDisappear(page);
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

  const taskHeaderAssignee = page.getByTestId(
    'incident-manager-task-header-container'
  );
  // List pages can contain several incidents, so a generic first() may assert
  // against an unrelated unassigned row instead of the incident just updated.
  const incidentAssignee = testCaseName
    ? page
        .locator('tr')
        .filter({ has: page.getByTestId(`test-case-${testCaseName}`) })
        .first()
        .getByTestId('assignee')
    : page.getByTestId('assignee').first();

  await expect(
    (await taskHeaderAssignee.isVisible().catch(() => false))
      ? taskHeaderAssignee
      : incidentAssignee
  ).toContainText(user.displayName, { timeout: 30_000 });
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

export const triggerTestSuitePipelineAndWaitForSuccess = async (data: {
  page: Page;
  apiContext: APIRequestContext;
  pipeline: ResponseDataType;
  successTimeout?: number;
}) => {
  const { apiContext, pipeline, successTimeout = 300_000 } = data;
  const startedAfter = await triggerIngestionPipeline(apiContext, pipeline.id);
  await waitForIngestionResult(
    apiContext,
    pipeline.fullyQualifiedName,
    startedAfter,
    {
      timeout: successTimeout,
      intervals: [2_000, 5_000, 10_000],
    }
  );
};
