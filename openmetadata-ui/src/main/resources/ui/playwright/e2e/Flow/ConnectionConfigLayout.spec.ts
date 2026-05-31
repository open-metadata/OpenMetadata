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

import { expect, Locator, Page, test } from '@playwright/test';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';

test.use({ storageState: 'playwright/.auth/admin.json' });

const getBox = async (locator: Locator) => {
  await expect(locator).toBeVisible();

  const box = await locator.boundingBox();

  expect(box).not.toBeNull();

  return box!;
};

const expectNoOverlap = async (
  first: Locator,
  second: Locator,
  message: string
) => {
  const firstBox = await getBox(first);
  const secondBox = await getBox(second);
  const overlaps =
    firstBox.x < secondBox.x + secondBox.width &&
    firstBox.x + firstBox.width > secondBox.x &&
    firstBox.y < secondBox.y + secondBox.height &&
    firstBox.y + firstBox.height > secondBox.y;

  expect(overlaps, message).toBe(false);
};

const getGridColumnCount = async (locator: Locator) =>
  locator.evaluate(
    (element) =>
      getComputedStyle(element).gridTemplateColumns.split(' ').filter(Boolean)
        .length
  );

const chooseSelectOption = async (
  page: Page,
  select: Locator,
  optionName: string
) => {
  await select.getByRole('button').click();
  await page.getByRole('option', { exact: true, name: optionName }).click();
};

const openSnowflakeConnectionConfig = async (page: Page) => {
  await page.goto('/databaseServices/add-service', {
    waitUntil: 'domcontentloaded',
  });
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('Snowflake').click();

  try {
    await page.getByTestId('service-name').waitFor({
      state: 'visible',
      timeout: 5000,
    });
  } catch {
    await page.getByTestId('next-button').click();
    await page.getByTestId('service-name').waitFor({ state: 'visible' });
  }

  await page.getByTestId('service-name').fill('pw-layout-snowflake');

  const advancedSection = page.getByTestId('connection-section-advanced');

  if (!(await advancedSection.isVisible())) {
    await page.getByTestId('next-button').click();
    await advancedSection.waitFor({ state: 'visible' });
  }

  const sampleStorageSelect = page.locator(
    '[data-testid^="select-widget-root/sampleDataStorageConfig/config__"]'
  );

  if (!(await sampleStorageSelect.isVisible())) {
    await advancedSection
      .getByRole('button', { name: /Advanced Config/i })
      .click();
  }

  await sampleStorageSelect.waitFor({ state: 'visible' });
};

const openAddDatabaseServicePage = async (page: Page) => {
  await page.goto('/databaseServices/add-service', {
    waitUntil: 'domcontentloaded',
  });
  await waitForAllLoadersToDisappear(page);
  await page.getByTestId('select-service').waitFor({ state: 'visible' });
};

const expectConnectorConnectionForm = async (
  page: Page,
  connectorName: string
) => {
  await openAddDatabaseServicePage(page);
  await page.getByTestId(connectorName).click();
  await page.getByTestId('service-name').waitFor({ state: 'visible' });
  await expect(page.getByTestId('connection-schema-loader')).toBeHidden({
    timeout: 10000,
  });
  await expect(page.getByTestId('connection-grouped-form')).toBeVisible();
  await expect(page.getByTestId('connection-section-connection')).toBeVisible();
};

test.describe('Connection config layout', () => {
  test.beforeEach(async ({ page }) => {
    await redirectToHomePage(page);
  });

  test('should render compact connector cards with avatar icons', async ({
    page,
  }) => {
    await openAddDatabaseServicePage(page);

    const serviceGrid = page.getByTestId('select-service');
    const firstCard = serviceGrid.locator('.service-box').first();
    const iconAvatar = firstCard.locator('.service-icon-avatar');
    const logo = firstCard.locator('.service-logo, img, svg').first();
    const label = firstCard.locator('.service-box-title');

    await expect(serviceGrid).toHaveCSS('display', 'grid');
    expect(await getGridColumnCount(serviceGrid)).toBe(5);

    const cardBox = await getBox(firstCard);
    const avatarBox = await getBox(iconAvatar);
    const logoBox = await getBox(logo);

    expect(cardBox.height).toBeLessThanOrEqual(104);
    expect(Math.round(avatarBox.width)).toBe(40);
    expect(Math.round(avatarBox.height)).toBe(40);
    expect(logoBox.width).toBeLessThanOrEqual(24);
    expect(logoBox.height).toBeLessThanOrEqual(24);

    await expect(label).toHaveCSS('font-size', '12px');
    await expect(label).toHaveCSS('font-weight', '600');
  });

  test('should render connector forms that previously stalled at loading', async ({
    page,
  }) => {
    for (const connectorName of [
      'Cassandra',
      'Cockroach',
      'Databricks',
      'Glue',
      'Greenplum',
    ]) {
      await expectConnectorConnectionForm(page, connectorName);
    }
  });

  test('should align nested sample data storage config fields without overlap', async ({
    page,
  }) => {
    await openSnowflakeConnectionConfig(page);

    const scopeSection = page.getByTestId('connection-section-scope');
    await scopeSection.getByRole('button').click();

    const scopeBooleanGrid = scopeSection.locator(
      '.connection-section-boolean-grid'
    );
    const includeTransientTables = scopeSection.locator(
      '[data-field-name="includeTransientTables"]'
    );
    const includeStreams = scopeSection.locator(
      '[data-field-name="includeStreams"]'
    );
    const includeStages = scopeSection.locator(
      '[data-field-name="includeStages"]'
    );
    const clientSessionKeepAlive = scopeSection.locator(
      '[data-field-name="clientSessionKeepAlive"]'
    );

    await expect(scopeBooleanGrid).toHaveCSS('display', 'grid');
    expect(await getGridColumnCount(scopeBooleanGrid)).toBe(2);
    await expect(
      includeTransientTables.locator('.design-boolean-field')
    ).toHaveCSS('border-top-width', '0px');
    await expect(
      includeTransientTables.locator('.design-boolean-field label + div')
    ).toHaveText('Ingest transient tables alongside permanent ones.');
    await expect(
      includeStreams.locator('.design-boolean-field label + div')
    ).toHaveText('Ingest Snowflake streams as data assets.');
    await expect(
      includeStages.locator('.design-boolean-field label + div')
    ).toHaveText('Ingest external and internal stages.');
    await expect(
      clientSessionKeepAlive.locator('.design-boolean-field label + div')
    ).toHaveText('Keep the session alive for long-running scans.');
    await expectNoOverlap(
      includeTransientTables,
      includeStreams,
      'Include transient tables and streams controls overlap'
    );

    const advancedSection = page.getByTestId('connection-section-advanced');
    const primaryGrid = advancedSection.locator(
      '.connection-advanced-primary-grid'
    );
    const useAccessHistory = advancedSection.locator(
      '[data-field-name="useAccessHistory"]'
    );
    const accessHistoryChunk = advancedSection.locator(
      '[data-field-name="accessHistoryChunkSize"]'
    );
    const connectionOptions = advancedSection.locator(
      '[data-field-name="connectionOptions"]'
    );
    const addConnectionOption = page.getByTestId('add-item-Connection Options');
    const sampleStorageSelect = page.locator(
      '[data-testid^="select-widget-root/sampleDataStorageConfig/config__"]'
    );

    await expect(primaryGrid).toHaveCSS('display', 'grid');
    expect(await getGridColumnCount(primaryGrid)).toBe(3);
    await expectNoOverlap(
      useAccessHistory,
      accessHistoryChunk,
      'Use Access History and chunk size fields overlap'
    );
    await expect(
      accessHistoryChunk.locator('.design-field-label label')
    ).toHaveCSS('color', 'rgb(24, 29, 39)');

    const sampleSelectBox = await getBox(sampleStorageSelect);

    expect(sampleSelectBox.width).toBeLessThanOrEqual(530);

    const addButtonCenter = await addConnectionOption.evaluate((button) => {
      const icon = button.querySelector('[data-icon]');
      const buttonBox = button.getBoundingClientRect();
      const iconBox = icon?.getBoundingClientRect();

      return iconBox
        ? {
            x: Math.abs(
              buttonBox.left +
                buttonBox.width / 2 -
                (iconBox.left + iconBox.width / 2)
            ),
            y: Math.abs(
              buttonBox.top +
                buttonBox.height / 2 -
                (iconBox.top + iconBox.height / 2)
            ),
          }
        : { x: Number.MAX_SAFE_INTEGER, y: Number.MAX_SAFE_INTEGER };
    });

    expect(addButtonCenter.x).toBeLessThan(1);
    expect(addButtonCenter.y).toBeLessThan(1);

    await addConnectionOption.click();

    const additionalRow = connectionOptions.locator(
      '.core-wrap-if-additional-row'
    );

    await expect(additionalRow).toHaveCSS('display', 'grid');
    await expect(
      connectionOptions.locator('.core-wrap-if-additional-key input')
    ).toHaveAttribute('placeholder', 'option');
    await expect(
      connectionOptions.locator(
        '.core-wrap-if-additional-value .design-field-label'
      )
    ).toBeHidden();

    await chooseSelectOption(
      page,
      sampleStorageSelect,
      'Sample Data Storage Config'
    );

    const samplePanel = page.locator(
      '.core-object-field-template-sample-data-config[data-field-id$="/sampleDataStorageConfig/config"]'
    );
    const sampleBody = samplePanel.locator(
      ':scope > .core-object-field-template-body'
    );
    const sampleField = (name: string) =>
      sampleBody.locator(`:scope > [data-field-name="${name}"]`);

    await expect(samplePanel).toBeVisible();
    await expect(sampleBody).toHaveCSS('display', 'grid');
    expect(await getGridColumnCount(sampleBody)).toBe(2);

    const bucket = sampleField('bucketName');
    const prefix = sampleField('prefix');
    const filePathPattern = sampleField('filePathPattern');
    const overwriteData = sampleField('overwriteData');
    const storageConfig = sampleField('storageConfig');

    const bucketBox = await getBox(bucket);
    const prefixBox = await getBox(prefix);
    const filePathBox = await getBox(filePathPattern);
    const overwriteBox = await getBox(overwriteData);

    expect(Math.abs(bucketBox.y - prefixBox.y)).toBeLessThan(8);
    expect(filePathBox.y).toBeGreaterThan(
      Math.max(bucketBox.y + bucketBox.height, prefixBox.y + prefixBox.height)
    );
    expect(filePathBox.width).toBeGreaterThan(
      bucketBox.width + prefixBox.width
    );
    expect(overwriteBox.y).toBeGreaterThan(filePathBox.y + filePathBox.height);

    await expectNoOverlap(bucket, prefix, 'Bucket and prefix fields overlap');
    await expectNoOverlap(
      prefix,
      filePathPattern,
      'Prefix and file path fields overlap'
    );
    await expectNoOverlap(
      filePathPattern,
      overwriteData,
      'File path and overwrite fields overlap'
    );
    await expectNoOverlap(
      overwriteData,
      storageConfig,
      'Overwrite and storage config fields overlap'
    );

    await chooseSelectOption(
      page,
      page.locator(
        '[data-testid^="select-widget-root/sampleDataStorageConfig/config/storageConfig__"]'
      ),
      'AWS S3 Storage Config'
    );

    const storagePanel = page.locator(
      '.core-object-field-template-storage-config[data-field-id$="/sampleDataStorageConfig/config/storageConfig"]'
    );
    const storageBody = storagePanel.locator(
      ':scope > .core-object-field-template-body'
    );
    const storageField = (name: string) =>
      storageBody.locator(`:scope > [data-field-name="${name}"]`);

    await expect(storagePanel).toBeVisible();
    await expect(
      storagePanel.getByTestId('storage-config-title-icon')
    ).toBeVisible();
    await expect(storageBody).toHaveCSS('display', 'grid');
    expect(await getGridColumnCount(storageBody)).toBe(2);

    const enabled = storageField('enabled');
    const accessKey = storageField('awsAccessKeyId');
    const secretKey = storageField('awsSecretAccessKey');
    const region = storageField('awsRegion');
    const sessionToken = storageField('awsSessionToken');
    const endpoint = storageField('endPointURL');
    const profile = storageField('profileName');
    const iamSwitch = enabled.locator('.ant-switch');
    const accessKeyInput = accessKey.locator('input');

    const enabledBox = await getBox(enabled);
    const accessKeyBox = await getBox(accessKey);
    const secretKeyBox = await getBox(secretKey);
    const regionBox = await getBox(region);
    const sessionTokenBox = await getBox(sessionToken);

    expect(accessKeyBox.y).toBeGreaterThan(enabledBox.y + enabledBox.height);
    expect(Math.abs(accessKeyBox.y - secretKeyBox.y)).toBeLessThan(8);
    expect(regionBox.y).toBeGreaterThan(
      Math.max(
        accessKeyBox.y + accessKeyBox.height,
        secretKeyBox.y + secretKeyBox.height
      )
    );
    expect(Math.abs(regionBox.y - sessionTokenBox.y)).toBeLessThan(8);

    await expectNoOverlap(
      enabled,
      accessKey,
      'IAM auth and access key fields overlap'
    );
    await expectNoOverlap(
      accessKey,
      secretKey,
      'AWS access key and secret key fields overlap'
    );
    await expectNoOverlap(
      accessKey,
      region,
      'AWS access key and region fields overlap'
    );
    await expectNoOverlap(
      region,
      sessionToken,
      'AWS region and session token fields overlap'
    );
    await expectNoOverlap(
      endpoint,
      profile,
      'AWS endpoint and profile fields overlap'
    );

    await expect(iamSwitch).toHaveCSS('background-color', 'rgb(242, 244, 247)');

    await accessKeyInput.focus();

    await expect
      .poll(() =>
        accessKeyInput.evaluate((input) => {
          const frame = input.closest('.design-control-frame');

          return frame ? getComputedStyle(frame).borderColor : '';
        })
      )
      .toBe('rgb(46, 144, 250)');
    await expect
      .poll(() =>
        accessKeyInput.evaluate((input) => {
          const frame = input.closest('.design-control-frame');

          return frame ? getComputedStyle(frame).boxShadow : '';
        })
      )
      .toContain('rgb(209, 233, 255)');

    await iamSwitch.click();

    await expect(iamSwitch).toHaveAttribute('aria-checked', 'true');
    await expect(accessKeyInput).toBeDisabled();
    await expect(secretKey.locator('input')).toBeDisabled();
    await expect(sessionToken.locator('input')).toBeDisabled();
    await expect(accessKey).toHaveAttribute('aria-disabled', 'true');
  });
});
