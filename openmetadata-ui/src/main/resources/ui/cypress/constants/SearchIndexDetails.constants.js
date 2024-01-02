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
// eslint-disable-next-line spaced-comment
/// <reference types="cypress" />
import { uuid } from '../common/common';

export const TIER = 'Tier1';
export const TAG_1 = {
  classification: 'PersonalData',
  tag: 'SpecialCategory',
};
export const UPDATE_DESCRIPTION = 'Updated description for search index.';
export const UPDATE_FIELD_DESCRIPTION =
  'Updated description for search index field.';

export const USER_FIRST_NAME = `USER_FIRST_NAME_${uuid()}`;
export const USER_LAST_NAME = `USER_LAST_NAME_${uuid()}`;
export const USER_NAME = `test_user${uuid()}`;
export const USER_EMAIL = `${USER_NAME}@openmetadata.org`;
export const SEARCH_INDEX_NAME = `search_index-${uuid()}`;
export const SEARCH_INDEX_DISPLAY_NAME = `${SEARCH_INDEX_NAME}_display_name`;

export const USER_CREDENTIALS = {
  firstName: USER_FIRST_NAME,
  lastName: USER_LAST_NAME,
  email: USER_EMAIL,
  password: 'User@OMD123',
};

export const SEARCH_INDEX_DETAILS_FOR_ANNOUNCEMENT = {
  term: SEARCH_INDEX_NAME,
  displayName: SEARCH_INDEX_DISPLAY_NAME,
  entity: 'searchIndexes',
  serviceName: 'elasticsearch_sample',
  entityType: 'Search Index',
};

export const SEARCH_INDEX_DETAILS_FOR_DETAILS_PAGE_TEST = {
  name: SEARCH_INDEX_NAME,
  service: 'elasticsearch_sample',
  fields: [
    {
      name: 'name',
      dataType: 'TEXT',
      dataTypeDisplay: 'text',
      fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.name`,
      tags: [],
    },
    {
      name: 'displayName',
      dataType: 'TEXT',
      dataTypeDisplay: 'text',
      description: 'Description for field displayName',
      fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.displayName`,
      tags: [],
    },
    {
      name: 'description',
      dataType: 'TEXT',
      dataTypeDisplay: 'text',
      fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.description`,
      tags: [],
    },
    {
      name: 'columns',
      dataType: 'NESTED',
      dataTypeDisplay: 'nested',
      fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.columns`,
      tags: [],
      children: [
        {
          name: 'name',
          dataType: 'TEXT',
          dataTypeDisplay: 'text',
          fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.columns.name`,
          tags: [],
        },
        {
          name: 'displayName',
          dataType: 'TEXT',
          dataTypeDisplay: 'text',
          fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.columns.displayName`,
          tags: [],
        },
        {
          name: 'description',
          dataType: 'TEXT',
          dataTypeDisplay: 'text',
          fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.columns.description`,
          tags: [],
        },
      ],
    },
    {
      name: 'databaseSchema',
      dataType: 'TEXT',
      dataTypeDisplay: 'text',
      description: 'Database Schema that this table belongs to.',
      fullyQualifiedName: `elasticsearch_sample.${SEARCH_INDEX_NAME}.databaseSchema`,
      tags: [],
    },
  ],
  tags: [],
};
