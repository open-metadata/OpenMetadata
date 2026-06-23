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

  public getWidgetsFromKey(
    widgetKey: string
  ): ComponentType<WidgetCommonProps> {
    return getMyDataWidgetFromKey(widgetKey);
  }

  public getWidgetImageFromKey(widgetKey: string, size?: number): string {
    return getMyDataWidgetImageFromKey(widgetKey, size);
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
