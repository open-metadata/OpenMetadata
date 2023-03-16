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

import {
  QueryFieldInterface,
  QueryFilterInterface,
} from 'pages/explore/ExplorePage.interface';

export const mockAdvancedSearchQueryFilters: QueryFilterInterface = {
  query: {
    bool: {
      must: [
        { bool: { must: [{ term: { 'owner.type': 'team' } }] } },
        {
          bool: {
            must: [
              { term: { 'service.name': 'sample_data' } },
              { term: { 'databaseSchema.name': 'shopify' } },
            ],
          },
        },
      ],
    },
  },
};

export const mockESQueryFilters: QueryFilterInterface = {
  query: {
    bool: {
      must: [
        { bool: { should: [{ term: { 'tags.tagFQN': 'PII.Sensitive' } }] } },
      ],
    },
  },
};

export const mockCombinedQueryFilterValue: QueryFilterInterface = {
  query: {
    bool: {
      must: [
        { bool: { should: [{ term: { 'tags.tagFQN': 'PII.Sensitive' } }] } },
        { bool: { must: [{ term: { 'owner.type': 'team' } }] } },
        {
          bool: {
            must: [
              { term: { 'service.name': 'sample_data' } },
              { term: { 'databaseSchema.name': 'shopify' } },
            ],
          },
        },
      ],
    },
  },
};

export const mockCombinedMustFieldArray: QueryFieldInterface[] = [
  { bool: { should: [{ term: { 'tags.tagFQN': 'PII.Sensitive' } }] } },
  { bool: { must: [{ term: { 'owner.type': 'team' } }] } },
  {
    bool: {
      must: [
        { term: { 'service.name': 'sample_data' } },
        { term: { 'databaseSchema.name': 'shopify' } },
      ],
    },
  },
];

export const mockQueryFilterArray: QueryFieldInterface[] = [
  { bool: { should: [{ term: { 'tags.tagFQN': 'PII.Sensitive' } }] } },
];
