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
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { Topic } from '../generated/entity/data/topic';
import { Tab } from '../generated/system/ui/uiCustomization';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';
import i18n from './i18next/LocalUtil';
import {
  getTopicDetailsPageTabs,
  getTopicWidgetsFromKey,
} from './TopicDetailsUtils';

export interface TopicDetailPageTabProps {
  schemaCount: number;
  activityFeedTab: JSX.Element;
  sampleDataTab: JSX.Element;
  queryViewerTab: JSX.Element;
  lineageTab: JSX.Element;
  customPropertiesTab: JSX.Element;
  viewSampleDataPermission: boolean;
  activeTab: EntityTabs;
  feedCount: {
    totalCount: number;
  };
  labelMap?: Record<EntityTabs, string>;
}

class TopicClassBase {
  tabs = [];

  constructor() {
    this.tabs = [];
  }

  public getTopicDetailPageTabs(
    tableDetailsPageProps: TopicDetailPageTabProps
  ): TabProps[] {
    return getTopicDetailsPageTabs(tableDetailsPageProps);
  }

  public getTopicDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.SCHEMA,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.SAMPLE_DATA,
      EntityTabs.CONFIG,
      EntityTabs.LINEAGE,
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
        h: 2,
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: 8,
        i: DetailPageWidgetKeys.TOPIC_SCHEMA,
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
  }

  public getAlertEnableStatus() {
    return false;
  }

  public getDummyData(): Topic {
    return {
      id: 'd68d2e86-41cd-4c6c-bd78-41db489d46d1',
      name: 'address_book',
      fullyQualifiedName: 'sample_kafka.address_book',
      description:
        'All Protobuf record related events gets captured in this topic',
      version: 0.7,
      updatedAt: 1701432879105,
      updatedBy: 'aniket',
      service: {
        id: '46f09e52-34de-4580-8133-a7e54e23c22b',
        type: 'messagingService',
        name: 'sample_kafka',
        fullyQualifiedName: 'sample_kafka',
        displayName: 'sample_kafka',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/services/messagingServices/46f09e52-34de-4580-8133-a7e54e23c22b',
      },
      serviceType: 'Kafka',
      messageSchema: {
        schemaText:
          // eslint-disable-next-line max-len
          'syntax = "proto2";\n\npackage tutorial;\n\nmessage Person {\n  optional string name = 1;\n  optional int32 id = 2;\n  optional string email = 3;\n\n  enum PhoneType {\n    MOBILE = 0;\n    HOME = 1;\n    WORK = 2;\n  }\n\n  message PhoneNumber {\n    optional string number = 1;\n    optional PhoneType type = 2 [default = HOME];\n  }\n\n  repeated PhoneNumber phones = 4;\n}\n\nmessage AddressBook {\n  repeated Person people = 1;\n}',
        schemaType: 'Protobuf',
        schemaFields: [
          {
            name: 'AddressBook',
            dataType: 'RECORD',
            fullyQualifiedName: 'sample_kafka.address_book.AddressBook',
            tags: [],
            children: [
              {
                name: 'people',
                dataType: 'RECORD',
                fullyQualifiedName:
                  'sample_kafka.address_book.AddressBook.people',
                tags: [],
                children: [
                  {
                    name: 'name',
                    dataType: 'STRING',
                    fullyQualifiedName:
                      'sample_kafka.address_book.AddressBook.people.name',
                    tags: [],
                  },
                  {
                    name: 'id',
                    dataType: 'INT',
                    fullyQualifiedName:
                      'sample_kafka.address_book.AddressBook.people.id',
                    tags: [],
                  },
                  {
                    name: 'email',
                    dataType: 'STRING',
                    fullyQualifiedName:
                      'sample_kafka.address_book.AddressBook.people.email',
                    tags: [],
                  },
                  {
                    name: 'phones',
                    dataType: 'RECORD',
                    fullyQualifiedName:
                      'sample_kafka.address_book.AddressBook.people.phones',
                    tags: [],
                    children: [
                      {
                        name: 'number',
                        dataType: 'STRING',
                        fullyQualifiedName:
                          'sample_kafka.address_book.AddressBook.people.phones.number',
                        tags: [],
                      },
                      {
                        name: 'type',
                        dataType: 'ENUM',
                        fullyQualifiedName:
                          'sample_kafka.address_book.AddressBook.people.phones.type',
                        tags: [],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      partitions: 128,
      cleanupPolicies: ['compact', 'delete'],
      replicationFactor: 4,
      maximumMessageSize: 249,
      retentionSize: 1931232624,
      owners: [
        {
          id: 'ebac156e-6779-499c-8bbf-ab98a6562bc5',
          type: 'team',
          name: 'Data',
          fullyQualifiedName: 'Data',
          description: '',
          displayName: 'Data',
          deleted: false,
          href: 'http://sandbox-beta.open-metadata.org/api/v1/teams/ebac156e-6779-499c-8bbf-ab98a6562bc5',
        },
      ],
      followers: [
        {
          id: '96546482-1b99-4293-9e0f-7194fe25bcbf',
          type: 'user',
          name: 'sonal.w',
          fullyQualifiedName: '"sonal.w"',
          displayName: 'admin',
          deleted: false,
          href: 'http://sandbox-beta.open-metadata.org/api/v1/users/96546482-1b99-4293-9e0f-7194fe25bcbf',
        },
      ],
      tags: [],
      href: 'http://sandbox-beta.open-metadata.org/api/v1/topics/d68d2e86-41cd-4c6c-bd78-41db489d46d1',
      changeDescription: {
        fieldsAdded: [],
        fieldsUpdated: [
          {
            name: 'deleted',
            oldValue: true,
            newValue: false,
          },
        ],
        fieldsDeleted: [],
        previousVersion: 0.6,
      },
      deleted: false,
      domain: {
        id: '761f0a12-7b08-4889-acc3-b8d4d11a7865',
        type: 'domain',
        name: 'domain.with.dot',
        fullyQualifiedName: '"domain.with.dot"',
        description: 'domain.with.dot',
        displayName: 'domain.with.dot',
        href: 'http://sandbox-beta.open-metadata.org/api/v1/domains/761f0a12-7b08-4889-acc3-b8d4d11a7865',
      },
      dataProducts: [],
      votes: {
        upVotes: 0,
        downVotes: 0,
        upVoters: [],
        downVoters: [],
      },
    } as Topic;
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.TOPIC_SCHEMA,
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

  public getWidgetsFromKey(widgetConfig: WidgetConfig) {
    return getTopicWidgetsFromKey(widgetConfig);
  }
}

const topicClassBase = new TopicClassBase();

export default topicClassBase;
export { TopicClassBase };
