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
  SearchIndexField,
  SearchServiceType,
  State,
  TagSource,
} from '../generated/entity/data/searchIndex';

export const MOCK_SEARCH_INDEX_FIELDS: SearchIndexField[] = [
  {
    name: 'name',
    dataType: DataType.Text,
    description: 'Table Entity Name.',
    fullyQualifiedName: 'elasticsearch_sample.table_search_index.name',
    tags: [
      {
        tagFQN: 'PersonalData.Personal',
        description:
          'Data that can be used to directly or indirectly identify a person.',
        source: TagSource.Classification,
        labelType: LabelType.Manual,
        state: State.Confirmed,
      },
    ],
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
        name: 'column_name',
        dataType: DataType.Text,
        dataTypeDisplay: 'text',
        description: 'Column Name.',
        fullyQualifiedName:
          'elasticsearch_sample.table_search_index.columns.name',
        tags: [],
      },
      {
        name: 'column_description',
        dataType: DataType.Text,
        dataTypeDisplay: 'text',
        description: 'Column Description.',
        fullyQualifiedName:
          'elasticsearch_sample.table_search_index.columns.description',
        tags: [],
      },
    ],
  },
];

export const MOCK_SEARCH_INDEX: SearchIndex = {
  id: '5cb19694-636d-4c8f-93cf-ed6f6a135da7',
  name: 'table_search_index',
  fullyQualifiedName: 'elasticsearch_sample.table_search_index',
  displayName: 'TableSearchIndex',
  description: 'Table Search Index',
  version: 0.4,
  updatedAt: 1700546849712,
  updatedBy: 'harsha',
  service: {
    id: '43bcffa8-89e7-45f5-9518-9247c56a1de7',
    type: 'searchService',
    name: 'elasticsearch_sample',
    fullyQualifiedName: 'elasticsearch_sample',
    deleted: false,
    href: 'http://sandbox-beta.open-metadata.org/api/v1/services/storageServices/43bcffa8-89e7-45f5-9518-9247c56a1de7',
  },
  serviceType: SearchServiceType.ElasticSearch,
  fields: MOCK_SEARCH_INDEX_FIELDS,
  followers: [],
  tags: [
    {
      tagFQN: 'Banking.Account',
      name: 'Account',
      displayName: '',
      description: 'A type of financial property or financial.',
      source: TagSource.Classification,
      labelType: LabelType.Manual,
      state: State.Confirmed,
    },
  ],
  href: 'http://sandbox-beta.open-metadata.org/api/v1/searchIndexes/5cb19694-636d-4c8f-93cf-ed6f6a135da7',
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 0.3,
  },
  deleted: false,
  domain: {
    id: '52fc9c67-78b7-42bf-8147-69278853c230',
    type: 'domain',
    name: 'Design',
    fullyQualifiedName: 'Design',
    description: "Here' the description for Product Design",
    displayName: 'Product Design ',
    href: 'http://sandbox-beta.open-metadata.org/api/v1/domains/52fc9c67-78b7-42bf-8147-69278853c230',
  },
  dataProducts: [],
  votes: {
    upVotes: 0,
    downVotes: 0,
    upVoters: [],
    downVoters: [],
  },
};
