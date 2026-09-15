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
import { uuid } from '../../utils/common';
import {
  approvalStep,
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
  'Onboarding authorization and enrollment',
  { tag: [DOMAIN_TAGS.GOVERNANCE] },
  () => {
    test('A viewer can monitor work but cannot edit checks, approve another user task or open configuration', async ({
      page,
      onboarding,
    }) => {
      const viewer = await onboarding.createUser();
      const reviewer = await onboarding.createUser();
      const workflow = await onboarding.workflow([reviewer]);
      await onboarding.publish(metric, fields, checks, [
        approvalStep('Business review', workflow),
      ]);
      const asset = await onboarding.createAsset(metric, {
        displayName: 'Ready for review',
      });
      for (let attempt = 0; attempt < 2; attempt++) {
        const progress = await onboarding.progress(metric, asset);
        const response = await onboarding.api.post(
          `/api/v1/governance/onboarding/metric/${asset.id}/transition`,
          {
            data: {
              expectedVersion: progress.entityVersion,
              targetStatus: progress.nextStatus,
            },
          }
        );
        expect(response.ok()).toBeTruthy();
      }
      const progress = await onboarding.progress(metric, asset);
      const task = progress.steps.find(
        (step) => step.step.type === Type.Approval
      )?.taskId;
      expect(task).toBeTruthy();
      await viewer.login(page);
      const checklist = await visitOnboardingAsset(page, metric, asset);
      await checklist
        .getByRole('button', { name: 'Display Name', exact: true })
        .click();
      await expect(
        checklist.getByRole('textbox', { name: 'Display Name', exact: true })
      ).toHaveCount(0);
      await expect(
        checklist.getByRole('button', { name: 'Edit', exact: true })
      ).toHaveCount(0);
      await expect(checklist.getByTestId('onboarding-advance')).toBeDisabled();
      await checklist
        .getByRole('button', { name: 'Business review', exact: true })
        .click();
      await checklist
        .getByRole('link', { name: 'View task', exact: true })
        .click();
      await expect(page).toHaveURL(new RegExp(`/tasks/${task}$`));
      await expect(page.getByTestId('task-detail-panel')).toBeVisible();
      await expect(page.getByTestId('task-approve')).toHaveCount(0);
      await expect(page.getByTestId('task-reject')).toHaveCount(0);
      await page.goto('/settings/governance/intake-forms');
      await expect(
        page.getByTestId('permission-error-placeholder')
      ).toBeVisible();
      await expect(page.getByTestId('onboarding-configurations')).toHaveCount(
        0
      );
      expect((await onboarding.progress(metric, asset)).stage).toBe(
        'In Review'
      );
    });

    test('Enrollment status recovers from a failed load and leaves existing reviews, approvals and tasks intact', async ({
      page,
      onboarding,
    }) => {
      test.slow();
      await authenticateAdminPage(page);
      const reviewer = await onboarding.createUser();
      const eligible = await onboarding.createAsset(metric);
      const reviewing = await onboarding.createAsset(metric);
      const approved = await onboarding.createAsset(metric);
      for (const [asset, status] of [
        [reviewing, 'In Review'],
        [approved, 'Approved'],
      ] as const) {
        const response = await onboarding.api.patch(
          `/api/v1/metrics/${asset.id}`,
          {
            headers: { 'Content-Type': 'application/json-patch+json' },
            data: [{ op: 'add', path: '/entityStatus', value: status }],
          }
        );
        expect(response.ok()).toBeTruthy();
      }
      const task = await onboarding.createResource('tasks', {
        name: `existing_review_${uuid()}`,
        type: 'RequestApproval',
        category: 'Approval',
        about: `<#E::metric::${reviewing.fullyQualifiedName}>`,
        assignees: [reviewer.responseData.name],
      });
      const readTask = async () => {
        const response = await onboarding.api.get(`/api/v1/tasks/${task.id}`);
        expect(response.ok()).toBeTruthy();
        return response.json();
      };
      await expect
        .poll(async () => (await readTask()).workflowInstanceId)
        .toBeTruthy();
      const existingTask = await readTask();
      await onboarding.publish(metric, fields, checks);
      const backfillUrl = '**/api/v1/governance/onboarding/backfill/metric';
      await page.route(backfillUrl, (route) =>
        route.fulfill({
          status: 503,
          json: { message: 'Enrollment status unavailable' },
        })
      );
      await page.goto('/settings/governance/intake-forms');
      const status = page.getByTestId('onboarding-backfill-metric');
      await expect(status.getByRole('alert')).toBeVisible();
      await page.unroute(backfillUrl);
      const recovered = page.waitForResponse(backfillUrl);
      await status.getByRole('button', { name: 'Retry', exact: true }).click();
      expect((await recovered).ok()).toBeTruthy();
      await expect(page.getByTestId('row-metric')).toContainText(
        /enrolled.*scanned/
      );
      await expect(status.getByRole('alert')).toHaveCount(0);
      await expect
        .poll(async () => {
          const response = await onboarding.api.get(
            '/api/v1/governance/onboarding/backfill/metric'
          );
          return (await response.json())?.complete;
        })
        .toBe(true);
      const enrolled = await onboarding.progress(metric, eligible);
      expect(enrolled.stage).toBe('Draft');
      for (const [asset, expectedStatus] of [
        [reviewing, 'In Review'],
        [approved, 'Approved'],
      ] as const) {
        const response = await onboarding.api.get(
          `/api/v1/metrics/${asset.id}`
        );
        expect((await response.json()).entityStatus).toBe(expectedStatus);
        expect(
          (
            await onboarding.api.get(
              `/api/v1/governance/onboarding/metric/${asset.id}`
            )
          ).status()
        ).toBe(404);
      }
      const preservedTask = await readTask();
      expect(preservedTask.workflowInstanceId).toBe(
        existingTask.workflowInstanceId
      );
      expect(preservedTask.status).toBe(existingTask.status);
      const checklist = await visitOnboardingAsset(page, metric, eligible);
      await page.reload();
      await expect(
        checklist.getByTestId('onboarding-current-stage')
      ).toHaveText('Draft');
    });
  }
);
