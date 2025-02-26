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

class DashboardDataModelBase {
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
        h: 2,
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: 6,
        i: DetailPageWidgetKeys.DATA_MODEL,
        w: 6,
        x: 0,
        y: 2,
        static: false,
      },
      {
        h: 1,
        i: DetailPageWidgetKeys.DATA_PRODUCTS,
        w: 2,
        x: 6,
        y: 1,
        static: false,
      },
      {
        h: 2,
        i: DetailPageWidgetKeys.TAGS,
        w: 2,
        x: 6,
        y: 2,
        static: false,
      },
      {
        h: 2,
        i: DetailPageWidgetKeys.GLOSSARY_TERMS,
        w: 2,
        x: 6,
        y: 3,
        static: false,
      },
      {
        h: 4,
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
}

const dashboardDataModelClassBase = new DashboardDataModelBase();

export default dashboardDataModelClassBase;
export { DashboardDataModelBase };
