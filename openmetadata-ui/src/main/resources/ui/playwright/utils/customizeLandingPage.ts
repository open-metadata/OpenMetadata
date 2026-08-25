/*
 *  Copyright 2024 Collate.
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
import { expect, type Locator, type Page } from '@playwright/test';
import {
  redirectToHomePage,
  toastNotification,
  visitOwnProfilePage,
} from './common';
import { waitForAllLoadersToDisappear } from './entity';

const DEFAULT_LANDING_PAGE_WIDGETS = [
  'KnowledgePanel.ActivityFeed',
  'KnowledgePanel.DataAssets',
  'KnowledgePanel.MyData',
  'KnowledgePanel.KPI',
  'KnowledgePanel.TotalAssets',
  'KnowledgePanel.Following',
];

export const CURATED_ASSETS_WIDGET_KEY = 'KnowledgePanel.CuratedAssets';

export type NameableEntityResponse = {
  name?: string;
  displayName?: string;
};

// Landing-page widgets render inside `DeferredWidget`
// (src/components/common/DeferredWidget): the slot div mounts eagerly carrying a
// `deferred-widget-<layoutKey>` testid, while the widget itself mounts only once that slot
// intersects the viewport. A below-the-fold widget therefore has no DOM node at all.
//
// The slot is keyed by the *layout* key, which is not always the widget key: widgets added
// through the "Add widget" modal get a lodash `uniqueId` suffix (`getAddWidgetHandler` in
// CustomizableLandingPagePureUtils), e.g. `KnowledgePanel.MyData-211`, whereas the widget
// always renders the un-suffixed key as its own testid. So the slot has to be matched by
// prefix — the trailing `-` keeps it unambiguous, as no widget key is a `-`-suffixed
// extension of another.
const getLandingPageWidgetSlot = (page: Page, widgetKey: string) =>
  page
    .locator(
      `[data-testid="deferred-widget-${widgetKey}"], [data-testid^="deferred-widget-${widgetKey}-"]`
    )
    .first();

const revealLandingPageWidget = async (page: Page, widgetKey: string) => {
  const slot = getLandingPageWidgetSlot(page, widgetKey);

  // Scroll failures are tolerated on both branches: `isLandingPageWidgetVisible` runs inside
  // `expect.poll` callbacks, and Playwright's `pollMatcher` invokes the callback outside its
  // try/catch — a throw here aborts the poll with no retry instead of riding out a transient
  // detach. The `count()` guards are what prevent a stall; the caller's visibility assertion,
  // not the scroll, is what decides whether the widget is really there.
  if ((await slot.count()) > 0) {
    await slot.scrollIntoViewIfNeeded().catch(() => undefined);

    return;
  }

  // The customize-page edit view renders widgets without a deferred slot. Only scroll a
  // widget that is already attached — scrolling a locator that resolves to nothing stalls
  // for the full action timeout and starves the caller's own waiting.
  const widget = page.getByTestId(widgetKey);

  if ((await widget.count()) > 0) {
    await widget.scrollIntoViewIfNeeded().catch(() => undefined);
  }
};

// Entity types mapping from CURATED_ASSETS_LIST
export const ENTITY_TYPE_CONFIGS = [
  {
    name: 'Table',
    index: 'table',
    displayName: 'Tables',
    searchTerm: 'Table',
  },
  {
    name: 'Dashboard',
    index: 'dashboard',
    displayName: 'Dashboards',
    searchTerm: 'Dashboard',
  },
  {
    name: 'Pipeline',
    index: 'pipeline',
    displayName: 'Pipelines',
    searchTerm: 'Pipeline',
  },
  {
    name: 'Topic',
    index: 'topic',
    displayName: 'Topics',
    searchTerm: 'Topic',
  },
  {
    name: 'ML Model',
    index: 'mlmodel',
    displayName: 'ML Model',
    searchTerm: 'ML',
  },
  {
    name: 'Container',
    index: 'container',
    displayName: 'Containers',
    searchTerm: 'Container',
  },
  {
    name: 'Search Index',
    index: 'searchIndex',
    displayName: 'Search Indexes',
    searchTerm: 'Search',
  },
  {
    name: 'Chart',
    index: 'chart',
    displayName: 'Charts',
    searchTerm: 'Chart',
  },
  {
    name: 'Stored Procedure',
    index: 'storedProcedure',
    displayName: 'Stored Procedures',
    searchTerm: 'Stored',
  },
  {
    name: 'Data Model',
    index: 'dashboardDataModel',
    displayName: 'Data Model',
    searchTerm: 'Data',
  },
  {
    name: 'Glossary Term',
    index: 'glossaryTerm',
    displayName: 'Glossary Terms',
    searchTerm: 'Glossary',
  },
  {
    name: 'Metric',
    index: 'metric',
    displayName: 'Metrics',
    searchTerm: 'Metric',
  },
  {
    name: 'Database',
    index: 'database',
    displayName: 'Databases',
    searchTerm: 'Database',
  },
  {
    name: 'Database Schema',
    index: 'databaseSchema',
    displayName: 'Database Schemas',
    searchTerm: 'Database',
  },
  {
    name: 'API Collection',
    index: 'apiCollection',
    displayName: 'API Collections',
    searchTerm: 'API',
  },
  {
    name: 'API Endpoint',
    index: 'apiEndpoint',
    displayName: 'API Endpoints',
    searchTerm: 'API',
  },
  {
    name: 'Data Product',
    index: 'dataProduct',
    displayName: 'Data Products',
    searchTerm: 'Data',
  },
  {
    name: 'Knowledge Page',
    index: 'page',
    displayName: 'Knowledge Pages',
    searchTerm: 'Knowledge',
  },
];

export const navigateToCustomizeLandingPage = async (
  page: Page,
  { personaName }: { personaName: string }
) => {
  await page.goto(`/settings/persona/${encodeURIComponent(personaName)}`);
  await waitForAllLoadersToDisappear(page);

  // Navigate to the customize landing page
  await page.getByRole('tab', { name: 'Customize UI' }).click();

  const getCustomPageDataResponse = page.waitForResponse(
    `/api/v1/docStore/name/persona.${encodeURIComponent(personaName)}`
  );

  await page.getByTestId('LandingPage').click();
  await getCustomPageDataResponse;
  await waitForAllLoadersToDisappear(page);
  await page
    .getByTestId('customize-landing-page-header')
    .waitFor({ state: 'visible' });
};

export const removeAndCheckWidget = async (
  page: Page,
  { widgetKey }: { widgetKey: string }
) => {
  const widget = page.locator(`[data-testid="${widgetKey}"]`);

  await widget.scrollIntoViewIfNeeded();

  // Click on remove widget button
  await widget.locator('[data-testid="more-options-button"]').click();

  await page.locator('.ant-dropdown:visible [data-menu-id*="remove"]').click();

  await expect(page.getByTestId(`${widgetKey}`)).not.toBeVisible();
};

// Callers poll this across navigations, and each iteration starts from a fresh page load, so
// the widget needs a chance to mount inside the iteration — an instant `isVisible()` would
// never observe it. The assertion inherits the project's expect timeout.
const isLandingPageWidgetVisible = async (
  page: Page,
  widgetKey: string
): Promise<boolean> => {
  await revealLandingPageWidget(page, widgetKey);

  return expect(page.getByTestId(widgetKey))
    .toBeVisible()
    .then(() => true)
    .catch(() => false);
};

const isLandingPageWidgetLoading = async (widget: Locator) =>
  widget
    .getByTestId('entity-list-skeleton')
    .isVisible()
    .catch(() => false);

// Single gate every widget assertion goes through: reveal the deferred slot, prove the
// widget mounted, and let its own fetch settle. The skeleton wait belongs here rather than
// in the callers because a widget only starts loading once the slot reveals it — a caller
// that ran `waitForAllLoadersToDisappear(page, 'entity-list-skeleton')` beforehand saw no
// skeleton at all and then raced the fetch.
//
// `widgetKey` must be the widget's *layout* key — the `KnowledgePanel.*` value the widget
// renders as its own testid and that its DeferredWidget slot is named after. An inner testid
// (e.g. `kpi-widget`) matches neither, so nothing gets scrolled, the widget never mounts, and
// the assertion below fails on a widget that was simply never revealed. Assert inner testids
// against the returned locator instead.
export const waitForLandingPageWidget = async (
  page: Page,
  widgetKey: string
): Promise<Locator> => {
  const widget = page.getByTestId(widgetKey);

  // The reveal has to be retried, not done once. A deferred slot mounts its widget only
  // when scrolled into view, and `expect(...).toBeVisible()` cannot scroll. So when the
  // layout attaches *after* a single reveal — a fresh `/my-data` load right after saving a
  // layout is the common case — `revealLandingPageWidget` finds nothing to scroll, the
  // widget never mounts, and the visibility assertion then burns its entire timeout on an
  // element that was never going to appear no matter how long it waited. Polling the reveal
  // rides out that render delay; a widget that is genuinely missing still fails, just at the
  // poll timeout rather than instantly.
  await expect
    .poll(() => isLandingPageWidgetVisible(page, widgetKey), {
      timeout: 60_000,
      intervals: [500, 1_000, 2_000, 5_000],
    })
    .toBe(true);

  await expect(widget.getByTestId('entity-list-skeleton')).toBeHidden();

  return widget;
};

export const toNameableEntity = (
  entity?: unknown
): NameableEntityResponse | undefined => {
  const holder = entity as
    | {
        entityResponseData?: NameableEntityResponse;
      }
    | undefined;

  return holder?.entityResponseData;
};

export const checkAllDefaultWidgets = async (page: Page) => {
  await waitForAllLoadersToDisappear(page);
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

  await expect(page.getByTestId('page-layout-v1')).toBeVisible();
  await page.evaluate(() => {
    window.scrollTo(0, 0);
    document
      .querySelector('.page-layout-v1-center.page-layout-v1-vertical-scroll')
      ?.scrollTo({ top: 0 });
  });

  for (const widgetKey of DEFAULT_LANDING_PAGE_WIDGETS) {
    await waitForLandingPageWidget(page, widgetKey);
  }
};

export const setUserDefaultPersona = async (
  page: Page,
  personaName: string
) => {
  await visitOwnProfilePage(page);

  await page.locator('[data-testid="default-edit-user-persona"]').click();

  await expect(
    page.locator('[data-testid="default-persona-select-list"]')
  ).toBeVisible();

  const setDefaultPersona = page.waitForResponse('/api/v1/users/*');

  // Click on the persona option by text within the dropdown
  await page.click(`.ant-select-dropdown:visible [title="${personaName}"]`);

  await page
    .locator('[data-testid="user-profile-default-persona-edit-save"]')
    .click();

  await setDefaultPersona;

  await expect(
    page.locator('[data-testid="persona-details-card"]')
  ).toContainText(personaName);
};

export const openAddCustomizeWidgetModal = async (page: Page) => {
  const fetchResponse = page.waitForResponse(
    '/api/v1/docStore?fqnPrefix=KnowledgePanel*'
  );
  await page
    .locator(
      '[data-testid="customize-landing-page-header"] [data-testid="add-widget-button"]'
    )
    .click();

  await fetchResponse;
};

export const saveCustomizeLayoutPage = async (page: Page) => {
  const saveResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/docStore')
  );
  await page.locator('[data-testid="save-button"]').click();
  await saveResponse;

  await toastNotification(page, /Page layout (created|updated) successfully\./);
};

export const removeAndVerifyWidget = async (
  page: Page,
  widgetKey: string,
  personaName: string
) => {
  await navigateToCustomizeLandingPage(page, {
    personaName,
  });

  await removeAndCheckWidget(page, {
    widgetKey,
  });

  const saveLayout = page.waitForResponse((response) =>
    response.url().includes('/api/v1/docStore')
  );

  await page.locator('[data-testid="save-button"]').click();

  await saveLayout;

  await redirectToHomePage(page);

  await waitForAllLoadersToDisappear(page);

  // Assert on the deferred slot rather than the widget: the slot renders for every layout
  // entry, whereas the widget stays unmounted while below the fold — so
  // `not.toBeVisible()` on the widget would pass whether it was removed or merely deferred.
  await expect(getLandingPageWidgetSlot(page, widgetKey)).toHaveCount(0);
};

export const addAndVerifyWidget = async (
  page: Page,
  widgetKey: string,
  personaName: string
) => {
  await navigateToCustomizeLandingPage(page, {
    personaName,
  });

  await openAddCustomizeWidgetModal(page);
  await waitForAllLoadersToDisappear(page);

  await page
    .getByRole('dialog', { name: 'Customize Home' })
    .getByTestId(widgetKey)
    .click();

  await page.locator('[data-testid="apply-btn"]').click();

  await waitForLandingPageWidget(page, widgetKey);

  const saveLayout = page.waitForResponse((response) =>
    response.url().includes('/api/v1/docStore')
  );
  await page.locator('[data-testid="save-button"]').click();
  await saveLayout;
  await toastNotification(page, /Page layout (created|updated) successfully\./);

  await redirectToHomePage(page, false);

  await waitForAllLoadersToDisappear(page).catch(() => undefined);

  // The save response is awaited and its toast asserted above, and `redirectToHomePage`
  // disables ETag conditional reads, so the first read-back is authoritative — the widget
  // helper's own web-first assertions do the waiting from here.
  await waitForLandingPageWidget(page, widgetKey);
};

export const addCuratedAssetPlaceholder = async ({
  page,
  personaName,
}: {
  page: Page;
  personaName: string;
}) => {
  await navigateToCustomizeLandingPage(page, {
    personaName,
  });

  await openAddCustomizeWidgetModal(page);
  await waitForAllLoadersToDisappear(page);

  await page
    .getByRole('dialog', { name: 'Customize Home' })
    .getByTestId('KnowledgePanel.CuratedAssets')
    .click();

  await page.locator('[data-testid="apply-btn"]').click();

  const curatedAssetsWidget = await waitForLandingPageWidget(
    page,
    'KnowledgePanel.CuratedAssets'
  );

  await expect(
    curatedAssetsWidget.getByTestId('widget-empty-state')
  ).toBeVisible();
};

// Helper function to select asset types in the dropdown
export const selectAssetTypes = async (
  page: Page,
  assetTypes: string[] | 'all'
) => {
  // Click on asset type selector to open dropdown
  await page.locator('[data-testid="asset-type-select"]').click();

  // Wait for dropdown to be visible
  await page.locator('.ant-select-dropdown').waitFor({
    state: 'visible',
    timeout: 5000,
  });

  // Wait for the tree to load
  await page.locator('.ant-select-tree').waitFor({
    state: 'visible',
    timeout: 5000,
  });

  if (assetTypes === 'all') {
    // Select all asset types using the checkbox
    await page.locator('[data-testid="all-option"]').click();
  } else {
    // Select specific asset types
    for (const assetType of assetTypes) {
      // Find the corresponding config for search term
      const config = ENTITY_TYPE_CONFIGS.find(
        (c) => c.name === assetType || c.displayName === assetType
      );
      const searchTerm = config?.searchTerm || assetType;
      const index = config?.index || assetType.toLowerCase();

      // Search for the asset type
      await page.keyboard.type(searchTerm);
      // eslint-disable-next-line playwright/no-wait-for-timeout -- search debounce delay
      await page.waitForTimeout(500);

      // Try to click the filtered result
      const filteredElement = page.locator(`[data-testid="${index}-option"]`);

      if (await filteredElement.isVisible()) {
        await filteredElement.click();
      }

      await page.getByText('Select Asset Type').click();
    }
  }

  // Close the dropdown
  await page.getByText('Select Asset Type').click();
};

// Helper function to test widget footer "View More" button
export const verifyWidgetFooterViewMore = async (
  page: Page,
  {
    widgetKey,
    expectedLink,
    link,
    // Callers that seed enough rows for the link to be guaranteed pass true, so
    // a missing footer fails instead of quietly ending the check. Defaults to
    // false because most widgets here have no seeded row count to rely on.
    requireViewMore = false,
  }: {
    widgetKey: string;
    expectedLink?: string;
    link?: string;
    requireViewMore?: boolean;
  }
) => {
  // Wait for the page to load
  await waitForAllLoadersToDisappear(page);

  const widget = await waitForLandingPageWidget(page, widgetKey);

  // Wait for the data to appear in the widget
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

  // Check for widget footer
  const widgetFooter = widget.locator('[data-testid="widget-footer"]');

  if (requireViewMore) {
    await expect(widgetFooter).toBeVisible();
  }

  const footerExists = await widgetFooter.isVisible().catch(() => false);

  if (!footerExists) {
    // No footer is expected for this widget
    return;
  }

  // Footer exists, check for view more button
  const viewMoreButton = widget.locator('.footer-view-more-button');

  if (requireViewMore) {
    await expect(viewMoreButton).toBeVisible();
  }

  const buttonExists = await viewMoreButton.isVisible().catch(() => false);

  if (!buttonExists) {
    // No view more button in footer
    return;
  }

  // View more button exists, verify it
  await expect(viewMoreButton).toBeVisible();

  // Get and verify the href
  const href = await viewMoreButton.getAttribute('href');

  if (expectedLink) {
    // Exact link match
    expect(href).toBe(expectedLink);
  } else if (link) {
    // Pattern match
    expect(href).toContain(link);
  }

  // Click and verify navigation
  await viewMoreButton.click();

  if (expectedLink) {
    // Wait for the specific URL
    await page.waitForURL(expectedLink);
  } else if (link) {
    const currentUrl = page.url();

    // Wait for URL matching pattern
    expect(currentUrl).toContain(link);
  }
};

export const verifyWidgetEntityNavigation = async (
  page: Page,
  {
    widgetKey,
    entitySelector,
    urlPattern,
    emptyStateTestId,
    verifyElement,
    apiResponseUrl,
    searchQuery,
    altApiResponseUrl,
  }: {
    widgetKey: string;
    entitySelector: string;
    urlPattern: string;
    emptyStateTestId?: string;
    verifyElement?: string;
    apiResponseUrl: string;
    searchQuery: string | string[];
    altApiResponseUrl?: string;
  }
) => {
  // Wait for API response matching the search query with timeout fallback
  const response = Promise.race([
    page.waitForResponse((response) => {
      // Check primary API URL
      if (response.url().includes(apiResponseUrl)) {
        if (Array.isArray(searchQuery)) {
          return searchQuery.every((query) => response.url().includes(query));
        }
        return response.url().includes(searchQuery);
      }

      // Check alternative API URL (for Task API migration)
      if (altApiResponseUrl && response.url().includes(altApiResponseUrl)) {
        return true;
      }

      return false;
    }),
    page.waitForTimeout(10000),
  ]);

  await redirectToHomePage(page);

  await response;

  // Wait for loaders after navigation
  await waitForAllLoadersToDisappear(page);
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');

  // Get widget after navigation to home page
  const widget = await waitForLandingPageWidget(page, widgetKey);

  // Wait again for any widget-specific loaders
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton');
  // eslint-disable-next-line playwright/no-wait-for-timeout -- widget rendering delay
  await page.waitForTimeout(1000);

  // Check for entity items in the widget
  const entityItems = widget.locator(entitySelector);
  const hasEntities = (await entityItems.count()) > 0;

  if (hasEntities) {
    await expect(entityItems.first()).toBeVisible();

    // Get the first entity item
    const firstEntity = entityItems.first();

    // Check if it's a link or button and click appropriately
    const isLink = (await firstEntity.locator('.item-link').count()) > 0;

    if (isLink) {
      // For widgets with links inside (like My Data)
      const entityLink = firstEntity.locator('.item-link').first();
      await entityLink.click();
    } else {
      // For widgets with direct clickable cards (like Domains, Data Products)
      await firstEntity.click();
    }

    // Wait for navigation

    // Verify we're on the correct page
    const currentUrl = page.url();

    expect(currentUrl).toContain(urlPattern);

    // Verify page element is visible if specified
    if (verifyElement) {
      const pageElement = page.locator(verifyElement);

      await expect(pageElement).toBeVisible();
    }

    // Navigate back to home for next tests
    await redirectToHomePage(page);
  } else if (emptyStateTestId) {
    await expect(page.getByTestId(emptyStateTestId)).toBeVisible();
  } else {
    await expect(
      widget.locator('[data-testid="widget-empty-state"]')
    ).toBeVisible();
  }
};

export const verifyWidgetHeaderNavigation = async (
  page: Page,
  widgetKey: string,
  expectedTitle: string,
  navigationUrl: string,
  destinationTestId?: string
) => {
  const widget = await waitForLandingPageWidget(page, widgetKey);

  // Wait for loaders before interacting with widget header
  await waitForAllLoadersToDisappear(page);

  // Verify widget header
  const widgetHeader = widget.getByTestId('widget-header');

  await expect(widgetHeader).toBeVisible();

  // Verify header title
  const headerTitle = widgetHeader.getByTestId('widget-title');

  await expect(headerTitle).toBeVisible();
  await expect(headerTitle).toContainText(expectedTitle);

  // Click header title to navigate
  await headerTitle.click();

  // Poll instead of reading page.url() once: the click starts a client-side
  // navigation, so a single read can still observe the landing page URL.
  await expect.poll(() => page.url()).toContain(navigationUrl);

  // Optionally prove the destination rendered. A URL check alone cannot tell a
  // working page from one stuck on its loader. Must run before the redirect
  // below, which takes the browser back to the landing page.
  if (destinationTestId) {
    await expect(page.getByTestId(destinationTestId)).toBeVisible();
  }

  // Home keeps background requests alive on some persona routes; use the lighter
  // redirect path and wait on rendered state instead of networkidle.
  await redirectToHomePage(page, false);
  await waitForAllLoadersToDisappear(page).catch(() => undefined);
  await waitForAllLoadersToDisappear(page, 'entity-list-skeleton').catch(
    () => undefined
  );
};

export const verifyDomainCountInDomainWidget = async (
  page: Page,
  domainId: string,
  expectedCount: number
) => {
  const widgetCardSelector = [
    `[data-testid="domain-card-${domainId}"] .domain-card-count`,
    `[data-testid="domain-card-${domainId}"] .domain-card-full-count`,
  ].join(', ');

  await redirectToHomePage(page, false);

  await expect
    .poll(
      async () => {
        if (
          !(await isLandingPageWidgetVisible(page, 'KnowledgePanel.Domains'))
        ) {
          return null;
        }

        const domainWidget = page.getByTestId('KnowledgePanel.Domains');
        if (await isLandingPageWidgetLoading(domainWidget)) {
          return null;
        }

        const card = domainWidget.locator(widgetCardSelector).first();
        const isCardVisible = await card.isVisible().catch(() => false);

        if (!isCardVisible) {
          return null;
        }

        const text = await card.textContent();

        return text?.trim() ?? null;
      },
      { timeout: 60_000, intervals: [1_000, 2_000, 5_000] }
    )
    .toContain(expectedCount.toString());
};

export const verifyDataProductCountInDataProductWidget = async (
  page: Page,
  dataProductId: string,
  expectedCount: number
) => {
  const widgetCardSelector = `[data-testid="data-product-card-${dataProductId}"] [data-testid="data-product-asset-count"]`;

  await redirectToHomePage(page, false);

  await expect
    .poll(
      async () => {
        if (
          !(await isLandingPageWidgetVisible(
            page,
            'KnowledgePanel.DataProducts'
          ))
        ) {
          return null;
        }

        const dataProductWidget = page.getByTestId(
          'KnowledgePanel.DataProducts'
        );
        if (await isLandingPageWidgetLoading(dataProductWidget)) {
          return null;
        }

        const card = dataProductWidget.locator(widgetCardSelector).first();
        const isCardVisible = await card.isVisible().catch(() => false);

        if (!isCardVisible) {
          return null;
        }

        const text = await card.textContent();

        return text?.trim() ?? null;
      },
      { timeout: 60_000, intervals: [1_000, 2_000, 5_000] }
    )
    .toContain(expectedCount.toString());
};

export const verifyWidgetCountOnCurrentPage = async (
  page: Page,
  widgetKey: string,
  selector: string,
  expectedCount: number
) => {
  const widget = await waitForLandingPageWidget(page, widgetKey);

  await expect
    .poll(
      async () => {
        if (await isLandingPageWidgetLoading(widget)) {
          return null;
        }

        const element = widget.locator(selector).first();
        const isVisible = await element.isVisible().catch(() => false);

        if (!isVisible) {
          return null;
        }

        return (await element.textContent())?.trim() ?? null;
      },
      { timeout: 60_000, intervals: [1_000, 2_000, 5_000] }
    )
    .toContain(expectedCount.toString());
};
