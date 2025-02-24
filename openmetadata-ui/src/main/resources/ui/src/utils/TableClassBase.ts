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
  ConstraintType,
  DatabaseServiceType,
  DataType,
  RelationshipType,
  Table,
  TableType,
} from '../generated/entity/data/table';
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

class TableClassBase {
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

  public getDefaultLayout(tab?: EntityTabs) {
    if (tab && tab !== EntityTabs.SCHEMA) {
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
        h: 1,
        i: DetailPageWidgetKeys.TABLE_CONSTRAINTS,
        w: 2,
        x: 6,
        y: 4,
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

  public getAlertEnableStatus() {
    return false;
  }

  public getDummyData(): Table {
    return {
      id: 'ab4f893b-c303-43d9-9375-3e620a670b02',
      name: 'raw_product_catalog',
      fullyQualifiedName:
        'sample_data.ecommerce_db.shopify.raw_product_catalog',
      description:
        'This is a raw product catalog table contains the product listing, price, seller etc.. represented in our online DB. ',
      version: 0.2,
      updatedAt: 1688442727895,
      updatedBy: 'admin',
      tableType: TableType.Regular,
      dataProducts: [
        {
          id: 'c9b891b1-5d60-4171-9af0-7fd6d74f8f2b',
          type: 'dataProduct',
          name: 'Design Data product ',
          fullyQualifiedName: 'Design Data product ',
          description:
            "Here's the description for the Design Data product Name.",
          displayName: 'Design Data product Name',
          href: '#',
        },
      ],
      joins: {
        startDate: new Date(),
        dayCount: 30,
        columnJoins: [
          {
            columnName: 'address_id',
            joinedWith: [
              {
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.dim_address_clean.address_id',
                joinCount: 0,
              },
              {
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.dim_address.address_id',
                joinCount: 0,
              },
            ],
          },
        ],
        directTableJoins: [
          {
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
            joinCount: 0,
          },
        ],
      },
      columns: [
        {
          name: 'address_id',
          dataType: DataType.Numeric,
          dataTypeDisplay: 'numeric',
          description: 'Unique identifier for the address.',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_address_clean.address_id',
          tags: [],
          ordinalPosition: 1,
        },
        {
          name: 'shop_id',
          dataType: DataType.Numeric,
          dataTypeDisplay: 'numeric',
          description:
            'The ID of the store. This column is a foreign key reference to the shop_id column in the dim_shop table.',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_address_clean.shop_id',
          tags: [],
          ordinalPosition: 2,
        },
        {
          name: 'first_name',
          dataType: DataType.Varchar,
          dataLength: 100,
          dataTypeDisplay: 'varchar',
          description: 'First name of the customer.',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_address_clean.first_name',
          tags: [],
          ordinalPosition: 3,
        },
        {
          name: 'last_name',
          dataType: DataType.Varchar,
          dataLength: 100,
          dataTypeDisplay: 'varchar',
          description: 'Last name of the customer.',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_address_clean.last_name',
          tags: [],
          ordinalPosition: 4,
        },
        {
          name: 'address',
          dataType: DataType.Varchar,
          dataLength: 500,
          dataTypeDisplay: 'varchar',
          description: 'Clean address test',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_address_clean.address',
          tags: [],
          ordinalPosition: 5,
        },
        {
          name: 'company',
          dataType: DataType.Varchar,
          dataLength: 100,
          dataTypeDisplay: 'varchar',
          description: "The name of the customer's business, if one exists.",
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_address_clean.company',
          tags: [],
          ordinalPosition: 7,
        },
        {
          name: 'city',
          dataType: DataType.Varchar,
          dataLength: 100,
          dataTypeDisplay: 'varchar',
          description: 'The name of the city. For example, Palo Alto.',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_address_clean.city',
          tags: [],
          ordinalPosition: 8,
        },
        {
          name: 'region',
          dataType: DataType.Varchar,
          dataLength: 512,
          dataTypeDisplay: 'varchar',
          description:
            // eslint-disable-next-line max-len
            'The name of the region, such as a province or state, where the customer is located. For example, Ontario or New York. This column is the same as CustomerAddress.province in the Admin API.',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_address_clean.region',
          tags: [],
          ordinalPosition: 9,
        },
        {
          name: 'zip',
          dataType: DataType.Varchar,
          dataLength: 10,
          dataTypeDisplay: 'varchar',
          description: 'The ZIP or postal code. For example, 90210.',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_address_clean.zip',
          tags: [],
          ordinalPosition: 10,
        },
        {
          name: 'country',
          dataType: DataType.Varchar,
          dataLength: 50,
          dataTypeDisplay: 'varchar',
          description: 'The full name of the country. For example, Canada.',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_address_clean.country',
          tags: [],
          ordinalPosition: 11,
        },
        {
          name: 'phone',
          dataType: DataType.Varchar,
          dataLength: 15,
          dataTypeDisplay: 'varchar',
          description: 'The phone number of the customer.',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.dim_address_clean.phone',
          tags: [],
          ordinalPosition: 12,
        },
      ],
      owners: [
        {
          id: '38be030f-f817-4712-bc3b-ff7b9b9b805e',
          type: 'user',
          name: 'aaron_johnson0',
          fullyQualifiedName: 'aaron_johnson0',
          displayName: 'Aaron Johnson',
          deleted: false,
        },
      ],
      databaseSchema: {
        id: '3f0d9c39-0926-4028-8070-65b0c03556cb',
        type: 'databaseSchema',
        name: 'shopify',
        fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
        description:
          'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
        deleted: false,
      },
      database: {
        id: 'f085e133-e184-47c8-ada5-d7e005d3153b',
        type: 'database',
        name: 'ecommerce_db',
        fullyQualifiedName: 'sample_data.ecommerce_db',
        description:
          'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
        deleted: false,
      },
      service: {
        id: 'e61069a9-29e3-49fa-a7f4-f5227ae50b72',
        type: 'databaseService',
        name: 'sample_data',
        fullyQualifiedName: 'sample_data',
        deleted: false,
      },
      tableConstraints: [
        {
          constraintType: ConstraintType.ForeignKey,
          columns: ['post_id'],
          referredColumns: ['mysql_sample.default.posts_db.Posts.post_id'],
          relationshipType: RelationshipType.ManyToOne,
        },
        {
          constraintType: ConstraintType.ForeignKey,
          columns: ['user_id'],
          referredColumns: ['mysql_sample.default.posts_db.Users.user_id'],
          relationshipType: RelationshipType.ManyToOne,
        },
      ],
      serviceType: DatabaseServiceType.BigQuery,
      tags: [],
      followers: [],
      deleted: false,
    };
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
}

const tableClassBase = new TableClassBase();

export default tableClassBase;
export { TableClassBase };
