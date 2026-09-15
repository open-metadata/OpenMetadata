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
  advanceOnboarding,
  approvalStep,
  decideOnboardingTask,
  onboardingTest as test,
  ONBOARDING_TYPES,
  refreshChecklist,
  saveOnboardingField,
  visitOnboardingAsset,
} from '../../utils/onboarding';

const displayName = {
  fieldPath: 'displayName',
  fieldLabel: 'Display Name',
  fieldKind: FieldKind.Native,
  required: true,
};
const nameCheck = {
  id: 'display-name',
  type: Type.Field,
  fieldPath: 'displayName',
  title: 'Display Name',
  rules: { minLength: 5 },
};

test.describe(
  'Onboarding workflow evidence and recovery',
  { tag: [DOMAIN_TAGS.GOVERNANCE] },
  () => {
    test.beforeEach(async ({ page }) => {
      await authenticateAdminPage(page);
    });

    for (const type of ONBOARDING_TYPES) {
      test(`${type.label}: distinct approvals, concurrent requests, rejection and revised metadata`, async ({
        page,
        browser,
        baseURL,
        onboarding,
      }) => {
        test.slow();
        const reviewer = await onboarding.createUser();
        const firstWorkflow = await onboarding.workflow([reviewer]);
        const secondWorkflow = await onboarding.workflow([reviewer]);
        await onboarding.publish(
          type,
          [displayName],
          [nameCheck],
          [
            approvalStep('Business review', firstWorkflow),
            approvalStep('Quality review', secondWorkflow),
          ]
        );
        const asset = await onboarding.createAsset(type, {
          displayName: 'Ready for review',
        });
        const checklist = await visitOnboardingAsset(page, type, asset);
        await advanceOnboarding(page, checklist, type, asset);
        await expect(
          checklist.getByTestId('onboarding-current-stage')
        ).toHaveText('In Review');
        const secondTab = await page.context().newPage();
        const reviewerPage = await browser.newPage({ baseURL });
        try {
          const secondChecklist = await visitOnboardingAsset(
            secondTab,
            type,
            asset
          );
          const submissions = await Promise.all([
            advanceOnboarding(page, checklist, type, asset),
            advanceOnboarding(secondTab, secondChecklist, type, asset),
          ]);
          const tasks = submissions[0].steps
            .filter((step) => step.step.type === Type.Approval)
            .map((step) => step.taskId);
          expect(tasks).toHaveLength(2);
          expect(tasks.every(Boolean)).toBeTruthy();
          expect(new Set(tasks).size).toBe(2);
          expect(
            submissions[1].steps
              .filter((step) => step.step.type === Type.Approval)
              .map((step) => step.taskId)
          ).toEqual(tasks);
          await reviewer.login(reviewerPage);
          await decideOnboardingTask(reviewerPage, tasks[0]!, true);
          await refreshChecklist(page, checklist, type, asset);
          await expect(
            checklist.getByTestId('onboarding-current-stage')
          ).toHaveText('In Review');
          const bypass = await onboarding.api.patch(
            `/api/v1/${type.collection}/${asset.id}`,
            {
              headers: { 'Content-Type': 'application/json-patch+json' },
              data: [{ op: 'add', path: '/entityStatus', value: 'Approved' }],
            }
          );
          expect(bypass.status()).toBe(400);
          await decideOnboardingTask(reviewerPage, tasks[1]!, false);
          await expect(
            reviewerPage.getByTestId('task-status-badge')
          ).toHaveText('Rejected');
          await expect(
            reviewerPage.getByTestId('task-detail-panel')
          ).toContainText('Please clarify the business definition.');
          await refreshChecklist(page, checklist, type, asset);
          await expect(
            checklist.getByRole('button', {
              name: 'Quality review',
              exact: true,
            })
          ).toContainText('Rejected');
          const resubmitted = await advanceOnboarding(
            page,
            checklist,
            type,
            asset
          );
          const retried = resubmitted.steps.filter(
            (step) => step.step.type === Type.Approval
          );
          expect(retried[0].taskId).toBe(tasks[0]);
          expect(retried[1].taskId).not.toBe(tasks[1]);
          await decideOnboardingTask(reviewerPage, retried[1].taskId!, true);
          await checklist
            .getByRole('button', { name: 'Display Name', exact: true })
            .click();
          await checklist
            .getByRole('textbox', { name: 'Display Name', exact: true })
            .fill('Revised business definition');
          expect(
            (await saveOnboardingField(page, checklist, type, asset)).ok()
          ).toBeTruthy();
          await expect(
            checklist.getByTestId('onboarding-current-stage')
          ).toHaveText('In Review');
          expect((await onboarding.progress(type, asset)).canAdvance).toBe(
            false
          );
          const revised = await advanceOnboarding(page, checklist, type, asset);
          const renewed = revised.steps.filter(
            (step) => step.step.type === Type.Approval
          );
          expect(renewed[0].taskId).not.toBe(tasks[0]);
          expect(renewed[1].taskId).not.toBe(retried[1].taskId);
          for (const step of renewed)
            await decideOnboardingTask(reviewerPage, step.taskId!, true);
          await expect
            .poll(
              async () => (await onboarding.progress(type, asset)).canAdvance
            )
            .toBe(true);
          await refreshChecklist(page, checklist, type, asset);
          await expect(checklist.getByTestId('onboarding-advance')).toHaveText(
            'Advance to Approved'
          );
          const finished = await advanceOnboarding(
            page,
            checklist,
            type,
            asset
          );
          expect(finished.completed).toBe(true);
          const evidence = finished.steps.filter(
            (step) => step.step.type === Type.Approval
          );
          expect(evidence.map((step) => step.step.workflow?.id)).toEqual([
            firstWorkflow.id,
            secondWorkflow.id,
          ]);
          expect(
            evidence.every(
              (step) => step.state === 'Complete' && step.workflowInstanceId
            )
          ).toBeTruthy();
          await page.reload();
          await expect(
            checklist.getByTestId('onboarding-current-stage')
          ).toHaveText('Approved');
          await checklist
            .getByRole('button', { name: 'Quality review', exact: true })
            .click();
          await expect(
            checklist.getByText(/Workflow execution:/)
          ).toBeVisible();
          await checklist
            .getByRole('link', { name: 'Onboarding board', exact: true })
            .click();
          await expect(
            page
              .getByRole('row')
              .filter({ hasText: 'Revised business definition' })
          ).toContainText('Approved');
        } finally {
          await secondTab.close();
          await reviewerPage.close();
        }
      });
    }

    test('Metric: two distinct reviewers must satisfy the configured threshold', async ({
      page,
      browser,
      baseURL,
      onboarding,
    }) => {
      test.slow();
      const type = ONBOARDING_TYPES.find(
        (item) => item.type === TargetEntityType.Metric
      )!;
      const reviewers = [
        await onboarding.createUser(),
        await onboarding.createUser(),
      ];
      const workflow = await onboarding.workflow(reviewers, 2);
      await onboarding.publish(
        type,
        [],
        [],
        [approvalStep('Two-person review', workflow)]
      );
      const asset = await onboarding.createAsset(type);
      const checklist = await visitOnboardingAsset(page, type, asset);
      const requested = await advanceOnboarding(page, checklist, type, asset);
      const taskId = requested.steps.find(
        (step) => step.step.type === Type.Approval
      )?.taskId;
      expect(taskId).toBeTruthy();
      for (const reviewer of reviewers) {
        const decisionPage = await browser.newPage({ baseURL });
        try {
          await reviewer.login(decisionPage);
          await decideOnboardingTask(decisionPage, taskId!, true);
          if (reviewer === reviewers[0]) {
            const pending = await onboarding.progress(type, asset);
            expect(pending.canAdvance).toBe(false);
            expect(pending.stage).toBe('In Review');
            await expect(decisionPage.getByTestId('task-approve')).toHaveCount(
              0
            );
          }
        } finally {
          await decisionPage.close();
        }
      }
      await expect
        .poll(async () => (await onboarding.progress(type, asset)).canAdvance)
        .toBe(true);
      await refreshChecklist(page, checklist, type, asset);
      expect(
        (await advanceOnboarding(page, checklist, type, asset)).completed
      ).toBe(true);
    });

    test('Metric: suspended workflow resumes its task; deleted workflow remains a blocker', async ({
      page,
      onboarding,
    }) => {
      const type = ONBOARDING_TYPES.find(
        (item) => item.type === TargetEntityType.Metric
      )!;
      const reviewer = await onboarding.createUser();
      const workflow = await onboarding.workflow([reviewer]);
      await onboarding.publish(
        type,
        [],
        [],
        [approvalStep('Workflow review', workflow)]
      );
      const asset = await onboarding.createAsset(type);
      const checklist = await visitOnboardingAsset(page, type, asset);
      const pending = await advanceOnboarding(page, checklist, type, asset);
      const taskId = pending.steps.find(
        (step) => step.step.type === Type.Approval
      )?.taskId;
      const workflowPath = `/api/v1/governance/workflowDefinitions/name/${workflow.fullyQualifiedName}`;
      expect(
        (await onboarding.api.put(`${workflowPath}/suspend`, { data: {} })).ok()
      ).toBeTruthy();
      await refreshChecklist(page, checklist, type, asset);
      await expect(
        checklist.getByRole('button', { name: 'Workflow review', exact: true })
      ).toContainText('Failed');
      await expect(
        checklist.getByTestId('onboarding-current-stage')
      ).toHaveText('In Review');
      expect(
        (await onboarding.api.put(`${workflowPath}/resume`, { data: {} })).ok()
      ).toBeTruthy();
      const resumed = await advanceOnboarding(page, checklist, type, asset);
      expect(
        resumed.steps.find((step) => step.step.type === Type.Approval)?.taskId
      ).toBe(taskId);
      expect(
        (
          await onboarding.api.delete(
            `/api/v1/governance/workflowDefinitions/${workflow.id}?hardDelete=true`
          )
        ).ok()
      ).toBeTruthy();
      await refreshChecklist(page, checklist, type, asset);
      await expect(
        checklist.getByRole('button', { name: 'Workflow review', exact: true })
      ).toContainText('Failed');
      const blocked = await advanceOnboarding(page, checklist, type, asset);
      expect(blocked.canAdvance).toBe(false);
      expect(blocked.stage).toBe('In Review');
      await expect(checklist.getByTestId('onboarding-handoff')).toContainText(
        /workflow/i
      );
    });

    test('Metric: missing workflow assignees remain visible unresolved work', async ({
      page,
      onboarding,
    }) => {
      const type = ONBOARDING_TYPES.find(
        (item) => item.type === TargetEntityType.Metric
      )!;
      const workflow = await onboarding.workflow([]);
      await onboarding.publish(
        type,
        [],
        [],
        [approvalStep('Unassigned review', workflow)]
      );
      const asset = await onboarding.createAsset(type);
      const checklist = await visitOnboardingAsset(page, type, asset);
      await advanceOnboarding(page, checklist, type, asset);
      await expect
        .poll(
          async () =>
            (
              await onboarding.progress(type, asset)
            ).steps.find((step) => step.step.type === Type.Approval)?.state
        )
        .toBe('Blocked');
      await refreshChecklist(page, checklist, type, asset);
      await expect(
        checklist.getByRole('navigation', {
          name: 'Unassigned work',
          exact: true,
        })
      ).toContainText('Unassigned review');
      await expect(checklist.getByTestId('onboarding-handoff')).toContainText(
        'No responsible person could be resolved.'
      );
      const blocked = await advanceOnboarding(page, checklist, type, asset);
      expect(blocked.canAdvance).toBe(false);
      expect(blocked.stage).toBe('In Review');
    });
  }
);
