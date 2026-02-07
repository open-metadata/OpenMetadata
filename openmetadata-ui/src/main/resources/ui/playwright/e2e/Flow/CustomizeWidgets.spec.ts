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
import { test as base, expect, Page } from '@playwright/test';
import { SearchIndex } from '../../../src/enums/search.enum';
import { KPI_DATA } from '../../constant/dataInsight';
import { SidebarItem } from '../../constant/sidebar';
import { DataProduct } from '../../support/domain/DataProduct';
import { Domain } from '../../support/domain/Domain';
import { EntityDataClass } from '../../support/entity/EntityDataClass';
import { PersonaClass } from '../../support/persona/PersonaClass';
import { UserClass } from '../../support/user/UserClass';
import { performAdminLogin } from '../../utils/admin';
import { getApiContext, redirectToHomePage } from '../../utils/common';
import {
  addAndVerifyWidget,
  removeAndVerifyWidget,
  verifyWidgetEntityNavigation,
  verifyWidgetFooterViewMore,
  verifyWidgetHeaderNavigation,
} from '../../utils/customizeLandingPage';
import { addKpi, deleteKpiRequest } from '../../utils/dataInsight';
import { followEntity, waitForAllLoadersToDisappear } from '../../utils/entity';
import { sidebarClick } from '../../utils/sidebar';
import {
  verifyActivityFeedFilters,
  verifyDataFilters,
  verifyDataProductsFilters,
  verifyDomainsFilters,
  verifyTaskFilters,
  verifyTotalDataAssetsFilters,
} from '../../utils/widgetFilters';
import { PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ } from '../../constant/config';

const adminUser = new UserClass();
const persona = new PersonaClass();

// Test domain and data products for comprehensive testing
const testDomain = new Domain();
const testDataProducts = [
  new DataProduct([testDomain]),
  new DataProduct([testDomain]),
  new DataProduct([testDomain]),
];

const test = base.extend<{ page: Page }>({
  page: async ({ browser }, use) => {
    const page = await browser.newPage();
    await adminUser.login(page);
    await use(page);
    await page.close();
  },
});

test.beforeAll('Setup pre-requests', async ({ browser }) => {
  test.slow(true);

  const { afterAction, apiContext } = await performAdminLogin(browser);
  await adminUser.create(apiContext);
  await adminUser.setAdminRole(apiContext);
  await persona.create(apiContext, [adminUser.responseData.id]);

  // Set adminUser as owner for entities created by entityDetails config
  // Only domains and glossaries from entityDetails typically support owners
  const entitiesToPatch = [];

  // Since creationConfig has entityDetails: true, these entities are created:
  // domains, glossaries, users, teams, tags, classifications
  // Only domains and glossaries support ownership

  entitiesToPatch.push(
    { entity: EntityDataClass.domain1, endpoint: 'domains' },
    { entity: EntityDataClass.domain2, endpoint: 'domains' },
    { entity: EntityDataClass.glossary1, endpoint: 'glossaries' },
    { entity: EntityDataClass.glossary2, endpoint: 'glossaries' }
  );

  // Patch entities with owner in parallel
  const ownerPatchPromises = entitiesToPatch.map(
    async ({ entity, endpoint }) => {
      // Check for the appropriate id property based on entity type
      const entityId = (entity as Domain).responseData?.id;

      if (entityId) {
        try {
          await apiContext.patch(`/api/v1/${endpoint}/${entityId}`, {
            data: [
              {
                op: 'add',
                path: '/owners',
                value: [
                  {
                    id: adminUser.responseData.id,
                    type: 'user',
                  },
                ],
              },
            ],
            headers: {
              'Content-Type': 'application/json-patch+json',
            },
          });
        } catch {
          // Some entities may not support owners, skip silently
        }
      }
    }
  );

  await Promise.allSettled(ownerPatchPromises);

  // Create test domain first
  await testDomain.create(apiContext);

  // Create test data products
  for (const dp of testDataProducts) {
    await dp.create(apiContext);
  }

  // Delete all existing KPIs before running the test
  await deleteKpiRequest(apiContext);

  // Set default persona for admin user
  await apiContext.patch(`/api/v1/users/${adminUser.responseData.id}`, {
    data: [
      {
        op: 'add',
        path: '/defaultPersona',
        value: {
          id: persona.responseData.id,
          type: 'persona',
          name: persona.responseData.name,
          fullyQualifiedName: persona.responseData.fullyQualifiedName,
          description: persona.responseData.description,
          displayName: persona.responseData.displayName,
        },
      },
    ],
    headers: {
      'Content-Type': 'application/json-patch+json',
    },
  });

  await afterAction();
});

test.beforeEach(async ({ page }) => {
  await redirectToHomePage(page);
  await waitForAllLoadersToDisappear(page);
});

test('Activity Feed Widget', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, async ({ page }) => {
  test.slow(true);

  const widgetKey = 'KnowledgePanel.ActivityFeed';
  const widget = page.getByTestId(widgetKey);

  await waitForAllLoadersToDisappear(page);

  await expect(widget).toBeVisible();

  await test.step('Test widget header and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await verifyWidgetHeaderNavigation(
      page,
      widgetKey,
      'Activity Feed',
      `/users/${adminUser.responseData.name}/activity_feed/all`
    );
  });

  await test.step('Test widget filters', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyActivityFeedFilters(page, widgetKey);
  });

  await test.step('Test widget footer navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyWidgetFooterViewMore(page, {
      widgetKey,
      link: `/users/${adminUser.responseData.name}/activity_feed/all`,
    });

    await redirectToHomePage(page);
  });

  await test.step('Test widget customization', async () => {
    await waitForAllLoadersToDisappear(page);
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});

test('Data Assets Widget', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, async ({ page }) => {
  test.slow(true);

  const widgetKey = 'KnowledgePanel.DataAssets';
  const widget = page.getByTestId(widgetKey);

  await waitForAllLoadersToDisappear(page);

  await expect(widget).toBeVisible();

  await test.step('Test widget header and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await verifyWidgetHeaderNavigation(
      page,
      widgetKey,
      'Data Assets',
      '/explore'
    );
  });

  await test.step('Test widget displays entities and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    // Data Assets widget needs special handling for multiple search indexes
    const searchIndex = SearchIndex.DATA_ASSET;

    await verifyWidgetEntityNavigation(page, {
      widgetKey,
      entitySelector: '[data-testid^="data-asset-service-"]',
      urlPattern: '/explore',
      verifyElement: '[data-testid="explore-page"]',
      apiResponseUrl: '/api/v1/search/query',
      searchQuery: searchIndex,
    });
  });

  await test.step('Test widget footer navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyWidgetFooterViewMore(page, {
      widgetKey,
      link: 'explore',
    });

    await redirectToHomePage(page);
  });

  await test.step('Test widget customization', async () => {
    await waitForAllLoadersToDisappear(page);
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});

test('My Data Widget', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, async ({ page }) => {
  test.slow(true);

  const widgetKey = 'KnowledgePanel.MyData';
  const widget = page.getByTestId(widgetKey);

  await waitForAllLoadersToDisappear(page);

  await expect(widget).toBeVisible();

  await test.step('Test widget header and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await verifyWidgetHeaderNavigation(
      page,
      widgetKey,
      'My Data',
      `/users/${adminUser.responseData.name}/mydata`
    );
  });

  await test.step('Test widget filters', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyDataFilters(page, widgetKey);
  });

  await test.step('Test widget displays entities and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyWidgetEntityNavigation(page, {
      widgetKey,
      entitySelector: '[data-testid^="My-Data-"]',
      urlPattern: '/', // My Data can navigate to various entity types
      apiResponseUrl: '/api/v1/search/query',
      searchQuery: `index=${SearchIndex.ALL}`,
    });
  });

  await test.step('Test widget footer navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    // My Data footer navigates to explore with owner filter
    await verifyWidgetFooterViewMore(page, {
      widgetKey,
      link: 'explore',
    });

    await redirectToHomePage(page);
  });

  await test.step('Test widget customization', async () => {
    await waitForAllLoadersToDisappear(page);
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});

test('KPI Widget', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, async ({ page }) => {
  test.slow(true);

  await test.step('Add KPI', async () => {
    await waitForAllLoadersToDisappear(page);

    await sidebarClick(page, SidebarItem.DATA_INSIGHT);
    await page.getByRole('menuitem', { name: 'KPIs' }).click();

    await page.getByTestId('add-kpi-btn').click();
    await addKpi(page, KPI_DATA[1]);
  });

  await redirectToHomePage(page);

  await waitForAllLoadersToDisappear(page);

  const widgetKey = 'KnowledgePanel.KPI';
  const widget = page.getByTestId(widgetKey);

  await expect(widget).toBeVisible();

  await test.step('Test widget header and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await verifyWidgetHeaderNavigation(
      page,
      widgetKey,
      'KPI',
      '/data-insights/kpi'
    );
  });

  await test.step('Test widget footer navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyWidgetFooterViewMore(page, {
      widgetKey,
      link: 'data-insights/kpi',
    });

    await redirectToHomePage(page);
  });

  await test.step('Test widget loads KPI data correctly', async () => {
    // Wait for the KPI list API to be called
    const kpiListResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/kpi') &&
        response.url().includes('fields=dataInsightChart')
    );

    // Wait for KPI results API to be called
    const kpiResultsResponse = page.waitForResponse(
      (response) =>
        response.url().includes('/api/v1/kpi/') &&
        response.url().includes('/kpiResult')
    );

    await waitForAllLoadersToDisappear(page);

    const widget = page.getByTestId(widgetKey);

    await expect(widget).toBeVisible();

    await kpiListResponse;
    await kpiResultsResponse;

    // Wait for skeleton loader to disappear
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

    // Check if the KPI widget content is visible
    const kpiWidgetContent = widget.locator('[data-testid="kpi-widget"]');

    await expect(kpiWidgetContent).toBeVisible();

    // Check if there's either a chart or empty state
    const hasChart = await widget
      .locator('.recharts-responsive-container')
      .isVisible()
      .catch(() => false);

    const hasEmptyState = await widget
      .locator('[data-testid="widget-empty-state"]')
      .isVisible()
      .catch(() => false);

    expect(hasChart || hasEmptyState).toBeTruthy();

    if (hasChart) {
      // If chart exists, verify it's rendered properly
      await expect(
        widget.locator('.recharts-responsive-container')
      ).toBeVisible();

      // Verify chart elements are present
      await expect(widget.locator('.recharts-area')).toBeVisible();
    }
  });

  await test.step('Test widget customization', async () => {
    await waitForAllLoadersToDisappear(page);
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});

test('Total Data Assets Widget', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, async ({ page }) => {
  test.slow(true);

  const widgetKey = 'KnowledgePanel.TotalAssets';
  const widget = page.getByTestId(widgetKey);

  // Wait for the widgets data to appear
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

  await expect(widget).toBeVisible();

  await test.step('Test widget header and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await verifyWidgetHeaderNavigation(
      page,
      widgetKey,
      'Total Data Assets',
      '/data-insights'
    );
  });

  await test.step('Test widget filters', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyTotalDataAssetsFilters(page, widgetKey);
  });

  await test.step('Test widget footer navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyWidgetFooterViewMore(page, {
      widgetKey,
      link: 'data-insights',
    });

    await redirectToHomePage(page);
  });

  await test.step('Test widget customization', async () => {
    await waitForAllLoadersToDisappear(page);
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});

test('Following Assets Widget', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, async ({ page }) => {
  test.slow(true);

  await testDomain.visitEntityPage(page);
  await waitForAllLoadersToDisappear(page);

  await followEntity(page, testDomain.endpoint);

  await redirectToHomePage(page);
  // wait for the page loader to disappear
  await waitForAllLoadersToDisappear(page);

  const widgetKey = 'KnowledgePanel.Following';
  const widget = page.getByTestId(widgetKey);

  // Wait for the widgets data to appear
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

  await expect(widget).toBeVisible();

  await test.step('Test widget header and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await verifyWidgetHeaderNavigation(
      page,
      widgetKey,
      'Following',
      `/users/${adminUser.responseData.name}/following`
    );
  });

  await test.step('Test widget filters', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyDataFilters(page, widgetKey);
  });

  await test.step('Test widget displays followed entities', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    // Verify that followed entities appear in the widget
    await verifyWidgetEntityNavigation(page, {
      widgetKey,
      entitySelector: '[data-testid^="Following-"]',
      urlPattern: '/', // Following can navigate to various entity types
      apiResponseUrl: '/api/v1/search/query',
      searchQuery: `index=${SearchIndex.ALL}`,
    });
  });

  await test.step('Test widget footer navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    // Following footer navigates to explore with following filter
    await verifyWidgetFooterViewMore(page, {
      widgetKey,
      link: 'explore',
    });

    await redirectToHomePage(page);
  });

  await test.step('Test widget customization', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});

test('Domains Widget', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, async ({ page }) => {
  test.slow(true);

  const widgetKey = 'KnowledgePanel.Domains';
  const widget = page.getByTestId(widgetKey);

  await waitForAllLoadersToDisappear(page);

  await expect(widget).not.toBeVisible();

  await test.step('Add widget', async () => {
    await waitForAllLoadersToDisappear(page);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });

  await test.step('Test widget header and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await verifyWidgetHeaderNavigation(page, widgetKey, 'Domains', '/domain');
  });

  await test.step('Test widget filters', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyDomainsFilters(page, widgetKey);
  });

  await test.step('Test widget displays entities and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await verifyWidgetEntityNavigation(page, {
      widgetKey,
      entitySelector: '[data-testid^="domain-card-"]',
      urlPattern: '/domain',
      apiResponseUrl: '/api/v1/search/query',
      searchQuery: `index=${SearchIndex.DOMAIN}`,
    });
  });

  await test.step('Test widget footer navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyWidgetFooterViewMore(page, {
      widgetKey,
      link: 'domain',
    });
  });

  await test.step('Remove widget', async () => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});

test('My Tasks Widget', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, async ({ page }) => {
  test.slow(true);

  await test.step('Create a task', async () => {
    const { apiContext, afterAction } = await getApiContext(page);
    const glossary1 = EntityDataClass.glossary1;
    await apiContext.post('/api/v1/feed', {
      data: {
        from: 'admin',
        message: `Update description for glossary ${glossary1.responseData.displayName}`,
        about: `<#E::glossary::${glossary1.responseData.fullyQualifiedName}::description>`,
        taskDetails: {
          assignees: [
            {
              id: adminUser.responseData.id,
              type: 'user',
            },
          ],
          suggestion: '<p>Test task description for My Tasks widget test</p>',
          type: 'UpdateDescription',
          oldValue: '',
        },
        type: 'Task',
      },
    });

    await afterAction();
  });

  // Navigate back to home to test the widget
  await redirectToHomePage(page);
  await waitForAllLoadersToDisappear(page);

  const widgetKey = 'KnowledgePanel.MyTask';
  const widget = page.getByTestId(widgetKey);

  await expect(widget).not.toBeVisible();

  await test.step('Add widget', async () => {
    await waitForAllLoadersToDisappear(page);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });

  await test.step('Test widget header and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await verifyWidgetHeaderNavigation(
      page,
      widgetKey,
      'My Tasks',
      `/users/${adminUser.responseData.name}/task`
    );
  });

  await test.step('Test widget filters', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyTaskFilters(page, widgetKey);
  });

  await test.step('Test widget displays entities and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyWidgetEntityNavigation(page, {
      widgetKey,
      entitySelector:
        '[data-testid="task-feed-card"] [data-testid="redirect-task-button-link"]',
      urlPattern: '/glossary', // Tasks can navigate to various entity detail pages
      apiResponseUrl: '/api/v1/feed',
      searchQuery: 'type=Task', // My Tasks uses feed API with type=Task
    });
  });

  await test.step('Remove widget', async () => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});

test('Data Products Widget', PLAYWRIGHT_SAMPLE_DATA_TAG_OBJ, async ({ page }) => {
  test.slow(true);

  const widgetKey = 'KnowledgePanel.DataProducts';
  const widget = page.getByTestId(widgetKey);

  await waitForAllLoadersToDisappear(page);

  await expect(widget).not.toBeVisible();

  await test.step('Add widget', async () => {
    await waitForAllLoadersToDisappear(page);
    await addAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });

  await test.step('Test widget header and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await verifyWidgetHeaderNavigation(
      page,
      widgetKey,
      'Data Products',
      '/explore?tab=data_product'
    );
  });

  await test.step('Test widget filters', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyDataProductsFilters(page, widgetKey);
  });

  await test.step('Test widget displays entities and navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyWidgetEntityNavigation(page, {
      widgetKey,
      entitySelector: '[data-testid^="data-product-card-"]',
      urlPattern: '/dataProduct',
      apiResponseUrl: '/api/v1/search/query',
      searchQuery: `index=${SearchIndex.DATA_PRODUCT}`,
    });
  });

  await test.step('Test widget footer navigation', async () => {
    await waitForAllLoadersToDisappear(page);
    await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
    await verifyWidgetFooterViewMore(page, {
      widgetKey,
      link: '/explore',
    });
  });

  await test.step('Remove widget', async () => {
    await redirectToHomePage(page);
    await waitForAllLoadersToDisappear(page);
    await removeAndVerifyWidget(page, widgetKey, persona.responseData.name);
  });
});