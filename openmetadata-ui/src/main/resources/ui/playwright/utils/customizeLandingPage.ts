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

// The default landing layout, in DEFAULT_LANDING_PAGE_LAYOUT order. MyData,
// DataAssets, TotalAssets, Following and MyTask are gone: the topic cards
// replaced them, and `getExcludedWidgetFqns` keeps their keys out of both the
// grid and the Add Widgets picker, so waiting on one now waits forever.
const DEFAULT_LANDING_PAGE_WIDGETS = [
  'KnowledgePanel.PlatformHealth',
  'KnowledgePanel.DataEstate',
  'KnowledgePanel.ActivityFeed',
  'KnowledgePanel.YoursAndFollowed',
  'KnowledgePanel.KnowledgeCenter',
  'KnowledgePanel.CuratedAssets',
  'KnowledgePanel.DataQuality',
  'KnowledgePanel.Domains',
  'KnowledgePanel.DataProducts',
  'KnowledgePanel.KPI',
];

export const CURATED_ASSETS_WIDGET_KEY = 'KnowledgePanel.CuratedAssets';

// Root of the live landing page. The old `page-layout-v1` handle came from
// PageLayoutV1, which the home route only renders for the welcome screen now.
export const LANDING_PAGE_ROOT = 'home-landing-page';
// Root of the persona customize page, which is still built on PageLayoutV1.
const CUSTOMIZE_PAGE_ROOT = 'page-layout-v1';

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
  await page.goto(`/settings/persona/${encodeURIComponent(personaName)}`, {
    waitUntil: 'domcontentloaded',
  });
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

  // Removal is a button in the card header now, not an item behind an antd
  // overflow menu -- topic cards carry no `more-options-button` at all, so
  // main's switch to `getByRole('menuitem', { name: 'Remove' })` has nothing
  // left to target here.
  await widget.getByTestId(`remove-widget-${widgetKey}`).click();

  await expect(page.getByTestId(`${widgetKey}`)).not.toBeVisible();
};

// Keep each probe non-blocking so the caller can reveal a slot that mounts
// after this probe. Waiting here would leave that slot below the viewport.
const isLandingPageWidgetVisible = async (
  page: Page,
  widgetKey: string
): Promise<boolean> => {
  await revealLandingPageWidget(page, widgetKey);

  return page
    .getByTestId(widgetKey)
    .isVisible()
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
  // Topic cards skeleton their summary line rather than rendering an
  // `entity-list-skeleton`; match on the prefix because the suffix is the
  // card's own topic key, which is not derivable from the layout key.
  await expect(
    widget.locator('[data-testid^="topic-summary-skeleton-"]')
  ).toBeHidden();

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

  // Called on both surfaces: the landing page is built on the core PageLayout
  // now, but the persona customize page still renders inside PageLayoutV1.
  // Neither renders the other's root, so the union resolves to one element.
  await expect(
    page
      .getByTestId(LANDING_PAGE_ROOT)
      .or(page.getByTestId(CUSTOMIZE_PAGE_ROOT))
  ).toBeVisible();
  await page.evaluate(
    ([landingRoot, customizeRoot]) => {
      window.scrollTo(0, 0);
      document
        .querySelectorAll(
          `[data-testid="${landingRoot}"] [class*='overflow-y-auto'], ` +
            `[data-testid="${customizeRoot}"] .page-layout-v1-vertical-scroll`
        )
        .forEach((scroller) => scroller.scrollTo({ top: 0 }));
    },
    [LANDING_PAGE_ROOT, CUSTOMIZE_PAGE_ROOT]
  );

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

  // "Add" has to mean "ensure present". The picker refuses to re-add a widget
  // the layout already holds (`handleSelectWidget` returns early), so the click
  // is a no-op, `apply-btn` stays `disabled={!hasChanges}`, and clicking it
  // waits out the action timeout -- which several widgets now hit, because they
  // are in the default layout.
  //
  // Bounded wait rather than a single read: the editor grid paints after the
  // header `navigateToCustomizeLandingPage` waited for, so an immediate probe
  // can report a widget missing that is merely not mounted yet, landing on that
  // same dead end.
  const isAlreadyOnLayout = await page
    .getByTestId(widgetKey)
    .waitFor({ state: 'attached', timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (!isAlreadyOnLayout) {
    await openAddCustomizeWidgetModal(page);
    await waitForAllLoadersToDisappear(page);

    await page
      .getByRole('dialog', { name: 'Customize Home' })
      .getByTestId(widgetKey)
      .click();

    await page.locator('[data-testid="apply-btn"]').click();
  }

  await waitForLandingPageWidget(page, widgetKey);

  // Save is gated on the layout actually differing from the saved document, so
  // a second "ensure present" pass over an unchanged layout has nothing to
  // write and leaves the button disabled. Clicking it then waits out the
  // action timeout instead of failing on the thing under test.
  const saveButton = page.locator('[data-testid="save-button"]');

  if (await saveButton.isEnabled()) {
    const saveLayout = page.waitForResponse((response) =>
      response.url().includes('/api/v1/docStore')
    );
    await saveButton.click();
    await saveLayout;
    await toastNotification(
      page,
      /Page layout (created|updated) successfully\./
    );
  }

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

export const selectAssetTypes = async (
  page: Page,
  assetTypes: string[] | 'all'
) => {
  const field = page.getByTestId('asset-type-select');
  const search = field.getByRole('textbox');
  await field.click();
  const tree = page.getByTestId('asset-type-select-popover');
  await expect(tree.getByTestId('tree-node-all')).toBeVisible();

  const types = assetTypes === 'all' ? ['all'] : assetTypes;
  for (const assetType of types) {
    const config = ENTITY_TYPE_CONFIGS.find(
      (entry) => entry.name === assetType || entry.displayName === assetType
    );
    const index = assetType === 'all' ? 'all' : config?.index;
    expect(index, `Asset type configuration for ${assetType}`).toBeTruthy();
    // The search matches the asset type value as well as its display label,
    // which can differ (the page value is "Article").
    await search.fill(index ?? '');
    const option = tree.getByTestId(`tree-node-${index}`);
    await expect(option).toBeVisible();
    await option.click();
    await expect(tree.getByTestId(`checkbox-${index}`)).toHaveAttribute(
      'data-selected',
      'true'
    );
  }

  // Escape would also dismiss the parent modal, so close the tree by clicking
  // outside it, on the modal title.
  await page.getByTestId('curated-assets-modal-title').click();
  await expect(tree).toBeHidden();
};

// Helper function to test widget footer "View More" button

export const verifyWidgetTitleAndNavigation = async (
  page: Page,
  widgetKey: string,
  expectedTitle: string,
  navigationUrl: string,
  destinationTestId?: string
) => {
  const widget = await waitForLandingPageWidget(page, widgetKey);

  // Wait for loaders before interacting with widget header
  await waitForAllLoadersToDisappear(page);

  // The title is the card's collapse toggle now, not a link: the way out to the
  // full view is the footer action. So assert the card still names itself, then
  // navigate the way a reader actually can.
  await expect(widget).toContainText(expectedTitle);

  const footerAction = widget.locator('[data-testid^="topic-action-"]');

  await expect(footerAction).toBeVisible();
  await footerAction.click();

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

// Read a landing-page widget's rendered count once, or null if the widget isn't
// ready yet (slot not revealed, still showing its skeleton, or the target card
// not painted). Never throws — a detached node during a remount resolves to null
// so the caller's poll rides it out instead of aborting.
const readLandingWidgetCount = async (
  page: Page,
  widgetKey: string,
  cardSelector: string
): Promise<string | null> => {
  if (!(await isLandingPageWidgetVisible(page, widgetKey))) {
    return null;
  }

  const widget = page.getByTestId(widgetKey);
  if (await isLandingPageWidgetLoading(widget)) {
    return null;
  }

  const card = widget.locator(cardSelector).first();
  if (!(await card.isVisible().catch(() => false))) {
    return null;
  }

  const text = (await card.textContent().catch(() => null))?.trim();

  // Topic cards render the count inside a labelled badge ("2 Assets"), where the
  // old widgets rendered a bare number. Take the leading integer so the same
  // helper reads both.
  return text?.match(/\d+/)?.[0] ?? null;
};

// Poll a landing-page widget's asset count until it equals `expectedCount`.
//
// Each iteration reveals the widget itself: `readLandingWidgetCount` scrolls the
// deferred slot into view (via `isLandingPageWidgetVisible`) so a below-the-fold
// widget mounts and paints before it is read — that reveal is independent of the
// reload below.
//
// `reloadOnMismatch` (default true): the Domains and Data Products widgets fetch
// their asset-count map exactly once per page load and never refetch in the
// background. Asset add/remove mutations also return before Elasticsearch is
// refreshed, so the *first* page load after a mutation can snapshot a stale count
// — and because the widget never refetches, a plain DOM poll would then re-read
// that same stale value until it times out (passing only on the next run once the
// index caught up: the flake). Reloading the landing page whenever the rendered
// count doesn't match yet forces a fresh fetch, so the assertion self-heals as
// soon as the index propagates.
//
// Pass `false` when asserting the count already rendered on the current page (no
// mutation preceded it): a wrong value must then fail rather than self-heal via a
// reload, so a real UI regression is not masked — and the helper must not silently
// navigate a non-home caller to `/my-data`.
const pollLandingWidgetCount = async (
  page: Page,
  widgetKey: string,
  cardSelector: string,
  expectedCount: number,
  reloadOnMismatch = true
) => {
  const expected = expectedCount.toString();

  await expect
    .poll(
      async () => {
        const value = await readLandingWidgetCount(
          page,
          widgetKey,
          cardSelector
        );

        // A settled-but-wrong read means the widget already loaded a stale count;
        // reload so the next iteration reads a freshly fetched value. A null read
        // (still loading) needs no reload — just wait it out.
        if (reloadOnMismatch && value !== null && value !== expected) {
          await redirectToHomePage(page, false);
          await waitForAllLoadersToDisappear(page).catch(() => undefined);
        }

        return value;
      },
      { timeout: 60_000, intervals: [1_000, 2_000, 5_000] }
    )
    .toBe(expected);
};

export const verifyDomainCountInDomainWidget = async (
  page: Page,
  domainId: string,
  expectedCount: number
) => {
  const widgetCardSelector = `[data-testid="domain-card-${domainId}"] [data-testid="domain-asset-count"]`;

  await redirectToHomePage(page, false);

  await pollLandingWidgetCount(
    page,
    'KnowledgePanel.Domains',
    widgetCardSelector,
    expectedCount
  );
};

export const verifyDataProductCountInDataProductWidget = async (
  page: Page,
  dataProductId: string,
  expectedCount: number
) => {
  const widgetCardSelector = `[data-testid="data-product-card-${dataProductId}"] [data-testid="data-product-asset-count"]`;

  await redirectToHomePage(page, false);

  await pollLandingWidgetCount(
    page,
    'KnowledgePanel.DataProducts',
    widgetCardSelector,
    expectedCount
  );
};

export const verifyWidgetCountOnCurrentPage = async (
  page: Page,
  widgetKey: string,
  selector: string,
  expectedCount: number
) => {
  await pollLandingWidgetCount(page, widgetKey, selector, expectedCount, false);
};
