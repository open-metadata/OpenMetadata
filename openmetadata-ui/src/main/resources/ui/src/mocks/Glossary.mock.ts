/*
 *  Copyright 2022 Collate.
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

import { Status } from '../generated/entity/data/glossaryTerm';

export const mockedAssetData = {
  currPage: 1,
  data: [],
  total: 0,
};

export const mockedGlossaryTerms = [
  {
    id: 'a5a97523-2229-41e5-abbe-65f61a534c34',
    name: 'Clothing',
    displayName: 'Clothing',
    description: 'description of Business Glossary.Clothing',
    fullyQualifiedName: 'Business Glossary.Clothing',
    synonyms: [],
    glossary: {
      id: 'mocked-glossary-id',
      type: 'glossary',
      name: 'Mock Glossary',
      description: '',
      displayName: 'Mock Glossary',
      deleted: false,
    },
    children: [],
    relatedTerms: [],
    references: [],
    version: 1.3,
    updatedAt: 1647931273177,
    updatedBy: 'anonymous',
    reviewers: [],
    tags: [],
    status: 'Draft' as Status,
    deleted: false,
  },
  {
    id: '937b87df-0b20-4464-bb12-8a2a268d1f1d',
    name: 'Sales',
    displayName: 'Sales',
    description: 'description of Business Glossary.Sales',
    fullyQualifiedName: 'Business Glossary.Sales',
    synonyms: [],
    glossary: {
      id: 'mocked-glossary-id',
      type: 'glossary',
      name: 'Mock Glossary',
      description: '',
      displayName: 'Mock Glossary',
      deleted: false,
    },
    children: [],
    relatedTerms: [],
    references: [],
    version: 1.3,
    updatedAt: 1647931273177,
    updatedBy: 'anonymous',
    reviewers: [],
    tags: [],
    status: 'Draft' as Status,
    deleted: false,
  },
];

export const mockedGlossaries = [
  {
    deleted: false,
    displayName: 'Mocked Glossary',
    description: '',
    id: 'mocked-glossary-id',
    name: 'Mock Glossary',
    owner: {
      deleted: false,
      displayName: 'Mocked User',
      id: 'mocked-user-id',
      name: 'mocked_user',
      type: 'user',
    },
    reviewers: [],
    tags: [],
    updatedAt: 1234567890,
    updatedBy: 'mocked_user',
    version: 0.1,
  },
];

export const mockGlossaryList = [
  {
    name: 'Tag1',
    displayName: 'Tag1',
    fullyQualifiedName: 'Glossary.Tag1',
    type: 'glossaryTerm',
    id: 'glossaryTagId1',
  },
  {
    name: 'Tag2',
    displayName: 'Tag2',
    fullyQualifiedName: 'Glossary.Tag2',
    type: 'glossaryTerm',
    id: 'glossaryTagId2',
  },
];

export const MOCK_GLOSSARY = {
  id: '35f8ca1c-65a7-403f-af1f-d86683f5e16d',
  name: 'Business glossary',
  fullyQualifiedName: 'Business glossary',
  displayName: 'Business glossary',
  description: 'Lorem Ipsum is simply ',
  version: 1.7,
  updatedAt: 1654247462471,
  updatedBy: 'anonymous',
  href: 'http://localhost:8585/api/v1/glossaries/35f8ca1c-65a7-403f-af1f-d86683f5e16d',
  reviewers: [
    {
      id: '790d6873-dbe1-4297-8e0a-59d4f88eaf9d',
      type: 'user',
      name: 'aaron_singh2',
      fullyQualifiedName: 'aaron_singh2',
      displayName: 'Aaron Singh',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/790d6873-dbe1-4297-8e0a-59d4f88eaf9d',
    },
    {
      id: '6f5ffe31-437f-496f-92fe-15886fe67f43',
      type: 'user',
      name: 'aaron_warren5',
      fullyQualifiedName: 'aaron_warren5',
      displayName: 'Aaron Warren',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/6f5ffe31-437f-496f-92fe-15886fe67f43',
    },
    {
      id: '7abd5d27-b8cf-4dc7-a98b-faa91e4d1ceb',
      type: 'user',
      name: 'adam_rodriguez9',
      fullyQualifiedName: 'adam_rodriguez9',
      displayName: 'Adam Rodriguez',
      deleted: false,
      href: 'http://localhost:8585/api/v1/users/7abd5d27-b8cf-4dc7-a98b-faa91e4d1ceb',
    },
  ],
  owner: {
    id: 'cffe41bc-2306-4fff-8b92-9ecf3e414127',
    type: 'user',
    name: 'aaron_johnson0',
    fullyQualifiedName: 'aaron_johnson0',
    displayName: 'Aaron Johnson',
    deleted: false,
    href: 'http://localhost:8585/api/v1/users/cffe41bc-2306-4fff-8b92-9ecf3e414127',
  },
  tags: [
    {
      tagFQN: 'PersonalData.SpecialCategory',
      description: 'GDPR special category ',
      source: 'Classification',
      labelType: 'Manual',
      state: 'Confirmed',
    },
    {
      tagFQN: 'PII.Sensitive',
      description:
        'PII which if lost, compromised, or disclosed without authorization, could result in substantial harm, embarrassment, inconvenience, or unfairness to an individual.',
      source: 'Classification',
      labelType: 'Manual',
      state: 'Confirmed',
    },
  ],
  changeDescription: {
    fieldsAdded: [],
    fieldsUpdated: [],
    fieldsDeleted: [],
    previousVersion: 1.6,
  },
  deleted: false,
};

export const MOCK_ASSETS_DATA = {
  data: {
    took: 28,
    timed_out: false,
    _shards: { total: 5, successful: 5, skipped: 0, failed: 0 },
    hits: {
      total: { value: 1, relation: 'eq' },
      max_score: 2.1288848,
      hits: [
        {
          _index: 'table_search_index',
          _type: '_doc',
          _id: 'c514ca18-2ea4-44b1-aa06-0c66bc0cd355',
          _score: 2.1288848,
          _source: {
            id: 'c514ca18-2ea4-44b1-aa06-0c66bc0cd355',
            name: 'raw_order',
            fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_order',
            description:
              'This is a raw orders table as represented in our online DB.',
            version: 0.8,
            updatedAt: 1664445302349,
            updatedBy: 'bharatdussa',
            href: 'http://localhost:8585/api/v1/tables/c514ca18-2ea4-44b1-aa06-0c66bc0cd355',
            tableType: 'Regular',
            columns: [
              {
                dataLength: 1,
                dataType: 'STRING',
                name: 'comments',
                constraint: 'NULL',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_order.comments',
                ordinalPosition: 1,
                dataTypeDisplay: 'string',
                tags: [
                  {
                    tagFQN: 'PersonalData.Personal',
                    labelType: 'Manual',
                    description:
                      'Data that can be used to directly or indirectly identify a person.',
                    source: 'Classification',
                    state: 'Confirmed',
                  },
                  {
                    tagFQN: 'PersonalData.SpecialCategory',
                    labelType: 'Manual',
                    description:
                      'GDPR special category data is personal information of data subjects that is especially sensitive.',
                    source: 'Classification',
                    state: 'Confirmed',
                  },
                ],
                customMetrics: [],
              },
              {
                dataLength: 1,
                dataType: 'STRING',
                name: 'creditcard',
                constraint: 'NULL',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_order.creditcard',
                ordinalPosition: 2,
                dataTypeDisplay: 'string',
                tags: [],
                customMetrics: [],
              },
              {
                dataLength: 1,
                dataType: 'STRING',
                name: 'membership',
                constraint: 'NULL',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_order.membership',
                ordinalPosition: 4,
                dataTypeDisplay: 'string',
                tags: [],
                customMetrics: [],
              },
              {
                dataLength: 1,
                dataType: 'ARRAY',
                name: 'orders',
                constraint: 'NULL',
                fullyQualifiedName:
                  'sample_data.ecommerce_db.shopify.raw_order.orders',
                ordinalPosition: 5,
                dataTypeDisplay:
                  'array<struct<product_id:character varying(24),price:int,onsale:boolean,tax:int,weight:int,others:int,vendor:character varying(64)>>',
                arrayDataType: 'STRUCT',
                tags: [],
                customMetrics: [],
              },
            ],
            databaseSchema: {
              deleted: false,
              name: 'shopify',
              description:
                'This **mock** database contains schema related to shopify sales and orders with related dimension tables.',
              id: '85217879-eff9-4990-9f76-806a563c500b',
              href: 'http://localhost:8585/api/v1/databaseSchemas/85217879-eff9-4990-9f76-806a563c500b',
              type: 'databaseSchema',
              fullyQualifiedName: 'sample_data.ecommerce_db.shopify',
            },
            database: {
              deleted: false,
              name: 'ecommerce_db',
              description:
                'This **mock** database contains schemas related to shopify sales and orders with related dimension tables.',
              id: '0b37dd2c-b235-4243-8ea8-7485f9b7c4a3',
              href: 'http://localhost:8585/api/v1/databases/0b37dd2c-b235-4243-8ea8-7485f9b7c4a3',
              type: 'database',
              fullyQualifiedName: 'sample_data.ecommerce_db',
            },
            service: {
              deleted: false,
              name: 'sample_data',
              id: '3768e7fe-ce05-480d-9021-38baf0d0f637',
              href: 'http://localhost:8585/api/v1/services/databaseServices/3768e7fe-ce05-480d-9021-38baf0d0f637',
              type: 'databaseService',
              fullyQualifiedName: 'sample_data',
            },
            serviceType: 'BigQuery',
            tags: [
              {
                tagFQN: 'PersonalData.Personal',
                labelType: 'Manual',
                description:
                  'Data that can be used to directly or indirectly identify a person.',
                source: 'Classification',
                state: 'Confirmed',
              },
            ],
            usageSummary: {
              dailyStats: { count: 0, percentileRank: 0.0 },
              weeklyStats: { count: 0, percentileRank: 0.0 },
              monthlyStats: { count: 0, percentileRank: 0.0 },
              date: '2022-09-29',
            },
            followers: [],
            tableQueries: [],
            deleted: false,
            tier: null,
            suggest: [
              {
                input: 'sample_data.ecommerce_db.shopify.raw_order',
                weight: 5,
              },
              { input: 'raw_order', weight: 10 },
            ],
            service_suggest: [{ input: 'sample_data', weight: 5 }],
            column_suggest: [
              { input: 'comments', weight: 5 },
              { input: 'creditcard', weight: 5 },
              { input: 'membership', weight: 5 },
              { input: 'orders', weight: 5 },
            ],
            schema_suggest: [{ input: 'shopify', weight: 5 }],
            database_suggest: [{ input: 'ecommerce_db', weight: 5 }],
            entityType: 'table',
            owner: {
              deleted: false,
              displayName: 'Bharat Dussa',
              name: 'bharatdussa',
              id: 'f187364d-114c-4426-b941-baf6a15f70e4',
              href: 'http://localhost:8585/api/v1/users/f187364d-114c-4426-b941-baf6a15f70e4',
              type: 'user',
              fullyQualifiedName: 'bharatdussa',
            },
          },
        },
      ],
    },
    aggregations: {
      'sterms#EntityType': {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [{ key: 'table', doc_count: 1 }],
      },
      'sterms#Tags': {
        doc_count_error_upper_bound: 0,
        sum_other_doc_count: 0,
        buckets: [
          { key: 'PII.NonSensitive', doc_count: 1 },
          { key: 'PII.None', doc_count: 1 },
          { key: 'PII.Sensitive', doc_count: 1 },
          { key: 'PersonalData.Personal', doc_count: 1 },
          { key: 'PersonalData.SpecialCategory', doc_count: 1 },
          { key: 'test-category.test-glossary-term-tag', doc_count: 1 },
          { key: 'test-glossary.test-glossary-term', doc_count: 1 },
        ],
      },
    },
  },
};
