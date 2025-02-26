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
  APIEndpoint,
  APIRequestMethod,
  APIServiceType,
  DataTypeTopic,
  SchemaType,
} from '../../generated/entity/data/apiEndpoint';
import { Tab } from '../../generated/system/ui/uiCustomization';
import { FeedCounts } from '../../interface/feed.interface';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from '../CustomizePage/CustomizePageUtils';
import i18n from '../i18next/LocalUtil';
import {
  getApiEndpointDetailsPageTabs,
  getApiEndpointWidgetsFromKey,
} from './APIEndpointUtils';

export interface APIEndpointDetailPageTabProps {
  activeTab: EntityTabs;
  feedCount: {
    totalCount: number;
  };
  apiEndpoint: APIEndpoint;
  fetchAPIEndpointDetails: () => void;
  getEntityFeedCount: () => Promise<void>;
  handleFeedCount: (data: FeedCounts) => void;
  editCustomAttributePermission: boolean;
  viewAllPermission: boolean;
  editLineagePermission: boolean;
  labelMap: Record<EntityTabs, string>;
}

class APIEndpointClassBase {
  tabs = [];

  constructor() {
    this.tabs = [];
  }

  public getAPIEndpointDetailPageTabs(
    apiEndpointDetailsPageProps: APIEndpointDetailPageTabProps
  ): TabProps[] {
    return getApiEndpointDetailsPageTabs(apiEndpointDetailsPageProps);
  }

  public getEndpointDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.SCHEMA,
      EntityTabs.ACTIVITY_FEED,
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

  public getDefaultLayout(tab?: EntityTabs): Layout[] {
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
        i: DetailPageWidgetKeys.API_SCHEMA,
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
  public getDummyData(): APIEndpoint {
    return {
      id: 'b41d3506-09ac-4e02-ae40-8d6933f6a77f',
      name: 'addPet',
      displayName: 'Add Pet',
      fullyQualifiedName: 'sample_api_service.pet.addPet',
      description: 'add a new pet',
      version: 0.5,
      updatedAt: 1723268606694,
      updatedBy: 'sachin',
      endpointURL: 'https://petstore3.swagger.io/#/pet/addPet',
      requestMethod: APIRequestMethod.Post,
      requestSchema: {
        schemaType: SchemaType.JSON,
        schemaFields: [
          {
            name: 'id',
            dataType: DataTypeTopic.Int,
            description: 'ID of pet that needs to be updated',
            fullyQualifiedName: 'sample_api_service.pet.addPet.id',
            tags: [],
          },
          {
            name: 'name',
            dataType: DataTypeTopic.String,
            description: 'Name of pet',
            fullyQualifiedName: 'sample_api_service.pet.addPet.name',
            tags: [],
          },
          {
            name: 'category',
            dataType: DataTypeTopic.Record,
            description: 'Category of pet',
            fullyQualifiedName: 'sample_api_service.pet.addPet.category',
            tags: [],
            children: [
              {
                name: 'id',
                dataType: DataTypeTopic.Int,
                description: 'ID of category',
                fullyQualifiedName: 'sample_api_service.pet.addPet.category.id',
                tags: [],
              },
              {
                name: 'name',
                dataType: DataTypeTopic.String,
                description: 'Name of category',
                fullyQualifiedName:
                  'sample_api_service.pet.addPet.category.name',
                tags: [],
              },
            ],
          },
          {
            name: 'photoUrls',
            dataType: DataTypeTopic.Array,
            description: "URLs of pet's photos",
            fullyQualifiedName: 'sample_api_service.pet.addPet.photoUrls',
            tags: [],
          },
          {
            name: 'tags',
            dataType: DataTypeTopic.Array,
            description: 'Tags of pet',
            fullyQualifiedName: 'sample_api_service.pet.addPet.tags',
            tags: [],
          },
          {
            name: 'status',
            dataType: DataTypeTopic.String,
            description: 'Status of pet',
            fullyQualifiedName: 'sample_api_service.pet.addPet.status',
            tags: [],
          },
        ],
      },
      responseSchema: {
        schemaType: SchemaType.JSON,
        schemaFields: [
          {
            name: 'id',
            dataType: DataTypeTopic.Int,
            description: 'ID of pet that needs to be updated',
            fullyQualifiedName: 'sample_api_service.pet.addPet.id',
            tags: [],
          },
          {
            name: 'name',
            dataType: DataTypeTopic.String,
            description: 'Name of pet',
            fullyQualifiedName: 'sample_api_service.pet.addPet.name',
            tags: [],
          },
          {
            name: 'category',
            dataType: DataTypeTopic.Record,
            description: 'Category of pet',
            fullyQualifiedName: 'sample_api_service.pet.addPet.category',
            tags: [],
            children: [
              {
                name: 'id',
                dataType: DataTypeTopic.Int,
                description: 'ID of category',
                fullyQualifiedName: 'sample_api_service.pet.addPet.category.id',
                tags: [],
              },
              {
                name: 'name',
                dataType: DataTypeTopic.String,
                description: 'Name of category',
                fullyQualifiedName:
                  'sample_api_service.pet.addPet.category.name',
                tags: [],
              },
            ],
          },
          {
            name: 'photoUrls',
            dataType: DataTypeTopic.Array,
            description: "URLs of pet's photos",
            fullyQualifiedName: 'sample_api_service.pet.addPet.photoUrls',
            tags: [],
          },
          {
            name: 'tags',
            dataType: DataTypeTopic.Array,
            description: 'Tags of pet',
            fullyQualifiedName: 'sample_api_service.pet.addPet.tags',
            tags: [],
          },
          {
            name: 'status',
            dataType: DataTypeTopic.String,
            description: 'Status of pet',
            fullyQualifiedName: 'sample_api_service.pet.addPet.status',
            tags: [],
          },
        ],
      },
      apiCollection: {
        id: 'db03ef8f-82f9-4a23-a940-3ba5af5bba29',
        type: 'apiCollection',
        name: 'pet',
        fullyQualifiedName: 'sample_api_service.pet',
        displayName: 'pet',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/apiCollections/db03ef8f-82f9-4a23-a940-3ba5af5bba29',
      },
      href: 'http://sandbox-beta.open-metadata.org/api/v1/apiEndpoints/b41d3506-09ac-4e02-ae40-8d6933f6a77f',
      owners: [],
      followers: [],
      tags: [],
      service: {
        id: '449b7937-c4ca-4dce-866c-5f6d0acc45c1',
        type: 'apiService',
        name: 'sample_api_service',
        fullyQualifiedName: 'sample_api_service',
        displayName: 'sample_api_service',
        deleted: false,
        href: 'http://sandbox-beta.open-metadata.org/api/v1/services/apiServices/449b7937-c4ca-4dce-866c-5f6d0acc45c1',
      },
      serviceType: APIServiceType.REST,

      deleted: false,
      dataProducts: [],
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
        fullyQualifiedName: DetailPageWidgetKeys.API_ENDPOINTS,
        name: i18n.t('label.api-endpoint'),
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
    return getApiEndpointWidgetsFromKey(widgetConfig);
  }
}

const apiEndpointClassBase = new APIEndpointClassBase();

export default apiEndpointClassBase;
export { APIEndpointClassBase };
