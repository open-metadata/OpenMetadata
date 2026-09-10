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
  onboardingTest as test,
  ONBOARDING_TYPES,
  visitOnboardingAsset,
} from '../../utils/onboarding';

const metric = ONBOARDING_TYPES.find(
  (type) => type.type === TargetEntityType.Metric
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
    id: 'name',
    title: 'Display Name',
    type: Type.Field,
    fieldPath: 'displayName',
  },
];

test.describe(
  'Onboarding keyboard and navigation',
  { tag: [DOMAIN_TAGS.GOVERNANCE] },
  () => {
    test('Browser Back preserves dirty input until the producer explicitly discards it', async ({
      page,
      onboarding,
    }) => {
      await authenticateAdminPage(page);
      await onboarding.publish(metric, fields, checks);
      const asset = await onboarding.createAsset(metric);
      await page.goto('/onboarding?entityType=metric');
      await page.getByRole('link', { name: asset.name, exact: true }).click();
      const checklist = page.getByTestId('onboarding-checklist');
      const input = checklist.getByRole('textbox', {
        name: 'Display Name',
        exact: true,
      });
      await input.fill('A draft worth keeping');
      const assetUrl = page.url();
      await page.goBack();
      await expect(
        page.getByRole('dialog', { name: 'Unsaved changes', exact: true })
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'Continue Editing', exact: true })
        .click();
      await expect(page).toHaveURL(assetUrl);
      await expect(input).toHaveValue('A draft worth keeping');
      await page.goBack();
      await page.getByRole('button', { name: 'Discard', exact: true }).click();
      await expect(page).toHaveURL(/\/onboarding\?entityType=metric$/);
      await page.getByRole('link', { name: asset.name, exact: true }).click();
      await expect(input).toHaveValue('');
    });

    test('Browser Forward preserves dirty input without replacing the original history entry', async ({
      page,
      onboarding,
    }) => {
      await authenticateAdminPage(page);
      await onboarding.publish(metric, fields, checks);
      const asset = await onboarding.createAsset(metric);
      const checklist = await visitOnboardingAsset(page, metric, asset);
      await checklist
        .getByRole('link', { name: 'Onboarding board', exact: true })
        .click();
      const boardUrl = page.url();
      await page.goBack();
      const input = checklist.getByRole('textbox', {
        name: 'Display Name',
        exact: true,
      });
      await input.fill('Forward draft');
      const assetUrl = page.url();
      await page.goForward();
      await page
        .getByRole('button', { name: 'Continue Editing', exact: true })
        .click();
      await expect(page).toHaveURL(assetUrl);
      await expect(input).toHaveValue('Forward draft');
      await page.goForward();
      await page.getByRole('button', { name: 'Discard', exact: true }).click();
      await expect(page).toHaveURL(boardUrl);
      await page.goBack();
      await expect(page).toHaveURL(assetUrl);
      await expect(input).toHaveValue('');
    });

    test('A producer can reach, edit and save a check with Tab and Enter at 320px', async ({
      page,
      onboarding,
    }) => {
      await authenticateAdminPage(page);
      await onboarding.publish(metric, fields, checks);
      const asset = await onboarding.createAsset(metric);
      await page.setViewportSize({ width: 320, height: 844 });
      const checklist = await visitOnboardingAsset(page, metric, asset);
      await expect(
        checklist.getByRole('heading', { name: 'Display Name', exact: true })
      ).toBeFocused();
      const input = checklist.getByRole('textbox', {
        name: 'Display Name',
        exact: true,
      });
      await page.keyboard.press('Tab');
      await expect(input).toBeFocused();
      await page.keyboard.type('Keyboard producer');
      await page.keyboard.press('Tab');
      const back = checklist.getByRole('button', { name: 'Back', exact: true });
      await expect(back).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(
        page.getByRole('dialog', { name: 'Unsaved changes', exact: true })
      ).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(back).toBeFocused();
      await page.keyboard.press('Tab');
      const save = checklist.getByRole('button', {
        name: 'Save & continue',
        exact: true,
      });
      await expect(save).toBeFocused();
      await expect(save).toBeInViewport();
      const bounds = await save.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(320);
      const saved = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          response.url().endsWith(`/api/v1/metrics/${asset.id}`)
      );
      await page.keyboard.press('Enter');
      expect((await saved).ok()).toBeTruthy();
      await expect(
        checklist.locator('button[data-loading="true"]')
      ).toHaveCount(0);
      await page.reload();
      await checklist
        .getByRole('button', { name: 'Display Name', exact: true })
        .click();
      await expect(input).toHaveValue('Keyboard producer');
    });
  }
);
