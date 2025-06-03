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
import { SEARCH_INDEX_DUMMY_DATA } from '../constants/SearchIndex.constants';
import { DetailPageWidgetKeys } from '../enums/CustomizeDetailPage.enum';
import { EntityTabs } from '../enums/entity.enum';
import { SearchIndex } from '../generated/entity/data/searchIndex';
import { Tab } from '../generated/system/ui/uiCustomization';
import { FeedCounts } from '../interface/feed.interface';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';
import i18n from './i18next/LocalUtil';
import {
  getSearchIndexDetailsTabs,
  getSearchIndexWidgetsFromKey,
} from './SearchIndexUtils';

export interface SearchIndexDetailPageTabProps {
  searchIndexDetails: SearchIndex;
  viewAllPermission: boolean;
  feedCount: FeedCounts;
  activeTab: EntityTabs;
  getEntityFeedCount: () => Promise<void>;
  fetchSearchIndexDetails: () => Promise<void>;
  handleFeedCount: (feedCount: FeedCounts) => void;
  viewSampleDataPermission: boolean;
  deleted: boolean;
  editLineagePermission: boolean;
  editCustomAttributePermission: boolean;
  onExtensionUpdate: (extension: SearchIndex['extension']) => Promise<void>;
  labelMap?: Record<EntityTabs, string>;
}

type SearchIndexWidgetKeys =
  | DetailPageWidgetKeys.DESCRIPTION
  | DetailPageWidgetKeys.SEARCH_INDEX_FIELDS
  | DetailPageWidgetKeys.DATA_PRODUCTS
  | DetailPageWidgetKeys.TAGS
  | DetailPageWidgetKeys.GLOSSARY_TERMS
  | DetailPageWidgetKeys.CUSTOM_PROPERTIES;

class SearchIndexClassBase {
  defaultWidgetHeight: Record<SearchIndexWidgetKeys, number>;

  constructor() {
    this.defaultWidgetHeight = {
      [DetailPageWidgetKeys.DESCRIPTION]: 2,
      [DetailPageWidgetKeys.SEARCH_INDEX_FIELDS]: 6,
      [DetailPageWidgetKeys.DATA_PRODUCTS]: 2,
      [DetailPageWidgetKeys.TAGS]: 2,
      [DetailPageWidgetKeys.GLOSSARY_TERMS]: 2,
      [DetailPageWidgetKeys.CUSTOM_PROPERTIES]: 4,
    };
  }

  public getSearchIndexDetailPageTabs(
    tabProps: SearchIndexDetailPageTabProps
  ): TabProps[] {
    return getSearchIndexDetailsTabs(tabProps);
  }

  public getSearchIndexDetailPageTabsIds(): Tab[] {
    return [
      EntityTabs.FIELDS,
      EntityTabs.ACTIVITY_FEED,
      EntityTabs.SAMPLE_DATA,
      EntityTabs.LINEAGE,
      EntityTabs.SEARCH_INDEX_SETTINGS,
      EntityTabs.CUSTOM_PROPERTIES,
    ].map((tab: EntityTabs) => ({
      id: tab,
      name: tab,
      displayName: getTabLabelFromId(tab),
      layout: this.getDefaultLayout(tab),
      editable: tab === EntityTabs.FIELDS,
    }));
  }

  public getDefaultLayout(tab?: EntityTabs): WidgetConfig[] {
    if (tab && tab !== EntityTabs.FIELDS) {
      return [];
    }

    return [
      {
        h:
          this.defaultWidgetHeight[DetailPageWidgetKeys.SEARCH_INDEX_FIELDS] +
          this.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION] +
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
            h: this.defaultWidgetHeight[
              DetailPageWidgetKeys.SEARCH_INDEX_FIELDS
            ],
            i: DetailPageWidgetKeys.SEARCH_INDEX_FIELDS,
            w: 1,
            x: 0,
            y: 1,
            static: false,
          },
        ],
        static: true,
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
        y: 6,
        static: false,
      },
    ];
  }

  public getDummyData(): SearchIndex {
    return SEARCH_INDEX_DUMMY_DATA;
  }

  public getCommonWidgetList() {
    return [
      DESCRIPTION_WIDGET,
      {
        fullyQualifiedName: DetailPageWidgetKeys.SEARCH_INDEX_FIELDS,
        name: i18n.t('label.field-plural'),
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
    return getSearchIndexWidgetsFromKey(widgetConfig);
  }

  public getWidgetHeight(widgetName: string) {
    switch (widgetName) {
      case DetailPageWidgetKeys.DESCRIPTION:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.DESCRIPTION];
      case DetailPageWidgetKeys.SEARCH_INDEX_FIELDS:
        return this.defaultWidgetHeight[
          DetailPageWidgetKeys.SEARCH_INDEX_FIELDS
        ];
      case DetailPageWidgetKeys.DATA_PRODUCTS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.DATA_PRODUCTS];
      case DetailPageWidgetKeys.TAGS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.TAGS];
      case DetailPageWidgetKeys.GLOSSARY_TERMS:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.GLOSSARY_TERMS];
      case DetailPageWidgetKeys.CUSTOM_PROPERTIES:
        return this.defaultWidgetHeight[DetailPageWidgetKeys.CUSTOM_PROPERTIES];
      default:
        return 1;
    }
  }
}

const searchIndexClassBase = new SearchIndexClassBase();

export default searchIndexClassBase;
export { SearchIndexClassBase };
