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

import MyTaskImg from '../assets/img/my-task-widget.png';
import ActivityFeedImg from '../assets/img/widgets/activity-feed-widget.png';
import KnowledgeCenterWidgetImg from '../assets/img/widgets/context-center-widget.png';
import CuratedAssetsImg from '../assets/img/widgets/curated-assets.png';
import DataAssetsImg from '../assets/img/widgets/data-assets-widget.png';
import DataProductsImg from '../assets/img/widgets/data-products-widget.png';
import DomainsImg from '../assets/img/widgets/domains-widget.png';
import FollowingImg from '../assets/img/widgets/following-widget.png';
import KPIImg from '../assets/img/widgets/kpi-widget.png';
import MyDataImg from '../assets/img/widgets/my-data-widget.png';
import TotalAssetsImg from '../assets/img/widgets/total-assets-widget.png';
import { LandingPageWidgetKeys } from '../enums/CustomizablePage.enum';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';

// Widget preview screenshots are only needed inside customize/add-widget flows.
// Keeping them out of CustomizeMyDataPageClassBase avoids preloading these
// image modules when /my-data only needs layout defaults.
const WIDGET_IMAGE_BY_KEY: ReadonlyArray<[string, string]> = [
  [LandingPageWidgetKeys.ACTIVITY_FEED, ActivityFeedImg],
  [LandingPageWidgetKeys.DATA_ASSETS, DataAssetsImg],
  [LandingPageWidgetKeys.DATA_PRODUCTS, DataProductsImg],
  [LandingPageWidgetKeys.MY_DATA, MyDataImg],
  [LandingPageWidgetKeys.KPI, KPIImg],
  [LandingPageWidgetKeys.TOTAL_DATA_ASSETS, TotalAssetsImg],
  [LandingPageWidgetKeys.FOLLOWING, FollowingImg],
  [LandingPageWidgetKeys.CURATED_ASSETS, CuratedAssetsImg],
  [LandingPageWidgetKeys.MY_TASK, MyTaskImg],
  [LandingPageWidgetKeys.DOMAINS, DomainsImg],
  [LandingPageWidgetKeys.KNOWLEDGE_CENTER, KnowledgeCenterWidgetImg],
  [DetailPageWidgetKeys.KNOWLEDGE_ARTICLE, KnowledgeCenterWidgetImg],
];

export const getMyDataWidgetImageFromKey = (widgetKey: string): string => {
  const match = WIDGET_IMAGE_BY_KEY.find(([key]) => key === widgetKey);

  return match ? match[1] : '';
};
