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
  APICollection,
  APIServiceType,
} from '../../generated/entity/data/apiCollection';
import { Tab } from '../../generated/system/ui/uiCustomization';
import { FeedCounts } from '../../interface/feed.interface';
import { WidgetConfig } from '../../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from '../CustomizePage/CustomizePageUtils';
import i18n from '../i18next/LocalUtil';
import {
  getApiCollectionDetailsPageTabs,
  getApiCollectionWidgetsFromKey,
} from './APICollectionUtils';

export interface APICollectionDetailPageTabProps {
  activeTab: EntityTabs;
  feedCount: {
    totalCount: number;
  };
  apiCollection: APICollection;
  fetchAPICollectionDetails: () => Promise<void>;
  getEntityFeedCount: () => void;
  handleFeedCount: (data: FeedCounts) => void;
  editCustomAttributePermission: boolean;
  viewAllPermission: boolean;
  apiEndpointCount: number;
  labelMap: Record<EntityTabs, string>;
}

class APICollectionClassBase {
  tabs = [];

  constructor() {
    this.tabs = [];
  }

  public getAPICollectionDetailPageTabs(
    apiCollectionDetailsPageProps: APICollectionDetailPageTabProps
  ): TabProps[] {
    return getApiCollectionDetailsPageTabs(apiCollectionDetailsPageProps);
  }

  public getAPICollectionDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.API_ENDPOINT,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: tab === EntityTabs.API_ENDPOINT,
    }));
  }

  public getDefaultLayout(tab?: EntityTabs) {
    if (tab && tab !== EntityTabs.API_ENDPOINT) {
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
        i: DetailPageWidgetKeys.API_ENDPOINTS,
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
  public getDummyData(): APICollection {
    return {
      id: 'db03ef8f-82f9-4a23-a940-3ba5af5bba29',
      name: 'pet',
      fullyQualifiedName: 'sample_api_service.pet',
      version: 0.1,
      updatedAt: 1722588116104,
      updatedBy: 'ingestion-bot',
      endpointURL: 'https://petstore3.swagger.io/#/pet',
      href: 'http://sandbox-beta.open-metadata.org/api/v1/apiCollections/db03ef8f-82f9-4a23-a940-3ba5af5bba29',
      owners: [],
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
    return getApiCollectionWidgetsFromKey(widgetConfig);
  }
}

const apiCollectionClassBase = new APICollectionClassBase();

export default apiCollectionClassBase;
export { APICollectionClassBase };
