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
import { EntityType } from '../../../src/enums/entity.enum';
import { ContextRule } from '../../../src/generated/type/personaContextDefinition';
import { expect, test } from '../../support/fixtures/userPages';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { getDefaultAdminAPIContext, uuid } from '../../utils/common';
import { openPersonaAIContext } from '../../utils/personaAIContext';

const persona = new PersonaClass();
const RULE_NAME = `Read only tables ${uuid()}`;

test.describe(
  'Persona AI Context permissions',
  { tag: ['@Features', '@Platform'] },
  () => {
    test.beforeAll(
      'Create a persona carrying one rule',
      async ({ browser }) => {
        const { apiContext, afterAction } = await getDefaultAdminAPIContext(
          browser
        );
        await persona.create(apiContext);

        const basePath = `/api/v1/personas/${persona.responseData.id}/aiContext`;
        const settingsResponse = await apiContext.put(basePath, {
          data: { cacheTtlMinutes: 30, characterBudget: 400000, enabled: true },
        });
        expect(settingsResponse.ok()).toBe(true);

        const rule: ContextRule = {
          entityType: EntityType.TABLE,
          maxAssets: 1,
          name: RULE_NAME,
          queryFilter: '',
          sections: [],
        };
        const ruleResponse = await apiContext.post(`${basePath}/rules`, {
          data: rule,
        });
        expect(ruleResponse.ok()).toBe(true);

        await afterAction();
      }
    );

    test.afterAll('Remove the persona', async ({ browser }) => {
      const { apiContext, afterAction } = await getDefaultAdminAPIContext(
        browser
      );
      await persona.delete(apiContext);
      await afterAction();
    });

    test('a read-only user sees the rules and no way to change them', async ({
      dataConsumerPage: page,
    }) => {
      test.slow();

      await test.step('the configuration endpoint serves a non-admin', async () => {
        const response = await openPersonaAIContext(page, persona.data.name);

        expect(response.status()).toBe(200);
      });

      await test.step('the rules render', async () => {
        await expect(
          page.getByTestId('context-rule-card').filter({ hasText: RULE_NAME })
        ).toBeVisible();
      });

      await test.step('no mutation affordance is offered', async () => {
        await expect(page.getByTestId('add-context-rule')).not.toBeVisible();
        await expect(
          page.getByTestId('empty-add-context-rule')
        ).not.toBeVisible();
        await expect(page.getByTestId('edit-context-rule')).not.toBeVisible();
        await expect(page.getByTestId('delete-context-rule')).not.toBeVisible();
        await expect(
          page.getByTestId('persona-ai-context-settings-card')
        ).toHaveAttribute('data-disabled', 'true');
      });

      await test.step('preview is withheld because the document endpoint stays admin-only', async () => {
        await expect(
          page.getByTestId('preview-persona-context')
        ).not.toBeVisible();
      });
    });

    test('an admin reaches the same page with the edit affordances', async ({
      adminPage,
    }) => {
      test.slow();

      const response = await openPersonaAIContext(adminPage, persona.data.name);

      expect(response.status()).toBe(200);
      await expect(
        adminPage
          .getByTestId('context-rule-card')
          .filter({ hasText: RULE_NAME })
      ).toBeVisible();
      await expect(adminPage.getByTestId('add-context-rule')).toBeVisible();
      await expect(
        adminPage.getByTestId('preview-persona-context')
      ).toBeVisible();
      await expect(
        adminPage.getByTestId('persona-ai-context-settings-card')
      ).toHaveAttribute('data-disabled', 'false');
    });
  }
);
