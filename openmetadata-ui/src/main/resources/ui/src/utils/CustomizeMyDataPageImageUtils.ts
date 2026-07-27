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

// Widget preview screenshots are only needed inside customize/add-widget flows.
// Keeping them out of CustomizeMyDataPageClassBase avoids preloading these
// image modules when /my-data only needs layout defaults.
export const getMyDataWidgetImageFromKey = (
  widgetKey: string,
  size?: number
): string => {
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
};
