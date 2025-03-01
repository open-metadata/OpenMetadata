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
  feedCount: {
    totalCount: number;
  };
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

class SearchIndexClassBase {
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

  public getDefaultLayout(tab?: EntityTabs): Layout[] {
    if (tab && tab !== EntityTabs.FIELDS) {
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
        h: 11,
        i: DetailPageWidgetKeys.SEARCH_INDEX_FIELDS,
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
}

const searchIndexClassBase = new SearchIndexClassBase();

export default searchIndexClassBase;
export { SearchIndexClassBase };
