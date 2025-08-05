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
  feedCount: FeedCounts;
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

type TableWidgetKeys =
  | DetailPageWidgetKeys.DESCRIPTION
  | DetailPageWidgetKeys.TABLE_SCHEMA
  | DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES
  | DetailPageWidgetKeys.DATA_PRODUCTS
  | DetailPageWidgetKeys.TAGS
  | DetailPageWidgetKeys.GLOSSARY_TERMS
  | DetailPageWidgetKeys.CUSTOM_PROPERTIES
  | DetailPageWidgetKeys.TABLE_CONSTRAINTS
  | DetailPageWidgetKeys.PARTITIONED_KEYS;

class TableClassBase {
  defaultWidgetHeight: Record<TableWidgetKeys, number>;

  constructor() {
    this.defaultWidgetHeight = {
      [DetailPageWidgetKeys.DESCRIPTION]: 2,
      [DetailPageWidgetKeys.TABLE_SCHEMA]: 8.5,
      [DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES]: 2,
      [DetailPageWidgetKeys.DATA_PRODUCTS]: 2,
      [DetailPageWidgetKeys.TAGS]: 2,
      [DetailPageWidgetKeys.GLOSSARY_TERMS]: 2,
      [DetailPageWidgetKeys.CUSTOM_PROPERTIES]: 4,
      [DetailPageWidgetKeys.TABLE_CONSTRAINTS]: 2,
      [DetailPageWidgetKeys.PARTITIONED_KEYS]: 2,
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
      EntityTabs.LINEAGE,
      EntityTabs.DBT,
      EntityTabs.VIEW_DEFINITION,
      EntityTabs.CONTRACT,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: tab === EntityTabs.SCHEMA,
    }));
  }

  public getDefaultLayout(tab?: EntityTabs): WidgetConfig[] {
    if (tab && tab !== EntityTabs.SCHEMA) {
      return [];
    }

    return [
      {
        h:
          this.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION] +
          this.defaultWidgetHeight[DetailPageWidgetKeys.TABLE_SCHEMA] +
          // Padding for left panel container
          0.5,
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
          {
            h: this.defaultWidgetHeight[DetailPageWidgetKeys.TABLE_SCHEMA],
            i: DetailPageWidgetKeys.TABLE_SCHEMA,
            w: 1,
            x: 0,
            y: 1,
            static: false,
          },
        ],
        static: true,
      },
      {
        h: this.defaultWidgetHeight[
          DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES
        ],
        i: DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES,
        w: 2,
        x: 6,
        y: 0,
        static: false,
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
        y: 4,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.PARTITIONED_KEYS],
        i: DetailPageWidgetKeys.PARTITIONED_KEYS,
        w: 2,
        x: 6,
        y: 5,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[DetailPageWidgetKeys.TABLE_CONSTRAINTS],
        i: DetailPageWidgetKeys.TABLE_CONSTRAINTS,
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
        return this.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION];
      case DetailPageWidgetKeys.TABLE_SCHEMA:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.TABLE_SCHEMA];
      case DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES:
        return this.defaultWidgetHeight[
          DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES
        ];
      case DetailPageWidgetKeys.DATA_PRODUCTS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.DATA_PRODUCTS];
      case DetailPageWidgetKeys.TAGS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.TAGS];
      case DetailPageWidgetKeys.GLOSSARY_TERMS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.GLOSSARY_TERMS];
      case DetailPageWidgetKeys.TABLE_CONSTRAINTS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.TABLE_CONSTRAINTS];
      case DetailPageWidgetKeys.PARTITIONED_KEYS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.PARTITIONED_KEYS];
      default:
        return 1;
    }
  }
}

const tableClassBase = new TableClassBase();

export default tableClassBase;
export { TableClassBase };
