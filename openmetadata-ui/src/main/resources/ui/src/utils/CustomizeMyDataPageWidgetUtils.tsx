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

import { isEmpty } from 'lodash';
import { lazy, type ComponentType } from 'react';
import withSuspenseFallback from '../components/AppRouter/withSuspenseFallback';
import { LandingPageWidgetKeys } from '../enums/CustomizablePage.enum';
import type {
  WidgetCommonProps,
  WidgetConfig,
} from '../pages/CustomizablePage/CustomizablePage.interface';
import { reflowLayoutToGrid } from './CustomizableLandingPagePureUtils';

/** Every landing widget occupies exactly one grid column. */
const LANDING_PAGE_WIDGET_COLUMN_SPAN = 1;

// This registry is intentionally isolated from the layout class base. The
// class base is imported for sizing/defaults on /my-data, while widget chunks
// should only become reachable through the deferred widget render path.
const PlatformHealthWidget = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/MyData/Widgets/PlatformHealthWidget/PlatformHealthWidget'
      )
  )
) as ComponentType<WidgetCommonProps>;
const DataEstateWidget = withSuspenseFallback(
  lazy(
    () =>
      import('../components/MyData/Widgets/DataEstateWidget/DataEstateWidget')
  )
) as ComponentType<WidgetCommonProps>;
const TeamActivityWidget = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/MyData/Widgets/TeamActivityWidget/TeamActivityWidget'
      )
  )
) as ComponentType<WidgetCommonProps>;
const YoursAndFollowedWidget = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/MyData/Widgets/YoursAndFollowedWidget/YoursAndFollowedWidget'
      )
  )
) as ComponentType<WidgetCommonProps>;
const ContextCenterWidget = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/MyData/Widgets/ContextCenterWidget/ContextCenterWidget'
      )
  )
) as ComponentType<WidgetCommonProps>;
const CuratedAssetsSummaryWidget = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/MyData/Widgets/CuratedAssetsSummaryWidget/CuratedAssetsSummaryWidget'
      )
  )
) as ComponentType<WidgetCommonProps>;
const DataQualityWidget = withSuspenseFallback(
  lazy(
    () =>
      import('../components/MyData/Widgets/DataQualityWidget/DataQualityWidget')
  )
) as ComponentType<WidgetCommonProps>;
const DomainsOverviewWidget = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/MyData/Widgets/DomainsOverviewWidget/DomainsOverviewWidget'
      )
  )
) as ComponentType<WidgetCommonProps>;
const DataProductsOverviewWidget = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/MyData/Widgets/DataProductsOverviewWidget/DataProductsOverviewWidget'
      )
  )
) as ComponentType<WidgetCommonProps>;
const KpiProgressWidget = withSuspenseFallback(
  lazy(
    () =>
      import('../components/MyData/Widgets/KpiProgressWidget/KpiProgressWidget')
  )
) as ComponentType<WidgetCommonProps>;

/**
 * The landing-page registry: every key that resolves to a widget, and what it
 * resolves to. Module-scope and single-source so the lookup and the
 * "is this key still renderable" check can never disagree.
 *
 * Matched by prefix, not equality — a grid instance key carries a `uniqueId`
 * suffix (e.g. `KnowledgePanel.Following-42`).
 */
const WIDGET_KEY_PREFIX_MAP: Array<
  [LandingPageWidgetKeys, ComponentType<WidgetCommonProps>]
> = [
  [LandingPageWidgetKeys.PLATFORM_HEALTH, PlatformHealthWidget],
  [LandingPageWidgetKeys.DATA_ESTATE, DataEstateWidget],
  [LandingPageWidgetKeys.ACTIVITY_FEED, TeamActivityWidget],
  [LandingPageWidgetKeys.YOURS_AND_FOLLOWED, YoursAndFollowedWidget],
  [LandingPageWidgetKeys.KNOWLEDGE_CENTER, ContextCenterWidget],
  [LandingPageWidgetKeys.CURATED_ASSETS, CuratedAssetsSummaryWidget],
  [LandingPageWidgetKeys.DATA_QUALITY, DataQualityWidget],
  [LandingPageWidgetKeys.DOMAINS, DomainsOverviewWidget],
  [LandingPageWidgetKeys.DATA_PRODUCTS, DataProductsOverviewWidget],
  [LandingPageWidgetKeys.KPI, KpiProgressWidget],
];

/**
 * Every landing-page widget key this build resolves to a component, in default
 * layout order. Exported so a caller can assert the whole set instead of
 * re-deriving it, which is what makes adding or retiring a widget a visible,
 * deliberate change rather than a silent one.
 */
export const MY_DATA_WIDGET_KEYS: readonly LandingPageWidgetKeys[] =
  WIDGET_KEY_PREFIX_MAP.map(([widgetKey]) => widgetKey);

/**
 * Whether a saved layout entry still names a widget this build can render.
 *
 * Persona layouts outlive the widgets in them: a doc saved before a widget was
 * retired still lists it. Callers use this to drop those entries rather than
 * leave an empty cell in the grid.
 */
export const isKnownMyDataWidgetKey = (widgetKey: string): boolean =>
  WIDGET_KEY_PREFIX_MAP.some(([prefix]) => widgetKey.startsWith(prefix));

/**
 * Whether a landing-page widget may appear on the page at all — both in the
 * grid and in the Add Widgets picker.
 *
 * The picker and the renderer have to answer this the same way. A key the
 * picker offers but the renderer cannot resolve becomes a blank grid cell, and
 * a key the renderer accepts but the picker withholds is a widget nobody can
 * add back once it is removed. Sharing one predicate is what keeps the offered
 * set and the renderable set equal.
 */
export const isAvailableMyDataWidgetKey = (
  widgetKey: string,
  excludedWidgetFqns: string[]
): boolean =>
  isKnownMyDataWidgetKey(widgetKey) &&
  !excludedWidgetFqns.some((fqn) => widgetKey.startsWith(fqn));

export const getMyDataWidgetFromKey = (
  widgetKey: string
): ComponentType<WidgetCommonProps> => {
  const matchedWidget = WIDGET_KEY_PREFIX_MAP.find(([prefix]) =>
    widgetKey.startsWith(prefix)
  );

  return (
    matchedWidget?.[1] ?? ((() => null) as ComponentType<WidgetCommonProps>)
  );
};

/**
 * The read path for a persona's landing layout, shared by the home page and by
 * the customize page that edits it.
 *
 * A saved layout outlives the build that wrote it. It names widgets that have
 * since been retired or excluded, carries `w` from when a column was a third of
 * the row rather than half, and carries `x` from when the grid was three
 * columns wide. None of those read as an error: a retired key resolves to a
 * render-nothing component and leaves a hole, a stale `w` of 2 is no longer
 * two-thirds but the whole row, and an `x` past the last column is pushed onto
 * a row of its own, stranding the space it vacated. Both call sites must
 * correct them identically or the editor shows an arrangement the home page
 * will not render.
 */
export const normalizeLandingPageLayout = (
  savedLayout: WidgetConfig[] | undefined,
  defaultLayout: WidgetConfig[],
  excludedWidgetFqns: string[],
  cols: number
): WidgetConfig[] => {
  const filtered = (savedLayout ?? [])
    .filter((widget) =>
      isAvailableMyDataWidgetKey(widget.i, excludedWidgetFqns)
    )
    // One column each, rather than `getConstrainedWidgetWidth`'s upper bound.
    // The landing grid exposes no width control -- CustomiseHomeModal adds at
    // width 1 and both grids are `isResizable={false}` -- so any other width is
    // stale state from the three-column era that nothing in the UI can undo,
    // and at two columns a `w` of 2 spans the whole row. Revisit this line if a
    // size control comes back.
    .map((widget) => ({ ...widget, w: LANDING_PAGE_WIDGET_COLUMN_SPAN }));

  // Re-packed whichever source it came from: a default a subclass positioned
  // itself can overflow the grid just as a saved layout can.
  return reflowLayoutToGrid(isEmpty(filtered) ? defaultLayout : filtered, cols);
};
