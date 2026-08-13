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
import { EntityType } from '../../../src/enums/entity.enum';
import {
  CacheState,
  PersonaContextDefinition,
} from '../../../src/generated/type/personaContextDefinition';
import { expect, test } from '../../support/fixtures/userPages';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { getDefaultAdminAPIContext } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  navigateToPersonaSettings,
  navigateToPersonaWithPagination,
} from '../../utils/persona';

const persona = new PersonaClass();
const RULE_ID = '55555555-5555-4555-8555-555555555555';
const GENERATED_AT = 1_752_000_000_000;

const TWO_CONDITION_TREE = JSON.stringify({
  type: 'group',
  properties: { conjunction: 'AND' },
  children1: {
    'aaaaaaaa-0000-4000-8000-000000000001': {
      type: 'rule',
      properties: {
        field: 'tags.tagFQN',
        operator: 'select_any_in',
        value: [['PII.Sensitive']],
        valueSrc: ['value'],
      },
    },
    'bbbbbbbb-0000-4000-8000-000000000002': {
      type: 'rule',
      properties: {
        field: 'owners.name',
        operator: 'select_any_in',
        value: [['alice']],
        valueSrc: ['value'],
      },
    },
  },
});

const makeDefinition = (
  overrides: Partial<PersonaContextDefinition>
): PersonaContextDefinition => ({
  cacheState: CacheState.Fresh,
  cacheTtlMinutes: 30,
  characterBudget: 400000,
  enabled: true,
  lastGeneratedAt: GENERATED_AT,
  rules: [],
  ...overrides,
});

const mockPersonaContext = async (
  page: Page,
  personaId: string,
  definition: PersonaContextDefinition
) => {
  const basePath = `/api/v1/personas/${personaId}/aiContext`;
  const fulfill = (body: unknown) => ({
    body: JSON.stringify(body),
    contentType: 'application/json',
    status: 200,
  });

  await page.route(`**${basePath}**`, async (route) => {
    const path = new URL(route.request().url()).pathname;

    if (path === `${basePath}/rules/preview`) {
      return route.fulfill(
        fulfill({
          matchedCount: 42,
          sampleNames: ['dim_customer', 'fact_orders'],
        })
      );
    }

    if (
      path === `${basePath}/document` ||
      path === `${basePath}/document:refresh`
    ) {
      return route.fulfill(
        fulfill({
          bytes: 32,
          cacheState: CacheState.Fresh,
          entitiesIncluded: 1,
          generatedAt: GENERATED_AT,
          markdown: '# Persona context',
          tokensEst: 8,
          truncated: false,
          truncatedCount: 0,
        })
      );
    }

    return route.fulfill(fulfill(definition));
  });
};

const openPersonaContext = async (page: Page) => {
  await navigateToPersonaSettings(page);
  await navigateToPersonaWithPagination(page, persona.data.name, true);
  await page.getByRole('tab', { name: 'AI Context' }).click();
  await expect(page).toHaveURL(/#ai-context/);
  await waitForAllLoadersToDisappear(page);
  await expect(page.getByTestId('persona-ai-context')).toBeVisible();
};

test.describe
  .serial('Persona AI Context - rule card & settings/cache states', () => {
  test.beforeAll(async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );
    await persona.create(apiContext);
    await afterAction();
  });

  test.afterAll(async ({ browser }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );
    await persona.delete(apiContext);
    await afterAction();
  });

  test('rule card shows the all-entities state when no filter is set', async ({
    adminPage,
  }) => {
    await mockPersonaContext(
      adminPage,
      persona.responseData.id,
      makeDefinition({
        rules: [
          {
            entityType: EntityType.TABLE,
            id: RULE_ID,
            matchedCount: 100,
            maxAssets: 50,
            name: 'Governed datasets',
            sections: [],
          },
        ],
      })
    );
    await openPersonaContext(adminPage);

    const card = adminPage
      .getByTestId('context-rule-card')
      .filter({ hasText: 'Governed datasets' });
    await expect(card.getByText('All Tables', { exact: true })).toBeVisible();
  });

  test('rule card shows the condition count for a multi-condition filter', async ({
    adminPage,
  }) => {
    await mockPersonaContext(
      adminPage,
      persona.responseData.id,
      makeDefinition({
        rules: [
          {
            entityType: EntityType.TABLE,
            filterJsonTree: TWO_CONDITION_TREE,
            id: RULE_ID,
            matchedCount: 12,
            maxAssets: 50,
            name: 'Tagged and owned',
            sections: [],
          },
        ],
      })
    );
    await openPersonaContext(adminPage);

    const card = adminPage
      .getByTestId('context-rule-card')
      .filter({ hasText: 'Tagged and owned' });
    await expect(card.getByText('2 conditions', { exact: true })).toBeVisible();
  });

  test('caps max assets at the backend maximum of 1000', async ({
    adminPage,
  }) => {
    await mockPersonaContext(
      adminPage,
      persona.responseData.id,
      makeDefinition({ rules: [] })
    );
    await openPersonaContext(adminPage);

    await adminPage.getByTestId('empty-add-context-rule').click();
    const maxAssets = adminPage.getByTestId('context-rule-max-assets');
    await maxAssets.fill('5000');
    await maxAssets.blur();

    await expect(maxAssets).toHaveValue('1000');
  });

  test('surfaces the persisted generation error on the settings card', async ({
    adminPage,
  }) => {
    const lastError = 'Generation failed: token budget exceeded';
    await mockPersonaContext(
      adminPage,
      persona.responseData.id,
      makeDefinition({
        lastError,
        rules: [
          {
            entityType: EntityType.TABLE,
            id: RULE_ID,
            matchedCount: 5,
            maxAssets: 50,
            name: 'Governed datasets',
            sections: [],
          },
        ],
      })
    );
    await openPersonaContext(adminPage);

    await expect(
      adminPage
        .getByTestId('persona-ai-context-settings-card')
        .getByText(lastError)
    ).toBeVisible();
  });

  test('renders the failed cache-state badge', async ({ adminPage }) => {
    await mockPersonaContext(
      adminPage,
      persona.responseData.id,
      makeDefinition({
        cacheState: CacheState.Failed,
        rules: [
          {
            entityType: EntityType.TABLE,
            id: RULE_ID,
            matchedCount: 5,
            maxAssets: 50,
            name: 'Governed datasets',
            sections: [],
          },
        ],
      })
    );
    await openPersonaContext(adminPage);

    await expect(
      adminPage
        .getByTestId('persona-ai-context-settings-card')
        .getByText('failed', { exact: true })
    ).toBeVisible();
  });

  test('renders the stale cache-state badge', async ({ adminPage }) => {
    await mockPersonaContext(
      adminPage,
      persona.responseData.id,
      makeDefinition({
        cacheState: CacheState.Stale,
        rules: [
          {
            entityType: EntityType.TABLE,
            id: RULE_ID,
            matchedCount: 5,
            maxAssets: 50,
            name: 'Governed datasets',
            sections: [],
          },
        ],
      })
    );
    await openPersonaContext(adminPage);

    await expect(
      adminPage
        .getByTestId('persona-ai-context-settings-card')
        .getByText('stale', { exact: true })
    ).toBeVisible();
  });
});
