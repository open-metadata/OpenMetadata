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
import { DASHBOARD_DATA_MODEL_DUMMY_DATA } from '../constants/Dashboard.constnats';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import { Tab } from '../generated/system/ui/page';
import { FeedCounts } from '../interface/feed.interface';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';
import {
  getDashboardDataModelDetailPageTabs,
  getDashboardDataModelWidgetsFromKey,
} from './DashboardDataModelUtils';
import i18n from './i18next/LocalUtil';

export interface DashboardDataModelDetailPageTabProps {
  feedCount: {
    totalCount: number;
  };
  activeTab: EntityTabs;
  handleFeedCount: (data: FeedCounts) => void;
  editLineagePermission: boolean;
  dataModelData: DashboardDataModel;
  dataModelPermissions: OperationPermission;
  deleted: boolean;
  getEntityFeedCount: () => void;
  fetchDataModel: () => void;
  labelMap?: Record<EntityTabs, string>;
}

enum DashboardDataModelWidgetKeys {
  DESCRIPTION = DetailPageWidgetKeys.DESCRIPTION,
  DATA_MODEL = DetailPageWidgetKeys.DATA_MODEL,
  DATA_PRODUCTS = DetailPageWidgetKeys.DATA_PRODUCTS,
  TAGS = DetailPageWidgetKeys.TAGS,
  GLOSSARY_TERMS = DetailPageWidgetKeys.GLOSSARY_TERMS,
  CUSTOM_PROPERTIES = DetailPageWidgetKeys.CUSTOM_PROPERTIES,
}

class DashboardDataModelBase {
  defaultWidgetHeight: Record<DashboardDataModelWidgetKeys, number>;

  constructor() {
    this.defaultWidgetHeight = {
      [DashboardDataModelWidgetKeys.DESCRIPTION]: 2,
      [DashboardDataModelWidgetKeys.DATA_MODEL]: 6,
      [DashboardDataModelWidgetKeys.DATA_PRODUCTS]: 2,
      [DashboardDataModelWidgetKeys.TAGS]: 2,
      [DashboardDataModelWidgetKeys.GLOSSARY_TERMS]: 2,
      [DashboardDataModelWidgetKeys.CUSTOM_PROPERTIES]: 4,
    };
  }

  public getDashboardDataModelDetailPageTabs(
    tabsProps: DashboardDataModelDetailPageTabProps
  ): TabProps[] {
    return getDashboardDataModelDetailPageTabs(tabsProps);
  }

  public getDashboardDataModelDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.MODEL,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.LINEAGE,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: tab === EntityTabs.MODEL,
    }));
  }

  public getDefaultLayout(tab?: EntityTabs): Layout[] {
    if (tab && tab !== EntityTabs.MODEL) {
      return [];
    }

    return [
      {
        h: this.defaultWidgetHeight[DashboardDataModelWidgetKeys.DESCRIPTION],
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DashboardDataModelWidgetKeys.DATA_MODEL],
        i: DetailPageWidgetKeys.DATA_MODEL,
        w: 6,
        x: 0,
        y: 2,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DashboardDataModelWidgetKeys.DATA_PRODUCTS],
        i: DetailPageWidgetKeys.DATA_PRODUCTS,
        w: 2,
        x: 6,
        y: 1,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DashboardDataModelWidgetKeys.TAGS],
        i: DetailPageWidgetKeys.TAGS,
        w: 2,
        x: 6,
        y: 2,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[
          DashboardDataModelWidgetKeys.GLOSSARY_TERMS
        ],
        i: DetailPageWidgetKeys.GLOSSARY_TERMS,
        w: 2,
        x: 6,
        y: 3,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[
          DashboardDataModelWidgetKeys.CUSTOM_PROPERTIES
        ],
        i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
        w: 2,
        x: 6,
        y: 6,
        static: false,
      },
    ];
  }

  public getDummyData(): DashboardDataModel {
    return DASHBOARD_DATA_MODEL_DUMMY_DATA;
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.DATA_MODEL,
        name: i18n.t('label.data-model'),
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
    return getDashboardDataModelWidgetsFromKey(widgetConfig);
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case DetailPageWidgetKeys.DESCRIPTION:
        return this.defaultWidgetHeight[
          DashboardDataModelWidgetKeys.DESCRIPTION
        ];
      case DetailPageWidgetKeys.DATA_MODEL:
        return this.defaultWidgetHeight[
          DashboardDataModelWidgetKeys.DATA_MODEL
        ];
      case DetailPageWidgetKeys.DATA_PRODUCTS:
        return this.defaultWidgetHeight[
          DashboardDataModelWidgetKeys.DATA_PRODUCTS
        ];
      case DetailPageWidgetKeys.TAGS:
        return this.defaultWidgetHeight[DashboardDataModelWidgetKeys.TAGS];
      case DetailPageWidgetKeys.GLOSSARY_TERMS:
        return this.defaultWidgetHeight[
          DashboardDataModelWidgetKeys.GLOSSARY_TERMS
        ];
      case DetailPageWidgetKeys.CUSTOM_PROPERTIES:
        return this.defaultWidgetHeight[
          DashboardDataModelWidgetKeys.CUSTOM_PROPERTIES
        ];
      default:
        return 1;
    }
  }
}

const dashboardDataModelClassBase = new DashboardDataModelBase();

export default dashboardDataModelClassBase;
export { DashboardDataModelBase };
