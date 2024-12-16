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
import { sidebarClick } from './sidebar';

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
  await page.click('[data-testid="profiler-tab-left-panel"]');
  await page
    .getByTestId('profiler-tab-left-panel')
    .getByText('Data Quality')
    .click();
  await page.click(`[data-testid="${testCase}"] >> .last-run-box.failed`);
  await page.waitForSelector(`[data-testid="${testCase}-status"] >> text=New`);
  await page.click(`[data-testid="${testCase}"] >> text=${testCase}`);
  await page.click('[data-testid="edit-resolution-icon"]');
  await page.click('[data-testid="test-case-resolution-status-type"]');
  await page.click('[title="Ack"]');
  const statusChangeResponse = page.waitForResponse(
    '/api/v1/dataQuality/testCases/testCaseIncidentStatus'
  );
  await page.click('#update-status-button');
  await statusChangeResponse;
  await page.waitForSelector(`[data-testid="${testCase}-status"] >> text=Ack`);
};

export const assignIncident = async (data: {
  testCaseName: string;
  page: Page;
  user: { name: string; displayName: string };
}) => {
  const { testCaseName, page, user } = data;
  await sidebarClick(page, SidebarItem.INCIDENT_MANAGER);
  await page.waitForSelector(`[data-testid="test-case-${testCaseName}"]`);
  await page.click(
    `[data-testid="${testCaseName}-status"] [data-testid="edit-resolution-icon"]`
  );
  await page.click('[data-testid="test-case-resolution-status-type"]');
  await page.click('[title="Assigned"]');
  await page.waitForSelector('#testCaseResolutionStatusDetails_assignee');
  await page.fill(
    '#testCaseResolutionStatusDetails_assignee',
    user.displayName
  );
  await page.waitForResponse('/api/v1/search/query?q=*');
  await page.click(`[data-testid="${user.name.toLocaleLowerCase()}"]`);
  const updateIncident = page.waitForResponse(
    '/api/v1/dataQuality/testCases/testCaseIncidentStatus'
  );
  await page.click('#update-status-button');
  await updateIncident;
  await page.waitForSelector(
    `[data-testid="${testCaseName}-status"] [data-testid="badge-container"] >> text=Assigned`
  );

  await expect(
    page.locator(
      `[data-testid="${testCaseName}-status"] [data-testid="badge-container"]`
    )
  ).toContainText('Assigned');
};

export const triggerTestSuitePipelineAndWaitForSuccess = async (data: {
  page: Page;
  apiContext: APIRequestContext;
  pipeline: ResponseDataType;
}) => {
  const { page, apiContext, pipeline } = data;
  // wait for 2s before the pipeline to be run
  await page.waitForTimeout(2000);
  await apiContext
    .post(`/api/v1/services/ingestionPipelines/trigger/${pipeline?.['id']}`)
    .then((res) => {
      if (res.status() !== 200) {
        return apiContext.post(
          `/api/v1/services/ingestionPipelines/trigger/${pipeline?.['id']}`
        );
      }
    });

  // Wait for the run to complete
  await page.waitForTimeout(2000);
  const oneHourBefore = Date.now() - 86400000;

  await expect
    .poll(
      async () => {
        const response = await apiContext
          .get(
            `/api/v1/services/ingestionPipelines/${encodeURIComponent(
              pipeline?.['fullyQualifiedName']
            )}/pipelineStatus?startTs=${oneHourBefore}&endTs=${Date.now()}`
          )
          .then((res) => res.json());

        return response.data[0]?.pipelineState;
      },
      {
        // Custom expect message for reporting, optional.
        message: 'Wait for the pipeline to be successful',
        timeout: 90_000,
        intervals: [5_000, 10_000],
      }
    )
    .toBe('success');
};
