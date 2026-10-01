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

import { lazy, type ComponentType } from 'react';
import withSuspenseFallback from '../components/AppRouter/withSuspenseFallback';
import { LandingPageWidgetKeys } from '../enums/CustomizablePage.enum';
import type { WidgetCommonProps } from '../pages/CustomizablePage/CustomizablePage.interface';

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
 * Whether a saved layout entry still names a widget this build can render.
 *
 * Persona layouts outlive the widgets in them: a doc saved before a widget was
 * retired still lists it. Callers use this to drop those entries rather than
 * leave an empty cell in the grid.
 */
export const isKnownMyDataWidgetKey = (widgetKey: string): boolean =>
  WIDGET_KEY_PREFIX_MAP.some(([prefix]) => widgetKey.startsWith(prefix));

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
