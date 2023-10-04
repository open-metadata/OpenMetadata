/*
 *  Copyright 2023 Collate.
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

import {
  DataType,
  LabelType,
  SearchIndex,
  SearchServiceType,
  State,
  TagSource,
} from '../../../../generated/entity/data/searchIndex';

export const mockSearchIndexEntityDetails: SearchIndex = {
  id: 'e157b054-e9d1-428b-97b6-12a36d6c1146',
  name: 'table_search_index',
  fullyQualifiedName: 'testES.table_search_index',
  displayName: 'table_search_index_new',
  version: 1.6,
  updatedAt: 1694592004058,
  updatedBy: 'ingestion-bot',
  service: {
    id: 'fb1bd626-d560-4a7f-8db1-aba7d2e6698b',
    type: 'searchService',
    name: 'testES',
    fullyQualifiedName: 'testES',
    description: '',
    deleted: false,
    href: 'http://localhost:8585/api/v1/services/storageServices/fb1bd626-d560-4a7f-8db1-aba7d2e6698b',
  },
  serviceType: SearchServiceType.ElasticSearch,
  fields: [
    {
      name: 'column_suggest',
      dataType: DataType.Completion,
      fullyQualifiedName: 'testES.table_search_index.column_suggest',
      tags: [],
    },
    {
      name: 'columns',
      dataType: DataType.Object,
      fullyQualifiedName: 'testES.table_search_index.columns',
      tags: [],
      children: [
        {
          name: 'arrayDataType',
          dataType: DataType.Text,
          fullyQualifiedName: 'testES.table_search_index.columns.arrayDataType',
          tags: [],
        },
        {
          name: 'children',
          dataType: DataType.Object,
          fullyQualifiedName: 'testES.table_search_index.columns.children',
          tags: [],
          children: [
            {
              name: 'children',
              dataType: DataType.Object,
              fullyQualifiedName:
                'testES.table_search_index.columns.children.children',
              tags: [],
              children: [
                {
                  name: 'dataLength',
                  dataType: DataType.Unknown,
                  fullyQualifiedName:
                    'testES.table_search_index.columns.children.children.dataLength',
                  tags: [],
                },
                {
                  name: 'dataType',
                  dataType: DataType.Text,
                  fullyQualifiedName:
                    'testES.table_search_index.columns.children.children.dataType',
                  tags: [],
                },
              ],
            },
            {
              name: 'constraint',
              dataType: DataType.Text,
              fullyQualifiedName:
                'testES.table_search_index.columns.children.constraint',
              tags: [],
            },
            {
              name: 'dataLength',
              dataType: DataType.Unknown,
              fullyQualifiedName:
                'testES.table_search_index.columns.children.dataLength',
              tags: [],
            },
            {
              name: 'dataType',
              dataType: DataType.Text,
              fullyQualifiedName:
                'testES.table_search_index.columns.children.dataType',
              tags: [],
            },
            {
              name: 'dataTypeDisplay',
              dataType: DataType.Text,
              fullyQualifiedName:
                'testES.table_search_index.columns.children.dataTypeDisplay',
              tags: [],
            },
            {
              name: 'description',
              dataType: DataType.Text,
              fullyQualifiedName:
                'testES.table_search_index.columns.children.description',
              tags: [],
            },
            {
              name: 'fullyQualifiedName',
              dataType: DataType.Text,
              fullyQualifiedName:
                'testES.table_search_index.columns.children.fullyQualifiedName',
              tags: [],
            },
            {
              name: 'name',
              dataType: DataType.Text,
              fullyQualifiedName:
                'testES.table_search_index.columns.children.name',
              tags: [],
            },
          ],
        },
        {
          name: 'constraint',
          dataType: DataType.Text,
          fullyQualifiedName: 'testES.table_search_index.columns.constraint',
          tags: [],
        },
        {
          name: 'dataLength',
          dataType: DataType.Unknown,
          fullyQualifiedName: 'testES.table_search_index.columns.dataLength',
          tags: [],
        },
        {
          name: 'dataType',
          dataType: DataType.Text,
          fullyQualifiedName: 'testES.table_search_index.columns.dataType',
          tags: [],
        },
        {
          name: 'dataTypeDisplay',
          dataType: DataType.Text,
          fullyQualifiedName:
            'testES.table_search_index.columns.dataTypeDisplay',
          tags: [],
        },
        {
          name: 'description',
          dataType: DataType.Text,
          fullyQualifiedName: 'testES.table_search_index.columns.description',
          tags: [],
        },
        {
          name: 'fullyQualifiedName',
          dataType: DataType.Text,
          fullyQualifiedName:
            'testES.table_search_index.columns.fullyQualifiedName',
          tags: [],
        },
        {
          name: 'name',
          dataType: DataType.Keyword,
          fullyQualifiedName: 'testES.table_search_index.columns.name',
          tags: [],
        },
        {
          name: 'ordinalPosition',
          dataType: DataType.Unknown,
          fullyQualifiedName:
            'testES.table_search_index.columns.ordinalPosition',
          tags: [],
        },
      ],
    },
    {
      name: 'dataProducts',
      dataType: DataType.Keyword,
      fullyQualifiedName: 'testES.table_search_index.dataProducts',
      tags: [],
    },
    {
      name: 'database',
      dataType: DataType.Object,
      fullyQualifiedName: 'testES.table_search_index.database',
      tags: [],
    },
    {
      name: 'name',
      dataType: DataType.Text,
      fullyQualifiedName: 'testES.table_search_index.name',
      tags: [],
    },
  ],
  searchIndexSettings: {
    index: {
      uuid: '3DqvLSVTRR2Cc8biJleHaA',
      routing: {
        allocation: {
          include: {
            _tier_preference: 'data_content',
          },
        },
      },
      version: {
        created: '7160399',
      },
      analysis: {
        filter: {
          om_stemmer: {
            name: 'english',
            type: 'stemmer',
          },
        },
        analyzer: {
          om_ngram: {
            filter: ['lowercase'],
            max_gram: '2',
            min_gram: '1',
            tokenizer: 'ngram',
          },
          om_analyzer: {
            filter: ['lowercase', 'om_stemmer'],
            tokenizer: 'letter',
          },
        },
        normalizer: {
          lowercase_normalizer: {
            type: 'custom',
            filter: ['lowercase'],
            char_filter: [],
          },
        },
      },
      creation_date: '1694572027496',
      provided_name: 'table_search_index',
      number_of_shards: '1',
      number_of_replicas: '1',
    },
  },
  followers: [],
  tags: [
    {
      tagFQN: 'PersonalData.Personal',
      description:
        'Data that can be used to directly or indirectly identify a person.',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
    {
      tagFQN: 'PII.Sensitive',
      description:
        'PII which if lost, compromised, or disclosed without authorization, could result in substantial harm, embarrassment, inconvenience, or unfairness to an individual.',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
  ],
  href: 'http://localhost:8585/api/v1/searchIndexes/e157b054-e9d1-428b-97b6-12a36d6c1146',
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [],
    fieldsDeleted: [
      {
        name: 'fields.column_suggest.description',
        oldValue: '',
      },
    ],
    previousVersion: 1.5,
  },
  deleted: false,
};
