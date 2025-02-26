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
import { DATABASE_SCHEMA_DUMMY_DATA } from '../constants/Database.constants';
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { DatabaseSchema } from '../generated/entity/data/databaseSchema';
import { Tab } from '../generated/system/ui/uiCustomization';
import { FeedCounts } from '../interface/feed.interface';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';
import {
  getDataBaseSchemaPageBaseTabs,
  getDatabaseSchemaWidgetsFromKey,
} from './DatabaseSchemaDetailsUtils';
import i18n from './i18next/LocalUtil';

export interface DatabaseSchemaPageTabProps {
  feedCount: FeedCounts;
  activeTab: EntityTabs;
  editCustomAttributePermission: boolean;
  viewAllPermission: boolean;
  databaseSchemaPermission: OperationPermission;
  storedProcedureCount: number;
  getEntityFeedCount: () => void;
  fetchDatabaseSchemaDetails: () => Promise<void>;
  handleFeedCount: (data: FeedCounts) => void;
  tableCount: number;
  labelMap: Record<string, string>;
}

class DatabaseSchemaClassBase {
  public getDatabaseSchemaPageTabs(
    databaseSchemaTabData: DatabaseSchemaPageTabProps
  ): TabProps[] {
    return getDataBaseSchemaPageBaseTabs(databaseSchemaTabData);
  }

  public getDatabaseSchemaPageTabsIds(): Tab[] {
    return [
      EntityTabs.TABLE,
      EntityTabs.STORED_PROCEDURE,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: [EntityTabs.TABLE].includes(tab),
    }));
  }

  public getDefaultLayout(tab?: EntityTabs): Layout[] {
    if (tab && tab !== EntityTabs.TABLE) {
      return [];
    }

    return [
      {
        h: 1,
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: 8,
        i: DetailPageWidgetKeys.TABLES,
        w: 6,
        x: 0,
        y: 0,
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
        h: 1,
        i: DetailPageWidgetKeys.TAGS,
        w: 2,
        x: 6,
        y: 2,
        static: false,
      },
      {
        h: 1,
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

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.TABLE_SCHEMA,
        name: i18n.t('label.table-plural'),
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

  public getDummyData(): DatabaseSchema {
    return DATABASE_SCHEMA_DUMMY_DATA;
  }

  public getWidgetsFromKey(widgetConfig: WidgetConfig) {
    return getDatabaseSchemaWidgetsFromKey(widgetConfig);
  }
}

const databaseSchemaClassBase = new DatabaseSchemaClassBase();

export default databaseSchemaClassBase;
export { DatabaseSchemaClassBase };
