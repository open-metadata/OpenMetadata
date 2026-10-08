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
import { Page, Response } from '@playwright/test';
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
import { waitForResponseWithStatus } from '../../utils/waitHelpers';
import {
  selectTopicCardFilterOption,
  verifyDataProductsFilters,
} from '../../utils/widgetFilters';

let adminUser: UserClass;

// Test domain and data products for comprehensive testing
let testDomain: Domain;
let testDataProducts: DataProduct[] = [];

// Seed tables for the Team Activity and Data Quality cards. Each test makes
// its own per-test user the owner before seeding: Team Activity reads
// `/activity/my-feed`, which only returns events on assets the viewer (or one
// of their teams) owns, and the Data Quality card is narrowed to "My data" so
// its rows are this test's failures rather than the newest ones server-wide.
let activitySeedTable: TableClass;
let dataQualitySeedTable: TableClass;

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
  dataQualitySeedTable = new TableClass();
  await settleAll([
    activitySeedTable.create(apiContext),
    dataQualitySeedTable.create(apiContext),
  ]);

  await afterAction();
});

test.afterAll('Cleanup: delete the seed tables', async ({ browser }) => {
  const { afterAction, apiContext } = await performAdminLogin(browser);

  try {
    await settleAll([
      activitySeedTable.delete(apiContext),
      dataQualitySeedTable.delete(apiContext),
    ]);
  } finally {
    await afterAction();
  }
});

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
test('Activity Feed Widget', async ({ browser, page, persona, testUser }) => {
  test.slow(true);

  const widgetKey = 'KnowledgePanel.ActivityFeed';
  const activitySummary = `Customize widgets activity ${uuid()}`;

  await test.step('Seed activity on a table the user owns', async () => {
    const { apiContext, afterAction } = await performAdminLogin(browser);

    try {
      // Owner first: `my-feed` is scoped to assets the viewer owns, so an
      // event on an unowned table never reaches the card.
      await activitySeedTable.setOwner(apiContext, {
        id: testUser.responseData.id,
        type: 'user',
      });
      await insertActivityEventForTest(
        apiContext,
        activitySeedTable,
        activitySummary
      );
    } finally {
      await afterAction();
    }

    // The card read the feed when beforeEach landed; load it again so it
    // reads the seeded event.
    await redirectToHomePage(page);
  });

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
    const widget = await waitForLandingPageWidget(page, widgetKey);

    // Pinned to the seeded table rather than to a non-empty list: the feed
    // holds whatever else the user's assets saw, so a row count alone would
    // pass on somebody else's activity.
    await expect(
      widget
        .getByTestId('team-activity-rows')
        .getByText(activitySeedTable.entityResponseData.name)
    ).toBeVisible();
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
    // The row names the KPI the way a reader set it up: its display name.
    await expect(kpiRow).toContainText(kpi.displayName ?? kpi.name);
  });

  // The range is the window each KPI's results are read over, so switching it
  // has to re-read them over the new span rather than relabel the old one.
  await test.step('Test widget range filter re-reads the window', async () => {
    const widget = await waitForLandingPageWidget(page, widgetKey);
    const ninetyDayResults = waitForResponseWithStatus(
      page,
      (response) => {
        const url = new URL(response.url());

        return (
          response.request().method() === 'GET' &&
          url.pathname ===
            `/api/v1/kpi/${encodeURIComponent(
              kpi.fullyQualifiedName
            )}/kpiResult` &&
          Number(url.searchParams.get('endTs')) -
            Number(url.searchParams.get('startTs')) ===
            90 * 24 * 60 * 60 * 1000
        );
      },
      200
    );

    await selectTopicCardFilterOption(page, widget, 'kpi-window-filter', '90');
    await ninetyDayResults;

    await expect(widget.getByTestId('kpi-window-filter')).toContainText(
      'Last 90 days'
    );
    await expect(widget.getByTestId(`kpi-${kpi.id}`)).toBeVisible();
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

test('Data Quality Widget', async ({ browser, page, persona, testUser }) => {
  test.slow(true);

  const widgetKey = 'KnowledgePanel.DataQuality';

  // The card only lists failing tests, so the test seeds one: a table the
  // user owns, a test case on it, and a failed result.
  const testCase =
    await test.step('Seed a failing test the user owns', async () => {
      const { apiContext, afterAction } = await performAdminLogin(browser);

      try {
        await dataQualitySeedTable.setOwner(apiContext, {
          id: testUser.responseData.id,
          type: 'user',
        });
        const created = await dataQualitySeedTable.createTestCase(apiContext);
        await dataQualitySeedTable.addTestCaseResult(
          apiContext,
          created.fullyQualifiedName ?? '',
          {
            result: 'Failed (landing page widget fixture)',
            testCaseStatus: 'Failed',
            timestamp: Date.now(),
          }
        );

        // The card reads the search index, which lags the write. Gate on the
        // exact query "My data" sends so the first UI read is already final.
        await expect
          .poll(
            async () => {
              const response = await apiContext.get(
                '/api/v1/dataQuality/testCases/search/list',
                {
                  params: {
                    includeAllTests: true,
                    limit: 50,
                    owner: testUser.responseData.name,
                    q: '*',
                    testCaseStatus: 'Failed',
                  },
                }
              );
              const body = await okJson<{ data: { id: string }[] }>(
                response,
                'Owned failing tests'
              );

              return body.data.map((item) => item.id);
            },
            { timeout: 60_000, intervals: [1_000, 2_000, 5_000] }
          )
          .toContain(created.id);

        return created as typeof created & { id: string; name: string };
      } finally {
        await afterAction();
      }
    });

  const isFailedTestsResponse = (response: Response) => {
    const url = new URL(response.url());

    return (
      response.request().method() === 'GET' &&
      url.pathname === '/api/v1/dataQuality/testCases/search/list' &&
      url.searchParams.get('testCaseStatus') === 'Failed'
    );
  };

  await redirectToHomePage(page);
  const widget = await waitForLandingPageWidget(page, widgetKey);

  await test.step('Scope to My data lists the seeded failure', async () => {
    const mineResponse = waitForResponseWithStatus(
      page,
      (response) =>
        isFailedTestsResponse(response) &&
        new URL(response.url()).searchParams.get('owner') ===
          testUser.responseData.name,
      200
    );

    await selectTopicCardFilterOption(page, widget, 'dq-scope-filter', 'mine');
    await mineResponse;

    await expect(widget.getByTestId('dq-scope-filter')).toContainText(
      'My Data'
    );
    await expect(widget.getByTestId('data-quality-rows')).toBeVisible();
    await expect(
      widget.getByTestId(`failed-test-${testCase.id}`)
    ).toContainText(testCase.name);
  });

  await test.step('Widening the range refetches the 30-day window', async () => {
    const thirtyDayResponse = waitForResponseWithStatus(
      page,
      (response) => {
        const url = new URL(response.url());

        return (
          isFailedTestsResponse(response) &&
          Number(url.searchParams.get('endTimestamp')) -
            Number(url.searchParams.get('startTimestamp')) ===
            30 * 24 * 60 * 60 * 1000
        );
      },
      200
    );

    await selectTopicCardFilterOption(page, widget, 'dq-range-filter', '30');
    const response = await thirtyDayResponse;
    const url = new URL(response.url());

    // Scope survives the range change, and the window ends now.
    expect(url.searchParams.get('owner')).toBe(testUser.responseData.name);
    expect(
      Math.abs(Number(url.searchParams.get('endTimestamp')) - Date.now())
    ).toBeLessThan(5 * 60 * 1000);

    await expect(widget.getByTestId('dq-range-filter')).toContainText(
      'Last 30 days'
    );
    await expect(
      widget.getByTestId(`failed-test-${testCase.id}`)
    ).toBeVisible();
  });

  await test.step('View test opens the test case page', async () => {
    await widget.getByTestId(`dq-view-test-${testCase.id}`).click();

    await expect
      .poll(() => decodeURIComponent(new URL(page.url()).pathname))
      .toContain(`/test-case/${testCase.fullyQualifiedName}`);
  });

  await test.step('Test widget customization', async () => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});
