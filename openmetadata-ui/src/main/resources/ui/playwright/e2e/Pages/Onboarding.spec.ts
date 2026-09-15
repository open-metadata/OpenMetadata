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
import { APIRequestContext, Page } from '@playwright/test';
import { DOMAIN_TAGS } from '../../constant/config';
import { expect, test } from '../../support/fixtures/base';
import { UserClass } from '../../support/user/UserClass';
import {
  authenticateAdminPage,
  createAdminApiContext,
} from '../../utils/admin';
import { uuid } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  createOnboardingAssetThroughUI,
  ONBOARDING_TYPES,
} from '../../utils/onboarding';

interface Asset {
  id: string;
  name: string;
  fullyQualifiedName: string;
}
const TYPES = ONBOARDING_TYPES;
const SETTINGS = '/settings/governance/intake-forms';
const openChecklist = async (page: Page) => {
  const checklist = page.getByTestId('onboarding-checklist');
  await expect(checklist).toBeVisible();
  await expect(checklist.getByTestId('onboarding-journey')).toBeVisible();
  await expect(checklist.getByTestId('onboarding-advance')).toBeVisible();
  return checklist;
};

test.describe('Unified onboarding', { tag: [DOMAIN_TAGS.GOVERNANCE] }, () => {
  test.describe.configure({ mode: 'serial' });
  const delegate = new UserClass();
  const viewer = new UserClass();
  let permissionRole: Asset;
  let permissionPolicy: Asset;
  let api: APIRequestContext;
  let dispose: () => Promise<void>;
  let domain: Asset;
  let glossary: Asset;
  let workflow: Asset;
  const cleanup: string[] = [];

  test.beforeAll(async () => {
    const login = await createAdminApiContext();
    api = login.apiContext;
    dispose = login.afterAction;
    const policyResponse = await api.post('/api/v1/policies', {
      data: {
        name: `onboarding_delegate_policy_${uuid()}`,
        description:
          'Allow delegated display name edits on onboarding asset types',
        rules: [
          {
            name: 'DelegatedMetadata',
            resources: TYPES.map((type) => type.type),
            operations: ['EditDisplayName'],
            effect: 'allow',
          },
        ],
      },
    });
    expect(policyResponse.status()).toBe(201);
    permissionPolicy = await policyResponse.json();
    const roleResponse = await api.post('/api/v1/roles', {
      data: {
        name: `onboarding_delegate_role_${uuid()}`,
        policies: [
          'DataConsumerPolicy',
          'TaskAuthorPolicy',
          permissionPolicy.name,
        ],
      },
    });
    expect(roleResponse.status()).toBe(201);
    permissionRole = await roleResponse.json();
    await viewer.create(api);
    const userResponse = await api.post('/api/v1/users', {
      data: {
        name: delegate.data.email.split('@')[0],
        email: delegate.data.email,
        displayName: 'Onboarding reviewer',
        isAdmin: false,
        roles: [permissionRole.id],
        createPasswordType: 'ADMIN_CREATE',
        password: delegate.data.password,
        confirmPassword: delegate.data.password,
      },
    });
    expect(userResponse.status()).toBe(201);
    delegate.responseData = await userResponse.json();
    expect(delegate.responseData.isAdmin).toBe(false);
    const domainResponse = await api.post('/api/v1/domains', {
      data: {
        name: `onboarding_parent_${uuid()}`,
        description: 'Onboarding test parent',
        domainType: 'Aggregate',
      },
    });
    expect(domainResponse.status()).toBe(201);
    domain = await domainResponse.json();
    const glossaryResponse = await api.post('/api/v1/glossaries', {
      data: {
        name: `onboarding_glossary_${uuid()}`,
        description: 'Onboarding test glossary',
      },
    });
    expect(glossaryResponse.status()).toBe(201);
    glossary = await glossaryResponse.json();
    const seedResponse = await api.get(
      '/api/v1/governance/workflowDefinitions/name/RequestApprovalTaskWorkflow?fields=*'
    );
    expect(seedResponse.status()).toBe(200);
    const seed = await seedResponse.json();
    for (const node of seed.nodes) {
      if (node.subType === 'userApprovalTask') {
        node.config.assigneeStrategy = 'reviewers-and-assignees';
        node.config.approvalThreshold = 1;
        node.config.assignees = {
          addReviewers: false,
          addOwners: false,
          candidates: [
            {
              id: delegate.responseData.id,
              type: 'user',
              fullyQualifiedName: delegate.responseData.fullyQualifiedName,
            },
          ],
        };
      }
    }
    const workflowResponse = await api.post(
      '/api/v1/governance/workflowDefinitions',
      {
        data: {
          name: `onboarding_${uuid()}`,
          description: 'Browser journey approval',
          config: seed.config,
          trigger: seed.trigger,
          nodes: seed.nodes,
          edges: seed.edges,
        },
      }
    );
    expect(workflowResponse.status()).toBe(201);
    workflow = await workflowResponse.json();
  });

  test.afterAll(async () => {
    for (const path of cleanup.reverse()) {
      const response = await api.delete(
        `${path}?hardDelete=true&recursive=true`
      );
      expect([200, 204, 404]).toContain(response.status());
    }
    if (workflow) {
      const workflowResponse = await api.delete(
        `/api/v1/governance/workflowDefinitions/${workflow.id}?hardDelete=true`
      );
      expect(workflowResponse.ok()).toBeTruthy();
    }
    if (delegate.responseData.id) await delegate.delete(api);
    if (viewer.responseData.id) await viewer.delete(api);
    if (permissionRole)
      await api.delete(`/api/v1/roles/${permissionRole.id}?hardDelete=true`);
    if (permissionPolicy)
      await api.delete(
        `/api/v1/policies/${permissionPolicy.id}?hardDelete=true`
      );
    if (glossary)
      await api.delete(
        `/api/v1/glossaries/${glossary.id}?hardDelete=true&recursive=true`
      );
    if (domain)
      await api.delete(
        `/api/v1/domains/${domain.id}?hardDelete=true&recursive=true`
      );
    await dispose?.();
  });

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(30000);
    await authenticateAdminPage(page);
  });

  for (const type of TYPES) {
    test(`${type.label}: configure, resume, delegate, approve and navigate the board`, async ({
      page,
      browser,
      baseURL,
    }) => {
      test.slow();
      let asset: Asset;
      await test.step('Publish ordered field and workflow checks', async () => {
        await page.goto(SETTINGS);
        await waitForAllLoadersToDisappear(page);
        await page.getByTestId('add-intake-form').click();
        await page
          .getByRole('menuitem', { name: type.label, exact: true })
          .click();
        const designer = page.getByTestId('intake-form-designer-modal');
        await expect(designer).toBeVisible();
        await designer.getByTestId('onboarding-stage-Draft').click();
        await designer.getByRole('button', { name: / Field$/ }).click();
        await page
          .getByRole('option', { name: 'Display Name', exact: true })
          .click();
        await designer
          .getByRole('button', { name: 'Add field', exact: true })
          .click();
        const settings = designer.getByTestId('onboarding-check-settings');
        await settings.getByRole('button', { name: / Requirement$/ }).click();
        await page
          .getByRole('option', { name: 'Required', exact: true })
          .click();
        await settings
          .getByRole('spinbutton', { name: 'Minimum length', exact: true })
          .fill('5');
        await settings.getByRole('button', { name: / Assign to$/ }).click();
        await page
          .getByRole('option', { name: 'Selected users or teams', exact: true })
          .click();
        await settings
          .getByRole('combobox', { name: 'Assignees', exact: true })
          .fill(delegate.responseData.name);
        await page
          .getByRole('option', {
            name:
              delegate.responseData.displayName ?? delegate.responseData.name,
            exact: true,
          })
          .click();
        await page.keyboard.press('Escape');
        await designer.getByRole('button', { name: / Field$/ }).click();
        await page.getByRole('option', { name: 'Tags', exact: true }).click();
        await designer
          .getByRole('button', { name: 'Add field', exact: true })
          .click();
        await designer.getByTestId('onboarding-stage-In Review').click();
        await designer
          .getByRole('button', { name: 'Add approval', exact: true })
          .click();
        await settings.getByRole('button', { name: / Workflow$/ }).click();
        await page
          .getByRole('option', { name: workflow.name, exact: true })
          .click();
        await designer
          .getByRole('button', { name: 'Producer preview', exact: true })
          .click();
        const preview = designer.getByTestId('onboarding-producer-preview');
        await expect(preview.getByTestId('onboarding-journey')).toBeVisible();
        await expect(
          preview.getByRole('progressbar', { name: 'Your checks', exact: true })
        ).toBeVisible();
        await expect(preview.getByTestId('onboarding-advance')).toBeDisabled();
        await test.info().attach('onboarding-preview', {
          body: await preview.screenshot(),
          contentType: 'image/png',
        });
        await designer.getByTestId('onboarding-preview-toggle').click();
        await designer.getByTestId('onboarding-stage-In Review').click();
        await designer
          .getByRole('button', { name: '1. Approval', exact: true })
          .click();
        await test.info().attach('onboarding-builder', {
          body: await designer.screenshot(),
          contentType: 'image/png',
        });
        await page.setViewportSize({ width: 390, height: 844 });
        await expect(
          designer.getByTestId('onboarding-check-settings')
        ).toBeVisible();
        await test.info().attach('onboarding-builder-narrow', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
        await page.setViewportSize({ width: 1280, height: 900 });
        const saved = page.waitForResponse(
          (response) =>
            response.url().endsWith('/api/v1/governance/intakeForms') &&
            response.request().method() === 'POST'
        );
        await page.getByTestId('intake-form-submit').click();
        const response = await saved;
        expect(response.status()).toBe(201);
        const form = await response.json();
        cleanup.push(`/api/v1/governance/intakeForms/${form.id}`);
      });
      await test.step('Create an asset with later requirements still empty', async () => {
        asset = await createOnboardingAssetThroughUI(
          page,
          type,
          uuid(),
          domain,
          glossary
        );
        cleanup.push(`/api/v1/${type.collection}/${asset.id}`);
        await page.goto('/onboarding');
        await expect(page.getByTestId('onboarding-board')).toBeVisible();
        await page.getByRole('link', { name: asset.name, exact: true }).click();
        const checklist = await openChecklist(page);
        await expect(
          checklist.getByTestId('onboarding-current-stage')
        ).toHaveText('Draft');
        await checklist
          .getByRole('button', { name: 'Display Name', exact: true })
          .click();
        await expect(checklist.getByTestId('onboarding-handoff')).toBeVisible();
        await expect(
          checklist.getByTestId('onboarding-advance')
        ).toBeDisabled();
        await test.info().attach('onboarding-checklist', {
          body: await checklist.screenshot(),
          contentType: 'image/png',
        });
      });
      await test.step('An ordinary viewer cannot edit delegated work', async () => {
        const viewerPage = await browser.newPage({ baseURL });
        try {
          await viewer.login(viewerPage);
          await viewerPage.goto(page.url());
          const checklist = await openChecklist(viewerPage);
          await checklist
            .getByRole('button', { name: 'Display Name', exact: true })
            .click();
          await expect(
            checklist.getByTestId('onboarding-handoff')
          ).toBeVisible();
          await expect(
            checklist.getByRole('textbox', {
              name: 'Display Name',
              exact: true,
            })
          ).toHaveCount(0);
          await expect(
            checklist.getByRole('button', { name: 'Edit', exact: true })
          ).toHaveCount(0);
          await expect(
            checklist.getByTestId('onboarding-advance')
          ).toBeDisabled();
        } finally {
          await viewerPage.close();
        }
      });
      await test.step('Save delegated metadata and resume after reload', async () => {
        const delegatedPage = await browser.newPage({ baseURL });
        try {
          await delegate.login(delegatedPage);
          await delegatedPage.goto(page.url());
          const checklist = await openChecklist(delegatedPage);
          await expect(
            checklist
              .getByRole('navigation', { name: 'Your checks', exact: true })
              .getByRole('button', { name: 'Display Name', exact: true })
          ).toHaveAttribute('aria-current', 'step');
          const input = checklist.getByRole('textbox', {
            name: 'Display Name',
            exact: true,
          });
          await expect(
            checklist.getByRole('heading', {
              name: 'Display Name',
              exact: true,
            })
          ).toBeFocused();
          await input.fill('Ready for review');
          const saved = delegatedPage.waitForResponse(
            (response) =>
              response
                .url()
                .includes(`/api/v1/${type.collection}/${asset.id}`) &&
              response.request().method() === 'PATCH'
          );
          await checklist
            .getByRole('button', { name: 'Save & continue', exact: true })
            .click();
          expect((await saved).status()).toBe(200);
          await delegatedPage.reload();
          const resumed = await openChecklist(delegatedPage);
          await expect(
            resumed.getByRole('button', { name: 'Display Name', exact: true })
          ).toContainText('Complete');
          await resumed
            .getByRole('button', { name: 'Display Name', exact: true })
            .click();
          await expect(
            resumed.getByRole('textbox', { name: 'Display Name', exact: true })
          ).toHaveValue('Ready for review');
        } finally {
          await delegatedPage.close();
        }
      });
      await test.step('Complete the workflow before advancing the gate', async () => {
        await page.reload();
        const checklist = await openChecklist(page);
        await page.setViewportSize({ width: 390, height: 844 });
        await test.info().attach('onboarding-journey-narrow', {
          body: await page.screenshot(),
          contentType: 'image/png',
        });
        await page.setViewportSize({ width: 1280, height: 900 });
        await checklist
          .getByRole('button', { name: 'Display Name', exact: true })
          .click();
        const tags = checklist.getByRole('button', {
          name: 'Tags',
          exact: true,
        });
        await tags.focus();
        await page.keyboard.press('Enter');
        await expect(
          checklist.getByRole('heading', { name: 'Tags', exact: true })
        ).toBeFocused();
        await checklist
          .getByRole('button', { name: 'Skip', exact: true })
          .click();
        await expect(tags).toContainText('Pending');
        const transition = page.waitForResponse((response) =>
          response
            .url()
            .endsWith(`/onboarding/${type.type}/${asset.id}/transition`)
        );
        await checklist.getByTestId('onboarding-advance').click();
        expect((await transition).status()).toBe(200);
        await expect(
          checklist.getByTestId('onboarding-current-stage')
        ).toHaveText('In Review');
        await checklist
          .getByRole('button', { name: 'Approval', exact: true })
          .click();
        const taskLink = checklist
          .getByTestId('onboarding-handoff')
          .getByRole('link', { name: 'View task', exact: true });
        await expect(taskLink).toHaveAttribute('href');
        const taskHref = await taskLink.getAttribute('href');
        if (!taskHref) throw new Error('Approval task link is missing');
        const stillBlocked = page.waitForResponse((response) =>
          response
            .url()
            .endsWith(`/onboarding/${type.type}/${asset.id}/transition`)
        );
        await checklist.getByTestId('onboarding-advance').click();
        expect((await stillBlocked).status()).toBe(200);
        await expect(
          checklist.getByTestId('onboarding-current-stage')
        ).toHaveText('In Review');
        await expect(taskLink).toHaveAttribute('href', taskHref);
        const unassignedPage = await browser.newPage({ baseURL });
        try {
          await viewer.login(unassignedPage);
          await unassignedPage.goto(taskHref);
          await expect(
            unassignedPage.getByTestId('task-detail-panel')
          ).toBeVisible();
          await expect(unassignedPage.getByTestId('task-approve')).toHaveCount(
            0
          );
          await expect(unassignedPage.getByTestId('task-reject')).toHaveCount(
            0
          );
        } finally {
          await unassignedPage.close();
        }
        const reviewerPage = await browser.newPage({ baseURL });
        try {
          await delegate.login(reviewerPage);
          await reviewerPage.goto(taskHref);
          await expect(
            reviewerPage.getByTestId('task-detail-panel')
          ).toBeVisible();
          const resolved = reviewerPage.waitForResponse(
            (response) =>
              response.url().includes('/api/v1/tasks/') &&
              response.url().endsWith('/resolve') &&
              response.request().method() === 'POST'
          );
          await reviewerPage.getByTestId('task-approve').click();
          expect((await resolved).ok()).toBeTruthy();
          await expect(
            reviewerPage.getByTestId('task-status-badge')
          ).toHaveText('Approved');
        } finally {
          await reviewerPage.close();
        }
        await checklist
          .getByRole('button', { name: 'Refresh', exact: true })
          .click();
        await expect(checklist.getByTestId('onboarding-advance')).toHaveText(
          'Advance to Approved'
        );
        const approved = page.waitForResponse((response) =>
          response
            .url()
            .endsWith(`/onboarding/${type.type}/${asset.id}/transition`)
        );
        await checklist.getByTestId('onboarding-advance').click();
        expect((await approved).status()).toBe(200);
        await expect(
          checklist.getByTestId('onboarding-current-stage')
        ).toHaveText('Approved');
        await checklist
          .getByRole('button', { name: 'Approval', exact: true })
          .click();
        await expect(checklist.getByText(/Workflow execution:/)).toBeVisible();
        await checklist
          .getByRole('link', { name: 'Onboarding board', exact: true })
          .click();
        await expect(
          page
            .getByRole('row')
            .filter({ hasText: 'Ready for review' })
            .filter({ hasText: type.label })
        ).toContainText('Approved');
        await test.info().attach('onboarding-board', {
          body: await page.getByTestId('onboarding-board').screenshot(),
          contentType: 'image/png',
        });
      });
    });
  }
});
