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
import {
  FieldKind,
  TargetEntityType,
  Type,
} from '../../../src/generated/governance/intakeForm';
import { DOMAIN_TAGS } from '../../constant/config';
import { expect } from '../../support/fixtures/base';
import { authenticateAdminPage } from '../../utils/admin';
import {
  approvalStep,
  onboardingTest as test,
  ONBOARDING_TYPES,
  visitOnboardingAsset,
} from '../../utils/onboarding';

const metric = ONBOARDING_TYPES.find(
  (item) => item.type === TargetEntityType.Metric
)!;
const fields = [
  {
    fieldPath: 'displayName',
    fieldLabel: 'Display Name',
    fieldKind: FieldKind.Native,
    required: true,
  },
];
const checks = [
  {
    id: 'display-name',
    type: Type.Field,
    fieldPath: 'displayName',
    title: 'Display Name',
    rules: { minLength: 5 },
  },
];

test.describe(
  'Onboarding configuration, preview and board',
  { tag: [DOMAIN_TAGS.GOVERNANCE] },
  () => {
    test.beforeEach(async ({ page }) => {
      page.setDefaultTimeout(20000);
      await authenticateAdminPage(page);
    });

    test('Builder preserves dirty edits on Escape and publication failure; old assets keep their version', async ({
      page,
      onboarding,
    }) => {
      const form = await onboarding.publish(metric, fields, checks);
      const oldAsset = await onboarding.createAsset(metric);
      const oldProgress = await onboarding.progress(metric, oldAsset);
      await page.goto('/settings/governance/intake-forms');
      await expect(page.getByTestId('onboarding-configurations')).toContainText(
        'Creation: Checks: 1'
      );
      await page.getByTestId('configure-onboarding-metric').click();
      const designer = page.getByTestId('intake-form-designer-modal');
      await designer
        .getByRole('textbox', { name: 'Description', exact: true })
        .fill('New published guidance');
      await page.keyboard.press('Escape');
      await page
        .getByRole('button', { name: 'Continue Editing', exact: true })
        .click();
      await expect(
        designer.getByRole('textbox', { name: 'Description', exact: true })
      ).toHaveValue('New published guidance');
      await designer.getByTestId('onboarding-stage-Draft').click();
      await designer
        .getByRole('button', { name: '1. Display Name', exact: true })
        .click();
      const settings = designer.getByTestId('onboarding-check-settings');
      await settings
        .getByRole('spinbutton', { name: 'Minimum length', exact: true })
        .fill('10');
      await expect(
        settings.getByRole('spinbutton', { name: 'Minimum count', exact: true })
      ).toHaveCount(0);
      await page.setViewportSize({ width: 320, height: 844 });
      await expect(designer).toBeVisible();
      expect(
        await designer.evaluate(
          (node) => node.scrollWidth <= node.clientWidth + 1
        )
      ).toBe(true);
      const publish = page.getByTestId('intake-form-submit');
      await publish.scrollIntoViewIfNeeded();
      const bounds = await publish.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
      await page.route(
        '**/api/v1/governance/intakeForms',
        (route) =>
          route.request().method() === 'PUT'
            ? route.fulfill({
                status: 503,
                json: { message: 'Publication unavailable' },
              })
            : route.fallback(),
        { times: 1 }
      );
      const failed = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/governance/intakeForms') &&
          response.request().method() === 'PUT'
      );
      await publish.click();
      expect((await failed).status()).toBe(503);
      await page.getByTestId('alert-icon-close').click();
      await expect(
        designer.getByRole('textbox', { name: 'Description', exact: true })
      ).toHaveValue('New published guidance');
      const saved = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/governance/intakeForms') &&
          response.request().method() === 'PUT'
      );
      await publish.click();
      expect((await saved).ok()).toBeTruthy();
      await expect(designer).toHaveCount(0);
      const newAsset = await onboarding.createAsset(metric);
      const newProgress = await onboarding.progress(metric, newAsset);
      expect(newProgress.configurationId).toBe(form.id);
      expect(newProgress.configurationVersion).not.toBe(
        oldProgress.configurationVersion
      );
      expect(
        (await onboarding.progress(metric, oldAsset)).configurationVersion
      ).toBe(oldProgress.configurationVersion);
      const oldChecklist = await visitOnboardingAsset(page, metric, oldAsset);
      await expect(oldChecklist).toContainText('Minimum characters: 5');
      const newChecklist = await visitOnboardingAsset(page, metric, newAsset);
      await expect(newChecklist).toContainText('Minimum characters: 10');
    });

    test('Producer preview completes local checks and simulated decisions without creating assets or tasks', async ({
      page,
      onboarding,
    }) => {
      const reviewer = await onboarding.createUser();
      const workflow = await onboarding.workflow([reviewer]);
      await onboarding.publish(metric, fields, checks, [
        approvalStep('Preview review', workflow),
      ]);
      await page.goto('/settings/governance/intake-forms');
      await page.getByTestId('configure-onboarding-metric').click();
      const designer = page.getByTestId('intake-form-designer-modal');
      await designer.getByTestId('onboarding-preview-toggle').click();
      const preview = designer.getByTestId('onboarding-producer-preview');
      const writes: string[] = [];
      const recordWrite = (request: import('@playwright/test').Request) => {
        if (
          ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method()) &&
          /\/api\/v1\/(metrics|tasks|governance\/onboarding)(\/|\?|$)/.test(
            request.url()
          )
        )
          writes.push(request.url());
      };
      page.on('request', recordWrite);
      try {
        await preview
          .getByRole('textbox', { name: 'Name', exact: true })
          .fill('Preview metric');
        await preview
          .getByRole('button', { name: 'Save & continue', exact: true })
          .click();
        await preview.getByTestId('onboarding-advance').click();
        await preview
          .getByRole('textbox', { name: 'Display Name', exact: true })
          .fill('Preview ready');
        await preview
          .getByRole('button', { name: 'Save & continue', exact: true })
          .click();
        await preview.getByTestId('onboarding-advance').click();
        await preview
          .getByRole('button', { name: 'Preview review', exact: true })
          .click();
        await preview
          .getByRole('button', { name: 'Simulate rejection', exact: true })
          .click();
        await expect(
          preview.getByRole('button', { name: 'Preview review', exact: true })
        ).toContainText('Rejected');
        await expect(preview.getByTestId('onboarding-advance')).toBeDisabled();
        await preview
          .getByRole('button', { name: 'Simulate approval', exact: true })
          .click();
        await preview.getByTestId('onboarding-advance').click();
        await expect(preview).toContainText('Approved completes onboarding');
        expect(writes).toEqual([]);
        await preview
          .getByRole('button', { name: 'Reset', exact: true })
          .click();
        await expect(
          preview.getByRole('textbox', { name: 'Name', exact: true })
        ).toHaveValue('');
        expect(writes).toEqual([]);
      } finally {
        page.off('request', recordWrite);
      }
    });

    test('Board filters and pagination survive reload and back navigation; errors clear stale rows', async ({
      page,
      onboarding,
    }) => {
      test.slow();
      await onboarding.publish(metric, fields, checks);
      const domain = await onboarding.createResource('domains', {
        name: `board_${Date.now()}`,
        description: 'Isolated board domain',
        domainType: 'Aggregate',
      });
      const assets = [];
      for (let count = 0; count < 26; count++)
        assets.push(
          await onboarding.createAsset(metric, {
            domains: [domain.fullyQualifiedName],
          })
        );
      await page.goto(
        `/onboarding?entityType=metric&domain=${domain.id}&domainName=${domain.name}`
      );
      const board = page.getByTestId('onboarding-board');
      const rows = board
        .getByRole('row')
        .filter({ has: page.getByRole('link') });
      await expect(rows).toHaveCount(25);
      await board.getByRole('button', { name: / Stage$/ }).click();
      await page.getByRole('option', { name: 'Draft', exact: true }).click();
      await expect(page).toHaveURL(/stage=Draft/);
      await expect(rows).toHaveCount(25);
      await board.getByRole('button', { name: 'Next', exact: true }).click();
      await expect(rows).toHaveCount(1);
      const secondPage = await rows.allTextContents();
      const secondUrl = page.url();
      await page.reload();
      await expect(rows).toHaveCount(1);
      await expect(rows).toHaveText(secondPage);
      expect(page.url()).toBe(secondUrl);
      await rows
        .getByRole('link', { name: 'Display Name', exact: true })
        .click();
      await expect(page.getByTestId('task-detail-panel')).toBeVisible();
      await page.goBack();
      await expect(rows).toHaveCount(1);
      const remaining = rows.getByRole('link', { name: /^journey_/ });
      await remaining.click();
      await expect(page.getByTestId('onboarding-checklist')).toBeVisible();
      await page.goBack();
      await expect(page).toHaveURL(secondUrl);
      await expect(rows).toHaveCount(1);
      await board
        .getByRole('button', { name: 'Previous', exact: true })
        .click();
      await expect(rows).toHaveCount(25);
      await page.route(
        '**/api/v1/governance/onboarding?*',
        (route) =>
          route.fulfill({
            status: 503,
            json: { message: 'Board unavailable' },
          }),
        { times: 1 }
      );
      await board.getByRole('button', { name: / Stage$/ }).click();
      await page.getByRole('option', { name: 'Approved', exact: true }).click();
      await expect(board.getByRole('alert')).toContainText(
        'Could not load the board'
      );
      await expect(rows).toHaveCount(0);
      await board.getByRole('button', { name: 'Refresh', exact: true }).click();
      await expect(board).toContainText('No assets match these filters.');
      await expect(board.getByRole('alert')).toHaveCount(0);
      expect((await onboarding.progress(metric, assets[0])).stage).toBe(
        'Draft'
      );
    });
  }
);
