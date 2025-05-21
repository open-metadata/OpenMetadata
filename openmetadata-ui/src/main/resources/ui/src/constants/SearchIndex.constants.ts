/*
 *  Copyright 2025 Collate.
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
  IndexType,
  SearchIndex,
  SearchServiceType,
} from '../generated/entity/data/searchIndex';

export const SEARCH_INDEX_DUMMY_DATA: SearchIndex = {
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
      fullyQualifiedName: 'elasticsearch_sample.table_search_index.displayName',
      tags: [],
    },
    {
      name: 'description',
      dataType: DataType.Text,
      dataTypeDisplay: 'text',
      description: 'Table Entity Description.',
      fullyQualifiedName: 'elasticsearch_sample.table_search_index.description',
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
    },
  ],
  tags: [],
  deleted: false,
  domain: {
    id: 'a440b3a9-fbbf-464d-91d4-c9cfeeccc8e4',
    type: 'domain',
    name: 'Domain 1.6.0',
    fullyQualifiedName: '"Domain 1.6.0"',
    description: 'csacasc',
    displayName: 'Domain 1.6.0',
  },
  dataProducts: [
    {
      id: '8c046cc5-ab23-40c0-a0bf-b58d206290f7',
      type: 'dataProduct',
      name: 'TestDataProduct',
      fullyQualifiedName: 'TestDataProduct',
      description: 'asd',
      displayName: 'TestDataProduct',
    },
  ],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};
