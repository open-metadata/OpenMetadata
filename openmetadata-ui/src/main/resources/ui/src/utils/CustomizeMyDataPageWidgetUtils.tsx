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

const KnowledgeCenterWidget = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/KnowledgeCenter/KnowledgeCenterWidget/KnowledgeCenterWidget'
      )
  )
) as ComponentType<WidgetCommonProps>;
const MyFeedWidget = withSuspenseFallback(
  lazy(() =>
    import('../components/MyData/FeedWidget/FeedWidget.component').then(
      (m) => ({
        default: m.MyFeedWidget,
      })
    )
  )
) as ComponentType<WidgetCommonProps>;
const MyDataWidget = withSuspenseFallback(
  lazy(() =>
    import('../components/MyData/MyDataWidget/MyDataWidget.component').then(
      (m) => ({ default: m.MyDataWidget })
    )
  )
) as ComponentType<WidgetCommonProps>;
const FollowingWidget = withSuspenseFallback(
  lazy(() => import('../components/MyData/RightSidebar/FollowingWidget'))
) as ComponentType<WidgetCommonProps>;
const CuratedAssetsWidget = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/MyData/Widgets/CuratedAssetsWidget/CuratedAssetsWidget'
      )
  )
) as ComponentType<WidgetCommonProps>;
const DataAssetsWidget = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/MyData/Widgets/DataAssetsWidget/DataAssetsWidget.component'
      )
  )
) as ComponentType<WidgetCommonProps>;
const DataProductsWidget = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/MyData/Widgets/DataProductsWidget/DataProductsWidget.component'
      )
  )
) as ComponentType<WidgetCommonProps>;
const DomainsWidget = withSuspenseFallback(
  lazy(() => import('../components/MyData/Widgets/DomainsWidget/DomainsWidget'))
) as ComponentType<WidgetCommonProps>;
const KPIWidget = withSuspenseFallback(
  lazy(
    () => import('../components/MyData/Widgets/KPIWidget/KPIWidget.component')
  )
) as ComponentType<WidgetCommonProps>;
const MyTaskWidget = withSuspenseFallback(
  lazy(() => import('../components/MyData/Widgets/MyTaskWidget/MyTaskWidget'))
) as ComponentType<WidgetCommonProps>;
const TotalDataAssetsWidget = withSuspenseFallback(
  lazy(
    () =>
      import(
        '../components/MyData/Widgets/TotalDataAssetsWidget/TotalDataAssetsWidget.component'
      )
  )
) as ComponentType<WidgetCommonProps>;

// This registry is intentionally isolated from the layout class base. The
// class base is imported for sizing/defaults on /my-data, while widget chunks
// should only become reachable through the deferred widget render path.
export const getMyDataWidgetFromKey = (
  widgetKey: string
): ComponentType<WidgetCommonProps> => {
  if (widgetKey.startsWith(LandingPageWidgetKeys.DATA_ASSETS)) {
    return DataAssetsWidget;
  }
  if (widgetKey.startsWith(LandingPageWidgetKeys.DATA_PRODUCTS)) {
    return DataProductsWidget;
  }
  if (widgetKey.startsWith(LandingPageWidgetKeys.MY_DATA)) {
    return MyDataWidget;
  }
  if (widgetKey.startsWith(LandingPageWidgetKeys.ACTIVITY_FEED)) {
    return MyFeedWidget;
  }
  if (widgetKey.startsWith(LandingPageWidgetKeys.KPI)) {
    return KPIWidget;
  }
  if (widgetKey.startsWith(LandingPageWidgetKeys.TOTAL_DATA_ASSETS)) {
    return TotalDataAssetsWidget;
  }
  if (widgetKey.startsWith(LandingPageWidgetKeys.FOLLOWING)) {
    return FollowingWidget;
  }
  if (widgetKey.startsWith(LandingPageWidgetKeys.CURATED_ASSETS)) {
    return CuratedAssetsWidget;
  }
  if (widgetKey.startsWith(LandingPageWidgetKeys.MY_TASK)) {
    return MyTaskWidget;
  }
  if (widgetKey.startsWith(LandingPageWidgetKeys.DOMAINS)) {
    return DomainsWidget;
  }
  if (widgetKey.startsWith(LandingPageWidgetKeys.KNOWLEDGE_CENTER)) {
    return KnowledgeCenterWidget;
  }

  return (() => null) as ComponentType<WidgetCommonProps>;
};
