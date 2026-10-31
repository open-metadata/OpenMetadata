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
import { Page } from '@playwright/test';
import {
  SMTPSettings,
  TransportationStrategy,
} from '../../../src/generated/email/smtpSettings';
import {
  ConfigSourceMode,
  SettingSource,
  SettingType,
} from '../../../src/generated/system/settingsSourceResponse';
import { expect, test } from '../../support/fixtures/base';
import { installVisualData } from '../../utils/visualData';
import { expectVisualMenuScreenshots } from '../../utils/visualMenus';
import {
  expectVisualScreenshot,
  gotoForScreenshot,
  prepareVisualTheme,
  VISUAL_THEMES,
  withFullVisualTarget,
} from '../../utils/visualRegression';

const settingsForms = [
  { page: 'theme', form: 'theme-form' },
  { page: 'email', form: 'email-config-form' },
  { page: 'login-configuration', form: 'custom-login-config-form' },
  { page: 'profiler-configuration', form: 'profiler-config-form' },
  { page: 'lineage', form: 'lineage-config-form' },
  { page: 'brand-url', form: 'brand-url-form' },
  { page: 'app-mode', form: 'app-mode-form' },
  { page: 'table-schema', form: 'table-schema-form' },
  { page: 'time-format', form: 'time-format-form' },
] as const;

const emailFields = [
  'serverEndpoint',
  'serverPort',
  'transportationStrategy',
  'enableSmtpServer',
  'senderMail',
  'emailingEntity',
  'username',
  'password',
  'supportUrl',
];
const emailConfig = {
  serverEndpoint: 'smtp.example.test',
  serverPort: 587,
  senderMail: 'metadata@example.test',
  emailingEntity: 'Visual Metadata',
  username: 'visual_smtp',
  supportUrl: 'https://example.test/support',
  enableSmtpServer: true,
  transportationStrategy: TransportationStrategy.SMTPTLS,
} satisfies SMTPSettings;
const overriddenSource: SettingSource = {
  configType: SettingType.EmailConfiguration,
  source: ConfigSourceMode.Auto,
  editable: true,
  overriddenFields: [
    { path: '/serverEndpoint', envVariable: 'SMTP_SERVER_ENDPOINT' },
  ],
};
const sourceScenes: {
  id: string;
  source: SettingSource;
  confirm?: boolean;
  failedAdoption?: boolean;
}[] = [
  {
    id: 'partially-managed',
    source: {
      configType: SettingType.EmailConfiguration,
      source: ConfigSourceMode.Env,
      sourceVariable: 'CONFIG_SOURCE',
      editable: true,
      managedPaths: ['/serverEndpoint', '/username', '/password'],
    },
  },
  {
    id: 'fully-managed',
    source: {
      configType: SettingType.EmailConfiguration,
      source: ConfigSourceMode.Env,
      sourceVariable: 'CONFIG_SOURCE',
      editable: false,
      managedPaths: emailFields.map((field) => `/${field}`),
    },
  },
  { id: 'overridden', source: overriddenSource },
  { id: 'adoption-confirmation', source: overriddenSource, confirm: true },
  {
    id: 'adoption-error',
    source: overriddenSource,
    confirm: true,
    failedAdoption: true,
  },
  {
    id: 'reload-error',
    source: {
      configType: SettingType.EmailConfiguration,
      source: ConfigSourceMode.Auto,
      editable: true,
      lastReloadError: 'SMTP configuration could not be applied.',
    },
  },
];

const openSettings = async (
  page: Page,
  path: string,
  formId: string,
  sources?: SettingSource[]
) => {
  await installVisualData(page);
  if (path === 'email') {
    await page.route(
      '**/api/v1/system/settings/emailConfiguration',
      async (route) => {
        if (route.request().method() !== 'GET') return route.fallback();
        await route.fulfill({
          json: {
            config_type: SettingType.EmailConfiguration,
            config_value: emailConfig,
          },
        });
      }
    );
  }
  if (sources) {
    await page.route('**/api/v1/system/settings/source', (route) =>
      route.fulfill({ json: { settings: sources } })
    );
  }
  await gotoForScreenshot(page, `/my-data#platform-settings/${path}/edit`, {
    readyTestId: formId,
  });
  const form = page.getByTestId(formId);
  if (path === 'email') {
    await expect(
      form.getByRole('textbox', { name: /server endpoint/i })
    ).toHaveValue(emailConfig.serverEndpoint);
  }

  return form;
};

for (const theme of VISUAL_THEMES) {
  test.describe(`Settings form bodies ${theme}`, { tag: '@Platform' }, () => {
    for (const scene of settingsForms) {
      test(`settings-form-${scene.page}`, async ({ page }) => {
        const errors: string[] = [];
        page.on('pageerror', (error) => errors.push(error.message));
        await prepareVisualTheme(page, theme);
        const form = await openSettings(page, scene.page, scene.form);
        await expect(form.getByTestId('save-button')).toBeInViewport({
          ratio: 1,
        });
        await expect(form.getByTestId('cancel-button')).toBeInViewport({
          ratio: 1,
        });

        // SettingsFormLayout fixes its footer while the direct child scrolls.
        // Measuring the outer form would miss clipping inside that child.
        const body = form.locator(':scope > [class~="tw:overflow-y-auto"]');
        await expect(body).toHaveCount(1);
        await expect(
          body.locator('input:visible, button:visible')
        ).not.toHaveCount(0);
        await withFullVisualTarget(page, body, () =>
          expectVisualScreenshot(page, `settings-form-${scene.page}`, theme, {
            target: body,
            maxDiffPixelRatio: 0,
          })
        );
        expect(
          errors,
          'Settings forms must render without runtime errors'
        ).toEqual([]);
      });
    }

    for (const scene of [
      {
        id: 'email-transport',
        page: 'email',
        form: 'email-config-form',
        field: 'transportation-strategy-input',
      },
      {
        id: 'lineage-layer',
        page: 'lineage',
        form: 'lineage-config-form',
        field: 'field-lineage-layer',
      },
      {
        id: 'lineage-pipeline-view',
        page: 'lineage',
        form: 'lineage-config-form',
        field: 'field-pipeline-view-mode',
      },
      {
        id: 'profiler-data-type',
        page: 'profiler-configuration',
        form: 'profiler-config-form',
        field: 'data-type-select',
      },
      {
        id: 'profiler-metric-type',
        page: 'profiler-configuration',
        form: 'profiler-config-form',
        field: 'metric-type-select',
      },
    ]) {
      test(`settings-menu-${scene.id}`, async ({ page }) => {
        await prepareVisualTheme(page, theme);
        const form = await openSettings(page, scene.page, scene.form);
        let scope = form;
        if (scene.page === 'profiler-configuration') {
          const count = await form.getByTestId(/^metric-row-\d+$/).count();
          await form.getByTestId('add-fields').click();
          scope = form.getByTestId(`metric-row-${count}`);
          await expect(scope).toBeVisible();
        }
        const body = form.locator(':scope > [class~="tw:overflow-y-auto"]');
        await withFullVisualTarget(page, body, async () => {
          if (scene.field === 'metric-type-select') {
            await scope.getByRole('combobox', { name: /metric type/i }).click();
          } else {
            await scope.getByTestId(scene.field).getByRole('button').click();
          }
          const menu = page.getByRole('listbox');
          // Profiler collections are taller than the scrolling popover.
          // Its positioned ancestor defines the viewport for each capture.
          const popup = page
            .locator('[data-rac][data-placement]')
            .filter({ has: menu });
          await expect(popup).toHaveCount(1);
          await expectVisualMenuScreenshots(
            page,
            `settings-menu-${scene.id}`,
            theme,
            menu,
            popup
          );
        });
      });
    }

    for (const scene of sourceScenes) {
      test(`settings-source-${scene.id}`, async ({ page }) => {
        await prepareVisualTheme(page, theme);
        const form = await openSettings(page, 'email', 'email-config-form', [
          scene.source,
        ]);
        const banner = form.getByTestId('settings-source-banner');
        await expect(banner).toBeVisible();
        if (scene.source.source === ConfigSourceMode.Env) {
          await expect(
            form.getByRole('textbox', { name: /server endpoint/i })
          ).toBeDisabled();
          if (scene.id === 'fully-managed')
            await expect(form.getByTestId('save-button')).toBeDisabled();
          else {
            await expect(
              form.getByRole('textbox', { name: /sender email/i })
            ).toBeEnabled();
            await expect(form.getByTestId('save-button')).toBeEnabled();
          }
        }
        if (scene.confirm) {
          await banner.getByTestId('use-deployment-value-button').click();
          const modal = page.getByTestId('use-deployment-value-modal');
          await expect(modal).toBeVisible();
          if (!scene.failedAdoption) {
            await expectVisualScreenshot(
              page,
              `settings-source-${scene.id}`,
              theme,
              { target: modal, maxDiffPixelRatio: 0 }
            );
            return;
          }
          // A failed adoption must retain the warning and the stored setting.
          await page.route('**/api/v1/system/settings/**', async (route) => {
            if (route.request().method() === 'GET') return route.fallback();
            await route.fulfill({
              status: 503,
              json: { message: 'Deployment values could not be adopted.' },
            });
          });
          await modal
            .getByRole('button', { name: /^Use Deployment Value$/i })
            .click();
          await expect(modal).toHaveCount(0);
          await expect(
            page.getByText('Deployment values could not be adopted.', {
              exact: true,
            })
          ).toBeVisible();
          await expect(
            banner.getByTestId('settings-source-overridden-alert')
          ).toBeVisible();
          await expect(
            form.getByRole('textbox', { name: /server endpoint/i })
          ).toHaveValue(emailConfig.serverEndpoint);
          await expectVisualScreenshot(
            page,
            `settings-source-${scene.id}`,
            theme,
            { allowErrorFeedback: true, maxDiffPixelRatio: 0 }
          );
          return;
        }
        const body = form.locator(':scope > [class~="tw:overflow-y-auto"]');
        await withFullVisualTarget(page, body, () =>
          expectVisualScreenshot(page, `settings-source-${scene.id}`, theme, {
            target: body,
            maxDiffPixelRatio: 0,
          })
        );
        if (scene.id === 'fully-managed') {
          // The fixed footer is outside the body crop; protect its disabled Save state.
          await expect(form.getByTestId('save-button')).toBeInViewport({
            ratio: 1,
          });
          await expectVisualScreenshot(
            page,
            'settings-source-fully-managed-frame',
            theme,
            {
              maxDiffPixelRatio: 0,
            }
          );
        }
      });
    }
  });
}
