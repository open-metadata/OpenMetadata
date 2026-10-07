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
import { test } from '../../support/fixtures/base';
import {
  chooseSelectOption,
  getApiContext,
  redirectToHomePage,
  toastNotification,
  uuid,
} from '../../utils/common';
import { clickAndWaitFor } from '../../utils/waitHelpers';
import { enableAiAppMode } from '../Utils/appMode';

test.use({ storageState: 'playwright/.auth/admin.json' });

const SETTINGS_PUT = '**/api/v1/system/settings';

type SettingState = {
  value?: Record<string, unknown>;
  puts: Record<string, unknown>[];
};

/**
 * Settings here are tenant-wide (email, lineage depth, app mode…), and sibling
 * workers read them. Saving is therefore stubbed per page: the PUT is captured
 * and echoed, and the GET serves what was saved, so the UI round-trip is real
 * while the server state never changes. Until something is saved (and with no
 * `initial`), the GET passes through to the real backend.
 */
const stubSettingRoundTrip = async (
  page: Page,
  configType: string,
  {
    getUrl = `**/api/v1/system/settings/${configType}`,
    wrapGet = true,
    initial,
  }: {
    getUrl?: string;
    wrapGet?: boolean;
    initial?: Record<string, unknown>;
  } = {}
): Promise<SettingState> => {
  const state: SettingState = { value: initial, puts: [] };

  await page.route(getUrl, async (route) => {
    if (route.request().method() !== 'GET' || state.value === undefined) {
      await route.fallback();

      return;
    }
    await route.fulfill({
      json: wrapGet
        ? { config_type: configType, config_value: state.value }
        : state.value,
    });
  });

  await page.route(SETTINGS_PUT, async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    if (
      route.request().method() !== 'PUT' ||
      body?.config_type !== configType
    ) {
      await route.fallback();

      return;
    }
    state.puts.push(body);
    state.value = body.config_value as Record<string, unknown>;
    await route.fulfill({ json: body });
  });

  return state;
};

const openPlatformSettings = async (page: Page) => {
  await enableAiAppMode(page);
  // Only the user menu is needed; home-page widget loaders are irrelevant here.
  await redirectToHomePage(page, false);
  await page.getByTestId('ask-ai-user-menu-trigger').click();
  await page.getByTestId('ai-user-menu-profile').click();
  await expect(page.getByTestId('ai-profile-page')).toBeVisible();
  await page.getByTestId('profile-nav-platform-settings').click();
  await expect(page.getByTestId('platform-settings-landing')).toBeVisible();
};

const card = (page: Page, id: string) =>
  page.getByTestId(`platform-settings-card-${id}`);

// No global loader wait here: widgets on the page behind the modal keep their
// own loaders, so each test asserts on the page content instead.
const openCard = async (page: Page, id: string) => {
  await card(page, id).click();
};

// `/system/status` probes the DB, search and the pipeline service, so it can
// take well past the default expect timeout on a busy backend.
const openHealthCheck = (page: Page) =>
  clickAndWaitFor(page, card(page, 'health-check'), '**/api/v1/system/status');

const header = (page: Page) => page.getByTestId('profile-content-header');

const fillField = async (page: Page, testId: string, value: string) => {
  await page.getByTestId(testId).locator('input').fill(value);
};

const saveSettings = (page: Page) =>
  clickAndWaitFor(page, page.getByTestId('save-button'), SETTINGS_PUT);

test.describe(
  'Profile Platform Settings',
  { tag: ['@Platform', '@Features'] },
  () => {
    test('landing lists every legacy Preferences page and each one opens', async ({
      page,
    }) => {
      // Health is covered on its own below; here it only has to open.
      await page.route('**/api/v1/system/status', (route) =>
        route.fulfill({
          json: { database: { passed: true, message: 'Connected' } },
        })
      );
      await openPlatformSettings(page);

      const pages: [string, string][] = [
        ['theme', 'theme-settings'],
        ['email', 'email-settings'],
        ['login-configuration', 'login-settings'],
        ['health-check', 'health-check-settings'],
        ['profiler-configuration', 'profiler-settings'],
        ['data-quality', 'data-quality-settings'],
        ['lineage', 'lineage-settings'],
        ['brand-url', 'brand-url-settings'],
        ['learning-resources', 'learning-resources-settings'],
        ['app-mode', 'default-app-mode-page'],
      ];

      for (const [cardId, contentTestId] of pages) {
        await test.step(`opens ${cardId}`, async () => {
          if (cardId === 'health-check') {
            await openHealthCheck(page);
          } else {
            await openCard(page, cardId);
          }
          // Each page loads its own settings; on a shared backend that can
          // queue behind sibling workers (e.g. a real /system/status probe).
          await expect(page.getByTestId(contentTestId)).toBeVisible({
            timeout: 30_000,
          });
          await header(page)
            .getByLabel('Breadcrumb')
            .getByText('Platform Settings', { exact: true })
            .click();
          await expect(
            page.getByTestId('platform-settings-landing')
          ).toBeVisible();
        });
      }
    });

    test('email: edit, save and see the change in the read-only view', async ({
      page,
    }) => {
      const settings = await stubSettingRoundTrip(page, 'emailConfiguration', {
        initial: {
          serverEndpoint: 'smtp.example.com',
          serverPort: 587,
          senderMail: 'noreply@example.com',
          transportationStrategy: 'SMTP_TLS',
          enableSmtpServer: false,
        },
      });
      await openPlatformSettings(page);
      await openCard(page, 'email');

      await expect(page.getByTestId('server-endpoint-value')).toHaveText(
        'smtp.example.com'
      );

      await header(page).getByTestId('edit-button').click();
      await expect(page.getByTestId('email-config-form')).toBeVisible();
      await expect(
        page.getByTestId('server-endpoint-input').locator('input')
      ).toHaveValue('smtp.example.com');

      await fillField(page, 'emailing-entity-input', 'Platform Team');
      await saveSettings(page);
      await toastNotification(page, /updated successfully/);

      expect(settings.puts).toHaveLength(1);
      expect(settings.puts[0].config_value).toMatchObject({
        emailingEntity: 'Platform Team',
        serverEndpoint: 'smtp.example.com',
        serverPort: 587,
      });
      await expect(page.getByTestId('emailing-entity-value')).toHaveText(
        'Platform Team'
      );
    });

    test('email: required fields block saving', async ({ page }) => {
      const settings = await stubSettingRoundTrip(page, 'emailConfiguration', {
        initial: { serverEndpoint: 'smtp.example.com', serverPort: 587 },
      });
      await openPlatformSettings(page);
      await openCard(page, 'email');
      await header(page).getByTestId('edit-button').click();

      await page.getByTestId('save-button').click();

      await expect(
        page.getByText('Sender Email is required', { exact: true })
      ).toBeVisible();
      expect(settings.puts).toHaveLength(0);
    });

    test('email: show hint reveals the field documentation', async ({
      page,
    }) => {
      await stubSettingRoundTrip(page, 'emailConfiguration', {
        initial: { serverEndpoint: 'smtp.example.com', serverPort: 587 },
      });
      await openPlatformSettings(page);
      await openCard(page, 'email');
      // Hints come from EmailConfiguration.md; focus before it lands and the
      // field has no doc registered yet.
      await clickAndWaitFor(
        page,
        header(page).getByTestId('edit-button'),
        '**/EmailConfiguration.md'
      );

      await header(page).getByTestId('show-hint-toggle').click();
      await page.getByTestId('server-endpoint-input').locator('input').focus();

      await expect(
        page.getByText('Endpoint of the SMTP server', { exact: false })
      ).toBeVisible();
    });

    test('email: test email validates the address', async ({ page }) => {
      await stubSettingRoundTrip(page, 'emailConfiguration', {
        initial: { senderMail: 'noreply@example.com' },
      });
      await openPlatformSettings(page);
      await openCard(page, 'email');

      await header(page).getByTestId('test-email-button').click();
      const modal = page.getByTestId('test-email-modal');
      await expect(modal).toBeVisible();

      await modal.getByTestId('test-email-input').locator('input').fill('nope');
      await modal.getByTestId('test-email-submit').click();

      await expect(modal.getByText('Email is invalid.')).toBeVisible();
    });

    test('health check: shows every status step and refreshes', async ({
      page,
    }) => {
      // Two real `/system/status` round trips, each probing DB, search and
      // the pipeline service.
      test.slow();
      await openPlatformSettings(page);
      await openHealthCheck(page);

      await expect(page.getByTestId('database')).toBeVisible();
      await expect(page.getByTestId('searchInstance')).toBeVisible();
      await expect(page.getByTestId('passing-count')).toBeVisible();

      await clickAndWaitFor(
        page,
        header(page).getByTestId('refresh-health-check'),
        '**/api/v1/system/status'
      );
      await expect(page.getByTestId('database')).toBeVisible();
    });

    test('brand URL: rejects an invalid URL and saves a valid one', async ({
      page,
    }) => {
      const settings = await stubSettingRoundTrip(
        page,
        'openMetadataBaseUrlConfiguration',
        { initial: { openMetadataUrl: 'http://localhost:8585' } }
      );
      await openPlatformSettings(page);
      await openCard(page, 'brand-url');

      await expect(page.getByTestId('open-metadata-url')).toHaveText(
        'http://localhost:8585'
      );
      await header(page).getByTestId('edit-button').click();

      await fillField(page, 'open-metadata-url-input', 'example.org');
      await page.getByTestId('save-button').click();
      await expect(page.getByText('Invalid URL format')).toBeVisible();
      expect(settings.puts).toHaveLength(0);

      await fillField(
        page,
        'open-metadata-url-input',
        'https://om.example.org'
      );
      await saveSettings(page);

      expect(settings.puts[0].config_value).toEqual({
        openMetadataUrl: 'https://om.example.org',
      });
      await expect(page.getByTestId('open-metadata-url')).toHaveText(
        'https://om.example.org'
      );
    });

    test('login configuration: saves the limits', async ({ page }) => {
      const settings = await stubSettingRoundTrip(page, 'loginConfiguration', {
        getUrl: '**/api/v1/system/config/loginConfig',
        wrapGet: false,
        initial: {
          maxLoginFailAttempts: 3,
          accessBlockTime: 600,
          jwtTokenExpiryTime: 3600,
        },
      });
      await openPlatformSettings(page);
      await openCard(page, 'login-configuration');

      await expect(page.getByTestId('max-login-fail-attampts')).toHaveText('3');
      await header(page).getByTestId('edit-button').click();

      await fillField(page, 'maxLoginFailAttempts', '5');
      await saveSettings(page);

      expect(settings.puts[0].config_value).toEqual({
        maxLoginFailAttempts: 5,
        accessBlockTime: 600,
        jwtTokenExpiryTime: 3600,
      });
      await expect(page.getByTestId('max-login-fail-attampts')).toHaveText('5');
    });

    test('lineage: saves depths and layer', async ({ page }) => {
      const settings = await stubSettingRoundTrip(page, 'lineageSettings', {
        initial: {
          upstreamDepth: 2,
          downstreamDepth: 2,
          lineageLayer: 'EntityLineage',
          pipelineViewMode: 'Node',
        },
      });
      await openPlatformSettings(page);
      await openCard(page, 'lineage');

      await expect(page.getByTestId('upstream-depth-value')).toHaveText('2');
      await header(page).getByTestId('edit-button').click();
      await expect(
        page.getByTestId('field-upstream').locator('input')
      ).toHaveValue('2');

      await fillField(page, 'field-upstream', '4');
      await chooseSelectOption(
        page.getByTestId('field-lineage-layer'),
        page.getByRole('option', { name: 'Column Level Lineage', exact: true })
      );
      await saveSettings(page);

      expect(settings.puts[0].config_value).toEqual({
        upstreamDepth: 4,
        downstreamDepth: 2,
        lineageLayer: 'ColumnLevelLineage',
        pipelineViewMode: 'Node',
      });
      await expect(page.getByTestId('upstream-depth-value')).toHaveText('4');
      await expect(page.getByTestId('lineage-layer-value')).toHaveText(
        'Column Level Lineage'
      );
    });

    test('default app mode: saves the selected mode', async ({ page }) => {
      const settings = await stubSettingRoundTrip(page, 'appConfiguration', {
        initial: { defaultAppMode: null },
      });
      await openPlatformSettings(page);
      await openCard(page, 'app-mode');

      await expect(page.getByTestId('default-app-mode-value')).toHaveText(
        'No default'
      );
      await header(page).getByTestId('edit-button').click();

      const save = page.getByTestId('save-button');
      await expect(save).toBeDisabled();

      await page.getByTestId('app-mode-option-classic').click();
      await saveSettings(page);

      expect(settings.puts[0]).toMatchObject({
        config_type: 'appConfiguration',
        config_value: { defaultAppMode: 'classic' },
      });
      await expect(page.getByTestId('default-app-mode-value')).toHaveText(
        'Classic'
      );
    });
    test('theme: saves colours and logo, and Reset clears them', async ({
      page,
    }) => {
      const settings = await stubSettingRoundTrip(
        page,
        'customUiThemePreference'
      );
      await openPlatformSettings(page);
      await openCard(page, 'theme');
      await expect(page.getByTestId('theme-settings')).toBeVisible();

      await header(page).getByTestId('edit-button').click();
      await page.getByTestId('infoColor-color-input').fill('#123456');
      await fillField(page, 'customFaviconUrlPath', 'favicon.ico');
      await page.getByTestId('save-button').click();
      await expect(
        page.getByText('Favicon URL is not valid url')
      ).toBeVisible();
      expect(settings.puts).toHaveLength(0);

      await fillField(
        page,
        'customFaviconUrlPath',
        'https://cdn.example.org/favicon.ico'
      );
      await saveSettings(page);

      expect(settings.puts[0].config_value).toMatchObject({
        customLogoConfig: {
          customFaviconUrlPath: 'https://cdn.example.org/favicon.ico',
        },
        customTheme: { infoColor: '#123456' },
      });
      await expect(page.getByTestId('infoColor-value')).toHaveText('#123456');

      await clickAndWaitFor(
        page,
        header(page).getByTestId('reset-button'),
        SETTINGS_PUT
      );
      expect(settings.puts[1].config_value).toMatchObject({
        customTheme: { infoColor: '', primaryColor: '' },
        customLogoConfig: { customFaviconUrlPath: '' },
      });
    });

    test('profiler configuration: edits metric rows and sample data', async ({
      page,
    }) => {
      const settings = await stubSettingRoundTrip(
        page,
        'profilerConfiguration',
        {
          initial: {
            metricConfiguration: [
              { dataType: 'INT', metrics: ['max', 'min'], disabled: false },
              { dataType: 'ARRAY', disabled: true },
            ],
            sampleDataConfig: { storeSampleData: false, readSampleData: true },
          },
        }
      );
      await openPlatformSettings(page);
      await openCard(page, 'profiler-configuration');

      await expect(page.getByTestId('metric-row-INT')).toContainText('Max');
      await expect(page.getByTestId('metric-row-ARRAY')).toContainText(
        'Disabled'
      );

      await header(page).getByTestId('edit-button').click();
      await page.getByTestId('remove-filter-1').click();
      await page.getByTestId('add-fields').click();
      await chooseSelectOption(
        page.getByTestId('metric-row-1').getByTestId('data-type-select'),
        page.getByRole('option', { name: 'STRING', exact: true })
      );
      await page.getByTestId('store-sample-data-switch').click();
      await saveSettings(page);

      expect(settings.puts[0].config_value).toEqual({
        metricConfiguration: [
          { dataType: 'INT', metrics: ['max', 'min'], disabled: false },
          { dataType: 'STRING', disabled: false },
        ],
        sampleDataConfig: { storeSampleData: true, readSampleData: true },
      });
      await expect(page.getByTestId('metric-row-STRING')).toBeVisible();
      await expect(page.getByTestId('store-sample-data-value')).toHaveText(
        'Enabled'
      );
    });

    test('data quality: adds, edits and deletes a custom dimension', async ({
      page,
    }) => {
      // Create, edit and delete against the real API, behind a list load.
      test.slow();
      // Dimensions are entities with unique names, so this runs against the
      // real API and cleans up after itself.
      const name = `pw_dimension_${uuid()}`;
      await openPlatformSettings(page);

      try {
        await openCard(page, 'data-quality');
        await expect(page.getByTestId('dimensions-table')).toBeVisible({
          timeout: 30_000,
        });

        await header(page).getByTestId('add-dimension').click();
        await fillField(page, 'dimension-name', name);
        await fillField(page, 'dimension-display-name', 'PW Dimension');
        await page.getByTestId('dimension-color-2').click();
        await clickAndWaitFor(
          page,
          page.getByTestId('save-button'),
          '**/api/v1/dataQuality/dimensions',
          201
        );

        const row = page.getByTestId(`dimension-${name}`);
        await expect(row).toContainText('PW Dimension');
        await expect(row).toContainText('Custom');

        await clickAndWaitFor(
          page,
          page.getByTestId(`edit-${name}`),
          /\/api\/v1\/dataQuality\/dimensions\?/
        );
        await expect(
          page.getByTestId('dimension-name').locator('input')
        ).toBeDisabled();
        await fillField(page, 'dimension-display-name', 'PW Renamed');
        await clickAndWaitFor(
          page,
          page.getByTestId('save-button'),
          '**/api/v1/dataQuality/dimensions/*'
        );
        await expect(row).toContainText('PW Renamed');

        await page.getByTestId(`delete-${name}`).click();
        await expect(page.getByTestId('delete-dimension-dialog')).toBeVisible();
        await clickAndWaitFor(
          page,
          page.getByTestId('confirm-delete-dimension'),
          '**/api/v1/dataQuality/dimensions/*'
        );
        await expect(row).toHaveCount(0);
      } finally {
        const { apiContext, afterAction } = await getApiContext(page);
        const list = await apiContext.get(
          '/api/v1/dataQuality/dimensions?limit=1000'
        );
        const leftover = ((await list.json()).data ?? []).find(
          (dimension: { name: string }) => dimension.name === name
        );
        if (leftover) {
          await apiContext.delete(
            `/api/v1/dataQuality/dimensions/${leftover.id}?hardDelete=true`
          );
        }
        await afterAction();
      }
    });
    test('data asset rules: toggling a rule saves it', async ({ page }) => {
      const rule = {
        name: 'Single Domain',
        description: 'One domain per asset.',
        enabled: false,
        rule: '{"==":[1,1]}',
      };
      const settings = await stubSettingRoundTrip(page, 'entityRulesSettings', {
        initial: { entitySemantics: [rule] },
      });
      await openPlatformSettings(page);
      await openCard(page, 'data-asset-rules');

      await expect(
        page.getByTestId('data-asset-rule-Single Domain')
      ).toContainText('One domain per asset.');
      await clickAndWaitFor(
        page,
        page.getByTestId('toggle-Single Domain'),
        SETTINGS_PUT
      );

      expect(settings.puts[0].config_value).toEqual({
        entitySemantics: [{ ...rule, enabled: true }],
      });
    });

    test('data asset rules: empty state offers no Add, as adding is unsupported', async ({
      page,
    }) => {
      await stubSettingRoundTrip(page, 'entityRulesSettings', {
        initial: { entitySemantics: [] },
      });
      await openPlatformSettings(page);
      await openCard(page, 'data-asset-rules');

      const emptyState = page.getByTestId('data-asset-rules-empty');
      await expect(emptyState).toBeVisible();
      await expect(emptyState.getByRole('button')).toHaveCount(0);
    });

    test('learning resources: adds, edits and deletes a resource', async ({
      page,
    }) => {
      // Create, edit and delete against the real API, behind a list load.
      test.slow();
      // Learning resources are entities with unique names, so this runs
      // against the real API and cleans up after itself.
      const name = `pw-resource-${uuid()}`;
      await openPlatformSettings(page);

      try {
        await openCard(page, 'learning-resources');
        await expect(page.getByTestId('learning-resources-table')).toBeVisible({
          timeout: 30_000,
        });

        await header(page).getByTestId('create-resource').click();
        await fillField(page, 'name-input', name);
        await page
          .getByTestId('description-input')
          .locator('textarea')
          .fill('Created by Playwright.');
        await chooseSelectOption(
          page.getByTestId('resource-type-select'),
          page.getByRole('option', { name: 'Video', exact: true })
        );
        for (const [testId, option] of [
          ['categories-select', 'Discovery'],
          ['contexts-select', 'Glossary'],
        ]) {
          await page.getByTestId(testId).locator('input').fill(option);
          await page.getByRole('option', { name: option, exact: true }).click();
        }
        await fillField(
          page,
          'source-url-input',
          'https://www.youtube.com/watch?v=pw-test'
        );
        await clickAndWaitFor(
          page,
          page.getByTestId('save-button'),
          '**/api/v1/learning/resources',
          201
        );

        await page.getByTestId('search-resources').locator('input').fill(name);
        const row = page.getByTestId(name);
        await expect(row).toBeVisible();

        await clickAndWaitFor(
          page,
          page.getByTestId(`edit-${name}`),
          '**/api/v1/learning/resources/*'
        );
        await expect(
          page.getByTestId('name-input').locator('input')
        ).toBeDisabled();
        await page
          .getByTestId('description-input')
          .locator('textarea')
          .fill('Edited by Playwright.');
        await clickAndWaitFor(
          page,
          page.getByTestId('save-button'),
          '**/api/v1/learning/resources'
        );

        await page.getByTestId('search-resources').locator('input').fill(name);
        await page.getByTestId(`delete-${name}`).click();
        await clickAndWaitFor(
          page,
          page.getByTestId('confirm-button'),
          '**/api/v1/learning/resources/*'
        );
        await expect(row).toHaveCount(0);
      } finally {
        const { apiContext, afterAction } = await getApiContext(page);
        const existing = await apiContext.get(
          `/api/v1/learning/resources/name/${encodeURIComponent(
            name
          )}?include=all`
        );
        if (existing.ok()) {
          const { id } = await existing.json();
          await apiContext.delete(
            `/api/v1/learning/resources/${id}?hardDelete=true`
          );
        }
        await afterAction();
      }
    });
  }
);
