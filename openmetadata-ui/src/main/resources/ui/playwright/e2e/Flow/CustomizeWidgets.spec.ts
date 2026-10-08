/*
 *  Copyright 2025 Collate.
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
import { KPI_DATA } from '../../constant/dataInsight';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { TableClass } from '../../support/entity/TableClass';
import { expect, test as base } from '../../support/fixtures/base';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { insertActivityEventForTest } from '../../utils/activityAPI';
import { performAdminLogin } from '../../utils/admin';
import { okJson, settleAll } from '../../utils/apiResponse';
import { getApiContext, redirectToHomePage, uuid } from '../../utils/common';
import {
  addAndVerifyWidget,
  removeAndVerifyWidget,
  verifyWidgetTitleAndNavigation,
  waitForLandingPageWidget,
} from '../../utils/customizeLandingPage';
import {
  addKpi,
  deleteKpiRequest,
  deleteSeededKpisOnChart,
} from '../../utils/dataInsight';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';
import { verifyDataProductsFilters } from '../../utils/widgetFilters';

let adminUser: UserClass;

// Test domain and data products for comprehensive testing
let testDomain: Domain;
let testDataProducts: DataProduct[] = [];

// The Activity Feed widget only renders its "View More" link once the feed
// exceeds PAGE_SIZE_BASE (15), so the footer step seeds one more than that
// rather than depending on whatever activity the database happens to hold.
let activitySeedTable: TableClass;
const FEED_WIDGET_PAGE_SIZE = 15;
const SEEDED_ACTIVITY_COUNT = FEED_WIDGET_PAGE_SIZE + 1;

type WidgetTestFixtures = {
  page: Page;
  testUser: UserClass;
  persona: PersonaClass;
  kpiIds: string[];
};

// Issue #31407. Every test here rewrites the whole `persona.<name>` layout document
// (remove widget -> save -> add widget -> save). Those saves are last-write-wins,
// so under `fullyParallel` two tests sharing a persona silently drop each other's
// widgets and a later test finds its widget missing from the landing page. The
// user has to be per test as well: the layout is resolved from
// `currentUser.defaultPersona`, which is a single field on the user.
const test = base.extend<WidgetTestFixtures>({
  kpiIds: async ({ page }, use) => {
    const ids: string[] = [];
    await use(ids);

    const { apiContext, afterAction } = await getApiContext(page);
    try {
      await deleteKpiRequest(apiContext, ids);
    } finally {
      await afterAction();
    }
  },
  testUser: async ({ browser }, use) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const user = new UserClass();
    await user.create(apiContext);
    await user.setAdminRole(apiContext);
    await afterAction();

    await use(user);

    const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
      await performAdminLogin(browser);
    await user.delete(cleanupContext);
    await cleanupAfterAction();
  },

  persona: async ({ browser, testUser }, use) => {
    const { apiContext, afterAction } = await performAdminLogin(browser);
    const testPersona = new PersonaClass();
    await testPersona.create(apiContext, [testUser.responseData.id]);

    const personaReference = {
      id: testPersona.responseData.id,
      type: 'persona',
      name: testPersona.responseData.name,
      fullyQualifiedName: testPersona.responseData.fullyQualifiedName,
      description: testPersona.responseData.description,
      displayName: testPersona.responseData.displayName,
    };

    await apiContext.patch(`/api/v1/users/${testUser.responseData.id}`, {
      data: [
        { op: 'add', path: '/personas/0', value: personaReference },
        { op: 'add', path: '/defaultPersona', value: personaReference },
      ],
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    });
    await afterAction();

    await use(testPersona);

    const { apiContext: cleanupContext, afterAction: cleanupAfterAction } =
      await performAdminLogin(browser);
    await testPersona.delete(cleanupContext);
    await cleanupAfterAction();
  },

  page: async ({ browser, testUser, persona }, use) => {
    // `persona` is depended on for its side effect - the default persona has to
    // be attached to the user before login, otherwise the session starts with
    // the stock layout instead of the persona's customizable one.
    void persona;

    const page = await browser.newPage();
    await testUser.signIn(page);
    await use(page);
    await page.close();
  },
});

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  test.slow(true);

  adminUser = new UserClass();
  testDomain = new Domain();
  testDataProducts = [
    new DataProduct([testDomain]),
    new DataProduct([testDomain]),
    new DataProduct([testDomain]),
  ];

  const { afterAction, apiContext } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);

  await settleAll(
    [
      { entity: EntityDataClass.domain1, endpoint: 'domains' },
      { entity: EntityDataClass.domain2, endpoint: 'domains' },
      { entity: EntityDataClass.glossary1, endpoint: 'glossaries' },
      { entity: EntityDataClass.glossary2, endpoint: 'glossaries' },
    ].map(async ({ entity, endpoint }) => {
      const entityId = entity.responseData.id;
      if (!entityId) {
        throw new Error(
          'Widget fixture is missing its ' + endpoint + ' entity ID'
        );
      }
      const response = await apiContext.patch(
        '/api/v1/' + endpoint + '/' + entityId,
        {
          data: [
            {
              op: 'add',
              path: '/owners',
              value: [{ id: adminUser.responseData.id, type: 'user' }],
            },
          ],
          headers: { 'Content-Type': 'application/json-patch+json' },
        }
      );
      await okJson(
        response,
        'Widget fixture owner for ' + endpoint + '/' + entityId
      );
    })
  );

  // Create test domain first
  await testDomain.create(apiContext);

  // Create test data products
  for (const dp of testDataProducts) {
    await dp.create(apiContext);
  }

  activitySeedTable = new TableClass();
  await activitySeedTable.create(apiContext);

  for (let index = 0; index < SEEDED_ACTIVITY_COUNT; index++) {
    await insertActivityEventForTest(
      apiContext,
      activitySeedTable,
      `Customize widgets activity ${index}`
    );
  }

  await afterAction();
});

test.afterAll(
  'Cleanup: delete the activity seed table',
  async ({ browser }) => {
    const { afterAction, apiContext } = await performAdminLogin(browser);

    try {
      await activitySeedTable.delete(apiContext);
    } finally {
      await afterAction();
    }
  }
);

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
  await waitForAllLoadersToDisappear(page);
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
});

// The landing page's widgets are topic cards now. Five of the nine suites that
// used to live here -- My Data, Data Assets, Total Data Assets, Following
// Assets and My Tasks -- covered widgets `getExcludedWidgetFqns` keeps out of
// both the grid and the Add Widgets picker, so there is nothing left for them
// to drive. What a card still offers is a title, a footer link out, and
// removal/re-adding from the persona editor; that is what the four below check.
test('Activity Feed Widget', async ({ page, persona, testUser }) => {
  test.slow(true);

  const widgetKey = 'KnowledgePanel.ActivityFeed';

  await waitForAllLoadersToDisappear(page);

  await waitForLandingPageWidget(page, widgetKey);

  await test.step('Test widget title and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await verifyWidgetTitleAndNavigation(
      page,
      widgetKey,
      'Team Activity',
      `/users/${testUser.responseData.name}/activity_feed`
    );
  });

  await test.step('Test widget displays activity', async () => {
    await waitForAllLoadersToDisappear(page);
    const widget = await waitForLandingPageWidget(page, widgetKey);

    await expect(widget.getByTestId('team-activity-rows')).toBeVisible();
  });

  await test.step('Test widget customization', async () => {
    await waitForAllLoadersToDisappear(page);
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});

test('KPI Widget', async ({ page, persona, kpiIds }) => {
  test.slow(true);

  const kpi = await test.step('Add KPI', async () => {
    const { apiContext, afterAction } = await getApiContext(page);
    try {
      await deleteSeededKpisOnChart(apiContext, 'owner');
    } finally {
      await afterAction();
    }

    await waitForAllLoadersToDisappear(page);

    await sidebarClick(page, SidebarItem.DATA_INSIGHT);
    await page.getByRole('menuitem', { name: 'KPIs' }).click();

    await page.getByTestId('add-kpi-btn').click();
    const createdKpi = await addKpi(page, {
      ...KPI_DATA[1],
      displayName: `Widget Owner ${uuid()}`,
    });
    kpiIds.push(createdKpi.id);

    return createdKpi;
  });

  await redirectToHomePage(page);

  await waitForAllLoadersToDisappear(page);

  const widgetKey = 'KnowledgePanel.KPI';

  await waitForLandingPageWidget(page, widgetKey);

  await test.step('Test widget title and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await verifyWidgetTitleAndNavigation(
      page,
      widgetKey,
      'Key Performance Indicators',
      '/data-insights/kpi'
    );
  });

  await test.step('Test widget loads KPI data correctly', async () => {
    const kpiListResponse = page.waitForResponse((response) => {
      const url = new URL(response.url());

      return (
        response.request().method() === 'GET' &&
        url.pathname === '/api/v1/kpi' &&
        url.searchParams.get('fields') === 'dataInsightChart'
      );
    });

    const kpiResultsResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        new URL(response.url()).pathname ===
          `/api/v1/kpi/${encodeURIComponent(kpi.fullyQualifiedName)}/kpiResult`
    );

    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);

    const widget = await waitForLandingPageWidget(page, widgetKey);

    const list = await okJson<{ data: { id: string }[] }>(
      await kpiListResponse,
      'Widget KPI list'
    );
    expect(list.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: kpi.id })])
    );
    const results = await okJson<{ results: unknown[] }>(
      await kpiResultsResponse,
      `Widget results for ${kpi.fullyQualifiedName}`
    );
    expect(results.results.length).toBeGreaterThan(0);

    // Wait for skeleton loader to disappear
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

    // The card lists one progress row per KPI rather than plotting a single
    // chart, so the KPI having a row of its own is what proves it was read.
    await expect(widget.getByTestId('kpi-rows')).toBeVisible();

    const kpiRow = widget.getByTestId(`kpi-${kpi.id}`);

    await expect(kpiRow).toBeVisible();
    await expect(kpiRow).toContainText(kpi.name);
  });

  await test.step('Test widget customization', async () => {
    await waitForAllLoadersToDisappear(page);
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});

test('Domains Widget', async ({ page, persona }) => {
  test.slow(true);

  const widgetKey = 'KnowledgePanel.Domains';

  await waitForAllLoadersToDisappear(page);

  // Domains is part of the default layout now, so the flow is the reverse of
  // what it was: the card is already there, and what has to work is taking it
  // out of the persona layout and putting it back.
  await waitForLandingPageWidget(page, widgetKey);

  await test.step('Test widget title and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await verifyWidgetTitleAndNavigation(page, widgetKey, 'Domains', '/domain');
  });

  await test.step('Test widget displays domains', async () => {
    await waitForAllLoadersToDisappear(page);
    const widget = await waitForLandingPageWidget(page, widgetKey);

    await expect(widget.getByTestId('domain-rows')).toBeVisible();
  });

  await test.step('Test widget customization', async () => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});

test('Data Products Widget', async ({ page, persona }) => {
  test.slow(true);

  const widgetKey = 'KnowledgePanel.DataProducts';

  await waitForAllLoadersToDisappear(page);

  // Default-layout widget, same as Domains — present first, removed and
  // re-added after.
  await waitForLandingPageWidget(page, widgetKey);

  await test.step('Test widget title and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await verifyWidgetTitleAndNavigation(
      page,
      widgetKey,
      'Data Products',
      '/dataProduct'
    );
  });

  await test.step('Test widget sort filter', async () => {
    await waitForAllLoadersToDisappear(page);
    await verifyDataProductsFilters(page, widgetKey);
  });

  await test.step('Test widget displays data products', async () => {
    await waitForAllLoadersToDisappear(page);
    const widget = await waitForLandingPageWidget(page, widgetKey);

    await expect(widget.getByTestId('data-product-rows')).toBeVisible();
  });

  await test.step('Test widget customization', async () => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});

// Ported from Collate's `LandingPageWidgets.spec.ts`: both cards moved into OSS
// with the landing-page migration, so their lifecycle belongs beside the other
// default-layout widgets rather than in a downstream suite.
test('Context Center Widget', async ({ page, persona }) => {
  test.slow(true);

  // The card is Context Center; the key is the Knowledge Center one it kept.
  const widgetKey = 'KnowledgePanel.KnowledgeCenter';

  await waitForAllLoadersToDisappear(page);
  await waitForLandingPageWidget(page, widgetKey);

  await test.step('Test widget customization', async () => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});

test('Data Quality Widget', async ({ page, persona }) => {
  test.slow(true);

  const widgetKey = 'KnowledgePanel.DataQuality';

  await waitForAllLoadersToDisappear(page);
  await waitForLandingPageWidget(page, widgetKey);

  await test.step('Test widget displays test results', async () => {
    await waitForAllLoadersToDisappear(page);
    const widget = await waitForLandingPageWidget(page, widgetKey);

    await expect(widget.getByTestId('data-quality-rows')).toBeVisible();
  });

  await test.step('Test widget customization', async () => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});
