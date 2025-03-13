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
import { API_COLLECTION_DUMMY_DATA } from '../../constants/APICollection.constants';
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
import { APICollection } from '../../generated/entity/data/apiCollection';
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

enum APICollectionWidgetKeys {
  DESCRIPTION = DetailPageWidgetKeys.DESCRIPTION,
  API_ENDPOINTS = DetailPageWidgetKeys.API_ENDPOINTS,
  DATA_PRODUCTS = DetailPageWidgetKeys.DATA_PRODUCTS,
  TAGS = DetailPageWidgetKeys.TAGS,
  GLOSSARY_TERMS = DetailPageWidgetKeys.GLOSSARY_TERMS,
  CUSTOM_PROPERTIES = DetailPageWidgetKeys.CUSTOM_PROPERTIES,
}

class APICollectionClassBase {
  defaultWidgetHeight: Record<APICollectionWidgetKeys, number>;

  constructor() {
    this.defaultWidgetHeight = {
      [APICollectionWidgetKeys.DESCRIPTION]: 2,
      [APICollectionWidgetKeys.API_ENDPOINTS]: 8,
      [APICollectionWidgetKeys.DATA_PRODUCTS]: 2,
      [APICollectionWidgetKeys.TAGS]: 2,
      [APICollectionWidgetKeys.GLOSSARY_TERMS]: 2,
      [APICollectionWidgetKeys.CUSTOM_PROPERTIES]: 4,
    };
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

  public getDefaultLayout(tab?: EntityTabs): Layout[] {
    if (tab && tab !== EntityTabs.API_ENDPOINT) {
      return [];
    }

    return [
      {
        h: this.defaultWidgetHeight[APICollectionWidgetKeys.DESCRIPTION],
        i: DetailPageWidgetKeys.DESCRIPTION,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[APICollectionWidgetKeys.API_ENDPOINTS],
        i: DetailPageWidgetKeys.API_ENDPOINTS,
        w: 6,
        x: 0,
        y: 0,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[APICollectionWidgetKeys.DATA_PRODUCTS],
        i: DetailPageWidgetKeys.DATA_PRODUCTS,
        w: 2,
        x: 6,
        y: 1,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[APICollectionWidgetKeys.TAGS],
        i: DetailPageWidgetKeys.TAGS,
        w: 2,
        x: 6,
        y: 2,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[APICollectionWidgetKeys.GLOSSARY_TERMS],
        i: DetailPageWidgetKeys.GLOSSARY_TERMS,
        w: 2,
        x: 6,
        y: 3,
        static: false,
      },
      {
        h: this.defaultWidgetHeight[APICollectionWidgetKeys.CUSTOM_PROPERTIES],
        i: DetailPageWidgetKeys.CUSTOM_PROPERTIES,
        w: 2,
        x: 6,
        y: 6,
        static: false,
      },
    ];
  }
  public getDummyData(): APICollection {
    return API_COLLECTION_DUMMY_DATA;
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

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case DetailPageWidgetKeys.DESCRIPTION:
        return this.defaultWidgetHeight[APICollectionWidgetKeys.DESCRIPTION];
      case DetailPageWidgetKeys.API_ENDPOINTS:
        return this.defaultWidgetHeight[APICollectionWidgetKeys.API_ENDPOINTS];
      case DetailPageWidgetKeys.DATA_PRODUCTS:
        return this.defaultWidgetHeight[APICollectionWidgetKeys.DATA_PRODUCTS];
      case DetailPageWidgetKeys.TAGS:
        return this.defaultWidgetHeight[APICollectionWidgetKeys.TAGS];
      case DetailPageWidgetKeys.GLOSSARY_TERMS:
        return this.defaultWidgetHeight[APICollectionWidgetKeys.GLOSSARY_TERMS];
      case DetailPageWidgetKeys.CUSTOM_PROPERTIES:
        return this.defaultWidgetHeight[
          APICollectionWidgetKeys.CUSTOM_PROPERTIES
        ];
      default:
        return 1;
    }
  }
}

const apiCollectionClassBase = new APICollectionClassBase();

export default apiCollectionClassBase;
export { APICollectionClassBase };
