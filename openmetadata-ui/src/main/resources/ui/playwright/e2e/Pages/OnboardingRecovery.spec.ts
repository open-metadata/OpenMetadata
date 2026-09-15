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
  Role,
  TargetEntityType,
  Type,
} from '../../../src/generated/governance/intakeForm';
import { DOMAIN_TAGS } from '../../constant/config';
import { expect } from '../../support/fixtures/base';
import { authenticateAdminPage } from '../../utils/admin';
import {
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
  'Onboarding editing and failure recovery',
  { tag: [DOMAIN_TAGS.GOVERNANCE] },
  () => {
    test.beforeEach(async ({ page }) => {
      await authenticateAdminPage(page);
    });

    for (const type of ONBOARDING_TYPES) {
      test(`${type.label}: guard dirty actions, validate boundaries and reload saved progress`, async ({
        page,
        onboarding,
      }) => {
        await onboarding.publish(type, [displayName], [nameCheck]);
        const asset = await onboarding.createAsset(type, {
          displayName: 'Saved value',
        });
        let checklist = await visitOnboardingAsset(page, type, asset);
        await checklist
          .getByRole('button', { name: 'Display Name', exact: true })
          .click();
        const input = checklist.getByRole('textbox', {
          name: 'Display Name',
          exact: true,
        });
        await input.fill('Unfinished replacement');
        for (const action of [
          checklist.getByRole('button', { name: 'Collapse', exact: true }),
          checklist.getByTestId('onboarding-advance'),
          checklist.getByRole('link', {
            name: 'Onboarding board',
            exact: true,
          }),
        ]) {
          await action.click();
          await expect(
            page.getByRole('dialog', { name: 'Unsaved changes', exact: true })
          ).toBeVisible();
          await page
            .getByRole('button', { name: 'Continue Editing', exact: true })
            .click();
          await expect(input).toHaveValue('Unfinished replacement');
        }
        expect((await onboarding.progress(type, asset)).stage).toBe('Draft');
        await checklist
          .getByRole('button', { name: 'Collapse', exact: true })
          .click();
        await page
          .getByRole('button', { name: 'Discard', exact: true })
          .click();
        await expect(checklist.getByTestId('onboarding-journey')).toHaveCount(
          0
        );
        await checklist
          .getByRole('button', { name: 'View details', exact: true })
          .click();
        await checklist
          .getByRole('button', { name: 'Display Name', exact: true })
          .click();
        await expect(input).toHaveValue('Saved value');
        for (const value of ['   ', 'abcd']) {
          await input.fill(value);
          expect(
            (await saveOnboardingField(page, checklist, type, asset)).ok()
          ).toBeTruthy();
          await expect(input).toHaveValue(value);
          await expect(
            checklist.getByTestId('onboarding-advance')
          ).toBeDisabled();
        }
        await input.fill('abcde');
        expect(
          (await saveOnboardingField(page, checklist, type, asset)).ok()
        ).toBeTruthy();
        await page.reload();
        checklist = page.getByTestId('onboarding-checklist');
        await expect(
          checklist.getByRole('button', { name: 'Display Name', exact: true })
        ).toContainText('Complete');
        await checklist
          .getByRole('button', { name: 'Display Name', exact: true })
          .click();
        await expect(input).toHaveValue('abcde');
        await expect(checklist.getByTestId('onboarding-advance')).toBeEnabled();
      });

      test(`${type.label}: failed and stale transitions retain saved progress and recover`, async ({
        page,
        onboarding,
      }) => {
        await onboarding.publish(type, [displayName], [nameCheck]);
        const asset = await onboarding.createAsset(type, {
          displayName: 'Saved value',
        });
        const checklist = await visitOnboardingAsset(page, type, asset);
        await checklist
          .getByRole('button', { name: 'Display Name', exact: true })
          .click();
        const input = checklist.getByRole('textbox', {
          name: 'Display Name',
          exact: true,
        });
        await input.fill('Discard this edit');
        const transitionUrl = `**/onboarding/${type.type}/${asset.id}/transition`;
        await page.route(
          transitionUrl,
          (route) =>
            route.fulfill({
              status: 503,
              json: { message: 'Transition unavailable' },
            }),
          { times: 1 }
        );
        const failed = page.waitForResponse(transitionUrl);
        await checklist.getByTestId('onboarding-advance').click();
        await page
          .getByRole('button', { name: 'Discard', exact: true })
          .click();
        expect((await failed).status()).toBe(503);
        await expect(input).toHaveValue('Saved value');
        await expect(
          checklist.getByTestId('onboarding-current-stage')
        ).toHaveText('Draft');
        const update = await onboarding.api.patch(
          `/api/v1/${type.collection}/${asset.id}`,
          {
            headers: { 'Content-Type': 'application/json-patch+json' },
            data: [
              {
                op: 'add',
                path: '/displayName',
                value: 'Saved in another tab',
              },
            ],
          }
        );
        expect(update.ok()).toBeTruthy();
        const stale = page.waitForResponse(transitionUrl);
        await checklist.getByTestId('onboarding-advance').click();
        expect((await stale).status()).toBe(409);
        await expect(
          checklist.getByTestId('onboarding-current-stage')
        ).toHaveText('Draft');
        await refreshChecklist(page, checklist, type, asset);
        await expect(input).toHaveValue('Saved in another tab');
        const recovered = page.waitForResponse(transitionUrl);
        await checklist.getByTestId('onboarding-advance').click();
        expect((await recovered).ok()).toBeTruthy();
        await page.reload();
        await expect(
          checklist.getByTestId('onboarding-current-stage')
        ).toHaveText('In Review');
      });

      test(`${type.label}: retry failed loads and saves, reconcile a concurrent edit`, async ({
        page,
        onboarding,
      }) => {
        await onboarding.publish(type, [displayName], [nameCheck]);
        const asset = await onboarding.createAsset(type, {});
        const fieldUrl = new RegExp(
          `/api/v1/${type.collection}/${asset.id}\\?fields=`
        );
        await page.route(fieldUrl, (route) =>
          route.fulfill({
            status: 503,
            json: { message: 'Temporary field load failure' },
          })
        );
        const checklist = await visitOnboardingAsset(page, type, asset);
        await expect(
          checklist.getByRole('button', { name: 'Retry', exact: true })
        ).toBeVisible();
        await page.unroute(fieldUrl);
        await refreshChecklist(page, checklist, type, asset);
        const input = checklist.getByRole('textbox', {
          name: 'Display Name',
          exact: true,
        });
        await expect(input).toHaveValue('');
        await input.fill('My preserved draft');
        const assetUrl = `**/api/v1/${type.collection}/${asset.id}`;
        await page.route(
          assetUrl,
          (route) =>
            route.fulfill({
              status: 503,
              json: { message: 'Temporary save failure' },
            }),
          { times: 1 }
        );
        expect(
          (await saveOnboardingField(page, checklist, type, asset)).status()
        ).toBe(503);
        await expect(input).toHaveValue('My preserved draft');
        const concurrent = await onboarding.api.patch(
          `/api/v1/${type.collection}/${asset.id}`,
          {
            headers: { 'Content-Type': 'application/json-patch+json' },
            data: [
              {
                op: 'add',
                path: '/displayName',
                value: 'Changed by another producer',
              },
              {
                op: 'add',
                path: '/description',
                value: 'Their description must survive',
              },
            ],
          }
        );
        expect(concurrent.ok()).toBeTruthy();
        const otherVersion = (await concurrent.json()).version;
        expect(
          (await saveOnboardingField(page, checklist, type, asset)).ok()
        ).toBeFalsy();
        await expect(input).toHaveValue('My preserved draft');
        await refreshChecklist(page, checklist, type, asset);
        const conflict = checklist.getByTestId('onboarding-field-conflict');
        await expect(conflict).toContainText('Changed by another producer');
        await expect(input).toHaveValue('My preserved draft');
        await expect(
          checklist.getByRole('button', {
            name: 'Save & continue',
            exact: true,
          })
        ).toBeDisabled();
        await conflict
          .getByRole('button', { name: 'Keep my edits', exact: true })
          .click();
        const saved = await saveOnboardingField(page, checklist, type, asset);
        expect(saved.ok()).toBeTruthy();
        expect(saved.request().postDataJSON()).toContainEqual({
          op: 'test',
          path: '/version',
          value: otherVersion,
        });
        expect(await saved.json()).toMatchObject({
          displayName: 'My preserved draft',
          description: 'Their description must survive',
        });
        await page.reload();
        await checklist
          .getByRole('button', { name: 'Display Name', exact: true })
          .click();
        await expect(input).toHaveValue('My preserved draft');
      });
    }

    for (const type of ONBOARDING_TYPES.filter(
      (item) => item.type !== TargetEntityType.Domain
    )) {
      test(`${type.label}: delegated EditReviewers permission and minimum-count check`, async ({
        page,
        browser,
        baseURL,
        onboarding,
      }) => {
        const delegate = await onboarding.createUser(['EditReviewers']);
        const second = await onboarding.createUser();
        await onboarding.publish(
          type,
          [
            {
              fieldPath: 'reviewers',
              fieldLabel: 'Reviewers',
              fieldKind: FieldKind.Native,
              required: true,
            },
          ],
          [
            {
              id: 'reviewers',
              title: 'Reviewers',
              type: Type.Field,
              fieldPath: 'reviewers',
              rules: { minItems: 2 },
              assignment: {
                role: Role.Explicit,
                assignees: [{ id: delegate.responseData.id, type: 'user' }],
              },
            },
          ]
        );
        const asset = await onboarding.createAsset(type);
        const producer = await browser.newPage({ baseURL });
        try {
          await delegate.login(producer);
          const checklist = await visitOnboardingAsset(producer, type, asset);
          const input = checklist.getByRole('combobox', {
            name: 'Reviewers',
            exact: true,
          });
          for (const person of [delegate, second]) {
            await input.fill(person.responseData.name);
            await producer
              .getByRole('option', {
                name: person.responseData.displayName,
                exact: true,
              })
              .click();
            await producer.keyboard.press('Escape');
            expect(
              (await saveOnboardingField(producer, checklist, type, asset)).ok()
            ).toBeTruthy();
            if (person === delegate)
              await expect(
                checklist.getByRole('button', {
                  name: 'Reviewers',
                  exact: true,
                })
              ).toContainText('Pending');
          }
          await producer.reload();
          await expect(
            checklist.getByRole('button', { name: 'Reviewers', exact: true })
          ).toContainText('Complete');
          await expect(
            checklist.getByTestId('onboarding-advance')
          ).toBeDisabled();
          const stored = await onboarding.api.get(
            `/api/v1/${type.collection}/${asset.id}?fields=reviewers`
          );
          expect(
            (await stored.json()).reviewers.map(
              (reviewer: { id: string }) => reviewer.id
            )
          ).toEqual(
            expect.arrayContaining([
              delegate.responseData.id,
              second.responseData.id,
            ])
          );
        } finally {
          await producer.close();
        }
        await visitOnboardingAsset(page, type, asset);
        await expect(page.getByTestId('onboarding-advance')).toBeEnabled();
      });
    }

    test('Glossary Term: type, paste, delete and reload multiple synonyms', async ({
      page,
      onboarding,
    }) => {
      const type = ONBOARDING_TYPES.find(
        (item) => item.type === TargetEntityType.GlossaryTerm
      )!;
      await onboarding.publish(
        type,
        [
          {
            fieldPath: 'synonyms',
            fieldLabel: 'Synonyms',
            fieldKind: FieldKind.Native,
            required: true,
          },
        ],
        [
          {
            id: 'synonyms',
            title: 'Synonyms',
            type: Type.Field,
            fieldPath: 'synonyms',
            rules: { minItems: 2 },
          },
        ]
      );
      const asset = await onboarding.createAsset(type);
      const checklist = await visitOnboardingAsset(page, type, asset);
      const input = checklist.getByRole('textbox', {
        name: 'Synonyms',
        exact: true,
      });
      await input.pressSequentially('first, second');
      await expect(input).toHaveValue('first, second');
      const saved = await saveOnboardingField(page, checklist, type, asset);
      expect((await saved.json()).synonyms).toEqual(['first', 'second']);
      await page.reload();
      await checklist
        .getByRole('button', { name: 'Synonyms', exact: true })
        .click();
      await expect(input).toHaveValue('first, second');
      await input.fill('first, second, pasted');
      expect(
        (await saveOnboardingField(page, checklist, type, asset)).ok()
      ).toBeTruthy();
      await checklist
        .getByRole('button', { name: 'Synonyms', exact: true })
        .click();
      await input.fill('first');
      expect(
        (await saveOnboardingField(page, checklist, type, asset)).ok()
      ).toBeTruthy();
      await expect(checklist.getByTestId('onboarding-advance')).toBeDisabled();
      await page.reload();
      await expect(input).toHaveValue('first');
    });
  }
);
