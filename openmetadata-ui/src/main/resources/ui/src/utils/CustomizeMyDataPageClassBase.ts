/*
 *  Copyright 2023 Collate.
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

import { ComponentType, lazy } from 'react';
import ActivityFeedImg from '../assets/img/activity-feed-widget.png';
import CuratedAssetsImg from '../assets/img/curated-assets.png';
import DataAssetsImg from '../assets/img/data-assets-widget.png';
import DataProductsImg from '../assets/img/data-products-widget.png';
import DomainsImg from '../assets/img/domains-widget.png';
import FollowingImg from '../assets/img/following-widget.png';
import KPISmallImg from '../assets/img/kpi-widget.png';
import KPIImg from '../assets/img/kpi.png';
import MyDataImg from '../assets/img/my-data-widget.png';
import MyTaskImg from '../assets/img/my-task-widget.png';
import TotalAssetsMediumImg from '../assets/img/total-assets-medium.png';
import TotalAssetsImg from '../assets/img/total-assets-widget.png';
import KnowledgeCenterWidgetImg from '../assets/img/widgets/knowledge-center-widget.png';
import {
  LandingPageWidgetKeys,
  WidgetWidths,
} from '../enums/CustomizablePage.enum';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../pages/CustomizablePage/CustomizablePage.interface';

const KnowledgeCenterWidget = lazy(
  () =>
    import(
      '../components/KnowledgeCenter/KnowledgeCenterWidget/KnowledgeCenterWidget'
    )
);
const MyFeedWidget = lazy(() =>
  import('../components/MyData/FeedWidget/FeedWidget.component').then((m) => ({
    default: m.MyFeedWidget,
  }))
);
const MyDataWidget = lazy(() =>
  import('../components/MyData/MyDataWidget/MyDataWidget.component').then(
    (m) => ({ default: m.MyDataWidget })
  )
);
const FollowingWidget = lazy(
  () => import('../components/MyData/RightSidebar/FollowingWidget')
);
const CuratedAssetsWidget = lazy(
  () =>
    import(
      '../components/MyData/Widgets/CuratedAssetsWidget/CuratedAssetsWidget'
    )
);
const DataAssetsWidget = lazy(
  () =>
    import(
      '../components/MyData/Widgets/DataAssetsWidget/DataAssetsWidget.component'
    )
);
const DataProductsWidget = lazy(
  () =>
    import(
      '../components/MyData/Widgets/DataProductsWidget/DataProductsWidget.component'
    )
);
const DomainsWidget = lazy(
  () => import('../components/MyData/Widgets/DomainsWidget/DomainsWidget')
);
const KPIWidget = lazy(
  () => import('../components/MyData/Widgets/KPIWidget/KPIWidget.component')
);
const MyTaskWidget = lazy(
  () => import('../components/MyData/Widgets/MyTaskWidget/MyTaskWidget')
);
const TotalDataAssetsWidget = lazy(
  () =>
    import(
      '../components/MyData/Widgets/TotalDataAssetsWidget/TotalDataAssetsWidget.component'
    )
);

class CustomizeMyDataPageClassBase {
  defaultWidgetHeight = 3;
  landingPageWidgetMargin = 16;
  landingPageRowHeight = 133.33;
  landingPageMaxGridSize = 3;

  landingPageWidgetDefaultHeights: Record<string, number> = {
    activityFeed: 3,
    announcements: 3,
    following: 3,
    myData: 3,
    kpi: 3,
    totalAssets: 3,
    DataAssets: 3,
    DataProducts: 3,
    curatedAssets: 3,
    myTask: 3,
    domains: 3,
    knowledgeCenter: 3,
  };

  curatedAssetsWidgetDefaultValues: WidgetConfig = {
    config: {
      sortBy: 'latest',
    },
    h: this.landingPageWidgetDefaultHeights.curatedAssets,
    i: LandingPageWidgetKeys.CURATED_ASSETS,
    static: false,
    w: 1,
    x: 2,
    y: 0,
  };

  myTaskWidgetDefaultValues: WidgetConfig = {
    h: this.landingPageWidgetDefaultHeights.myTask,
    i: LandingPageWidgetKeys.MY_TASK,
    static: false,
    w: 1,
    x: 2,
    y: 1,
  };

  domainsWidgetDefaultValues: WidgetConfig = {
    h: this.landingPageWidgetDefaultHeights.domains,
    i: LandingPageWidgetKeys.DOMAINS,
    static: false,
    w: 1,
    x: 2,
    y: 2,
  };

  defaultLayout: Array<WidgetConfig> = [
    {
      h: this.landingPageWidgetDefaultHeights.activityFeed,
      i: LandingPageWidgetKeys.ACTIVITY_FEED,
      w: 1,
      x: 0,
      y: 0,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.DataAssets,
      i: LandingPageWidgetKeys.DATA_ASSETS,
      w: 1,
      x: 1,
      y: 0,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.knowledgeCenter,
      i: LandingPageWidgetKeys.KNOWLEDGE_CENTER,
      w: 1,
      x: 2,
      y: 0,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.myData,
      i: LandingPageWidgetKeys.MY_DATA,
      w: 1,
      x: 0,
      y: 1,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.kpi,
      i: LandingPageWidgetKeys.KPI,
      w: 1,
      x: 1,
      y: 1,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.totalAssets,
      i: LandingPageWidgetKeys.TOTAL_DATA_ASSETS,
      w: 1,
      x: 2,
      y: 1,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.following,
      i: LandingPageWidgetKeys.FOLLOWING,
      w: 1,
      x: 0,
      y: 2,
      static: false,
    },
  ];

  protected updateDefaultLayoutLayout(layout: Array<WidgetConfig>) {
    this.defaultLayout = layout;
  }

  protected updateLandingPageWidgetDefaultHeights(obj: Record<string, number>) {
    this.landingPageWidgetDefaultHeights = obj;
  }

  /**
   *
   * @param string widgetKey
   * @returns React.FC<
    {
      isEditView?: boolean;
      widgetKey: string;
      handleRemoveWidget?: (widgetKey: string) => void;
      announcements: Thread[];
      followedData: EntityReference[];
      isLoadingOwnedData: boolean;
    }
  >
   */
  public getWidgetsFromKey(
    widgetKey: string
  ): ComponentType<WidgetCommonProps> {
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

    return (() => null) as React.FC;
  }

  public getWidgetImageFromKey(widgetKey: string, size?: number): string {
    switch (widgetKey) {
      case LandingPageWidgetKeys.ACTIVITY_FEED: {
        return ActivityFeedImg;
      }
      case LandingPageWidgetKeys.DATA_ASSETS: {
        return DataAssetsImg;
      }
      case LandingPageWidgetKeys.DATA_PRODUCTS: {
        return DataProductsImg;
      }
      case LandingPageWidgetKeys.MY_DATA: {
        return MyDataImg;
      }
      case LandingPageWidgetKeys.KPI: {
        if (size === WidgetWidths.small) {
          return KPISmallImg;
        }

        return KPIImg;
      }
      case LandingPageWidgetKeys.TOTAL_DATA_ASSETS: {
        if (size === WidgetWidths.medium) {
          return TotalAssetsMediumImg;
        }

        return TotalAssetsImg;
      }
      case LandingPageWidgetKeys.FOLLOWING: {
        return FollowingImg;
      }
      case LandingPageWidgetKeys.CURATED_ASSETS: {
        return CuratedAssetsImg;
      }
      case LandingPageWidgetKeys.MY_TASK: {
        return MyTaskImg;
      }
      case LandingPageWidgetKeys.DOMAINS: {
        return DomainsImg;
      }
      case LandingPageWidgetKeys.KNOWLEDGE_CENTER:
      case DetailPageWidgetKeys.KNOWLEDGE_ARTICLE: {
        return KnowledgeCenterWidgetImg;
      }
      default: {
        return '';
      }
    }
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case 'ActivityFeed':
        return this.landingPageWidgetDefaultHeights.activityFeed;

      case 'DataAssets':
        return this.landingPageWidgetDefaultHeights.DataAssets;

      case 'DataProducts':
        return this.landingPageWidgetDefaultHeights.DataProducts;

      case 'Announcements':
        return this.landingPageWidgetDefaultHeights.announcements;

      case 'Following':
        return this.landingPageWidgetDefaultHeights.following;

      case 'MyData':
        return this.landingPageWidgetDefaultHeights.myData;

      case 'KPI':
        return this.landingPageWidgetDefaultHeights.kpi;

      case 'TotalAssets':
        return this.landingPageWidgetDefaultHeights.totalAssets;

      case 'CuratedAssets':
        return this.landingPageWidgetDefaultHeights.curatedAssets;

      case 'MyTask':
        return this.landingPageWidgetDefaultHeights.myTask;

      case 'Domains':
        return this.landingPageWidgetDefaultHeights.domains;

      case 'KnowledgeCenter':
        return this.landingPageWidgetDefaultHeights.knowledgeCenter;

      default:
        return this.defaultWidgetHeight;
    }
  }
}

const customizeMyDataPageClassBase = new CustomizeMyDataPageClassBase();

export default customizeMyDataPageClassBase;
export { CustomizeMyDataPageClassBase };
