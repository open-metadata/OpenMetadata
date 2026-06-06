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
import { expect, Page } from '@playwright/test';
import { SERVICE_TYPE } from '../constant/service';
import { DatabaseServiceClass } from '../support/entity/service/DatabaseServiceClass';
import { redirectToHomePage } from './common';
import { waitForAllLoadersToDisappear } from './entity';
import { visitServiceDetailsPage } from './service';

export const PROFILE_PIPELINES_URL = '/api/v1/services/ingestionPipelines';

export type ProfileSampleConfig =
  | undefined
  | {
      sampleConfigType?: 'STATIC' | 'DYNAMIC';
      config?: Record<string, unknown>;
    };

export const expandAdvancedConfig = async (page: Page) => {
  const collapseHeader = page
    .locator('.advanced-properties-collapse .ant-collapse-header')
    .first();
  await collapseHeader.waitFor();
  const isExpanded =
    (await collapseHeader.getAttribute('aria-expanded')) === 'true';
  if (!isExpanded) {
    await collapseHeader.click();
  }
};

export const openProfilerForm = async (
  page: Page,
  service: DatabaseServiceClass
) => {
  await redirectToHomePage(page);
  const serviceDetailResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/services/databaseServices/name/')
  );
  await visitServiceDetailsPage(
    page,
    {
      type: SERVICE_TYPE.Database,
      name: service.entity.name,
      displayName: service.entity.name,
    },
    true,
    false
  );
  await serviceDetailResponse;
  await expect(page.getByTestId('agents')).toBeVisible();
  await page.getByTestId('agents').click();
  await page.getByTestId('ingestion-details-container').waitFor();

  const metadataTab = page.locator('[data-testid="metadata-sub-tab"]');
  if (await metadataTab.isVisible()) {
    await metadataTab.click();
  }

  await page.getByTestId('add-new-ingestion-button').click();
  const profilerMenuItem = page
    .locator('.ant-dropdown:visible')
    .getByTestId('agent-item-profiler');
  await expect(profilerMenuItem).toBeVisible();
  await profilerMenuItem.click();

  await waitForAllLoadersToDisappear(page);
  await expandAdvancedConfig(page);

  await expect(page.getByTestId('sample-config-type-select')).toBeVisible();
};

export const selectSampleConfigType = async (
  page: Page,
  type: 'STATIC' | 'DYNAMIC'
) => {
  await page.getByTestId('sample-config-type-select').click();
  await page.locator(`[data-key="${type}"]`).click();
};

export const isCreatePipelineCall = (url: string, method: string) =>
  method === 'POST' &&
  url.endsWith(PROFILE_PIPELINES_URL) &&
  !url.includes('/deploy/');

export const submitAndCaptureCreatePayload = async (
  page: Page
): Promise<ProfileSampleConfig> => {
  await page.click('[data-testid="submit-btn"]');

  await page.getByTestId('schedular-card-container').waitFor();
  await page
    .getByTestId('schedular-card-container')
    .getByText('On Demand')
    .click();

  const createResponsePromise = page.waitForResponse((response) =>
    isCreatePipelineCall(response.url(), response.request().method())
  );

  await page.click('[data-testid="deploy-button"]');

  const createResponse = await createResponsePromise;

  expect(
    createResponse.ok(),
    `Create pipeline call returned ${createResponse.status()}: ${await createResponse.text()}`
  ).toBe(true);

  const body = JSON.parse(createResponse.request().postData() ?? '{}');

  return body?.sourceConfig?.config?.profileSampleConfig;
};
