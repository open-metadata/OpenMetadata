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

import { FC } from 'react';
import ActivityFeedImg from '../assets/img/activity-feed-widget.png';
import AnnouncementImg from '../assets/img/announcement.png';
import CuratedAssetsImg from '../assets/img/curated-assets.png';
import DataAssetsImg from '../assets/img/data-assets-widget.png';
import FollowingImg from '../assets/img/following-widget.png';
import KPISmallImg from '../assets/img/kpi-widget.png';
import KPIImg from '../assets/img/kpi.png';
import MyDataImg from '../assets/img/my-data-widget.png';
import MyTaskImg from '../assets/img/my-task-widget.png';
import RecentViewsImg from '../assets/img/recent-views.png';
import TotalAssetsMediumImg from '../assets/img/total-assets-medium.png';
import TotalAssetsImg from '../assets/img/total-assets-widget.png';
import { ReactComponent as ActivityFeedIcon } from '../assets/svg/ic-activity-feed.svg';
import { ReactComponent as DataAssetsIcon } from '../assets/svg/ic-data-assets.svg';
import { ReactComponent as FollowingIcon } from '../assets/svg/ic-following-assets.svg';
import { ReactComponent as KPIIcon } from '../assets/svg/ic-kpi-widget.svg';
import { ReactComponent as MyDataIcon } from '../assets/svg/ic-my-data.svg';
import { ReactComponent as TotalAssetsIcon } from '../assets/svg/ic-total-data-assets.svg';
import { MyDataWidget } from '../components/MyData/MyDataWidget/MyDataWidget.component';
import AnnouncementsWidget, {
  AnnouncementsWidgetProps,
} from '../components/MyData/RightSidebar/AnnouncementsWidget';
import FollowingWidget, {
  FollowingWidgetProps,
} from '../components/MyData/RightSidebar/FollowingWidget';
import CuratedAssetsWidget from '../components/MyData/Widgets/CuratedAssetsWidget/CuratedAssetsWidget';
import DataAssetsWidget from '../components/MyData/Widgets/DataAssetsWidget/DataAssetsWidget.component';
import FeedsWidget from '../components/MyData/Widgets/FeedsWidget/FeedsWidget.component';
import KPIWidget from '../components/MyData/Widgets/KPIWidget/KPIWidget.component';
import MyTaskWidget from '../components/MyData/Widgets/MyTaskWidget/MyTaskWidget';
import RecentlyViewed from '../components/MyData/Widgets/RecentlyViewed/RecentlyViewed';
import TotalDataAssetsWidget from '../components/MyData/Widgets/TotalDataAssetsWidget/TotalDataAssetsWidget.component';
import {
  LandingPageWidgetKeys,
  WidgetWidths,
} from '../enums/CustomizablePage.enum';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../pages/CustomizablePage/CustomizablePage.interface';

class CustomizeMyDataPageClassBase {
  defaultWidgetHeight = 3;
  landingPageWidgetMargin = 16;
  landingPageRowHeight = 100;
  landingPageMaxGridSize = 3;

  landingPageWidgetDefaultHeights: Record<string, number> = {
    activityFeed: 4,
    announcements: 4,
    following: 4,
    recentlyViewed: 4,
    myData: 4,
    kpi: 4,
    totalAssets: 4,
    DataAssets: 4,
    curatedAssets: 4,
    myTask: 4,
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
    y: 12,
  };

  myTaskWidgetDefaultValues: WidgetConfig = {
    h: this.landingPageWidgetDefaultHeights.myTask,
    i: LandingPageWidgetKeys.MY_TASK,
    static: false,
    w: 1,
    x: 2,
    y: 12,
  };

  announcementWidget: WidgetConfig = {
    h: this.landingPageWidgetDefaultHeights.announcements,
    i: LandingPageWidgetKeys.ANNOUNCEMENTS,
    w: 1,
    x: 2,
    y: 0,
    static: true, // Making announcement widget fixed on top right position
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
      h: this.landingPageWidgetDefaultHeights.myData,
      i: LandingPageWidgetKeys.MY_DATA,
      w: 1,
      x: 0,
      y: 4,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.kpi,
      i: LandingPageWidgetKeys.KPI,
      w: 1,
      x: 1,
      y: 4,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.totalAssets,
      i: LandingPageWidgetKeys.TOTAL_DATA_ASSETS,
      w: 1,
      x: 2,
      y: 4,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.following,
      i: LandingPageWidgetKeys.FOLLOWING,
      w: 1,
      x: 0,
      y: 8,
      static: false,
    },
    {
      h: this.landingPageWidgetDefaultHeights.recentlyViewed,
      i: LandingPageWidgetKeys.RECENTLY_VIEWED,
      w: 1,
      x: 1,
      y: 8,
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
  ): FC<WidgetCommonProps & AnnouncementsWidgetProps & FollowingWidgetProps> {
    if (widgetKey.startsWith(LandingPageWidgetKeys.ACTIVITY_FEED)) {
      return FeedsWidget;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.DATA_ASSETS)) {
      return DataAssetsWidget;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.MY_DATA)) {
      return MyDataWidget;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.KPI)) {
      return KPIWidget;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.TOTAL_DATA_ASSETS)) {
      return TotalDataAssetsWidget;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.ANNOUNCEMENTS)) {
      return AnnouncementsWidget;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.FOLLOWING)) {
      return FollowingWidget;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.RECENTLY_VIEWED)) {
      return RecentlyViewed;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.CURATED_ASSETS)) {
      return CuratedAssetsWidget;
    }
    if (widgetKey.startsWith(LandingPageWidgetKeys.MY_TASK)) {
      return MyTaskWidget;
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
      case LandingPageWidgetKeys.ANNOUNCEMENTS: {
        return AnnouncementImg;
      }
      case LandingPageWidgetKeys.FOLLOWING: {
        return FollowingImg;
      }
      case LandingPageWidgetKeys.RECENTLY_VIEWED: {
        return RecentViewsImg;
      }
      case LandingPageWidgetKeys.CURATED_ASSETS: {
        return CuratedAssetsImg;
      }
      case LandingPageWidgetKeys.MY_TASK: {
        return MyTaskImg;
      }
      default: {
        return '';
      }
    }
  }

  public getWidgetIconFromKey(widgetKey: string) {
    switch (widgetKey) {
      case LandingPageWidgetKeys.ACTIVITY_FEED: {
        return ActivityFeedIcon;
      }
      case LandingPageWidgetKeys.DATA_ASSETS: {
        return DataAssetsIcon;
      }
      case LandingPageWidgetKeys.MY_DATA: {
        return MyDataIcon;
      }
      case LandingPageWidgetKeys.KPI: {
        return KPIIcon;
      }
      case LandingPageWidgetKeys.TOTAL_DATA_ASSETS: {
        return TotalAssetsIcon;
      }
      case LandingPageWidgetKeys.FOLLOWING: {
        return FollowingIcon;
      }
      case LandingPageWidgetKeys.CURATED_ASSETS: {
        return FollowingIcon;
      }
      case LandingPageWidgetKeys.MY_TASK: {
        return FollowingIcon;
      }
      default: {
        return null;
      }
    }
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case 'ActivityFeed':
        return this.landingPageWidgetDefaultHeights.activityFeed;
      case 'DataAssets':
        return this.landingPageWidgetDefaultHeights.DataAssets;
      case 'Announcements':
        return this.landingPageWidgetDefaultHeights.announcements;
      case 'Following':
        return this.landingPageWidgetDefaultHeights.following;
      case 'RecentlyViewed':
        return this.landingPageWidgetDefaultHeights.recentlyViewed;
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
      default:
        return this.defaultWidgetHeight;
    }
  }
}

const customizeMyDataPageClassBase = new CustomizeMyDataPageClassBase();

export default customizeMyDataPageClassBase;
export { CustomizeMyDataPageClassBase };
