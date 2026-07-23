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
import { expect } from '@playwright/test';
import { DatabaseServiceClass } from '../../../support/entity/service/DatabaseServiceClass';
import { performAdminLogin } from '../../../utils/admin';
import {
  openProfilerForm,
  selectSampleConfigType,
  submitAndCaptureCreatePayload,
} from '../../../utils/profilerForm';
import { test } from '../../fixtures/pages';

const service = new DatabaseServiceClass();

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
    await openProfilerForm(page, service);
  });

  test('STATIC config sends profileSample and no DYNAMIC-only keys', async ({
    page,
  }) => {
    await selectSampleConfigType(page, 'STATIC');
    await page.getByTestId('profile-sample-input').locator('input').fill('10');

    const profileSampleConfig = await submitAndCaptureCreatePayload(page);

    expect(profileSampleConfig?.sampleConfigType).toBe('STATIC');
    expect(profileSampleConfig?.config).toMatchObject({ profileSample: 10 });
    expect(profileSampleConfig?.config).not.toHaveProperty('smartSampling');
    expect(profileSampleConfig?.config).not.toHaveProperty('thresholds');
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

    expect(profileSampleConfig?.sampleConfigType).toBe('STATIC');
    expect(profileSampleConfig?.config).toMatchObject({
      profileSample: 25,
      profileSampleType: 'ROWS',
      samplingMethodType: 'SYSTEM',
    });
    expect(profileSampleConfig?.config).not.toHaveProperty('smartSampling');
    expect(profileSampleConfig?.config).not.toHaveProperty('thresholds');
  });

  test('DYNAMIC with smart sampling ON sends only DYNAMIC keys', async ({
    page,
  }) => {
    await selectSampleConfigType(page, 'DYNAMIC');

    await expect(page.getByTestId('smart-sampling-toggle')).toBeVisible();
    await expect(page.getByTestId('add-threshold-btn')).not.toBeVisible();

    const profileSampleConfig = await submitAndCaptureCreatePayload(page);

    expect(profileSampleConfig?.sampleConfigType).toBe('DYNAMIC');
    expect(profileSampleConfig?.config).toMatchObject({
      smartSampling: true,
      thresholds: [],
    });
    expect(profileSampleConfig?.config).not.toHaveProperty('profileSample');
    expect(profileSampleConfig?.config).not.toHaveProperty(
      'samplingMethodType'
    );
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

    const thresholds = profileSampleConfig?.config?.thresholds as Array<
      Record<string, unknown>
    >;
    expect(thresholds).toHaveLength(2);
    expect(thresholds[0]).toMatchObject({
      rowCountThreshold: 1000000,
      profileSample: 10,
    });
    expect(thresholds[1]).toMatchObject({
      rowCountThreshold: 500000,
      profileSample: 25,
    });
    expect(profileSampleConfig?.config).not.toHaveProperty('profileSample');
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

    const thresholds = profileSampleConfig?.config?.thresholds as Array<
      Record<string, unknown>
    >;
    expect(thresholds).toHaveLength(2);
    expect(thresholds[0]).toMatchObject({
      rowCountThreshold: 1000000,
      profileSample: 10,
    });
    expect(thresholds[1]).toMatchObject({
      rowCountThreshold: 100000,
      profileSample: 50,
    });
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
    expect(profileSampleConfig?.config).toMatchObject({ profileSample: 40 });
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
