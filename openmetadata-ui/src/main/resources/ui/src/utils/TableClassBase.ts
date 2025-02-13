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
  Constraint,
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
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';
import i18n from './i18next/LocalUtil';
import { getTableDetailPageBaseTabs } from './TableUtils';

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
  onExtensionUpdate: (updatedData: Table) => Promise<void>;
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
      editable: [
        EntityTabs.SCHEMA,
        EntityTabs.OVERVIEW,
        EntityTabs.TERMS,
      ].includes(tab),
    }));
  }

  public getDefaultLayout(tab: EntityTabs) {
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
            h: 11,
            i: DetailPageWidgetKeys.TABLE_SCHEMA,
            w: 6,
            x: 0,
            y: 0,
            static: false,
          },
          {
            h: 2,
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
            h: 3,
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

      default:
        return [];
    }
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
          name: 'shop_id',
          displayName: 'Shop Id Customer',
          dataType: DataType.Number,
          dataTypeDisplay: 'numeric',
          description:
            'Unique identifier for the store. This column is the primary key for this table.',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify."dim.shop".shop_id',
          tags: [],
          constraint: Constraint.PrimaryKey,
          ordinalPosition: 1,
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
      changeDescription: {
        fieldsAdded: [
          {
            name: 'owner',
            newValue:
              '{"id":"38be030f-f817-4712-bc3b-ff7b9b9b805e","type":"user","name":"aaron_johnson0","fullyQualifiedName":"aaron_johnson0","displayName":"Aaron Johnson","deleted":false}',
          },
        ],
        fieldsUpdated: [],
        fieldsDeleted: [],
        previousVersion: 0.1,
      },
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
}

const tableClassBase = new TableClassBase();

export default tableClassBase;
export { TableClassBase };
