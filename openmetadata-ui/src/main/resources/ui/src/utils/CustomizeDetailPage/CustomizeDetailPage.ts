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
import { GenericWidget } from '../../components/Customization/GenericWidget/GenericWidget';
import {
  CUSTOM_PROPERTIES_WIDGET,
  DESCRIPTION_WIDGET,
  DOMAIN_WIDGET,
  OWNER_WIDGET,
  TAGS_WIDGET,
} from '../../constants/CustomizeWidgets.constants';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import {
  WidgetCommonProps,
  WidgetConfig,
} from '../../pages/CustomizablePage/CustomizablePage.interface';

class CustomizeDetailPageClassBase {
  defaultWidgetHeight = 3;
  detailPageWidgetMargin = 16;
  detailPageRowHeight = 50;
  detailPageMaxGridSize = 4;

  detailPageWidgetDefaultHeights: Record<string, number> = {
    header: 1,
    description: 6,
    tableSchema: 3,
    topicSchema: 3,
    announcement: 3,
    frequentlyJoinedTables: 3,
    dataProduct: 3,
    tags: 3,
    glossaryTerms: 3,
    customProperty: 3,
    tabs: 1,
    announcements: 3,
  };

  announcementWidget: WidgetConfig = {
    h: this.detailPageWidgetDefaultHeights.announcements,
    i: DetailPageWidgetKeys.ANNOUNCEMENTS,
    w: 1,
    x: 3,
    y: 0,
    static: false, // Making announcement widget fixed on top right position
  };

  defaultLayout: Array<WidgetConfig> = [
    {
      h: this.detailPageWidgetDefaultHeights.header,
      i: DetailPageWidgetKeys.HEADER,
      w: 4,
      x: 0,
      y: 0,
      static: true,
    },
    {
      h: this.detailPageWidgetDefaultHeights.tabs,
      i: DetailPageWidgetKeys.TABS,
      w: 4,
      x: 0,
      y: 1,
      static: false,
    },
    {
      h: this.detailPageWidgetDefaultHeights.tableSchema,
      i: DetailPageWidgetKeys.TABLE_SCHEMA,
      w: 1,
      x: 3,
      y: 6,
      static: false,
    },
    {
      h: this.detailPageWidgetDefaultHeights.dataProduct,
      i: DetailPageWidgetKeys.DATA_PRODUCTS,
      w: 2,
      x: 0,
      y: 9,
      static: false,
    },
    {
      h: this.detailPageWidgetDefaultHeights.tags,
      i: DetailPageWidgetKeys.TAGS,
      w: 3,
      x: 0,
      y: 6,
      static: false,
    },
    {
      h: this.detailPageWidgetDefaultHeights.glossaryTerms,
      i: DetailPageWidgetKeys.GLOSSARY_TERMS,
      w: 1,
      x: 3,
      y: 1.5,
      static: false,
    },
    {
      h: this.detailPageWidgetDefaultHeights.frequentlyJoinedTables,
      i: DetailPageWidgetKeys.GLOSSARY_TERMS,
      w: 1,
      x: 3,
      y: 3,
      static: false,
    },
    {
      h: this.detailPageWidgetDefaultHeights.customProperty,
      i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
      w: 1,
      x: 3,
      y: 4.5,
      static: false,
    },
    {
      h: this.detailPageWidgetDefaultHeights.announcement,
      i: DetailPageWidgetKeys.ANNOUNCEMENTS,
      w: 1,
      x: 3,
      y: 0,
      static: true,
    },
  ];

  protected updateDefaultLayoutLayout(layout: Array<WidgetConfig>) {
    this.defaultLayout = layout;
  }

  protected updateLandingPageWidgetDefaultHeights(obj: Record<string, number>) {
    this.detailPageWidgetDefaultHeights = obj;
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
      followedDataCount: number;
      isLoadingOwnedData: boolean;
    }
  >
   */
  public getWidgetsFromKey(_widgetKey: string): FC<WidgetCommonProps> {
    return GenericWidget;
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case 'ActivityFeed':
        return this.detailPageWidgetDefaultHeights.activityFeed;
      case 'DataAssets':
        return this.detailPageWidgetDefaultHeights.DataAssets;
      case 'Announcements':
        return this.detailPageWidgetDefaultHeights.announcements;
      case 'Following':
        return this.detailPageWidgetDefaultHeights.following;
      case 'RecentlyViewed':
        return this.detailPageWidgetDefaultHeights.recentlyViewed;
      case 'MyData':
        return this.detailPageWidgetDefaultHeights.myData;
      case 'KPI':
        return this.detailPageWidgetDefaultHeights.kpi;
      case 'TotalAssets':
        return this.detailPageWidgetDefaultHeights.totalAssets;
      default:
        return this.defaultWidgetHeight;
    }
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      TAGS_WIDGET,
      DOMAIN_WIDGET,
      OWNER_WIDGET,
      CUSTOM_PROPERTIES_WIDGET,
    ];
  }
}

const customizeDetailPageClassBase = new CustomizeDetailPageClassBase();

export default customizeDetailPageClassBase;
export { CustomizeDetailPageClassBase };
