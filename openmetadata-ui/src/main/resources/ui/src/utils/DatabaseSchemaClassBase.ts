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
import { OperationPermission } from '../context/PermissionProvider/PermissionProvider.interface';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import {
  DatabaseSchema,
  DatabaseServiceType,
  State,
} from '../generated/entity/data/databaseSchema';
import { Tab } from '../generated/system/ui/uiCustomization';
import { LabelType, TagSource } from '../generated/type/tagLabel';
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
  handleExtensionUpdate: (schema: DatabaseSchema) => Promise<void>;
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

  public getDefaultLayout(tab: EntityTabs) {
    switch (tab) {
      case EntityTabs.TABLE:
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
            h: 3,
            i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
            w: 2,
            x: 6,
            y: 6,
            static: false,
          },
        ];

      default:
        return [];
    }
  }

  public getDatabaseSchemaPageDefaultLayout = (tab: EntityTabs) => {
    switch (tab) {
      case EntityTabs.SCHEMA:
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
            h: 8,
            i: DetailPageWidgetKeys.TABLE_SCHEMA,
            w: 6,
            x: 0,
            y: 0,
            static: false,
          },
          {
            h: 1,
            i: DetailPageWidgetKeys.FREQUENTLY_JOINED_TABLES,
            w: 2,
            x: 6,
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
            h: 3,
            i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
            w: 2,
            x: 6,
            y: 4,
            static: false,
          },
        ];

      default:
        return [];
    }
  };

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
    return {
      id: '9f127bdc-d060-4fac-ae7b-c635933fc2e0',
      name: 'shopify',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
      description:
        'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
      dataProducts: [],
      version: 1.1,
      updatedAt: 1736405774154,
      updatedBy: 'prajwal.p',
      href: 'http://sandbox-beta.open-metadata.org/api/v1/databaseSchemas/9f127bdc-d060-4fac-ae7b-c635933fc2e0',
      owners: [
        {
          id: '50bb97a5-cf0c-4273-930e-b3e802b52ee1',
          type: 'user',
          name: 'aaron.singh2',
          fullyQualifiedName: '"aaron.singh2"',
          displayName: 'Aaron Singh',
          deleted: false,
          href: 'http://sandbox-beta.open-metadata.org/api/v1/users/50bb97a5-cf0c-4273-930e-b3e802b52ee1',
        },
        {
          id: '1eb7eb26-21da-42d7-b0ed-8812f04f4ca4',
          type: 'user',
          name: 'ayush',
          fullyQualifiedName: 'ayush',
          displayName: 'Ayush Shah',
          deleted: false,
          href: 'http://sandbox-beta.open-metadata.org/api/v1/users/1eb7eb26-21da-42d7-b0ed-8812f04f4ca4',
        },
        {
          id: '32e07f38-faff-45b1-9b51-4e42caa69e3c',
          type: 'user',
          name: 'ayush02shah12',
          fullyQualifiedName: 'ayush02shah12',
          displayName: 'Ayush Shah',
          deleted: false,
          href: 'http://sandbox-beta.open-metadata.org/api/v1/users/32e07f38-faff-45b1-9b51-4e42caa69e3c',
        },
        {
          id: 'f7971c49-bca7-48fb-bb1a-821a1e2c5802',
          type: 'user',
          name: 'prajwal161998',
          fullyQualifiedName: 'prajwal161998',
          displayName: 'prajwal161998',
          deleted: false,
          href: 'http://sandbox-beta.open-metadata.org/api/v1/users/f7971c49-bca7-48fb-bb1a-821a1e2c5802',
        },
      ],
      service: {
        id: '75199480-3d06-4b6f-89d2-e8805ebe8d01',
        type: 'databaseService',
        name: 'sample_data',
        fullyQualifiedName: 'sample_data',
        displayName: 'sample_data',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/services/databaseServices/75199480-3d06-4b6f-89d2-e8805ebe8d01',
      },
      serviceType: DatabaseServiceType.BigQuery,
      database: {
        id: '77147d45-888b-42dd-a369-8b7ba882dffb',
        type: 'database',
        name: 'ecommerce_db',
        fullyQualifiedName: 'sample_data.ecommerce_db',
        description:
          'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
        displayName: 'ecommerce_db',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/databases/77147d45-888b-42dd-a369-8b7ba882dffb',
      },
      usageSummary: {
        dailyStats: {
          count: 21,
          percentileRank: 0,
        },
        weeklyStats: {
          count: 21,
          percentileRank: 0,
        },
        monthlyStats: {
          count: 21,
          percentileRank: 0,
        },
        date: new Date('2023-11-10'),
      },
      tags: [
        {
          tagFQN: 'PersonalData.Personal',
          name: 'Personal',
          description:
            'Data that can be used to directly or indirectly identify a person.',
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ],
      deleted: false,
      domain: {
        id: '31c2b84e-b87a-4e47-934f-9c5309fbb7c3',
        type: 'domain',
        name: 'Engineering',
        fullyQualifiedName: 'Engineering',
        description: 'Domain related engineering development.',
        displayName: 'Engineering',
        href: 'http://sandbox-beta.open-metadata.org/api/v1/domains/31c2b84e-b87a-4e47-934f-9c5309fbb7c3',
      },
      votes: {
        upVotes: 0,
        downVotes: 1,
        upVoters: [],
        downVoters: [
          {
            id: 'f14f17bf-0923-4234-8e73-2dcc051f2adc',
            type: 'user',
            name: 'admin',
            fullyQualifiedName: 'admin',
            displayName: 'admin',
            deleted: false,
          },
        ],
      },
    };
  }

  public getWidgetsFromKey(widgetConfig: WidgetConfig) {
    return getDatabaseSchemaWidgetsFromKey(widgetConfig);
  }
}

const databaseSchemaClassBase = new DatabaseSchemaClassBase();

export default databaseSchemaClassBase;
export { DatabaseSchemaClassBase };
