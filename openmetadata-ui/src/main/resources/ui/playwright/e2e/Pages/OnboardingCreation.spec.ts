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
import { Type } from '../../../src/generated/governance/intakeForm';
import { DOMAIN_TAGS } from '../../constant/config';
import { expect } from '../../support/fixtures/base';
import { uuid } from '../../utils/common';
import {
  createOnboardingAssetThroughUI,
  onboardingTest as test,
  ONBOARDING_TYPES,
  visitOnboardingAsset,
} from '../../utils/onboarding';

test.describe(
  'Onboarding creation requirements',
  { tag: [DOMAIN_TAGS.GOVERNANCE] },
  () => {
    for (const type of ONBOARDING_TYPES) {
      test(`${type.label}: non-admin creation blocks missing requirements and queues later work`, async ({
        page,
        onboarding,
      }) => {
        test.slow();
        const creator = await onboarding.createUser(['Create', 'EditAll']);
        const domain = await onboarding.createResource('domains', {
          name: `parent_${uuid()}`,
          description: 'Creation parent',
          domainType: 'Aggregate',
        });
        const glossary = await onboarding.createResource('glossaries', {
          name: `glossary_${uuid()}`,
          description: 'Creation glossary',
        });
        await onboarding.createResource('governance/intakeForms', {
          name: `creation_${uuid()}`,
          enabled: true,
          entityType: type.type,
          formFields: [
            {
              fieldPath: 'displayName',
              fieldLabel: 'Display Name',
              fieldKind: 'native',
              required: true,
              errorMessage: 'Provide a display name before creating.',
            },
            {
              fieldPath: 'tags',
              fieldLabel: 'Tags',
              fieldKind: 'native',
              required: true,
            },
          ],
          onboarding: {
            enabled: true,
            gates: [
              {
                stage: 'Creation',
                steps: [
                  {
                    id: 'display-name',
                    type: Type.Field,
                    title: 'Display Name',
                    fieldPath: 'displayName',
                  },
                ],
              },
              {
                stage: 'Draft',
                steps: [
                  {
                    id: 'tags',
                    type: Type.Field,
                    title: 'Tags',
                    fieldPath: 'tags',
                  },
                ],
              },
            ],
          },
        });
        await creator.login(page);
        const asset = await createOnboardingAssetThroughUI(
          page,
          type,
          uuid(),
          domain,
          glossary,
          async (submit) => {
            await expect(
              page.getByTestId('onboarding-upcoming-work')
            ).toContainText('Tags');
            const requests: string[] = [];
            const observe = (request: import('@playwright/test').Request) => {
              if (
                request.method() === 'POST' &&
                request.url().endsWith(`/api/v1/${type.collection}`)
              )
                requests.push(request.url());
            };
            page.on('request', observe);
            try {
              await submit();
              await expect(
                page
                  .getByTestId('onboarding-creation-checklist')
                  .getByText('Provide a display name before creating.', {
                    exact: true,
                  })
              ).toBeVisible();
              expect(requests).toEqual([]);
              await page
                .getByRole('textbox', { name: /Display Name/ })
                .fill('Created by a producer');
            } finally {
              page.off('request', observe);
            }
          }
        );
        onboarding.cleanup.push(`/api/v1/${type.collection}/${asset.id}`);
        const checklist = await visitOnboardingAsset(page, type, asset);
        await expect(
          checklist.getByTestId('onboarding-current-stage')
        ).toHaveText('Draft');
        await expect(
          checklist.getByRole('navigation', {
            name: 'Your checks',
            exact: true,
          })
        ).toContainText('Tags');
        await expect(
          checklist.getByTestId('onboarding-advance')
        ).toBeDisabled();
        await page.reload();
        await expect(
          checklist.getByRole('button', { name: 'Display Name', exact: true })
        ).toContainText('Complete');
        await expect(
          checklist.getByRole('button', { name: 'Tags', exact: true })
        ).toContainText('Pending');
        await checklist
          .getByRole('link', { name: 'Onboarding board', exact: true })
          .click();
        await expect(
          page.getByRole('row').filter({ hasText: 'Created by a producer' })
        ).toContainText('Draft');
      });
    }
  }
);
