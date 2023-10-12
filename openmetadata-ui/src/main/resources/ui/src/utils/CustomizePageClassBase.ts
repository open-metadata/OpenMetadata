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
import ActivityFeedImg from '../assets/img/activity-feed.png';
import AnnouncementImg from '../assets/img/announcement.png';
import FollowingImg from '../assets/img/following.png';
import KPIImg from '../assets/img/kpi.png';
import MyDataImg from '../assets/img/my-data.png';
import RecentViewsImg from '../assets/img/recent-views.png';
import TotalAssetsImg from '../assets/img/total-assets.png';
import KPIWidget from '../components/KPIWidget/KPIWidget.component';
import { MyDataWidget } from '../components/MyData/MyDataWidget/MyDataWidget.component';
import AnnouncementsWidget, {
  AnnouncementsWidgetProps,
} from '../components/MyData/RightSidebar/AnnouncementsWidget';
import FollowingWidget, {
  FollowingWidgetProps,
} from '../components/MyData/RightSidebar/FollowingWidget';
import RecentlyViewed from '../components/recently-viewed/RecentlyViewed';
import TotalDataAssetsWidget from '../components/TotalDataAssetsWidget/TotalDataAssetsWidget.component';
import FeedsWidget from '../components/Widgets/FeedsWidget/FeedsWidget.component';
import { LandingPageWidgetKeys } from '../enums/CustomizablePage.enum';
import { WidgetCommonProps } from '../pages/CustomisablePages/CustomisablePage.interface';

export class CustomizePageClassBase {
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
      followedDataCount: number;
      isLoadingOwnedData: boolean;
    }
  >
   */
  static getWidgetsFromKey = (
    widgetKey: string
  ): FC<
    WidgetCommonProps & AnnouncementsWidgetProps & FollowingWidgetProps
  > => {
    if (widgetKey.startsWith(LandingPageWidgetKeys.ACTIVITY_FEED)) {
      return FeedsWidget;
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

    return (() => null) as React.FC;
  };

  static getWidgetImageFromKey = (widgetKey: string): string => {
    switch (widgetKey) {
      case LandingPageWidgetKeys.ACTIVITY_FEED: {
        return ActivityFeedImg;
      }
      case LandingPageWidgetKeys.MY_DATA: {
        return MyDataImg;
      }
      case LandingPageWidgetKeys.KPI: {
        return KPIImg;
      }
      case LandingPageWidgetKeys.TOTAL_DATA_ASSETS: {
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
      default: {
        return '';
      }
    }
  };
}
