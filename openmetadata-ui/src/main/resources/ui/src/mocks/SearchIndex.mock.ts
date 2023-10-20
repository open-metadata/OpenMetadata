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
  SearchIndexField,
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

export const MOCK_SEARCHED_FIELDS: SearchIndexField[] = [
  {
    name: 'name',
    dataType: DataType.Text,
    dataTypeDisplay: 'text',
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
    ],
  },
];
