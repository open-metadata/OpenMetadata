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

const mockSuccessfulSnowflakeTestConnection = async (page: Page) => {
  const workflowId = 'pw-snowflake-test-workflow';

  await page.route('**/api/v1/services/databaseServices/name/**', (route) =>
    route.fulfill({ status: 404, body: '' })
  );
  await page.route(
    '**/api/v1/services/testConnectionDefinitions/name/**',
    (route) =>
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          name: 'Snowflake.testConnectionDefinition',
          steps: [
            {
              name: 'CheckAccess',
              mandatory: true,
              description: 'Establish Snowflake connection',
            },
            {
              name: 'GetSchemas',
              mandatory: true,
              description: 'Read schemas',
            },
            {
              name: 'GetViews',
              mandatory: false,
              description: 'Read views',
            },
          ],
        }),
      })
  );
  await page.route('**/api/v1/automations/workflows', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();

      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: workflowId,
        name: workflowId,
        status: 'Running',
        workflowType: 'TEST_CONNECTION',
      }),
    });
  });
  await page.route('**/api/v1/automations/workflows/trigger/**', (route) =>
    route.fulfill({ status: 200, body: '{}' })
  );
  await page.route(
    `**/api/v1/automations/workflows/${workflowId}**`,
    (route) => {
      if (route.request().method() === 'DELETE') {
        return route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ id: workflowId }),
        });
      }

      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          id: workflowId,
          name: workflowId,
          status: 'Successful',
          workflowType: 'TEST_CONNECTION',
          response: {
            status: 'Successful',
            steps: [
              {
                name: 'CheckAccess',
                mandatory: true,
                passed: true,
                message: 'Connected',
              },
              {
                name: 'GetSchemas',
                mandatory: true,
                passed: true,
                message: 'Schemas readable',
              },
              {
                name: 'GetViews',
                mandatory: false,
                passed: true,
                message: 'Views readable',
              },
            ],
          },
        }),
      });
    }
  );
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

  await page.locator('#service-name').fill('pw-layout-snowflake');

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

    expect(await getGridColumnCount(scopeBooleanGrid)).toBe(2);
    await expect(
      includeTransientTables.getByText(
        'Ingest transient tables alongside permanent ones.'
      )
    ).toBeVisible();
    await expect(
      includeStreams.getByText('Ingest Snowflake streams as data assets.')
    ).toBeVisible();
    await expect(
      includeStages.getByText('Ingest external and internal stages.')
    ).toBeVisible();
    await expect(
      clientSessionKeepAlive.getByText(
        'Keep the session alive for long-running scans.'
      )
    ).toBeVisible();
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

    expect(await getGridColumnCount(primaryGrid)).toBe(3);
    await expectNoOverlap(
      useAccessHistory,
      accessHistoryChunk,
      'Use Access History and chunk size fields overlap'
    );

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
      '[data-field-id$="/sampleDataStorageConfig/config"]'
    );
    const sampleBody = samplePanel
      .locator('.core-object-field-template-body-grid')
      .first();
    const sampleField = (name: string) =>
      sampleBody.locator(`:scope > [data-field-name="${name}"]`);

    await expect(samplePanel).toBeVisible();
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
      '[data-field-id$="/sampleDataStorageConfig/config/storageConfig"]'
    );
    const storageBody = storagePanel
      .locator('.core-object-field-template-credential-field-grid')
      .first();
    const storageField = (name: string) =>
      storagePanel.locator(`[data-field-name="${name}"]`);

    await expect(storagePanel).toBeVisible();
    await expect(
      storagePanel.getByTestId('storage-config-title-icon')
    ).toBeVisible();
    expect(await getGridColumnCount(storageBody)).toBe(2);

    const enabled = storageField('enabled');
    const accessKey = storageField('awsAccessKeyId');
    const secretKey = storageField('awsSecretAccessKey');
    const region = storageField('awsRegion');
    const accessKeyInput = accessKey.locator('input');

    const enabledBox = await getBox(enabled);
    const accessKeyBox = await getBox(accessKey);
    const secretKeyBox = await getBox(secretKey);
    const regionBox = await getBox(region);

    expect(accessKeyBox.y).toBeGreaterThan(enabledBox.y + enabledBox.height);
    expect(Math.abs(accessKeyBox.y - secretKeyBox.y)).toBeLessThan(8);
    expect(regionBox.y).toBeGreaterThan(
      Math.max(
        accessKeyBox.y + accessKeyBox.height,
        secretKeyBox.y + secretKeyBox.height
      )
    );

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

    await storagePanel
      .getByRole('button', { name: /Show Advanced Config/ })
      .click();

    const sessionToken = storageField('awsSessionToken');
    const endpoint = storageField('endPointURL');
    const profile = storageField('profileName');
    const currentRegionBox = await getBox(region);
    const sessionTokenBox = await getBox(sessionToken);

    expect(sessionTokenBox.y).toBeGreaterThan(
      currentRegionBox.y + currentRegionBox.height
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

    await accessKeyInput.focus();

    await enabled
      .locator(
        '[for="root/sampleDataStorageConfig/config/storageConfig/enabled"]'
      )
      .click();

    await expect(
      enabled
        .locator('[data-selected="true"]')
        .locator(
          String.raw`#root\/sampleDataStorageConfig\/config\/storageConfig\/enabled`
        )
    ).toBeAttached();
    await expect(accessKeyInput).toBeDisabled();
    await expect(secretKey.locator('input')).toBeDisabled();
    await expect(sessionToken.locator('input')).toBeDisabled();
    await expect(accessKey).toHaveAttribute('aria-disabled', 'true');
  });

  test('should clear inactive Snowflake auth fields before test connection and unlock ingestion filters', async ({
    page,
  }) => {
    await mockSuccessfulSnowflakeTestConnection(page);
    await page.goto('/databaseServices/add-service', {
      waitUntil: 'domcontentloaded',
    });
    await waitForAllLoadersToDisappear(page);
    await page.getByTestId('Snowflake').click();

    try {
      await page.locator('#service-name').waitFor({
        state: 'visible',
      });
    } catch {
      await page.getByTestId('next-button').click();
      await page.locator('#service-name').waitFor({ state: 'visible' });
    }

    await page.locator('#service-name').fill('pw-snowflake-auth-payload');
    await expect(page.getByTestId('connection-schema-loader')).toBeHidden({
      timeout: 10000,
    });
    await expect(page.locator('[id="root/account"]')).toBeVisible();

    await page.locator('[id="root/account"]').fill('fsad');
    await page.locator('[id="root/username"]').fill('openmetadata');
    await page.locator('[id="root/warehouse"]').fill('COMPUTE_WH');
    await page.locator('[id="root/authType/password"]').fill('stale-secret');
    await page.getByTestId('auth-method-1').click();

    await expect(page.locator('[id="root/authType/password"]')).toBeHidden();
    await page.locator('[id="root/authType/privateKey"]').fill('pem-key');

    const workflowRequest = page.waitForRequest(
      (request) =>
        request.url().includes('/api/v1/automations/workflows') &&
        request.method() === 'POST'
    );

    await page.getByTestId('test-connection-btn').click();

    const workflowPayload = (await workflowRequest).postDataJSON();

    expect(workflowPayload.request.connection.config).toMatchObject({
      account: 'fsad',
      privateKey: 'pem-key',
      type: 'Snowflake',
      username: 'openmetadata',
      warehouse: 'COMPUTE_WH',
    });
    expect(workflowPayload.request.connection.config.password).toBeUndefined();
    expect(workflowPayload.request.connection.config.authType).toBeUndefined();

    await expect(
      page.getByTestId('message-container').getByTestId('success-badge')
    ).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();

    const nextIngestionButton = page.getByRole('button', {
      name: 'Next: what to ingest',
    });

    await expect(nextIngestionButton).toBeEnabled();
    await nextIngestionButton.click();

    await expect(page.getByTestId('filters-config-form')).toBeVisible();

    const tableSection = page.getByTestId('filter-section-tableFilterPattern');

    await tableSection.getByRole('button', { name: /Tables/ }).click();
    await tableSection
      .getByRole('button', { name: 'Only specific tables' })
      .click();
    await tableSection.getByPlaceholder('e.g. a table name').fill('orders');
    await tableSection.getByRole('button', { name: 'Add' }).first().click();

    await expect(
      tableSection.getByText(
        'Only tables matching 1 include rule are in scope.'
      )
    ).toBeVisible();
    await tableSection
      .getByRole('button', { name: 'Show equivalent regex' })
      .click();
    await expect(tableSection.getByText('includes += orders')).toBeVisible();
  });
});
