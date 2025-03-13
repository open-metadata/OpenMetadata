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
import { TABLE_DUMMY_DATA } from '../constants/Table.constants';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { Table } from '../generated/entity/data/table';
import { Tab } from '../generated/system/ui/uiCustomization';
import { TestSummary } from '../generated/tests/testCase';
import { FeedCounts } from '../interface/feed.interface';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';
import i18n from './i18next/LocalUtil';
import {
  getTableDetailPageBaseTabs,
  getTableWidgetFromKey,
} from './TableUtils';

export interface TableDetailPageTabProps {
  queryCount: number;
  isTourOpen: boolean;
  activeTab: EntityTabs;
  totalFeedCount: number;
  isViewTableType: boolean;
  viewAllPermission: boolean;
  viewQueriesPermission: boolean;
  editLineagePermission: boolean;
  viewProfilerPermission: boolean;
  viewSampleDataPermission: boolean;
  tablePermissions: OperationPermission;
  editCustomAttributePermission: boolean;
  deleted?: boolean;
  tableDetails?: Table;
  testCaseSummary?: TestSummary;
  getEntityFeedCount: () => void;
  fetchTableDetails: () => Promise<void>;
  handleFeedCount: (data: FeedCounts) => void;
  labelMap?: Record<EntityTabs, string>;
}

enum TableWidgetKeys {
  DESCRIPTION = DetailPageWidgetKeys.DESCRIPTION,
  TABLE_SCHEMA = DetailPageWidgetKeys.TABLE_SCHEMA,
  FREQUENTLY_JOINED_TABLES = DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES,
  DATA_PRODUCTS = DetailPageWidgetKeys.DATA_PRODUCTS,
  TAGS = DetailPageWidgetKeys.TAGS,
  GLOSSARY_TERMS = DetailPageWidgetKeys.GLOSSARY_TERMS,
  CUSTOM_PROPERTIES = DetailPageWidgetKeys.CUSTOM_PROPERTIES,
  TABLE_CONSTRAINTS = DetailPageWidgetKeys.TABLE_CONSTRAINTS,
  PARTITIONED_KEYS = DetailPageWidgetKeys.PARTITIONED_KEYS,
}

class TableClassBase {
  defaultWidgetHeight: Record<TableWidgetKeys, number>;

  constructor() {
    this.defaultWidgetHeight = {
      [TableWidgetKeys.DESCRIPTION]: 2,
      [TableWidgetKeys.TABLE_SCHEMA]: 8,
      [TableWidgetKeys.FREQUENTLY_JOINED_TABLES]: 2,
      [TableWidgetKeys.DATA_PRODUCTS]: 2,
      [TableWidgetKeys.TAGS]: 2,
      [TableWidgetKeys.GLOSSARY_TERMS]: 2,
      [TableWidgetKeys.CUSTOM_PROPERTIES]: 4,
      [TableWidgetKeys.TABLE_CONSTRAINTS]: 2,
      [TableWidgetKeys.PARTITIONED_KEYS]: 2,
    };
  }

  public getTableDetailPageTabs(
    tableDetailsPageProps: TableDetailPageTabProps
  ): TabProps[] {
    return getTableDetailPageBaseTabs(tableDetailsPageProps);
  }

  public getTableDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.SCHEMA,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.SAMPLE_DATA,
      EntityTabs.TABLE_QUERIES,
      EntityTabs.PROFILER,
      EntityTabs.INCIDENTS,
      EntityTabs.LINEAGE,
      EntityTabs.VIEW_DEFINITION,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: tab === EntityTabs.SCHEMA,
    }));
  }

  public getDefaultLayout(tab?: EntityTabs): Layout[] {
    if (tab && tab !== EntityTabs.SCHEMA) {
      return [];
    }

    return [
      {
        h: this.defaultWidgetHeight[TableWidgetKeys.DESCRIPTION],
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[TableWidgetKeys.TABLE_SCHEMA],
        i: DetailPageWidgetKeys.TABLE_SCHEMA,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[TableWidgetKeys.FREQUENTLY_JOINED_TABLES],
        i: DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES,
        w: 2,
        x: 6,
        y: 0,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[TableWidgetKeys.DATA_PRODUCTS],
        i: DetailPageWidgetKeys.DATA_PRODUCTS,
        w: 2,
        x: 6,
        y: 1,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[TableWidgetKeys.TAGS],
        i: DetailPageWidgetKeys.TAGS,
        w: 2,
        x: 6,
        y: 2,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[TableWidgetKeys.GLOSSARY_TERMS],
        i: DetailPageWidgetKeys.GLOSSARY_TERMS,
        w: 2,
        x: 6,
        y: 3,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[TableWidgetKeys.TABLE_CONSTRAINTS],
        i: DetailPageWidgetKeys.TABLE_CONSTRAINTS,
        w: 2,
        x: 6,
        y: 4,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[TableWidgetKeys.CUSTOM_PROPERTIES],
        i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
        w: 2,
        x: 6,
        y: 6,
        static: false,
      },
    ];
  }

  public getAlertEnableStatus() {
    return false;
  }

  public getDummyData(): Table {
    return TABLE_DUMMY_DATA;
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.TABLE_SCHEMA,
        name: i18n.t('label.schema'),
        data: {
          gridSizes: ['large'] as GridSizes[],
        },
      },
      DATA_PRODUCTS_WIDGET,
      TAGS_WIDGET,
      GLOSSARY_TERMS_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES,
        name: i18n.t('label.frequently-joined-table-plural'),
        data: {
          gridSizes: ['small'] as GridSizes[],
        },
      },
      {
        fullyQualifiedName: DetailPageWidgetKeys.TABLE_CONSTRAINTS,
        name: i18n.t('label.table-constraints'),
        data: {
          gridSizes: ['small'] as GridSizes[],
        },
      },
      CUSTOM_PROPERTIES_WIDGET,
    ];
  }

  public getWidgetsFromKey(widgetConfig: WidgetConfig) {
    return getTableWidgetFromKey(widgetConfig);
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case DetailPageWidgetKeys.DESCRIPTION:
        return this.defaultWidgetHeight[TableWidgetKeys.DESCRIPTION];
      case DetailPageWidgetKeys.TABLE_SCHEMA:
        return this.defaultWidgetHeight[TableWidgetKeys.TABLE_SCHEMA];
      case DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES:
        return this.defaultWidgetHeight[
          TableWidgetKeys.FREQUENTLY_JOINED_TABLES
        ];
      case DetailPageWidgetKeys.DATA_PRODUCTS:
        return this.defaultWidgetHeight[TableWidgetKeys.DATA_PRODUCTS];
      case DetailPageWidgetKeys.TAGS:
        return this.defaultWidgetHeight[TableWidgetKeys.TAGS];
      case DetailPageWidgetKeys.GLOSSARY_TERMS:
        return this.defaultWidgetHeight[TableWidgetKeys.GLOSSARY_TERMS];
      case DetailPageWidgetKeys.TABLE_CONSTRAINTS:
        return this.defaultWidgetHeight[TableWidgetKeys.TABLE_CONSTRAINTS];
      case DetailPageWidgetKeys.PARTITIONED_KEYS:
        return this.defaultWidgetHeight[TableWidgetKeys.PARTITIONED_KEYS];
      default:
        return 1;
    }
  }
}

const tableClassBase = new TableClassBase();

export default tableClassBase;
export { TableClassBase };
