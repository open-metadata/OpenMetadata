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

import { LandingPageWidgetKeys } from '../enums/CustomizablePage.enum';
import type { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';

export const LANDING_PAGE_DEFAULT_WIDGET_HEIGHT = 3;
export const LANDING_PAGE_WIDGET_MARGIN = 16;
export const LANDING_PAGE_ROW_HEIGHT = 133.33;
export const LANDING_PAGE_MAX_GRID_SIZE = 3;

export const LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS: Record<string, number> = {
  activityFeed: LANDING_PAGE_DEFAULT_WIDGET_HEIGHT,
  announcements: LANDING_PAGE_DEFAULT_WIDGET_HEIGHT,
  following: LANDING_PAGE_DEFAULT_WIDGET_HEIGHT,
  myData: LANDING_PAGE_DEFAULT_WIDGET_HEIGHT,
  kpi: LANDING_PAGE_DEFAULT_WIDGET_HEIGHT,
  totalAssets: LANDING_PAGE_DEFAULT_WIDGET_HEIGHT,
  DataAssets: LANDING_PAGE_DEFAULT_WIDGET_HEIGHT,
  DataProducts: LANDING_PAGE_DEFAULT_WIDGET_HEIGHT,
  curatedAssets: LANDING_PAGE_DEFAULT_WIDGET_HEIGHT,
  myTask: LANDING_PAGE_DEFAULT_WIDGET_HEIGHT,
  domains: LANDING_PAGE_DEFAULT_WIDGET_HEIGHT,
  knowledgeCenter: LANDING_PAGE_DEFAULT_WIDGET_HEIGHT,
};

export const CURATED_ASSETS_WIDGET_DEFAULT_VALUES: WidgetConfig = {
  config: {
    sortBy: 'latest',
  },
  h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.curatedAssets,
  i: LandingPageWidgetKeys.CURATED_ASSETS,
  static: false,
  w: 1,
  x: 2,
  y: 0,
};

export const MY_TASK_WIDGET_DEFAULT_VALUES: WidgetConfig = {
  h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.myTask,
  i: LandingPageWidgetKeys.MY_TASK,
  static: false,
  w: 1,
  x: 2,
  y: 1,
};

export const DOMAINS_WIDGET_DEFAULT_VALUES: WidgetConfig = {
  h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.domains,
  i: LandingPageWidgetKeys.DOMAINS,
  static: false,
  w: 1,
  x: 2,
  y: 2,
};

export const DEFAULT_LANDING_PAGE_LAYOUT: WidgetConfig[] = [
  {
    h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.activityFeed,
    i: LandingPageWidgetKeys.ACTIVITY_FEED,
    w: 1,
    x: 0,
    y: 0,
    static: false,
  },
  {
    h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.DataAssets,
    i: LandingPageWidgetKeys.DATA_ASSETS,
    w: 1,
    x: 1,
    y: 0,
    static: false,
  },
  {
    h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.knowledgeCenter,
    i: LandingPageWidgetKeys.KNOWLEDGE_CENTER,
    w: 1,
    x: 2,
    y: 0,
    static: false,
  },
  {
    h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.myData,
    i: LandingPageWidgetKeys.MY_DATA,
    w: 1,
    x: 0,
    y: 1,
    static: false,
  },
  {
    h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.kpi,
    i: LandingPageWidgetKeys.KPI,
    w: 1,
    x: 1,
    y: 1,
    static: false,
  },
  {
    h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.totalAssets,
    i: LandingPageWidgetKeys.TOTAL_DATA_ASSETS,
    w: 1,
    x: 2,
    y: 1,
    static: false,
  },
  {
    h: LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS.following,
    i: LandingPageWidgetKeys.FOLLOWING,
    w: 1,
    x: 0,
    y: 2,
    static: false,
  },
];
