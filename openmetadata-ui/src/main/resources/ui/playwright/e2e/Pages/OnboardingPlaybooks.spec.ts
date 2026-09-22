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
import { Requirement } from '../../../src/generated/entity/governance/onboardingPlaybook';
import {
  FieldKind,
  TargetEntityType,
} from '../../../src/generated/governance/intakeForm';
import { DOMAIN_TAGS } from '../../constant/config';
import { expect } from '../../support/fixtures/base';
import { authenticateAdminPage } from '../../utils/admin';
import { uuid } from '../../utils/common';
import {
  fieldStep,
  onboardingTest as test,
  ONBOARDING_TYPES,
} from '../../utils/onboarding';

const dataProduct = ONBOARDING_TYPES.find(
  (type) => type.type === TargetEntityType.DataProduct
)!;

/** The Creation gate: what the API refuses to create a data product without. */
const creationFields = [
  {
    fieldPath: 'displayName',
    fieldLabel: 'Name & display name',
    fieldKind: FieldKind.Native,
    required: true,
  },
  {
    fieldPath: 'description',
    fieldLabel: 'Description',
    fieldKind: FieldKind.Native,
    required: true,
  },
  {
    fieldPath: 'domains',
    fieldLabel: 'Domain',
    fieldKind: FieldKind.Native,
    required: true,
  },
];

/**
 * Navigate and stay there. While the app restores the session it can bounce a freshly requested
 * deep link back to the landing page; asking again once the shell has settled is the difference
 * between a stable test and a flake, so the marker the page is known by is what we wait on.
 */
const NAVIGATION_TIMEOUT = 20_000;

const openPath = async (page: Page, path: string, marker: string) => {
  await page.goto(path);
  const landed = page.getByTestId(marker);
  try {
    await landed.waitFor({ state: 'visible', timeout: NAVIGATION_TIMEOUT });
  } catch {
    await page.goto(path);
    await landed.waitFor({ state: 'visible', timeout: NAVIGATION_TIMEOUT });
  }
};

const openCreationGateForm = async (page: Page) => {
  await openPath(page, '/dataProduct/add', 'create-data-product-page');

  await expect(page.getByTestId('creation-gate-form')).toBeVisible();
};

test.describe.configure({ mode: 'serial' });

test.describe(
  'Onboarding playbooks end to end',
  { tag: [DOMAIN_TAGS.GOVERNANCE] },
  () => {
    test('the manager lists the configured playbook and opens its builder', async ({
      page,
      onboarding,
    }) => {
      test.setTimeout(150_000);
      await authenticateAdminPage(page);
      await onboarding.publish(dataProduct, creationFields, [
        fieldStep('draft_reviewers', 'reviewers', { title: 'Reviewers' }),
      ]);
      await openPath(
        page,
        '/settings/governance/onboarding-playbooks',
        'playbook-table'
      );
      const row = page.getByTestId('playbook-row-dataProduct');

      await expect(row).toContainText('Data Product');
      await expect(row).toContainText('3 fields enforced at creation');

      await row.click();

      await expect(
        page.getByRole('button', { name: 'Publish changes' })
      ).toBeVisible();
      await expect(page.getByTestId('gate-sentence')).toContainText(
        'Nothing moves to'
      );
    });

    test('the create page enforces the gate, says what is queued, and creates the product', async ({
      page,
      onboarding,
    }) => {
      test.setTimeout(150_000);
      await authenticateAdminPage(page);
      const domain = await onboarding.createResource('domains', {
        name: `playbook_${uuid()}`,
        description: 'Domain for the playbook journey',
        domainType: 'Aggregate',
      });
      await onboarding.publish(dataProduct, creationFields, [
        fieldStep('draft_reviewers', 'reviewers', { title: 'Reviewers' }),
        fieldStep('draft_experts', 'experts', {
          title: 'Experts',
          requirement: Requirement.Optional,
        }),
      ]);
      await openCreationGateForm(page);

      await expect(page.getByTestId('create-data-product')).toBeDisabled();
      await expect(page.getByTestId('create-hint')).toContainText(
        'is required at creation'
      );
      await expect(page.getByTestId('queued-after-creation')).toContainText(
        '2 checks queued for after creation'
      );

      const name = `playbook_product_${uuid()}`;
      await page.getByTestId('creation-check-name').locator('input').fill(name);
      await page
        .getByTestId('creation-check-displayName')
        .locator('input')
        .fill('Playbook journey product');
      await page
        .getByTestId('creation-check-description')
        .locator('[contenteditable="true"]')
        .fill(
          'Created through the Creation gate by the playbook browser test.'
        );
      const domainSearch = page
        .getByTestId('creation-check-domains')
        .locator('input');
      await domainSearch.click();
      await domainSearch.fill(domain.name);
      await page
        .getByRole('option', { name: domain.name, exact: true })
        .click();

      await expect(page.getByTestId('create-hint')).toContainText(
        'Enforced at the API layer too'
      );

      const created = page.waitForResponse(
        (response) =>
          response.url().endsWith('/api/v1/dataProducts') &&
          response.request().method() === 'POST'
      );
      await page.getByTestId('create-data-product').click();
      expect((await created).status()).toBe(201);

      await expect(page.getByTestId('onboarding-journey')).toBeVisible();
      onboarding.cleanup.push(
        `/api/v1/dataProducts/name/${encodeURIComponent(name)}`
      );
    });

    test('the wizard counts the producer checks, saves one, and submits for review', async ({
      page,
      onboarding,
    }) => {
      test.setTimeout(150_000);
      await authenticateAdminPage(page);
      // The display name is asked for after creation here. A field is captured once, and the
      // fields the schema itself requires have to stay at Creation, so this is the one that can
      // carry a length rule into Draft.
      await onboarding.publish(
        dataProduct,
        creationFields.filter((field) => field.fieldPath !== 'displayName'),
        [
          fieldStep('draft_name', 'displayName', {
            title: 'Name & display name',
            rules: { minLength: 30 },
            guidance: 'The name consumers will search for.',
          }),
        ]
      );
      const asset = await onboarding.createAsset(dataProduct);
      await openPath(
        page,
        `/dataProduct/${asset.fullyQualifiedName}`,
        'onboarding-checklist'
      );
      const checklist = page.getByTestId('onboarding-checklist');

      await expect(checklist.getByTestId('onboarding-journey')).toBeVisible();
      await expect(
        checklist.getByTestId('onboarding-journey-header')
      ).toContainText('0 of 1 checks for you');
      await expect(
        checklist.getByTestId('onboarding-step-eyebrow')
      ).toContainText('Step 1 of 1');
      await expect(
        checklist.getByTestId('onboarding-rule-progress')
      ).toContainText('characters to go');

      const saved = page.waitForResponse(
        (response) =>
          response.url().includes(`/api/v1/dataProducts/${asset.id}`) &&
          response.request().method() === 'PATCH'
      );
      await checklist
        .getByTestId('onboarding-journey-step')
        .locator('input')
        .fill('A name long enough for the draft gate rule');
      await checklist
        .getByTestId('onboarding-journey-step')
        .locator('button[type="submit"]')
        .click();
      expect((await saved).ok()).toBeTruthy();

      await expect(
        checklist.getByTestId('onboarding-rule-progress')
      ).toContainText('Long enough');

      const advance = checklist.getByTestId('onboarding-advance');
      await expect(advance).toContainText('Submit for review');
      await expect(advance).toBeEnabled();
      const transition = page.waitForResponse((response) =>
        response
          .url()
          .endsWith(`/onboarding/dataProduct/${asset.id}/transition`)
      );
      await advance.click();
      expect((await transition).ok()).toBeTruthy();

      await expect(checklist.getByTestId('onboarding-submitted')).toContainText(
        'Sent to In Review'
      );
      await expect(checklist.getByTestId('onboarding-see-board')).toBeVisible();
    });

    test('the board and the list read the same onboarding state', async ({
      page,
      onboarding,
    }) => {
      test.setTimeout(150_000);
      await authenticateAdminPage(page);
      await onboarding.publish(dataProduct, creationFields, [
        fieldStep('draft_reviewers', 'reviewers', { title: 'Reviewers' }),
      ]);
      const displayName = `Board and list ${uuid()}`;
      const asset = await onboarding.createAsset(dataProduct, { displayName });

      await openPath(
        page,
        '/onboarding?entityType=dataProduct',
        'onboarding-board'
      );
      const row = page.getByRole('row', { name: new RegExp(displayName) });

      await expect(row).toContainText('Draft');
      await expect(row).toContainText('Waiting: Reviewers');

      await openPath(page, '/dataProduct', 'add-data-product');
      const listRow = page.getByRole('row', { name: new RegExp(displayName) });

      await expect(listRow).toContainText('Draft');
      await expect(listRow.getByTestId('continue-setup')).toBeVisible();
    });
  }
);
