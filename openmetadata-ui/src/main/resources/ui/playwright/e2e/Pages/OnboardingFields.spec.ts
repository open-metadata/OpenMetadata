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
  Operator,
  Role,
  TargetEntityType,
  Type,
} from '../../../src/generated/governance/intakeForm';
import { DOMAIN_TAGS } from '../../constant/config';
import { expect } from '../../support/fixtures/base';
import { authenticateAdminPage } from '../../utils/admin';
import { uuid } from '../../utils/common';
import {
  onboardingTest as test,
  ONBOARDING_TYPES,
  saveOnboardingField,
  visitOnboardingAsset,
} from '../../utils/onboarding';

const metric = ONBOARDING_TYPES.find(
  (type) => type.type === TargetEntityType.Metric
)!;

test.describe(
  'Onboarding field types and conditions',
  { tag: [DOMAIN_TAGS.GOVERNANCE] },
  () => {
    test('Metric: a domain owner sees and completes the domain-assigned check', async ({
      page,
      onboarding,
    }) => {
      const owner = await onboarding.createUser(['EditDisplayName']);
      const domain = await onboarding.createResource('domains', {
        name: `owned_${uuid()}`,
        description: 'Owned domain',
        domainType: 'Aggregate',
        owners: [{ id: owner.responseData.id, type: 'user' }],
      });
      await onboarding.publish(
        metric,
        [
          {
            fieldPath: 'displayName',
            fieldLabel: 'Display Name',
            fieldKind: FieldKind.Native,
            required: true,
          },
        ],
        [
          {
            id: 'name',
            title: 'Display Name',
            type: Type.Field,
            fieldPath: 'displayName',
            assignment: { role: Role.DomainOwners },
          },
        ]
      );
      const asset = await onboarding.createAsset(metric, {
        domains: [domain.fullyQualifiedName],
      });
      await owner.login(page);
      const checklist = await visitOnboardingAsset(page, metric, asset);
      await expect(
        checklist.getByRole('navigation', { name: 'Your checks', exact: true })
      ).toContainText('Display Name');
      await checklist
        .getByRole('textbox', { name: 'Display Name', exact: true })
        .fill('Owned domain metric');
      expect(
        (await saveOnboardingField(page, checklist, metric, asset)).ok()
      ).toBeTruthy();
      await page.reload();
      await expect(
        checklist.getByRole('button', { name: 'Display Name', exact: true })
      ).toContainText('Complete');
      const progress = await onboarding.progress(metric, asset);
      expect(
        progress.steps
          .find((step) => step.step.id === 'name')
          ?.assignees?.map((assignee) => assignee.id)
      ).toContain(owner.responseData.id);
    });

    test('Metric: a glossary-only editor can add a term while preserving protected classification tags', async ({
      page,
      onboarding,
    }) => {
      const editor = await onboarding.createUser(['EditGlossaryTerms']);
      const glossary = await onboarding.createResource('glossaries', {
        name: `glossary_${uuid()}`,
        description: 'Tag choices',
      });
      const term = await onboarding.createResource('glossaryTerms', {
        name: `term_${uuid()}`,
        description: 'Business term',
        glossary: glossary.fullyQualifiedName,
      });
      const classification = await onboarding.createResource(
        'classifications',
        {
          name: `classification_${uuid()}`,
          description: 'Protected classification',
        }
      );
      const tag = await onboarding.createResource('tags', {
        name: `protected_${uuid()}`,
        description: 'Protected tag',
        classification: classification.name,
      });
      await onboarding.publish(
        metric,
        [
          {
            fieldPath: 'tags',
            fieldLabel: 'Tags',
            fieldKind: FieldKind.Native,
            required: true,
          },
        ],
        [
          {
            id: 'tags',
            title: 'Tags',
            type: Type.Field,
            fieldPath: 'tags',
            rules: { minItems: 2 },
            assignment: {
              role: Role.Explicit,
              assignees: [{ id: editor.responseData.id, type: 'user' }],
            },
          },
        ]
      );
      const asset = await onboarding.createAsset(metric, {
        tags: [
          {
            tagFQN: tag.fullyQualifiedName,
            source: 'Classification',
            labelType: 'Manual',
            state: 'Confirmed',
          },
        ],
      });
      await editor.login(page);
      const checklist = await visitOnboardingAsset(page, metric, asset);
      const input = checklist.getByRole('combobox', {
        name: /^Tags/,
      });
      await expect(
        checklist.getByText(tag.fullyQualifiedName, { exact: true })
      ).toBeVisible();
      const search = page.waitForResponse(
        (response) =>
          response.url().includes('/search/query') &&
          new URL(response.url()).searchParams.get('q') === tag.name
      );
      await input.fill(tag.name);
      expect((await search).ok()).toBeTruthy();
      await expect(
        page.getByRole('option').filter({ hasText: tag.name })
      ).toHaveCount(0);
      await input.fill(term.name);
      await page.getByRole('option').filter({ hasText: term.name }).click();
      await page.keyboard.press('Escape');
      const saved = await saveOnboardingField(page, checklist, metric, asset);
      expect(saved.ok()).toBeTruthy();
      expect((await saved.json()).tags).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            tagFQN: tag.fullyQualifiedName,
            source: 'Classification',
          }),
          expect.objectContaining({
            tagFQN: term.fullyQualifiedName,
            source: 'Glossary',
          }),
        ])
      );
      await page.reload();
      await expect(
        checklist.getByRole('button', { name: 'Tags', exact: true })
      ).toContainText('Complete');
    });

    test('Metric: team member completes a conditional custom property through the saved journey', async ({
      page,
      onboarding,
    }) => {
      test.slow();
      const member = await onboarding.createUser([
        'EditDisplayName',
        'EditCustomFields',
      ]);
      const team = await onboarding.createResource('teams', {
        name: `stewards_${uuid()}`,
        teamType: 'Group',
        users: [member.responseData.id],
      });
      const property = `justification${uuid().replaceAll('-', '')}`;
      await onboarding.registerStringProperty('metric', property);
      const assignment = {
        role: Role.Explicit,
        assignees: [{ id: team.id, type: 'team' }],
      };
      await onboarding.publish(
        metric,
        [
          {
            fieldPath: 'displayName',
            fieldLabel: 'Display Name',
            fieldKind: FieldKind.Native,
          },
          {
            fieldPath: `extension.${property}`,
            fieldLabel: 'Justification',
            fieldKind: FieldKind.CustomProperty,
            required: true,
          },
        ],
        [
          {
            id: 'name',
            title: 'Display Name',
            type: Type.Field,
            fieldPath: 'displayName',
            assignment,
          },
          {
            id: 'reason',
            title: 'Justification',
            type: Type.Field,
            fieldPath: `extension.${property}`,
            assignment,
            rules: { minLength: 10 },
            conditions: [
              {
                fieldPath: 'displayName',
                operator: Operator.Equals,
                value: 'Review',
              },
            ],
          },
        ]
      );
      const asset = await onboarding.createAsset(metric);
      await member.login(page);
      const checklist = await visitOnboardingAsset(page, metric, asset);
      expect((await onboarding.progress(metric, asset)).canAdvance).toBe(true);
      await checklist
        .getByRole('textbox', { name: 'Display Name', exact: true })
        .fill('Review');
      expect(
        (await saveOnboardingField(page, checklist, metric, asset)).ok()
      ).toBeTruthy();
      expect((await onboarding.progress(metric, asset)).canAdvance).toBe(false);
      await expect(
        checklist.getByRole('navigation', { name: 'Your checks', exact: true })
      ).toContainText('Justification');

      const input = checklist.locator(
        `[data-testid="extension-${property}"] input, input[data-testid="extension-${property}"]`
      );
      await input.fill('short');
      expect(
        (await saveOnboardingField(page, checklist, metric, asset)).ok()
      ).toBeTruthy();
      await expect(
        checklist.getByRole('button', { name: 'Justification', exact: true })
      ).toContainText('Pending');
      await input.fill('A reviewed business justification');
      expect(
        (await saveOnboardingField(page, checklist, metric, asset)).ok()
      ).toBeTruthy();
      await page.reload();
      await expect(
        checklist.getByRole('button', { name: 'Justification', exact: true })
      ).toContainText('Complete');
      await checklist
        .getByRole('button', { name: 'Justification', exact: true })
        .click();
      await expect(input).toHaveValue('A reviewed business justification');
      await expect(checklist.getByTestId('onboarding-advance')).toBeDisabled();
    });

    test('Metric: saving expression code preserves its language and survives reload', async ({
      page,
      onboarding,
    }) => {
      await authenticateAdminPage(page);
      await onboarding.publish(
        metric,
        [
          {
            fieldPath: 'metricExpression.code',
            fieldLabel: 'Expression',
            fieldKind: FieldKind.Native,
            required: true,
          },
        ],
        [
          {
            id: 'expression',
            title: 'Expression',
            type: Type.Field,
            fieldPath: 'metricExpression.code',
            rules: { minLength: 5 },
          },
        ]
      );
      const asset = await onboarding.createAsset(metric, {
        metricExpression: { language: 'SQL', code: 'x' },
      });
      const checklist = await visitOnboardingAsset(page, metric, asset);
      const input = checklist.getByRole('textbox', {
        name: 'Expression',
        exact: true,
      });
      await input.fill('SUM(order_total)');
      const response = await saveOnboardingField(
        page,
        checklist,
        metric,
        asset
      );
      expect(response.ok()).toBeTruthy();
      expect((await response.json()).metricExpression).toEqual({
        language: 'SQL',
        code: 'SUM(order_total)',
      });
      await page.reload();
      await checklist
        .getByRole('button', { name: 'Expression', exact: true })
        .click();
      await expect(input).toHaveValue('SUM(order_total)');
    });
  }
);
