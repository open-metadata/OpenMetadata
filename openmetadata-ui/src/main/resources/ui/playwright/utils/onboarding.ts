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
import { APIRequestContext, Locator, Page } from '@playwright/test';
import {
  IntakeFormField,
  OnboardingStep,
  TargetEntityType,
  Type,
} from '../../src/generated/governance/intakeForm';
import { OnboardingProgress } from '../../src/generated/governance/onboarding/onboardingProgress';
import { EntityReference } from '../../src/generated/type/entityReference';
import { expect, test } from '../support/fixtures/base';
import { UserClass } from '../support/user/UserClass';
import { createAdminApiContext } from './admin';
import { descriptionBox, uuid } from './common';
import { clickDrawerSave } from './domain';
import { openAddGlossaryTermModal } from './glossary';

export const ONBOARDING_TYPES = [
  {
    type: TargetEntityType.DataProduct,
    collection: 'dataProducts',
    path: 'dataProduct',
    label: 'Data Product',
  },
  {
    type: TargetEntityType.Domain,
    collection: 'domains',
    path: 'domain',
    label: 'Domain',
  },
  {
    type: TargetEntityType.GlossaryTerm,
    collection: 'glossaryTerms',
    path: 'glossary',
    label: 'Glossary Term',
  },
  {
    type: TargetEntityType.Metric,
    collection: 'metrics',
    path: 'metric',
    label: 'Metric',
  },
];
export type OnboardingAssetType = (typeof ONBOARDING_TYPES)[number];
export interface OnboardingTestAsset extends EntityReference {
  name: string;
  fullyQualifiedName: string;
  version: number;
}

export class OnboardingFixtures {
  readonly cleanup: string[] = [];
  readonly cleanupActions: (() => Promise<void>)[] = [];
  domain?: OnboardingTestAsset;
  glossary?: OnboardingTestAsset;
  constructor(readonly api: APIRequestContext) {}

  async createResource(
    collection: string,
    data: unknown
  ): Promise<OnboardingTestAsset> {
    const response = await this.api.post(`/api/v1/${collection}`, { data });
    expect(response.status(), await response.text()).toBe(201);
    const resource: OnboardingTestAsset = await response.json();
    this.cleanup.push(`/api/v1/${collection}/${resource.id}`);
    return resource;
  }

  async publish(
    type: OnboardingAssetType,
    fields: IntakeFormField[],
    draft: OnboardingStep[],
    review: OnboardingStep[] = []
  ) {
    return this.createResource('governance/intakeForms', {
      name: `onboarding_${uuid()}`,
      entityType: type.type,
      enabled: true,
      formFields: fields,
      onboarding: {
        enabled: true,
        gates: [
          { stage: 'Creation', steps: [] },
          { stage: 'Draft', steps: draft },
          { stage: 'In Review', steps: review },
        ],
      },
    });
  }

  async createAsset(
    type: OnboardingAssetType,
    values: Record<string, unknown> = {}
  ) {
    if (type.type === TargetEntityType.DataProduct && !this.domain) {
      this.domain = await this.createResource('domains', {
        name: `parent_${uuid()}`,
        description: 'Browser test parent',
        domainType: 'Aggregate',
      });
    }
    if (type.type === TargetEntityType.GlossaryTerm && !this.glossary) {
      this.glossary = await this.createResource('glossaries', {
        name: `glossary_${uuid()}`,
        description: 'Browser test glossary',
      });
    }
    return this.createResource(type.collection, {
      name: `journey_${uuid()}`,
      description: 'Metadata under review',
      ...(type.type === TargetEntityType.DataProduct
        ? { domains: [this.domain?.fullyQualifiedName] }
        : {}),
      ...(type.type === TargetEntityType.Domain
        ? { domainType: 'Aggregate' }
        : {}),
      ...(type.type === TargetEntityType.GlossaryTerm
        ? { glossary: this.glossary?.fullyQualifiedName }
        : {}),
      ...values,
    });
  }

  async createUser(operations: string[] = []) {
    const user = new UserClass();
    const policies = ['DataConsumerPolicy', 'TaskAuthorPolicy'];
    if (operations.length) {
      const policy = await this.createResource('policies', {
        name: `onboarding_${uuid()}`,
        rules: [
          {
            name: 'Metadata',
            resources: ONBOARDING_TYPES.map((type) => type.type),
            operations,
            effect: 'allow',
          },
        ],
      });
      policies.push(policy.name);
    }
    const role = await this.createResource('roles', {
      name: `onboarding_${uuid()}`,
      policies,
    });
    const response = await this.api.post('/api/v1/users', {
      data: {
        name: user.data.email.split('@')[0],
        email: user.data.email,
        displayName: `Reviewer ${uuid()}`,
        roles: [role.id],
        isAdmin: false,
        createPasswordType: 'ADMIN_CREATE',
        password: user.data.password,
        confirmPassword: user.data.password,
      },
    });
    expect(response.status()).toBe(201);
    user.responseData = await response.json();
    this.cleanup.push(`/api/v1/users/${user.responseData.id}`);
    return user;
  }

  async workflow(users: UserClass[], threshold = 1) {
    const response = await this.api.get(
      '/api/v1/governance/workflowDefinitions/name/RequestApprovalTaskWorkflow?fields=*'
    );
    expect(response.ok()).toBeTruthy();
    const seed = await response.json();
    for (const node of seed.nodes) {
      if (node.subType === 'userApprovalTask') {
        node.config.assigneeStrategy = 'reviewers-and-assignees';
        node.config.approvalThreshold = threshold;
        node.config.assignees = {
          addReviewers: false,
          addOwners: false,
          candidates: users.map((user) => ({
            id: user.responseData.id,
            type: 'user',
            fullyQualifiedName: user.responseData.fullyQualifiedName,
          })),
        };
      }
    }
    return this.createResource('governance/workflowDefinitions', {
      name: `onboarding_${uuid()}`,
      description: 'Browser workflow evidence',
      config: seed.config,
      trigger: seed.trigger,
      nodes: seed.nodes,
      edges: seed.edges,
    });
  }

  async progress(
    type: OnboardingAssetType,
    asset: EntityReference
  ): Promise<OnboardingProgress> {
    const response = await this.api.get(
      `/api/v1/governance/onboarding/${type.type}/${asset.id}`
    );
    expect(response.ok()).toBeTruthy();
    return response.json();
  }

  async registerStringProperty(type: string, name: string) {
    const definitionResponse = await this.api.get(
      '/api/v1/metadata/types/name/' + type + '?fields=customProperties'
    );
    const propertyResponse = await this.api.get(
      '/api/v1/metadata/types/name/string'
    );
    expect(definitionResponse.ok()).toBeTruthy();
    expect(propertyResponse.ok()).toBeTruthy();
    const definition = await definitionResponse.json();
    const property = await propertyResponse.json();
    const saved = await this.api.put(
      '/api/v1/metadata/types/' + definition.id,
      {
        data: {
          name,
          description: 'Onboarding browser field',
          propertyType: { id: property.id, type: 'type' },
        },
      }
    );
    expect(saved.ok()).toBeTruthy();
    this.cleanupActions.push(async () => {
      const response = await this.api.get(
        '/api/v1/metadata/types/name/' + type + '?fields=customProperties'
      );
      const current = await response.json();
      const index = current.customProperties.findIndex(
        (item: { name: string }) => item.name === name
      );
      expect(index).toBeGreaterThanOrEqual(0);
      const removed = await this.api.patch(
        '/api/v1/metadata/types/' + current.id,
        {
          headers: { 'Content-Type': 'application/json-patch+json' },
          data: [
            {
              op: 'test',
              path: '/customProperties/' + index + '/name',
              value: name,
            },
            { op: 'remove', path: '/customProperties/' + index },
          ],
        }
      );
      expect(removed.ok()).toBeTruthy();
    });
  }

  async dispose() {
    for (const path of this.cleanup.reverse()) {
      const response = await this.api.delete(
        `${path}?hardDelete=true&recursive=true`
      );
      expect([200, 204, 404], path).toContain(response.status());
    }
    for (const action of this.cleanupActions.reverse()) await action();
  }
}

export const onboardingTest = test.extend<{ onboarding: OnboardingFixtures }>({
  onboarding: async ({ baseURL }, use) => {
    if (!baseURL) throw new Error('Onboarding tests require a base URL');
    const login = await createAdminApiContext();
    const fixture = new OnboardingFixtures(login.apiContext);
    try {
      await use(fixture);
    } finally {
      try {
        await fixture.dispose();
      } finally {
        await login.afterAction();
      }
    }
  },
});

export const approvalStep = (
  id: string,
  workflow: EntityReference
): OnboardingStep => ({
  id: id.replaceAll(' ', '-'),
  title: id,
  type: Type.Approval,
  workflow: {
    id: workflow.id,
    name: workflow.name,
    type: 'workflowDefinition',
    fullyQualifiedName: workflow.fullyQualifiedName,
  },
});
export const visitOnboardingAsset = async (
  page: Page,
  type: OnboardingAssetType,
  asset: EntityReference
) => {
  await page.goto(
    `/${type.path}/${encodeURIComponent(asset.fullyQualifiedName ?? '')}`
  );
  page.setDefaultTimeout(20000);
  const checklist = page.getByTestId('onboarding-checklist');
  await expect(checklist.getByTestId('onboarding-journey')).toBeVisible();
  return checklist;
};
export const refreshChecklist = async (
  page: Page,
  checklist: Locator,
  type: OnboardingAssetType,
  asset: EntityReference
) => {
  const refreshed = page.waitForResponse((response) =>
    response.url().endsWith(`/onboarding/${type.type}/${asset.id}`)
  );
  await checklist.getByRole('button', { name: 'Refresh', exact: true }).click();
  expect((await refreshed).ok()).toBeTruthy();
};
export const saveOnboardingField = async (
  page: Page,
  checklist: Locator,
  type: OnboardingAssetType,
  asset: EntityReference
) => {
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes(`/api/v1/${type.collection}/${asset.id}`) &&
      response.request().method() === 'PATCH'
  );
  await checklist
    .getByRole('button', { name: 'Save & continue', exact: true })
    .click();
  const response = await saved;
  await expect(checklist.locator('button[data-loading="true"]')).toHaveCount(0);
  return response;
};
export const advanceOnboarding = async (
  page: Page,
  checklist: Locator,
  type: OnboardingAssetType,
  asset: EntityReference
) => {
  const advanced = page.waitForResponse((response) =>
    response.url().endsWith(`/onboarding/${type.type}/${asset.id}/transition`)
  );
  await checklist.getByTestId('onboarding-advance').click();
  const response = await advanced;
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<OnboardingProgress>;
};
export const decideOnboardingTask = async (
  page: Page,
  taskId: string,
  approve: boolean
) => {
  page.setDefaultTimeout(20000);
  await page.goto(`/tasks/${taskId}`);
  await expect(page.getByTestId('task-detail-panel')).toBeVisible();
  const resolved = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/tasks/${taskId}/resolve`) &&
      response.request().method() === 'POST'
  );
  if (approve) {
    await page.getByTestId('task-approve').click();
  } else {
    await page.getByTestId('task-reject').click();
    await page
      .getByTestId('task-action-comment')
      .getByRole('textbox')
      .fill('Please clarify the business definition.');
    await page.getByTestId('task-action-comment-confirm').click();
  }
  expect((await resolved).ok()).toBeTruthy();
};

export const createOnboardingAssetThroughUI = async (
  page: Page,
  type: OnboardingAssetType,
  suffix: string,
  domain: Pick<OnboardingTestAsset, 'id' | 'name' | 'fullyQualifiedName'>,
  glossary: Pick<OnboardingTestAsset, 'id' | 'name' | 'fullyQualifiedName'>,
  beforeSubmit?: (submit: () => Promise<void>) => Promise<void>
): Promise<OnboardingTestAsset> => {
  const name = `onboarding_${suffix}`;
  if (type.type === 'metric') {
    await page.goto('/metrics');
    await page.getByTestId('create-metric').click();
    await page.locator('[id="root/name"]').fill(name);
  } else if (type.type === 'glossaryTerm') {
    await page.goto(
      `/glossary/${encodeURIComponent(glossary.fullyQualifiedName)}`
    );
    await openAddGlossaryTermModal(page);
    const modal = page.locator('[role="dialog"].edit-glossary-modal');
    await modal.getByTestId('name').fill(name);
    await modal
      .locator(descriptionBox)
      .fill('Metadata for the onboarding browser journey');
  } else {
    await page.goto(`/domain/${encodeURIComponent(domain.fullyQualifiedName)}`);
    await page.getByTestId('domain-details-add-button').click();
    await page
      .getByRole('menuitem', {
        name: type.type === 'domain' ? 'Sub Domains' : 'Data Products',
        exact: true,
      })
      .click();
    const form = page.getByTestId('add-domain-form');
    await form.getByTestId('name').locator('input').fill(name);
    await form
      .locator(descriptionBox)
      .fill('Metadata for the onboarding browser journey');
    if (type.type === 'domain') {
      await form.getByRole('button', { name: /Select Domain Type/ }).click();
      await page
        .getByRole('option', { name: 'Aggregate', exact: true })
        .click();
    }
  }
  await expect(page.getByTestId('onboarding-creation-checklist')).toBeVisible();
  const submit = async () => {
    if (type.type === 'metric') {
      await page.getByTestId('create-button').click();
    } else if (type.type === 'glossaryTerm') {
      await page
        .locator('[role="dialog"].edit-glossary-modal')
        .getByRole('button', { name: 'Save', exact: true })
        .click();
    } else {
      await clickDrawerSave(page);
    }
  };
  await beforeSubmit?.(submit);
  const created = page.waitForResponse(
    (response) =>
      response.url().endsWith(`/api/v1/${type.collection}`) &&
      response.request().method() === 'POST'
  );
  await submit();
  const response = await created;
  expect(response.status()).toBe(201);
  return response.json();
};
