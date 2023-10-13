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

import { LandingPageWidgetKeys } from '../enums/CustomizablePage.enum';

export const DEFAULT_WIDGET_HEIGHT = 3;
export const LANDING_PAGE_WIDGET_MARGIN = 16;
export const LANDING_PAGE_ROW_HEIGHT = 100;
export const LANDING_PAGE_RIGHT_CONTAINER_EDIT_HEIGHT = 16;
export const LANDING_PAGE_MAX_GRID_SIZE = 3;
export const LANDING_PAGE_RIGHT_CONTAINER_MAX_GRID_SIZE = 1;

export const LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS = {
  activityFeed: 5,
  rightSidebar: 11.5,
  announcements: 3.9,
  following: 2.4,
  recentlyViewed: 2.1,
  myData: 2.8,
  kpi: 2.8,
  totalDataAssets: 3.42,
};

export const RIGHT_PANEL_LAYOUT = [
  {
    h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.announcements,
    i: LandingPageWidgetKeys.ANNOUNCEMENTS,
    w: 1,
    x: 0,
    y: 0,
    static: false,
  },
  {
    h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.following,
    i: LandingPageWidgetKeys.FOLLOWING,
    w: 1,
    x: 0,
    y: 1.5,
    static: false,
  },
  {
    h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.recentlyViewed,
    i: LandingPageWidgetKeys.RECENTLY_VIEWED,
    w: 1,
    x: 0,
    y: 3,
    static: false,
  },
];

export const LANDING_PAGE_LAYOUT = [
  {
    h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.activityFeed,
    i: LandingPageWidgetKeys.ACTIVITY_FEED,
    w: 3,
    x: 0,
    y: 0,
    static: false,
  },
  {
    h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.rightSidebar,
    i: LandingPageWidgetKeys.RIGHT_PANEL,
    w: 1,
    x: 3,
    y: 0,
    data: {
      page: {
        layout: RIGHT_PANEL_LAYOUT,
      },
    },
    static: true,
  },
  {
    h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.myData,
    i: LandingPageWidgetKeys.MY_DATA,
    w: 1,
    x: 0,
    y: 6,
    static: false,
  },
  {
    h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.kpi,
    i: LandingPageWidgetKeys.KPI,
    w: 2,
    x: 1,
    y: 6,
    static: false,
  },
  {
    h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.totalDataAssets,
    i: LandingPageWidgetKeys.TOTAL_DATA_ASSETS,
    w: 3,
    x: 0,
    y: 9.1,
    static: false,
  },
];
