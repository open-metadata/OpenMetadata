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
import { KPIData } from '../constant/dataInsight.interface';
import { descriptionBox } from './common';

export const deleteKpiRequest = async (apiRequest: APIRequestContext) => {
  const kpis = await apiRequest.get('/api/v1/kpi').then((res) => res.json());

  if (kpis.data.length > 0) {
    for (const element of kpis.data) {
      await apiRequest.delete(
        `/api/v1/kpi/${element.id}?hardDelete=true&recursive=false`
      );
    }
  }
};

export const runDataInsightApplication = async (
  page: Page,
  apiRequest: APIRequestContext
) => {
  await expect(
    await apiRequest.patch(
      '/api/v1/apps/marketplace/name/DataInsightsApplication',
      {
        data: [
          {
            op: 'replace',
            path: '/appConfiguration/batchSize',
            value: 1000,
          },
          {
            op: 'replace',
            path: '/appConfiguration/recreateDataAssetsIndex',
            value: false,
          },
          {
            op: 'replace',
            path: '/appConfiguration/backfillConfiguration/enabled',
            value: false,
          },
        ],
        headers: {
          'Content-Type': 'application/json-patch+json',
        },
      }
    )
  ).toBeOK();

  await expect(
    await apiRequest.post('/api/v1/apps/trigger/DataInsightsApplication')
  ).toBeOK();

  // eslint-disable-next-line playwright/no-wait-for-timeout -- wait for pipeline run to start before polling status
  await page.waitForTimeout(2000);

  await expect
    .poll(
      async () => {
        const response = await apiRequest
          .get(
            '/api/v1/apps/name/DataInsightsApplication/status?offset=0&limit=1'
          )
          .then((res) => res.json());

        return response.data[0].status;
      },
      {
        message: 'Wait for the Data Insight Application run to be successful',
        ...(process.env.PLAYWRIGHT_IS_OSS
          ? {
              timeout: 120_000,
              intervals: [5_000, 10_000],
            }
          : {
              timeout: 5_400_000,
              intervals: [300_000, 300_000, 120_000],
            }),
      }
    )
    .toEqual(expect.stringMatching(/(success|partialSuccess)/));
};

export const addKpi = async (page: Page, data: KPIData) => {
  const currentDate = new Date();
  const month =
    currentDate.getMonth() + 1 < 10
      ? `0${currentDate.getMonth() + 1}`
      : currentDate.getMonth() + 1;
  const date =
    currentDate.getDate() < 10
      ? `0${currentDate.getDate()}`
      : currentDate.getDate();

  const startDate = `${currentDate.getFullYear()}-${month}-${date}`;
  currentDate.setDate(currentDate.getDate() + 1);
  const nextMonth =
    currentDate.getMonth() + 1 < 10
      ? `0${currentDate.getMonth() + 1}`
      : currentDate.getMonth() + 1;
  const nextDate =
    currentDate.getDate() < 10
      ? `0${currentDate.getDate()}`
      : currentDate.getDate();
  const endDate = `${currentDate.getFullYear()}-${nextMonth}-${nextDate}`;

  await page.click('#chartType');
  await page.click(`.ant-select-dropdown [title="${data.dataInsightChart}"]`);
  await page.getByTestId('displayName').fill(data.displayName);
  await page.getByTestId('metricType').click();
  await page.click(`.ant-select-dropdown [title="${data.metricType}"]`);
  await page.locator('.ant-slider-mark-text', { hasText: '100%' }).click();

  await page.getByTestId('start-date').click();
  await page.getByTestId('start-date').fill(startDate);
  await page.getByTestId('start-date').press('Enter');
  await page.getByTestId('end-date').click();
  await page.getByTestId('end-date').fill(endDate);
  await page.getByTestId('end-date').press('Enter');

  await page.locator(descriptionBox).fill('Playwright KPI test description');

  await page.getByTestId('submit-btn').click();
  await page.waitForURL('**/data-insights/kpi');
};
