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

import type { ComponentType } from 'react';
import {
  SEARCH_INDEX_PATH_MAP,
  type SearchIndexPathMap,
} from '../components/MyData/CustomizableComponents/CustomiseLandingPageHeader/CustomiseSearchBar.constants';
import {
  CURATED_ASSETS_WIDGET_DEFAULT_VALUES,
  DEFAULT_LANDING_PAGE_LAYOUT,
  DOMAINS_WIDGET_DEFAULT_VALUES,
  LANDING_PAGE_DEFAULT_WIDGET_HEIGHT,
  LANDING_PAGE_MAX_GRID_SIZE,
  LANDING_PAGE_ROW_HEIGHT,
  LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS,
  LANDING_PAGE_WIDGET_MARGIN,
  MY_TASK_WIDGET_DEFAULT_VALUES,
} from '../constants/CustomizeMyDataPage.constants';
import type { SearchIndex } from '../enums/search.enum';
import type {
  WidgetCommonProps,
  WidgetConfig,
} from '../pages/CustomizablePage/CustomizablePage.interface';
import { getMyDataWidgetImageFromKey } from './CustomizeMyDataPageImageUtils';
import { getMyDataWidgetFromKey } from './CustomizeMyDataPageWidgetUtils';
import type { LandingPageWidgetIconSource } from './LandingPageWidgetIconUtils.interface';

const WIDGET_HEIGHT_KEY_MAP: Record<string, string> = {
  ActivityFeed: 'activityFeed',
  DataAssets: 'DataAssets',
  DataProducts: 'DataProducts',
  Announcements: 'announcements',
  Following: 'following',
  MyData: 'myData',
  KPI: 'kpi',
  TotalAssets: 'totalAssets',
  CuratedAssets: 'curatedAssets',
  MyTask: 'myTask',
  Domains: 'domains',
  KnowledgeCenter: 'knowledgeCenter',
};

class CustomizeMyDataPageClassBase {
  defaultWidgetHeight = LANDING_PAGE_DEFAULT_WIDGET_HEIGHT;
  landingPageWidgetMargin = LANDING_PAGE_WIDGET_MARGIN;
  landingPageRowHeight = LANDING_PAGE_ROW_HEIGHT;
  landingPageMaxGridSize = LANDING_PAGE_MAX_GRID_SIZE;

  landingPageWidgetDefaultHeights: Record<string, number> = {
    ...LANDING_PAGE_WIDGET_DEFAULT_HEIGHTS,
  };

  curatedAssetsWidgetDefaultValues: WidgetConfig = {
    ...CURATED_ASSETS_WIDGET_DEFAULT_VALUES,
    config: {
      ...CURATED_ASSETS_WIDGET_DEFAULT_VALUES.config,
    },
  };

  myTaskWidgetDefaultValues: WidgetConfig = {
    ...MY_TASK_WIDGET_DEFAULT_VALUES,
  };

  domainsWidgetDefaultValues: WidgetConfig = {
    ...DOMAINS_WIDGET_DEFAULT_VALUES,
  };

  defaultLayout: Array<WidgetConfig> = DEFAULT_LANDING_PAGE_LAYOUT.map(
    (widget) => ({ ...widget })
  );

  protected searchIndexPathMap: SearchIndexPathMap = {
    ...SEARCH_INDEX_PATH_MAP,
  };

  protected updateDefaultLayoutLayout(layout: Array<WidgetConfig>) {
    this.defaultLayout = layout;
  }

  protected updateLandingPageWidgetDefaultHeights(obj: Record<string, number>) {
    this.landingPageWidgetDefaultHeights = obj;
  }

  protected updateSearchIndexPathMap(obj: SearchIndexPathMap) {
    this.searchIndexPathMap = obj;
  }

  public getSearchIndexPath(searchIndex: SearchIndex | string) {
    return this.searchIndexPathMap[searchIndex as SearchIndex] ?? '';
  }

  public getLandingPageWidgetEntityIconUrl(
    _item: LandingPageWidgetIconSource
  ): string | undefined {
    return undefined;
  }

  public getLandingPageWidgetServiceIconUrl(
    _item: LandingPageWidgetIconSource
  ): string | undefined {
    return undefined;
  }

  public getExcludedWidgetFqns(): string[] {
    return [];
  }

  public getWidgetsFromKey(
    widgetKey: string
  ): ComponentType<WidgetCommonProps> {
    return getMyDataWidgetFromKey(widgetKey);
  }

  public getWidgetImageFromKey(widgetKey: string): string {
    return getMyDataWidgetImageFromKey(widgetKey);
  }

  public getWidgetHeight(widgetName: string) {
    const heightKey = WIDGET_HEIGHT_KEY_MAP[widgetName];

    return heightKey
      ? this.landingPageWidgetDefaultHeights[heightKey]
      : this.defaultWidgetHeight;
  }
}

const customizeMyDataPageClassBase = new CustomizeMyDataPageClassBase();

export default customizeMyDataPageClassBase;
export { CustomizeMyDataPageClassBase };
