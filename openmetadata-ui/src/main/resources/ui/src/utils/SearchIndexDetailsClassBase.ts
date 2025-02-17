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
import {
  DataType,
  IndexType,
  SearchIndex,
  SearchServiceType,
  State,
} from '../generated/entity/data/searchIndex';
import { Tab } from '../generated/system/ui/uiCustomization';
import { LabelType, TagSource } from '../generated/type/tagLabel';
import { WidgetConfig } from '../pages/CustomizablePage/CustomizablePage.interface';
import { getTabLabelFromId } from './CustomizePage/CustomizePageUtils';
import i18n from './i18next/LocalUtil';
import { getSearchIndexWidgetsFromKey } from './SearchIndexUtils';

export interface SearchIndexDetailPageTabProps {
  labelMap?: Record<EntityTabs, string>;
}

class SearchIndexClassBase {
  public getSearchIndexDetailPageTabs(
    _tabProps: SearchIndexDetailPageTabProps
  ): TabProps[] {
    return [];
  }

  public getSearchIndexDetailPageTabsIds(): Tab[] {
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
      editable: [EntityTabs.SCHEMA].includes(tab),
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

  public getDummyData(): SearchIndex {
    return {
      id: '2de6c0f1-c85a-4c90-b74b-b40869cc446c',
      name: 'table_search_index',
      fullyQualifiedName: 'elasticsearch_sample.table_search_index',
      displayName: 'TableSearchIndex',
      description: 'Table Search Index',
      version: 0.2,
      updatedAt: 1726204919320,
      updatedBy: 'ashish',
      service: {
        id: 'dde0ee41-f45f-4cd4-8826-07cd298905f2',
        type: 'searchService',
        name: 'elasticsearch_sample',
        fullyQualifiedName: 'elasticsearch_sample',
        displayName: 'elasticsearch_sample',
        deleted: false,
        href: 'http://test-argo.getcollate.io/api/v1/services/storageServices/dde0ee41-f45f-4cd4-8826-07cd298905f2',
      },
      serviceType: SearchServiceType.ElasticSearch,
      fields: [
        {
          name: 'name',
          dataType: DataType.Text,
          dataTypeDisplay: 'text',
          description: 'Table Entity Name.',
          fullyQualifiedName: 'elasticsearch_sample.table_search_index.name',
          tags: [],
        },
        {
          name: 'displayName',
          dataType: DataType.Text,
          dataTypeDisplay: 'text',
          description: 'Table Entity DisplayName.',
          fullyQualifiedName:
            'elasticsearch_sample.table_search_index.displayName',
          tags: [],
        },
        {
          name: 'description',
          dataType: DataType.Text,
          dataTypeDisplay: 'text',
          description: 'Table Entity Description.',
          fullyQualifiedName:
            'elasticsearch_sample.table_search_index.description',
          tags: [],
        },
        {
          name: 'columns',
          dataType: DataType.Nested,
          dataTypeDisplay: 'nested',
          description: 'Table Columns.',
          fullyQualifiedName: 'elasticsearch_sample.table_search_index.columns',
          tags: [],
          children: [
            {
              name: 'name',
              dataType: DataType.Text,
              dataTypeDisplay: 'text',
              description: 'Column Name.',
              fullyQualifiedName:
                'elasticsearch_sample.table_search_index.columns.name',
              tags: [],
            },
            {
              name: 'displayName',
              dataType: DataType.Text,
              dataTypeDisplay: 'text',
              description: 'Column DisplayName.',
              fullyQualifiedName:
                'elasticsearch_sample.table_search_index.columns.displayName',
              tags: [],
            },
            {
              name: 'description',
              dataType: DataType.Text,
              dataTypeDisplay: 'text',
              description: 'Column Description.',
              fullyQualifiedName:
                'elasticsearch_sample.table_search_index.columns.description',
              tags: [],
            },
          ],
        },
        {
          name: 'databaseSchema',
          dataType: DataType.Text,
          dataTypeDisplay: 'text',
          description: 'Database Schema that this table belongs to.',
          fullyQualifiedName:
            'elasticsearch_sample.table_search_index.databaseSchema',
          tags: [],
        },
      ],
      indexType: IndexType.Index,
      owners: [],
      followers: [
        {
          id: 'e596a9cd-9ce1-4e12-aee1-b6f31926b0e8',
          type: 'user',
          name: 'ashish',
          fullyQualifiedName: 'ashish',
          description:
            '<p><code>data driven car</code></p><p><code>Hybrid Modal</code></p>',
          displayName: 'Ashish',
          deleted: false,
          href: 'http://test-argo.getcollate.io/api/v1/users/e596a9cd-9ce1-4e12-aee1-b6f31926b0e8',
        },
      ],
      tags: [
        {
          tagFQN: '"Testing%Version@1.56"."156-Term.3"',
          name: '156-Term.3',
          displayName: '156-Term.3',
          description: '156-Term.3',
          source: TagSource.Glossary,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: '"classify-1.6.2".tagtest-1',
          name: 'tagtest-1',
          displayName: 'tagtest-1',
          description: '<p>tagtest-1 for.1.6.2</p>',
          style: {},
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: 'Data Center.center-1',
          name: 'center-1',
          displayName: '',
          description: 'this is center-1',
          style: {},
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
        {
          tagFQN: 'Tier.Tier5',
          name: 'Tier5',
          displayName: 'Priority 5',
          description:
            // eslint-disable-next-line max-len
            '**Private/Unused data assets - No impact beyond individual users**\n\n- Data assets without any ownership with no usage in the last 60 days\n\n- Data assets owned by individuals without team ownership\n\n',
          style: {},
          source: TagSource.Classification,
          labelType: LabelType.Manual,
          state: State.Confirmed,
        },
      ],
      href: 'http://test-argo.getcollate.io/api/v1/searchIndexes/2de6c0f1-c85a-4c90-b74b-b40869cc446c',

      deleted: false,
      domain: {
        id: 'a440b3a9-fbbf-464d-91d4-c9cfeeccc8e4',
        type: 'domain',
        name: 'Domain 1.6.0',
        fullyQualifiedName: '"Domain 1.6.0"',
        description: 'csacasc',
        displayName: 'Domain 1.6.0',
        href: 'http://test-argo.getcollate.io/api/v1/domains/a440b3a9-fbbf-464d-91d4-c9cfeeccc8e4',
      },
      dataProducts: [
        {
          id: '8c046cc5-ab23-40c0-a0bf-b58d206290f7',
          type: 'dataProduct',
          name: 'TestDataProduct',
          fullyQualifiedName: 'TestDataProduct',
          description: 'asd',
          displayName: 'TestDataProduct',
          href: 'http://test-argo.getcollate.io/api/v1/dataProducts/8c046cc5-ab23-40c0-a0bf-b58d206290f7',
        },
      ],
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
