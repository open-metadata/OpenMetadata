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
import { Page, Request, Route } from '@playwright/test';
import { EntityType } from '../../../src/enums/entity.enum';
import {
  CacheState,
  ContextRule,
  ContextSection,
  PersonaContextDefinition,
} from '../../../src/generated/type/personaContextDefinition';
import { expect, test } from '../../support/fixtures/userPages';
import { PersonaClass } from '../../support/persona/PersonaClass';
import {
  getDefaultAdminAPIContext,
  toastNotification,
} from '../../utils/common';
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

// Builds a realistically-shaped, very large context document (one rule section
// per matched table, with a column list and prose) so the preview has to render
// hundreds of KB of markdown — the case that stresses the block-editor renderer.
const buildLargeMarkdown = (ruleCount: number): string => {
  const columns = Array.from(
    { length: 40 },
    (_, c) => `\`col_${c}:VARCHAR\``
  ).join(', ');
  const body = Array.from({ length: ruleCount }, (_, i) =>
    [
      `## Rule: dataset group ${i}`,
      '',
      `### Table: warehouse.public.fact_events_${i}`,
      '',
      `**Columns:** ${columns}`,
      '',
      `One row per event for dataset ${i}. `.repeat(24),
      '',
    ].join('\n')
  ).join('\n');

  return [
    '---',
    'persona: "Load Test"',
    'generated_at: "2026-07-13T00:00:00Z"',
    'rules: 1',
    'budget: 2000000',
    'tokens_est: 120000',
    '---',
    '',
    '# Persona context: Load Test',
    '',
    body,
  ].join('\n');
};

const isPersonaContextWrite = (
  basePath: string,
  path: string,
  request: Request
): boolean => {
  const isRuleWrite =
    path.startsWith(`${basePath}/rules`) &&
    path !== `${basePath}/rules/preview`;
  const isSettingsWrite = path === basePath && request.method() === 'PUT';

  return isRuleWrite || isSettingsWrite;
};

const mockPersonaContextApi = async (
  page: Page,
  personaId: string,
  initialRules: ContextRule[],
  options: { failWrites?: boolean; resolveGenerating?: boolean } = {}
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

    if (options.failWrites && isPersonaContextWrite(basePath, path, request)) {
      return route.fulfill({
        body: JSON.stringify({ message: 'Injected failure' }),
        contentType: 'application/json',
        status: 500,
      });
    }

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

    if (
      options.resolveGenerating &&
      definition.cacheState === CacheState.Generating
    ) {
      definition = { ...definition, cacheState: CacheState.Fresh };
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
      adminPage.getByTestId('persona-ai-context-settings-card')
    ).toHaveAttribute('data-disabled', 'true');
    await expect(
      adminPage.getByTestId('preview-persona-context')
    ).toBeDisabled();
    await expect(adminPage.getByText('No AI context rules yet')).toBeVisible();

    await adminPage.getByTestId('empty-add-context-rule').click();
    await expect(adminPage.getByTestId('form-heading')).toHaveText('Add Rule');
    await expect(adminPage.getByText(/142 entities matched/)).toBeVisible();

    const drawerBody = adminPage.getByRole('dialog').getByRole('main');
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
      .locator('textarea')
      .fill('Guidance for dashboard authors');

    const entitySelect = adminPage.getByTestId('context-rule-entity-type');
    await entitySelect.click();
    const entityTypePopup = adminPage.getByRole('listbox');
    await expect(entityTypePopup).toBeVisible();
    await expect(entityTypePopup.getByRole('option')).toHaveCount(18);
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
      adminPage
        .getByTestId('context-rule-always-in-context')
        .getByRole('switch')
    ).toBeChecked();
    await expect(
      adminPage.getByTestId('context-rule-fully-rendered').getByRole('switch')
    ).toBeChecked();
    await expect(
      adminPage.getByTestId('context-rule-fully-rendered').getByRole('switch')
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
    // Conjunction toggle is a react-aria ToggleButtonGroup (selectionMode
    // "single"), which exposes role="radio" items — not buttons.
    const orOperator = adminPage
      .getByRole('dialog')
      .getByRole('radio', { name: 'Or', exact: true });
    await expect(orOperator).toBeVisible();
    await orOperator.click();
    await expect(adminPage.getByTestId('delete-condition-button')).toHaveCount(
      2
    );
    await adminPage.getByTestId('delete-condition-button').last().click();

    await entitySelect.click();
    await entityTypePopup.getByText('Article', { exact: true }).click();
    await adminPage.getByTestId('context-rule-max-assets').fill('25');

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
    const budgetInput = adminPage.getByTestId(
      'persona-context-character-budget'
    );
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
      .getByTestId('delete-modal')
      .getByTestId('confirm-button')
      .click();
    await deleteRuleRequest;

    await expect(adminPage.getByText('No AI context rules yet')).toBeVisible();
    await expect(
      adminPage.getByTestId('persona-ai-context-settings-card')
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
      .getByRole('button', { name: 'Semantic layer tables' })
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

  test('measures the large-document preview render cost', async ({
    adminPage,
  }) => {
    test.slow();
    const personaId = persona.responseData.id as string;
    await mockPersonaContextApi(adminPage, personaId, [
      {
        entityType: EntityType.TABLE,
        id: RULE_ID,
        matchedCount: 5000,
        maxAssets: 1000,
        name: 'Everything, fully rendered',
        sections: [],
      },
    ]);

    const markdown = buildLargeMarkdown(350);
    const bytes = new TextEncoder().encode(markdown).length;
    const largeDocument: PersonaContextDocument = {
      bytes,
      cacheState: CacheState.Fresh,
      entitiesIncluded: 350,
      generatedAt: Date.now(),
      markdown,
      tokensEst: Math.ceil(markdown.length / 4),
      truncated: true,
      truncatedCount: 141,
    };
    // Override just the document endpoint with the large payload.
    await adminPage.route('**/aiContext/document', (route) =>
      route.fulfill({
        body: JSON.stringify(largeDocument),
        contentType: 'application/json',
        status: 200,
      })
    );

    await openPersonaContext(adminPage);
    await adminPage.getByTestId('preview-persona-context').click();
    await expect(adminPage.getByRole('dialog')).toBeVisible();

    // The modal opens in "Rendered" mode, so the block editor parses the whole
    // document up front. Measure how long the rendered heading takes to paint.
    const startedAt = Date.now();
    await expect(
      adminPage.getByRole('heading', { name: 'Persona context: Load Test' })
    ).toBeVisible({ timeout: 60_000 });
    const renderMs = Date.now() - startedAt;

    console.log(
      `[large-doc] Rendered ${(bytes / 1024).toFixed(0)} KB in ${renderMs} ms`
    );

    // Raw mode is a plain <pre>, so it stays responsive regardless of size.
    await adminPage.getByText('Raw', { exact: true }).click();
    await expect(
      adminPage.getByTestId('persona-context-raw-document')
    ).toContainText('warehouse.public.fact_events_0');
  });

  test('builds real version history and restores an earlier version', async ({
    browser,
    adminPage,
  }) => {
    const { apiContext, afterAction } = await getDefaultAdminAPIContext(
      browser
    );
    const personaId = persona.responseData.id as string;
    const aiBase = `/api/v1/personas/${personaId}/aiContext`;
    const versionsUrl = `/api/v1/personas/${personaId}/versions`;
    const formatVersion = (version: number) => version.toFixed(1);
    const RULE_NAME = 'Version history probe rule';
    try {
      await apiContext.put(aiBase, {
        data: { cacheTtlMinutes: 30, characterBudget: 120000, enabled: true },
      });
      const ruleResponse = await apiContext.post(`${aiBase}/rules`, {
        data: {
          entityType: EntityType.TABLE,
          maxAssets: 25,
          name: RULE_NAME,
          queryFilter: '',
          sections: [],
        },
      });
      expect(ruleResponse.ok()).toBe(true);
      expect(
        ((await ruleResponse.json()) as PersonaContextDefinition).rules?.some(
          ({ name }) => name === RULE_NAME
        )
      ).toBe(true);

      const historyResponse = await apiContext.get(versionsUrl);
      const history = (await historyResponse.json()) as { versions: string[] };
      const snapshots = history.versions
        .map(
          (snapshot) =>
            JSON.parse(snapshot) as {
              version: number;
              contextDefinition?: PersonaContextDefinition;
            }
        )
        .sort((a, b) => b.version - a.version);
      const currentVersion = snapshots[0].version;
      const beforeRuleVersion = snapshots.find(
        (snapshot) =>
          !(snapshot.contextDefinition?.rules ?? []).some(
            ({ name }) => name === RULE_NAME
          )
      )?.version;
      expect(beforeRuleVersion).toBeDefined();

      await openPersonaContext(adminPage);
      await expect(adminPage.getByText(RULE_NAME)).toBeVisible();

      await adminPage.getByTestId('persona-context-version').click();
      const drawer = adminPage.getByTestId('persona-context-version-history');
      await expect(drawer).toBeVisible();
      await expect(drawer.getByText('Current')).toBeVisible();
      await expect(
        adminPage.getByTestId(`version-dot-${formatVersion(currentVersion)}`)
      ).toBeVisible();
      await expect(drawer.getByText(`Rule '${RULE_NAME}' added`)).toBeVisible();

      const restoreRequest = adminPage.waitForRequest(
        (request) =>
          request.url().endsWith(`/personas/${personaId}`) &&
          request.method() === 'PATCH'
      );
      await adminPage
        .getByTestId(`restore-version-${formatVersion(beforeRuleVersion!)}`)
        .click();
      await adminPage.getByTestId('confirm-restore-version').click();
      await restoreRequest;

      await expect(
        adminPage.getByTestId('empty-add-context-rule')
      ).toBeVisible();

      const restoredDefinition = (await (
        await apiContext.get(aiBase)
      ).json()) as PersonaContextDefinition;
      expect(restoredDefinition.rules ?? []).toHaveLength(0);
    } finally {
      await afterAction();
    }
  });

  test('rolls back the optimistic rule and toasts when the save fails', async ({
    adminPage,
  }) => {
    await mockPersonaContextApi(
      adminPage,
      persona.responseData.id as string,
      [],
      { failWrites: true }
    );
    await openPersonaContext(adminPage);

    await adminPage.getByTestId('empty-add-context-rule').click();
    await adminPage.getByTestId('context-rule-name').fill('Doomed rule');

    const failedCreate = adminPage.waitForResponse(
      (response) =>
        response.url().endsWith('/aiContext/rules') &&
        response.request().method() === 'POST' &&
        response.status() === 500
    );
    await adminPage.getByRole('button', { name: 'Save Rule' }).click();
    await failedCreate;

    await toastNotification(adminPage, /Injected failure/);
    await expect(adminPage.getByTestId('form-heading')).toBeVisible();
    await expect(
      adminPage
        .getByTestId('context-rule-card')
        .filter({ hasText: 'Doomed rule' })
    ).toHaveCount(0);
  });

  test('reverts the enabled toggle when the settings update fails', async ({
    adminPage,
  }) => {
    await mockPersonaContextApi(
      adminPage,
      persona.responseData.id as string,
      [
        {
          entityType: EntityType.TABLE,
          id: RULE_ID,
          matchedCount: 142,
          maxAssets: 50,
          name: 'Semantic layer tables',
          sections: [ContextSection.Description],
        },
      ],
      { failWrites: true }
    );
    await openPersonaContext(adminPage);

    const toggle = adminPage
      .getByTestId('persona-context-enabled')
      .getByRole('switch');
    await expect(toggle).toBeChecked();

    const failedUpdate = adminPage.waitForResponse(
      (response) =>
        response.url().endsWith('/aiContext') &&
        response.request().method() === 'PUT' &&
        response.status() === 500
    );
    await adminPage.getByTestId('persona-context-enabled').click();
    await failedUpdate;

    await toastNotification(adminPage, /Injected failure/);
    await expect(toggle).toBeChecked();
  });

  test('surfaces the generating cache state and settles to fresh', async ({
    adminPage,
  }) => {
    await mockPersonaContextApi(
      adminPage,
      persona.responseData.id as string,
      [],
      { resolveGenerating: true }
    );
    await openPersonaContext(adminPage);

    await adminPage.getByTestId('empty-add-context-rule').click();
    await adminPage
      .getByTestId('context-rule-name')
      .fill('Kick off generation');
    await adminPage.getByRole('button', { name: 'Save Rule' }).click();

    const settingsCard = adminPage.getByTestId(
      'persona-ai-context-settings-card'
    );
    await expect(
      settingsCard.getByText('generating', { exact: true })
    ).toBeVisible();
    await expect(
      settingsCard.getByText('fresh', { exact: true })
    ).toBeVisible();
  });

  test('retries the preview after a failed document load', async ({
    adminPage,
  }) => {
    const personaId = persona.responseData.id as string;
    await mockPersonaContextApi(adminPage, personaId, [
      {
        entityType: EntityType.TABLE,
        id: RULE_ID,
        matchedCount: 142,
        maxAssets: 50,
        name: 'Semantic layer tables',
        sections: [ContextSection.Description],
      },
    ]);

    let documentCalls = 0;
    await adminPage.route('**/aiContext/document', (route) => {
      documentCalls++;

      return route.fulfill({
        body: JSON.stringify(
          documentCalls === 1 ? { message: 'boom' } : createDocument()
        ),
        contentType: 'application/json',
        status: documentCalls === 1 ? 500 : 200,
      });
    });

    await openPersonaContext(adminPage);
    await adminPage.getByTestId('preview-persona-context').click();
    await expect(adminPage.getByRole('dialog')).toBeVisible();

    await adminPage.getByRole('button', { name: 'Try Again' }).click();
    await expect(adminPage.getByText('1 entities included')).toBeVisible();
  });

  test('blocks saving a rule whose name already exists', async ({
    adminPage,
  }) => {
    await mockPersonaContextApi(adminPage, persona.responseData.id as string, [
      {
        entityType: EntityType.TABLE,
        id: RULE_ID,
        matchedCount: 142,
        maxAssets: 50,
        name: 'Semantic layer tables',
        sections: [ContextSection.Description],
      },
    ]);
    await openPersonaContext(adminPage);

    await adminPage.getByTestId('add-context-rule').click();
    await adminPage
      .getByTestId('context-rule-name')
      .fill('Semantic layer tables');
    await adminPage.getByRole('button', { name: 'Save Rule' }).click();

    await expect(adminPage.getByText('Name already exists')).toBeVisible();
    await expect(adminPage.getByTestId('form-heading')).toBeVisible();
  });

  test('clears and persists the character budget and cache TTL', async ({
    adminPage,
  }) => {
    await mockPersonaContextApi(adminPage, persona.responseData.id as string, [
      {
        entityType: EntityType.TABLE,
        id: RULE_ID,
        matchedCount: 142,
        maxAssets: 50,
        name: 'Semantic layer tables',
        sections: [ContextSection.Description],
      },
    ]);
    await openPersonaContext(adminPage);

    const budget = adminPage.getByTestId('persona-context-character-budget');
    await budget.fill('');
    await expect(budget).toHaveValue('');
    await budget.fill('250000');

    const budgetRequest = adminPage.waitForRequest(
      (request) =>
        request.url().endsWith('/aiContext') && request.method() === 'PUT'
    );
    await budget.blur();
    expect((await budgetRequest).postDataJSON()).toMatchObject({
      characterBudget: 250000,
    });

    const ttl = adminPage.getByTestId('persona-context-cache-ttl');
    await ttl.fill('');
    await expect(ttl).toHaveValue('');
    await ttl.fill('45');

    const ttlRequest = adminPage.waitForRequest(
      (request) =>
        request.url().endsWith('/aiContext') && request.method() === 'PUT'
    );
    await ttl.blur();
    expect((await ttlRequest).postDataJSON()).toMatchObject({
      cacheTtlMinutes: 45,
    });
  });

  test('links View in Explore to the entity-type explore tab', async ({
    adminPage,
  }) => {
    await mockPersonaContextApi(
      adminPage,
      persona.responseData.id as string,
      []
    );
    await openPersonaContext(adminPage);

    await adminPage.getByTestId('empty-add-context-rule').click();
    await expect(adminPage.getByText(/142 entities matched/)).toBeVisible();

    await expect(
      adminPage.getByRole('link', { name: 'View in Explore' })
    ).toHaveAttribute('href', /\/explore\/tables/);
  });

  test('shows the empty version history state', async ({ adminPage }) => {
    const personaId = persona.responseData.id as string;
    await mockPersonaContextApi(adminPage, personaId, [
      {
        entityType: EntityType.TABLE,
        id: RULE_ID,
        matchedCount: 142,
        maxAssets: 50,
        name: 'Semantic layer tables',
        sections: [ContextSection.Description],
      },
    ]);
    await adminPage.route(`**/personas/${personaId}/versions`, (route) =>
      route.fulfill({
        body: JSON.stringify({ entityType: 'persona', versions: [] }),
        contentType: 'application/json',
        status: 200,
      })
    );
    await openPersonaContext(adminPage);

    await adminPage.getByTestId('persona-context-version').click();
    const drawer = adminPage.getByTestId('persona-context-version-history');
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('No version history yet')).toBeVisible();
  });

  test('shows the truncated count in the preview stats', async ({
    adminPage,
  }) => {
    const personaId = persona.responseData.id as string;
    await mockPersonaContextApi(adminPage, personaId, [
      {
        entityType: EntityType.TABLE,
        id: RULE_ID,
        matchedCount: 142,
        maxAssets: 50,
        name: 'Semantic layer tables',
        sections: [ContextSection.Description],
      },
    ]);
    await adminPage.route('**/aiContext/document', (route) =>
      route.fulfill({
        body: JSON.stringify({
          ...createDocument(),
          truncated: true,
          truncatedCount: 7,
        }),
        contentType: 'application/json',
        status: 200,
      })
    );
    await openPersonaContext(adminPage);

    await adminPage.getByTestId('preview-persona-context').click();
    await expect(adminPage.getByRole('dialog')).toBeVisible();
    await expect(adminPage.getByText('7 truncated')).toBeVisible();
  });
});
