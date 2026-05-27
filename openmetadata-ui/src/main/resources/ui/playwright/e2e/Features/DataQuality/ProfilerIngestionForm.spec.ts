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
import { SERVICE_TYPE } from '../../../constant/service';
import { DatabaseServiceClass } from '../../../support/entity/service/DatabaseServiceClass';
import { performAdminLogin } from '../../../utils/admin';
import { redirectToHomePage } from '../../../utils/common';
import { waitForAllLoadersToDisappear } from '../../../utils/entity';
import { visitServiceDetailsPage } from '../../../utils/service';
import { test } from '../../fixtures/pages';

const PROFILE_PIPELINES_URL = '/api/v1/services/ingestionPipelines';

type ProfileSampleConfig =
  | undefined
  | {
      sampleConfigType?: 'STATIC' | 'DYNAMIC';
      config?: Record<string, unknown>;
    };

const service = new DatabaseServiceClass();

const openProfilerForm = async (page: Page) => {
  await redirectToHomePage(page);
  await visitServiceDetailsPage(
    page,
    {
      type: SERVICE_TYPE.Database,
      name: service.entity.name,
      displayName: service.entity.name,
    },
    false
  );

  await page.click('[data-testid="agents"]');
  await page.getByTestId('ingestion-details-container').waitFor();

  const metadataTab = page.locator('[data-testid="metadata-sub-tab"]');
  if (await metadataTab.isVisible()) {
    await metadataTab.click();
  }

  await page.click('[data-testid="add-new-ingestion-button"]');
  await page
    .locator('.ant-dropdown:visible [data-menu-id*="profiler"]')
    .waitFor();
  await page.click('[data-menu-id*="profiler"]');

  await waitForAllLoadersToDisappear(page);
  await expandAdvancedConfig(page);

  await expect(page.getByTestId('sample-config-type-select')).toBeVisible();
};

const expandAdvancedConfig = async (page: Page) => {
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

const selectSampleConfigType = async (
  page: Page,
  type: 'STATIC' | 'DYNAMIC'
) => {
  await page.getByTestId('sample-config-type-select').click();
  await page.locator(`[data-key="${type}"]`).click();
};

const isCreatePipelineCall = (url: string, method: string) =>
  method === 'POST' &&
  url.endsWith(PROFILE_PIPELINES_URL) &&
  !url.includes('/deploy/');

const submitAndCaptureCreatePayload = async (
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

test.describe('Profiler ingestion form — profile sample config', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await service.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    await service.delete(apiContext);
    await afterAction();
  });

  test.beforeEach(async ({ page }) => {
    await openProfilerForm(page);
  });

  test('STATIC config sends only profileSample under config', async ({
    page,
  }) => {
    await selectSampleConfigType(page, 'STATIC');

    await page.getByTestId('profile-sample-input').locator('input').fill('10');

    const profileSampleConfig = await submitAndCaptureCreatePayload(page);

    expect(profileSampleConfig).toEqual({
      sampleConfigType: 'STATIC',
      config: { profileSample: 10 },
    });
  });

  test('STATIC config sends all three static-only fields when set', async ({
    page,
  }) => {
    await selectSampleConfigType(page, 'STATIC');

    await page.getByTestId('profile-sample-input').locator('input').fill('25');

    await page.getByTestId('profile-sample-type-select').click();
    await page.locator('[data-key="ROWS"]').click();

    await page.getByTestId('sampling-method-type-select').click();
    await page.locator('[data-key="SYSTEM"]').click();

    const profileSampleConfig = await submitAndCaptureCreatePayload(page);

    expect(profileSampleConfig).toEqual({
      sampleConfigType: 'STATIC',
      config: {
        profileSample: 25,
        profileSampleType: 'ROWS',
        samplingMethodType: 'SYSTEM',
      },
    });
  });

  test('DYNAMIC with smart sampling ON sends only smartSampling', async ({
    page,
  }) => {
    await selectSampleConfigType(page, 'DYNAMIC');

    await expect(page.getByTestId('smart-sampling-toggle')).toBeVisible();
    await expect(page.getByTestId('add-threshold-btn')).not.toBeVisible();

    const profileSampleConfig = await submitAndCaptureCreatePayload(page);

    expect(profileSampleConfig?.sampleConfigType).toBe('DYNAMIC');
    expect(profileSampleConfig?.config).toEqual({
      smartSampling: true,
      thresholds: [],
    });
  });

  test('DYNAMIC with smart sampling OFF and thresholds sends thresholds array', async ({
    page,
  }) => {
    await selectSampleConfigType(page, 'DYNAMIC');

    await page.getByTestId('smart-sampling-toggle').click();

    await page.getByTestId('add-threshold-btn').click();
    await page
      .getByTestId('row-count-threshold-0')
      .locator('input')
      .fill('1000000');
    await page.getByTestId('profile-sample-0').locator('input').fill('10');

    await page.getByTestId('add-threshold-btn').click();
    await page
      .getByTestId('row-count-threshold-1')
      .locator('input')
      .fill('500000');
    await page.getByTestId('profile-sample-1').locator('input').fill('25');

    const profileSampleConfig = await submitAndCaptureCreatePayload(page);

    expect(profileSampleConfig?.sampleConfigType).toBe('DYNAMIC');
    expect(profileSampleConfig?.config?.smartSampling).toBe(false);
    expect(profileSampleConfig?.config?.thresholds).toEqual([
      { rowCountThreshold: 1000000, profileSample: 10 },
      { rowCountThreshold: 500000, profileSample: 25 },
    ]);
  });

  test('DYNAMIC threshold remove drops only the selected row', async ({
    page,
  }) => {
    await selectSampleConfigType(page, 'DYNAMIC');
    await page.getByTestId('smart-sampling-toggle').click();

    await page.getByTestId('add-threshold-btn').click();
    await page
      .getByTestId('row-count-threshold-0')
      .locator('input')
      .fill('1000000');
    await page.getByTestId('profile-sample-0').locator('input').fill('10');

    await page.getByTestId('add-threshold-btn').click();
    await page
      .getByTestId('row-count-threshold-1')
      .locator('input')
      .fill('500000');
    await page.getByTestId('profile-sample-1').locator('input').fill('25');

    await page.getByTestId('add-threshold-btn').click();
    await page
      .getByTestId('row-count-threshold-2')
      .locator('input')
      .fill('100000');
    await page.getByTestId('profile-sample-2').locator('input').fill('50');

    await page.getByTestId('remove-threshold-1').click();

    const profileSampleConfig = await submitAndCaptureCreatePayload(page);

    expect(profileSampleConfig?.config?.thresholds).toEqual([
      { rowCountThreshold: 1000000, profileSample: 10 },
      { rowCountThreshold: 100000, profileSample: 50 },
    ]);
  });

  test('switching DYNAMIC → STATIC does not leak smartSampling or thresholds', async ({
    page,
  }) => {
    await selectSampleConfigType(page, 'DYNAMIC');
    await expect(page.getByTestId('smart-sampling-toggle')).toBeVisible();

    await selectSampleConfigType(page, 'STATIC');

    await page.getByTestId('profile-sample-input').locator('input').fill('40');

    const profileSampleConfig = await submitAndCaptureCreatePayload(page);

    expect(profileSampleConfig?.sampleConfigType).toBe('STATIC');
    expect(profileSampleConfig?.config).toEqual({ profileSample: 40 });
    expect(profileSampleConfig?.config).not.toHaveProperty('smartSampling');
    expect(profileSampleConfig?.config).not.toHaveProperty('thresholds');
  });

  test('switching STATIC → DYNAMIC does not leak static-only fields', async ({
    page,
  }) => {
    await selectSampleConfigType(page, 'STATIC');
    await page.getByTestId('profile-sample-input').locator('input').fill('70');

    await page.getByTestId('profile-sample-type-select').click();
    await page.locator('[data-key="PERCENTAGE"]').click();

    await selectSampleConfigType(page, 'DYNAMIC');
    await expect(page.getByTestId('smart-sampling-toggle')).toBeVisible();

    const profileSampleConfig = await submitAndCaptureCreatePayload(page);

    expect(profileSampleConfig?.sampleConfigType).toBe('DYNAMIC');
    expect(profileSampleConfig?.config).not.toHaveProperty('profileSample');
    expect(profileSampleConfig?.config).not.toHaveProperty('profileSampleType');
    expect(profileSampleConfig?.config).not.toHaveProperty(
      'samplingMethodType'
    );
  });
});
