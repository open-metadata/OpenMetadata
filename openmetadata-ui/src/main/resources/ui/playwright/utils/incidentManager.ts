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
import { redirectToHomePage } from './common';
import { makeRetryRequest } from './serviceIngestion';
import { sidebarClick } from './sidebar';
import { waitForAllLoadersToDisappear } from './entity';

export const visitProfilerTab = async (page: Page, table: TableClass) => {
  await redirectToHomePage(page);
  await table.visitEntityPage(page);
  await page.click('[data-testid="profiler"]');
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

  await page.locator(`[data-testid="${testCase}-status"] >> text=New`).waitFor();
  await page.click(`[data-testid="${testCase}"] >> text=${testCase}`);
  await waitForAllLoadersToDisappear(page);
  await page.click('[data-testid="edit-resolution-icon"]');
  await page.click('[data-testid="test-case-resolution-status-type"]');
  await page.click('[title="Ack"]');
  const statusChangeResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/testCaseIncidentStatus'
  );
  await page.click('#update-status-button');
  await statusChangeResponse;
  await page.locator(`[data-testid="${testCase}-status"] >> text=Ack`).waitFor();

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

  if (testCaseName) {
    await page
      .getByRole('row', { name: testCaseName })
      .getByTestId('edit-owner')
      .click();
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

  const updateIncident = page.waitForResponse(
    '/api/v1/dataQuality/testCases/testCaseIncidentStatus'
  );
  await page.click(`.ant-popover [title="${user.displayName}"]`);
  await updateIncident;

  await page
    .getByTestId('assignee')
    .getByTestId('owner-link')
    .first()
    .waitFor();

  await expect(page.locator(`[data-testid=${user.displayName}]`)).toBeVisible();
};

export const assignIncident = async (data: {
  testCaseName: string;
  page: Page;
  user: { name: string; displayName: string };
  direct?: boolean; // Whether to update from edit assignee icon or from status dropdown
}) => {
  const { testCaseName, page, user, direct = false } = data;
  await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);
  await page.getByTestId(`test-case-${testCaseName}`).waitFor();
  if (direct) {
    // direct assignment from edit assignee icon
    await addAssigneeFromPopoverWidget({ page, user, testCaseName });
  } else {
    await page.click(`[data-testid="${testCaseName}-status"]`);
    await page.getByRole('menuitem', { name: 'Assigned' }).click();
    await page
      .getByTestId(`${testCaseName}-assignee-popover`)
      .waitFor();
    await page.click('[data-testid="assignee-search-input"]');

    const searchUserResponse = page.waitForResponse(
      'api/v1/search/query?q=*&index=user_search_index*'
    );
    await page.fill(
      '[data-testid="assignee-search-input"] input',
      user.displayName
    );
    await searchUserResponse;
    await page.click(`[data-testid="${user.name.toLocaleLowerCase()}"]`);
    const updateIncident = page.waitForResponse(
      '/api/v1/dataQuality/testCases/testCaseIncidentStatus'
    );
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
  // eslint-disable-next-line playwright/no-wait-for-timeout -- pipeline deployment settling time
  await page.waitForTimeout(5000);
  const response = await apiContext.post(
    `/api/v1/services/ingestionPipelines/trigger/${pipeline?.['id']}`
  );

  if (response.status() !== 200) {
    // re-deploy the pipeline then trigger it
    await makeRetryRequest({
      page,
      fn: () =>
        apiContext.post(
          `/api/v1/services/ingestionPipelines/deploy/${pipeline?.['id']}`
        ),
    });

    // eslint-disable-next-line playwright/no-wait-for-timeout -- pipeline deployment settling time
    await page.waitForTimeout(5000);

    await makeRetryRequest({
      page,
      fn: () =>
        apiContext.post(
          `/api/v1/services/ingestionPipelines/trigger/${pipeline?.['id']}`
        ),
    });
  }

  // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for pipeline run to complete
  await page.waitForTimeout(2000);

  await expect
    .poll(
      async () => {
        const response = await apiContext
          .get(
            `/api/v1/services/ingestionPipelines/${encodeURIComponent(
              pipeline?.['fullyQualifiedName']
            )}/pipelineStatus?limit=1`
          )
          .then((res) => res.json());
        const statuses = Array.isArray(response?.data) ? response.data : [];

        return statuses[0]?.pipelineState ?? 'running';
      },
      {
        // Custom expect message for reporting, optional.
        message: 'Wait for the pipeline to be successful',
        timeout: 180_000,
        intervals: [5_000, 10_000],
      }
    )
    .toBe('success');
};
