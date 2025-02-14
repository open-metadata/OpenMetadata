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
import { EntityTags } from 'Models';
import { TabProps } from '../../components/common/TabsLabel/TabsLabel.interface';
import {
  CUSTOM_PROPERTIES_WIDGET,
  DATA_PRODUCTS_WIDGET,
  DESCRIPTION_WIDGET,
  GLOSSARY_TERMS_WIDGET,
  GridSizes,
  TAGS_WIDGET,
} from '../../constants/CustomizeWidgets.constants';
import { DetailPageWidgetKeys } from '../../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../../enums/entity.enum';
import {
  Database,
  DatabaseServiceType,
  State,
} from '../../generated/entity/data/database';
import { Tab } from '../../generated/system/ui/uiCustomization';
import { LabelType, TagSource } from '../../generated/type/tagLabel';
import { FeedCounts } from '../../interface/feed.interface';
import { getTabLabelFromId } from '../CustomizePage/CustomizePageUtils';
import i18n from '../i18next/LocalUtil';
import { getDatabasePageBaseTabs } from './Database.util';

export interface DatabaseDetailPageTabProps {
  activeTab: EntityTabs;
  database: Database;
  description: string;
  editDescriptionPermission: boolean;
  editGlossaryTermsPermission: boolean;
  editTagsPermission: boolean;
  viewAllPermission: boolean;
  tags: EntityTags[];
  schemaInstanceCount: number;
  feedCount: FeedCounts;
  handleFeedCount: (data: FeedCounts) => void;
  getEntityFeedCount: () => void;
  onDescriptionUpdate: (updatedHTML: string) => Promise<void>;
  handleTagSelection: (selectedTags: EntityTags[]) => Promise<void>;
  settingsUpdateHandler: (
    data: Database,
    key?: keyof Database
  ) => Promise<void>;
  deleted: boolean;
  editCustomAttributePermission: boolean;
  getDetailsByFQN: () => void;
  labelMap?: Record<EntityTabs, string>;
}

class DatabaseClassBase {
  public getDatabaseDetailPageTabs(
    tabProps: DatabaseDetailPageTabProps
  ): TabProps[] {
    return getDatabasePageBaseTabs(tabProps);
  }

  public getDatabaseDetailPageTabsIds(): Tab[] {
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
            i: DetailPageWidgetKeys.DATABASE_SCHEMA,
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

      default:
        return [];
    }
  }

  public getDummyData(): Database {
    return {
      id: '77147d45-888b-42dd-a369-8b7ba882dffb',
      name: 'ecommerce_db',
      fullyQualifiedName: 'sample_data.ecommerce_db',
      displayName: '',
      description:
        'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
      dataProducts: [],
      tags: [
        {
          tagFQN: 'KnowledgeCenter.QuickLink',
          name: 'QuickLink',
          description: 'Knowledge Quick Link.',
          style: {
            color: '#c415d1',
          },
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ],
      version: 1.2,
      updatedAt: 1736405710107,
      updatedBy: 'prajwal.p',
      href: 'http://sandbox-beta.open-metadata.org/api/v1/databases/77147d45-888b-42dd-a369-8b7ba882dffb',
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
      changeDescription: {
        fieldsAdded: [
          {
            name: 'owners',
            newValue:
              '[{"id":"f7971c49-bca7-48fb-bb1a-821a1e2c5802","type":"user","name":"prajwal161998","fullyQualifiedName":"prajwal161998","displayName":"prajwal161998","deleted":false}]',
          },
        ],
        fieldsUpdated: [],
        fieldsDeleted: [],
        previousVersion: 1.1,
      },
      default: false,
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
        downVotes: 0,
        upVoters: [],
        downVoters: [],
      },
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
      CUSTOM_PROPERTIES_WIDGET,
    ];
  }
}

const databaseClassBase = new DatabaseClassBase();

export default databaseClassBase;
export { DatabaseClassBase };
