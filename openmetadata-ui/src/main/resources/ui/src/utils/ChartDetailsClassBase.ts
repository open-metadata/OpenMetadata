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
import { TabProps } from '../components/common/TabsLabel/TabsLabel.interface';
import { CHART_DUMMY_DATA } from '../constants/Chart.constants';
import {
  CUSTOM_PROPERTIES_WIDGET,
  DATA_PRODUCTS_WIDGET,
  DESCRIPTION_WIDGET,
  GLOSSARY_TERMS_WIDGET,
  TAGS_WIDGET,
} from '../constants/CustomizeWidgets.constants';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { Chart } from '../generated/entity/data/chart';
import { Tab } from '../generated/system/ui/page';
import { FeedCounts } from '../interface/feed.interface';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import {
  getChartDetailPageTabs,
  getChartWidgetsFromKey,
} from './ChartDetailsUtils.tsx';
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';

export interface ChartDetailsTabsProps {
  chartDetails: Chart;
  editLineagePermission: boolean;
  editCustomAttributePermission: boolean;
  viewAllPermission: boolean;
  handleFeedCount: (data: FeedCounts) => void;
  feedCount: FeedCounts;
  activeTab: EntityTabs;
  deleted: boolean;
  getEntityFeedCount: () => Promise<void>;
  fetchChart: () => void;
  labelMap: Record<EntityTabs, string>;
}

type ChartDetailsWidgetKeys =
  | DetailPageWidgetKeys.DESCRIPTION
  | DetailPageWidgetKeys.DATA_PRODUCTS
  | DetailPageWidgetKeys.TAGS
  | DetailPageWidgetKeys.GLOSSARY_TERMS
  | DetailPageWidgetKeys.CUSTOM_PROPERTIES;

class ChartDetailsClassBase {
  defaultWidgetHeight: Record<ChartDetailsWidgetKeys, number>;

  constructor() {
    this.defaultWidgetHeight = {
      [DetailPageWidgetKeys.DESCRIPTION]: 2,
      [DetailPageWidgetKeys.DATA_PRODUCTS]: 2,
      [DetailPageWidgetKeys.TAGS]: 2,
      [DetailPageWidgetKeys.GLOSSARY_TERMS]: 2,
      [DetailPageWidgetKeys.CUSTOM_PROPERTIES]: 4,
    };
  }

  public getChartDetailPageTabs(tabsProps: ChartDetailsTabsProps): TabProps[] {
    return getChartDetailPageTabs(tabsProps);
  }

  public getChartDetailPageTabsIds(): Tab[] {
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

  public getDefaultLayout(tab?: EntityTabs): WidgetConfig[] {
    if (tab && tab !== EntityTabs.DETAILS) {
      return [];
    }

    return [
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION] + 0.3,
        i: DetailPageWidgetKeys.LEFT_PANEL,
        w: 6,
        x: 0,
        y: 0,
        children: [
          {
            h: this.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION],
            i: DetailPageWidgetKeys.DESCRIPTION,
            w: 1,
            x: 0,
            y: 0,
            static: false,
          },
        ],
        static: true,
      },
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.DATA_PRODUCTS],
        i: DetailPageWidgetKeys.DATA_PRODUCTS,
        w: 2,
        x: 6,
        y: 1,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.TAGS],
        i: DetailPageWidgetKeys.TAGS,
        w: 2,
        x: 6,
        y: 2,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.GLOSSARY_TERMS],
        i: DetailPageWidgetKeys.GLOSSARY_TERMS,
        w: 2,
        x: 6,
        y: 3,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.CUSTOM_PROPERTIES],
        i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
        w: 2,
        x: 6,
        y: 6,
        static: false,
      },
    ];
  }

  public getDummyData(): Chart {
    return CHART_DUMMY_DATA;
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      DATA_PRODUCTS_WIDGET,
      TAGS_WIDGET,
      GLOSSARY_TERMS_WIDGET,
      CUSTOM_PROPERTIES_WIDGET,
    ];
  }

  public getWidgetsFromKey(widgetConfig: WidgetConfig) {
    return getChartWidgetsFromKey(widgetConfig);
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case DetailPageWidgetKeys.DESCRIPTION:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION];
      case DetailPageWidgetKeys.DATA_PRODUCTS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.DATA_PRODUCTS];
      case DetailPageWidgetKeys.TAGS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.TAGS];
      case DetailPageWidgetKeys.GLOSSARY_TERMS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.GLOSSARY_TERMS];
      case DetailPageWidgetKeys.CUSTOM_PROPERTIES:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.CUSTOM_PROPERTIES];
      default:
        return 1;
    }
  }
}

const chartDetailsClassBase = new ChartDetailsClassBase();

export default chartDetailsClassBase;
export { ChartDetailsClassBase };
