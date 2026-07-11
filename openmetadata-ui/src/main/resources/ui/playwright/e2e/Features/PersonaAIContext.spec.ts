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
import { Page, Route } from '@playwright/test';
import { EntityType } from '../../../src/enums/entity.enum';
import {
  CacheState,
  ContextRule,
  ContextSection,
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
const RULE_ID = '33333333-3333-4333-8333-333333333333';
const CREATED_RULE_ID = '44444444-4444-4444-8444-444444444444';

interface PersonaContextDocument {
  bytes: number;
  cacheState: CacheState;
  entitiesIncluded: number;
  generatedAt: number;
  markdown: string;
  tokensEst: number;
  truncated: boolean;
  truncatedCount: number;
}

const MARKDOWN = `---
persona: "Business Analyst"
generated_at: "2026-07-10T14:07:00Z"
rules: 1
budget: 400000
tokens_est: 128
---

# Persona context: Business Analyst

## Rule: Semantic layer tables

### Table: ecommerce.public.semantic.dim_customer

One row per customer.`;

const createDocument = (): PersonaContextDocument => ({
  bytes: new TextEncoder().encode(MARKDOWN).length,
  cacheState: CacheState.Fresh,
  entitiesIncluded: 1,
  generatedAt: Date.now(),
  markdown: MARKDOWN,
  tokensEst: Math.ceil(MARKDOWN.length / 4),
  truncated: false,
  truncatedCount: 0,
});

const mockPersonaContextApi = async (
  page: Page,
  personaId: string,
  initialRules: ContextRule[]
) => {
  const basePath = `/api/v1/personas/${personaId}/aiContext`;
  let documentRequestCount = 0;
  let definition: PersonaContextDefinition = {
    cacheState: CacheState.Fresh,
    cacheTtlMinutes: 30,
    characterBudget: 400000,
    enabled: true,
    lastGeneratedAt: Date.now(),
    rules: initialRules,
  };

  const fulfill = async (route: Route, body: unknown) =>
    route.fulfill({
      body: JSON.stringify(body),
      contentType: 'application/json',
      status: 200,
    });

  await page.route(`**${basePath}**`, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;

    if (path === `${basePath}/rules/preview`) {
      const rule = request.postDataJSON() as ContextRule;
      expect(rule.name.trim()).not.toHaveLength(0);
      const previewByType: Record<
        string,
        { count: number; samples: string[] }
      > = {
        [EntityType.GLOSSARY_TERM]: {
          count: 143,
          samples: ['Customer Lifetime Value', 'Churn Rate', 'ARR'],
        },
        [EntityType.KNOWLEDGE_PAGE]: {
          count: 18,
          samples: [
            'Building your first KPI dashboard',
            'Metric governance 101',
          ],
        },
        [EntityType.METRIC]: {
          count: 27,
          samples: ['Monthly Active Accounts', 'Net Revenue Retention'],
        },
      };
      const preview = previewByType[rule.entityType] ?? {
        count: 142,
        samples: ['dim_customer', 'fact_orders', 'dim_product'],
      };

      return fulfill(route, {
        matchedCount: preview.count,
        sampleNames: preview.samples,
      });
    }

    if (path === `${basePath}/document:refresh`) {
      return fulfill(route, createDocument());
    }

    if (path === `${basePath}/document`) {
      documentRequestCount++;
      expect(documentRequestCount).toBe(1);
      expect(new URL(request.url()).search).toBe('');

      return fulfill(route, createDocument());
    }

    if (path === `${basePath}/rules` && request.method() === 'POST') {
      const rule = request.postDataJSON() as ContextRule;
      definition = {
        ...definition,
        cacheState: CacheState.Generating,
        rules: [
          ...(definition.rules ?? []),
          { ...rule, id: CREATED_RULE_ID, matchedCount: 18 },
        ],
      };

      return fulfill(route, definition);
    }

    if (path.startsWith(`${basePath}/rules/`)) {
      const ruleId = path.substring(`${basePath}/rules/`.length);
      if (request.method() === 'DELETE') {
        definition = {
          ...definition,
          rules: (definition.rules ?? []).filter(({ id }) => id !== ruleId),
        };

        return fulfill(route, definition);
      }
      if (request.method() === 'PUT') {
        const rule = request.postDataJSON() as ContextRule;
        definition = {
          ...definition,
          rules: (definition.rules ?? []).map((currentRule) =>
            currentRule.id === ruleId
              ? { ...rule, id: ruleId, matchedCount: 142 }
              : currentRule
          ),
        };

        return fulfill(route, definition);
      }
    }

    if (path === basePath && request.method() === 'PUT') {
      const settings =
        request.postDataJSON() as Partial<PersonaContextDefinition>;
      definition = { ...definition, ...settings };

      return fulfill(route, definition);
    }

    return fulfill(route, definition);
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

test.describe.serial('Persona AI Context', () => {
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

  test('round-trips real configuration, rule CRUD, and preview endpoints', async ({
    browser,
  }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );
    const basePath = `/api/v1/personas/${persona.responseData.id}/aiContext`;
    try {
      const settingsResponse = await apiContext.put(basePath, {
        data: {
          cacheTtlMinutes: 30,
          characterBudget: 400000,
          enabled: true,
        },
      });
      expect(settingsResponse.ok()).toBe(true);

      const requestedRule: ContextRule = {
        entityType: EntityType.TABLE,
        maxAssets: 1,
        name: 'Real API tables',
        queryFilter: '',
        sections: [],
      };
      const createResponse = await apiContext.post(`${basePath}/rules`, {
        data: requestedRule,
      });
      expect(createResponse.ok()).toBe(true);
      const createdDefinition =
        (await createResponse.json()) as PersonaContextDefinition;
      const createdRule = createdDefinition.rules?.find(
        ({ name }) => name === requestedRule.name
      );
      expect(createdRule?.id).toBeTruthy();
      expect(createdRule?.sections).toContain(ContextSection.Description);
      expect(createdRule?.sections).toContain(ContextSection.Joins);

      const previewResponse = await apiContext.post(
        `${basePath}/rules/preview`,
        { data: requestedRule }
      );
      expect(previewResponse.ok()).toBe(true);
      expect(await previewResponse.json()).toEqual(
        expect.objectContaining({ matchedCount: expect.any(Number) })
      );

      const updateResponse = await apiContext.put(
        `${basePath}/rules/${createdRule?.id}`,
        {
          data: { ...requestedRule, name: 'Updated real API tables' },
        }
      );
      expect(updateResponse.ok()).toBe(true);

      const deleteResponse = await apiContext.delete(
        `${basePath}/rules/${createdRule?.id}`
      );
      expect(deleteResponse.ok()).toBe(true);
    } finally {
      await afterAction();
    }
  });

  test('configures every entity type, behavior, section, filter, and setting', async ({
    adminPage,
  }) => {
    await mockPersonaContextApi(
      adminPage,
      persona.responseData.id as string,
      []
    );
    await openPersonaContext(adminPage);

    await expect(
      adminPage.locator('.persona-ai-context-settings-card')
    ).toHaveAttribute('data-disabled', 'true');
    await expect(
      adminPage.getByTestId('preview-persona-context')
    ).toBeDisabled();
    await expect(adminPage.getByText('No AI context rules yet')).toBeVisible();

    await adminPage.getByTestId('empty-add-context-rule').click();
    await expect(adminPage.getByTestId('form-heading')).toHaveText('Add Rule');
    await expect(adminPage.getByText(/142 entities matched/)).toBeVisible();

    const drawerBody = adminPage.locator(
      '.persona-ai-context-rule-drawer .drawer-form-content'
    );
    await expect(drawerBody).toHaveCSS('overflow-y', 'auto');
    expect(
      await drawerBody.evaluate(
        (element) => element.scrollHeight > element.clientHeight
      )
    ).toBe(true);
    await drawerBody.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });
    expect(
      await drawerBody.evaluate((element) => element.scrollTop)
    ).toBeGreaterThan(0);

    await adminPage.getByTestId('context-rule-name').fill('Analytics articles');
    await adminPage
      .getByTestId('context-rule-description')
      .fill('Guidance for dashboard authors');

    const entitySelect = adminPage.getByTestId('context-rule-entity-type');
    await entitySelect.click();
    const entityTypePopup = adminPage.locator(
      '.persona-ai-context-entity-type-popup'
    );
    await expect(entityTypePopup).toBeVisible();
    await expect(
      entityTypePopup.locator('.ant-select-item-option')
    ).toHaveCount(18);
    const entityTypeList = entityTypePopup.locator('.rc-virtual-list-holder');
    await expect(entityTypeList).toHaveCSS('overflow-y', 'auto');
    expect(
      await entityTypeList.evaluate(
        (element) => element.scrollHeight > element.clientHeight
      )
    ).toBe(true);
    for (const option of [
      'Table',
      'Topic',
      'Dashboard',
      'Chart',
      'Data Model',
      'Pipeline',
      'ML Model',
      'Container',
      'Database',
      'Database Schema',
      'Stored Procedure',
      'Search Index',
      'API Collection',
      'API Endpoint',
      'Data Product',
      'Glossary Term',
      'Article',
      'Metric',
    ]) {
      const entityTypeOption = entityTypePopup.getByText(option, {
        exact: true,
      });
      await entityTypeOption.scrollIntoViewIfNeeded();
      await expect(entityTypeOption).toBeVisible();
    }
    await entityTypePopup.getByText('Data Product', { exact: true }).click();
    await expect(adminPage.getByText(/every asset it contains/)).toBeVisible();

    await entitySelect.click();
    await entityTypePopup.getByText('Article', { exact: true }).click();

    await expect(adminPage.getByText(/Generic content/)).toBeVisible();
    await expect(
      adminPage.getByTestId('context-rule-always-in-context')
    ).toHaveAttribute('aria-checked', 'true');
    await expect(
      adminPage.getByTestId('context-rule-fully-rendered')
    ).toHaveAttribute('aria-checked', 'true');
    await expect(
      adminPage.getByTestId('context-rule-fully-rendered')
    ).toBeDisabled();
    for (const section of [
      'Title & summary',
      'Full body',
      'Tags',
      'Related glossary terms',
      'Related assets',
    ]) {
      await expect(
        adminPage.getByRole('checkbox', { name: section })
      ).toBeDisabled();
    }
    await expect(adminPage.getByText(/18 entities matched/)).toBeVisible();

    await entitySelect.click();
    await entityTypePopup.getByText('Metric', { exact: true }).click();
    for (const section of [
      'Definition',
      'Formula / expression',
      'Unit & grain',
      'Owner',
      'Tags',
      'Related assets',
    ]) {
      await expect(
        adminPage.getByRole('checkbox', { name: section })
      ).toBeVisible();
    }
    await expect(adminPage.getByText(/27 entities matched/)).toBeVisible();

    await entitySelect.click();
    await entityTypePopup.getByText('Glossary Term', { exact: true }).click();
    for (const section of [
      'Definition',
      'Synonyms',
      'Related terms',
      'Tags',
      'Related assets',
    ]) {
      await expect(
        adminPage.getByRole('checkbox', { name: section })
      ).toBeVisible();
    }
    await expect(adminPage.getByText(/143 entities matched/)).toBeVisible();

    await entitySelect.click();
    await entityTypePopup.getByText('Table', { exact: true }).click();
    for (const section of [
      'Description',
      'Schema',
      'Keys & Constraints',
      'Tags',
      'Related glossary terms',
      'Join',
      'Related articles',
      'Related metrics',
      'Lineage',
      'Profile',
      'Data Quality',
    ]) {
      await expect(
        adminPage.getByRole('checkbox', { name: section })
      ).toBeVisible();
    }

    await adminPage.getByTestId('add-context-condition').click();
    const orOperator = adminPage
      .locator('.persona-ai-context-rule-drawer')
      .getByRole('button', { name: 'Or', exact: true });
    await expect(orOperator).toBeVisible();
    await orOperator.click();
    await expect(adminPage.getByTestId('delete-condition-button')).toHaveCount(
      2
    );
    await adminPage.getByTestId('delete-condition-button').last().click();

    await entitySelect.click();
    await entityTypePopup.getByText('Article', { exact: true }).click();
    await adminPage.getByRole('dialog').getByRole('spinbutton').fill('25');

    const createRuleRequest = adminPage.waitForRequest(
      (request) =>
        request.url().endsWith('/aiContext/rules') &&
        request.method() === 'POST'
    );
    await adminPage.getByRole('button', { name: 'Save Rule' }).click();
    const createdRule = (await createRuleRequest).postDataJSON() as ContextRule;
    expect(createdRule).toMatchObject({
      alwaysInContext: true,
      entityType: EntityType.KNOWLEDGE_PAGE,
      fullyRendered: true,
      maxAssets: 25,
      name: 'Analytics articles',
    });

    const createdRuleCard = adminPage
      .getByTestId('context-rule-card')
      .filter({ hasText: 'Analytics articles' });
    await expect(createdRuleCard).toBeVisible();
    await expect(createdRuleCard.getByText('Fully rendered')).toBeVisible();
    await expect(createdRuleCard.getByText('Always in context')).toBeVisible();

    const settingsRequest = adminPage.waitForRequest(
      (request) =>
        request.url().endsWith('/aiContext') && request.method() === 'PUT'
    );
    const budgetInput = adminPage
      .locator('.persona-ai-context-settings-card .ant-input-number-input')
      .first();
    await budgetInput.fill('175000');
    await budgetInput.blur();
    expect((await settingsRequest).postDataJSON()).toMatchObject({
      cacheTtlMinutes: 30,
      characterBudget: 175000,
      enabled: true,
    });

    const disableRequest = adminPage.waitForRequest(
      (request) =>
        request.url().endsWith('/aiContext') && request.method() === 'PUT'
    );
    await adminPage.getByTestId('persona-context-enabled').click();
    expect((await disableRequest).postDataJSON()).toMatchObject({
      enabled: false,
    });
  });

  test('edits and deletes a persisted rule and returns to the empty state', async ({
    adminPage,
  }) => {
    await mockPersonaContextApi(adminPage, persona.responseData.id as string, [
      {
        alwaysInContext: false,
        entityType: EntityType.TABLE,
        fullyRendered: false,
        id: RULE_ID,
        matchedCount: 142,
        maxAssets: 50,
        name: 'Semantic layer tables',
        sections: [ContextSection.Description, ContextSection.Schema],
      },
    ]);
    await openPersonaContext(adminPage);

    await adminPage.getByTestId('edit-context-rule').click();
    await adminPage
      .getByTestId('context-rule-name')
      .fill('Certified semantic tables');
    await adminPage.getByTestId('context-rule-always-in-context').click();
    await adminPage.getByTestId('context-rule-fully-rendered').click();

    const updateRuleRequest = adminPage.waitForRequest(
      (request) =>
        request.url().endsWith(`/aiContext/rules/${RULE_ID}`) &&
        request.method() === 'PUT'
    );
    await adminPage.getByRole('button', { name: 'Save Rule' }).click();
    expect((await updateRuleRequest).postDataJSON()).toMatchObject({
      alwaysInContext: true,
      fullyRendered: true,
      name: 'Certified semantic tables',
    });
    await expect(
      adminPage.getByText('Certified semantic tables')
    ).toBeVisible();

    await adminPage.getByTestId('delete-context-rule').click();
    const deleteRuleRequest = adminPage.waitForRequest(
      (request) =>
        request.url().endsWith(`/aiContext/rules/${RULE_ID}`) &&
        request.method() === 'DELETE'
    );
    await adminPage
      .locator('.ant-popconfirm')
      .getByRole('button', { name: 'Delete', exact: true })
      .click();
    await deleteRuleRequest;

    await expect(adminPage.getByText('No AI context rules yet')).toBeVisible();
    await expect(
      adminPage.locator('.persona-ai-context-settings-card')
    ).toHaveAttribute('data-disabled', 'true');
  });

  test('previews one byte-consistent document in rendered and raw modes', async ({
    adminPage,
  }) => {
    await mockPersonaContextApi(adminPage, persona.responseData.id as string, [
      {
        entityType: EntityType.TABLE,
        id: RULE_ID,
        matchedCount: 142,
        maxAssets: 50,
        name: 'Semantic layer tables',
        sections: [ContextSection.Description, ContextSection.Schema],
      },
    ]);
    await openPersonaContext(adminPage);

    await adminPage.getByTestId('preview-persona-context').click();
    await expect(adminPage.getByRole('dialog')).toBeVisible();
    await expect(adminPage.getByText('1 entities included')).toBeVisible();
    await expect(
      adminPage.getByRole('heading', {
        name: 'Persona context: Business Analyst',
      })
    ).toBeVisible();

    await adminPage.getByText('Raw', { exact: true }).click();
    await expect(
      adminPage.getByTestId('persona-context-raw-document')
    ).toContainText('ecommerce.public.semantic.dim_customer');

    await adminPage.getByText('Rendered', { exact: true }).click();
    await adminPage
      .getByRole('button', { name: 'Rule: Semantic layer tables' })
      .click();

    await adminPage.getByTestId('copy-persona-context').click();
    await expect(adminPage.getByText('Copied', { exact: true })).toBeVisible();

    const refreshRequest = adminPage.waitForRequest(
      (request) =>
        request.url().endsWith('/aiContext/document:refresh') &&
        request.method() === 'POST'
    );
    await adminPage.getByTestId('refresh-persona-context').click();
    await refreshRequest;
    await expect(
      adminPage
        .getByTestId('persona-context-preview-modal')
        .getByText('fresh', { exact: true })
    ).toBeVisible();
  });
});
