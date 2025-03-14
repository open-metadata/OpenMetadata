/*
 *  Copyright 2024 Collate.
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
import { Layout } from 'react-grid-layout';
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import {
  CUSTOM_PROPERTIES_WIDGET,
  DATA_PRODUCTS_WIDGET,
  DESCRIPTION_WIDGET,
  GLOSSARY_TERMS_WIDGET,
  GridSizes,
  TAGS_WIDGET,
} from '../constants/CustomizeWidgets.constants';
import { DASHBOARD_DUMMY_DATA } from '../constants/Dashboard.constnats';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { Dashboard } from '../generated/entity/data/dashboard';
import { Tab } from '../generated/system/ui/page';
import { FeedCounts } from '../interface/feed.interface';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';
import {
  getDashboardDetailPageTabs,
  getDashboardWidgetsFromKey,
} from './DashboardDetailsUtils';
import i18n from './i18next/LocalUtil';

export interface DashboardDetailsTabsProps {
  dashboardDetails: Dashboard;
  editLineagePermission: boolean;
  editCustomAttributePermission: boolean;
  viewAllPermission: boolean;
  handleFeedCount: (data: FeedCounts) => void;
  feedCount: FeedCounts;
  activeTab: EntityTabs;
  deleted: boolean;
  getEntityFeedCount: () => Promise<void>;
  fetchDashboard: () => void;
  labelMap: Record<EntityTabs, string>;
}

enum DashboardDetailsWidgetKeys {
  DESCRIPTION = DetailPageWidgetKeys.DESCRIPTION,
  CHARTS_TABLE = DetailPageWidgetKeys.CHARTS_TABLE,
  DATA_PRODUCTS = DetailPageWidgetKeys.DATA_PRODUCTS,
  TAGS = DetailPageWidgetKeys.TAGS,
  GLOSSARY_TERMS = DetailPageWidgetKeys.GLOSSARY_TERMS,
  CUSTOM_PROPERTIES = DetailPageWidgetKeys.CUSTOM_PROPERTIES,
}

class DashboardDetailsClassBase {
  defaultWidgetHeight: Record<DashboardDetailsWidgetKeys, number>;

  constructor() {
    this.defaultWidgetHeight = {
      [DashboardDetailsWidgetKeys.DESCRIPTION]: 2,
      [DashboardDetailsWidgetKeys.CHARTS_TABLE]: 6,
      [DashboardDetailsWidgetKeys.DATA_PRODUCTS]: 2,
      [DashboardDetailsWidgetKeys.TAGS]: 2,
      [DashboardDetailsWidgetKeys.GLOSSARY_TERMS]: 2,
      [DashboardDetailsWidgetKeys.CUSTOM_PROPERTIES]: 4,
    };
  }

  public getDashboardDetailPageTabs(
    tabsProps: DashboardDetailsTabsProps
  ): TabProps[] {
    return getDashboardDetailPageTabs(tabsProps);
  }

  public getDashboardDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.DETAILS,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.LINEAGE,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: tab === EntityTabs.DETAILS,
    }));
  }

  public getDefaultLayout(tab?: EntityTabs): Layout[] {
    if (tab && tab !== EntityTabs.DETAILS) {
      return [];
    }

    return [
      {
        h: this.defaultWidgetHeight[DashboardDetailsWidgetKeys.DESCRIPTION],
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DashboardDetailsWidgetKeys.CHARTS_TABLE],
        i: DetailPageWidgetKeys.CHARTS_TABLE,
        w: 6,
        x: 0,
        y: 2,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DashboardDetailsWidgetKeys.DATA_PRODUCTS],
        i: DetailPageWidgetKeys.DATA_PRODUCTS,
        w: 2,
        x: 6,
        y: 1,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DashboardDetailsWidgetKeys.TAGS],
        i: DetailPageWidgetKeys.TAGS,
        w: 2,
        x: 6,
        y: 2,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DashboardDetailsWidgetKeys.GLOSSARY_TERMS],
        i: DetailPageWidgetKeys.GLOSSARY_TERMS,
        w: 2,
        x: 6,
        y: 3,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[
          DashboardDetailsWidgetKeys.CUSTOM_PROPERTIES
        ],
        i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
        w: 2,
        x: 6,
        y: 6,
        static: false,
      },
    ];
  }

  public getDummyData(): Dashboard {
    return DASHBOARD_DUMMY_DATA;
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.CHARTS_TABLE,
        name: i18n.t('label.chart-plural'),
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      },
      DATA_PRODUCTS_WIDGET,
      TAGS_WIDGET,
      GLOSSARY_TERMS_WIDGET,
      CUSTOM_PROPERTIES_WIDGET,
    ];
  }

  public getWidgetsFromKey(widgetConfig: WidgetConfig) {
    return getDashboardWidgetsFromKey(widgetConfig);
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case DetailPageWidgetKeys.DESCRIPTION:
        return this.defaultWidgetHeight[DashboardDetailsWidgetKeys.DESCRIPTION];
      case DetailPageWidgetKeys.CHARTS_TABLE:
        return this.defaultWidgetHeight[
          DashboardDetailsWidgetKeys.CHARTS_TABLE
        ];
      case DetailPageWidgetKeys.DATA_PRODUCTS:
        return this.defaultWidgetHeight[
          DashboardDetailsWidgetKeys.DATA_PRODUCTS
        ];
      case DetailPageWidgetKeys.TAGS:
        return this.defaultWidgetHeight[DashboardDetailsWidgetKeys.TAGS];
      case DetailPageWidgetKeys.GLOSSARY_TERMS:
        return this.defaultWidgetHeight[
          DashboardDetailsWidgetKeys.GLOSSARY_TERMS
        ];
      case DetailPageWidgetKeys.CUSTOM_PROPERTIES:
        return this.defaultWidgetHeight[
          DashboardDetailsWidgetKeys.CUSTOM_PROPERTIES
        ];
      default:
        return 1;
    }
  }
}

const dashboardDetailsClassBase = new DashboardDetailsClassBase();

export default dashboardDetailsClassBase;
export { DashboardDetailsClassBase };
