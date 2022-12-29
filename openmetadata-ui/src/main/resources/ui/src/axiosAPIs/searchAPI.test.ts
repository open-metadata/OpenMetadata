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

import { flatten, isNull } from 'lodash';
import { SearchIndex } from '../enums/search.enum';

const mockTableSearchResponse = {
  took: 93,
  _shards: {
    total: 1,
    successful: 1,
    skipped: 0,
    failed: 0,
  },
  hits: {
    total: {
      value: 10000,
      relation: 'gte',
    },
    hits: [
      {
        _index: 'table_search_index',
        _type: '_doc',
        _id: '9b30a945-239a-4cb7-93b0-f1b7425aed41',
        _score: null,
        _source: {
          id: '9b30a945-239a-4cb7-93b0-f1b7425aed41',
          name: 'raw_product_catalog',
          fullyQualifiedName:
            'sample_data.ecommerce_db.shopify.raw_product_catalog',
          description:
            'This is a raw product catalog table contains the product listing, price, seller etc.. represented in our online DB. ',
          version: 0.1,
          updatedAt: 1661336543968,
          updatedBy: 'anonymous',
          href: 'http://localhost:8585/api/v1/tables/9b30a945-239a-4cb7-93b0-f1b7425aed41',
          tableType: 'Regular',
          entityType: 'table',
          owner: null,
          some: {
            nested: {
              nullValue: null,
            },
          },
        },
      },
    ],
  },
  aggregations: {
    'sterms#EntityType': {
      buckets: [
        {
          key: 'table',
          doc_count: 10960,
        },
      ],
    },
    'sterms#ServiceName': {
      buckets: [
        {
          key: 'trino',
          doc_count: 10924,
        },
        {
          key: 'sample_data',
          doc_count: 36,
        },
      ],
    },
    'sterms#Tags': {
      buckets: [],
    },
  },
};

const mockSuggestUserResponse = {
  suggest: {
    'metadata-suggest': [
      {
        text: 'a',
        offset: 0,
        length: 1,
        options: [
          {
            text: 'Aaron Johnson',
            _index: 'user_search_index',
            _type: '_doc',
            _id: '2cae227c-e2c4-487c-b52c-a96ae242d90d',
            _score: 10.0,
            _source: {
              id: '2cae227c-e2c4-487c-b52c-a96ae242d90d',
              name: 'aaron_johnson0',
              fullyQualifiedName: 'aaron_johnson0',
              displayName: 'Aaron Johnson',
              version: 0.1,
              updatedAt: 1661336540995,
              updatedBy: 'anonymous',
              email: 'aaron_johnson0@gmail.com',
              href: 'http://localhost:8585/api/v1/users/2cae227c-e2c4-487c-b52c-a96ae242d90d',
              isAdmin: false,
              deleted: false,
              roles: [],
              inheritedRoles: [],
              entityType: 'user',
              teams: null,
              some: {
                nested: {
                  nullValue: null,
                },
              },
            },
          },
        ],
      },
    ],
  },
};

describe('searchAPI tests', () => {
  beforeEach(() => jest.resetModules());

  it('suggestQuery should return object and aggregations', async () => {
    jest.mock('./index', () => ({
      get: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ data: mockTableSearchResponse })
        ),
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { searchQuery } = require('./searchAPI');
    const res = await searchQuery({ searchIndex: SearchIndex.TABLE });

    expect(res.hits.total.value).toBe(10_000);

    expect(res.hits.hits).toHaveLength(1);
    expect(res.hits.hits[0]._index).toEqual(SearchIndex.TABLE);
    expect(res.hits.hits[0]._source).toEqual(
      expect.objectContaining({
        id: '9b30a945-239a-4cb7-93b0-f1b7425aed41',
        name: 'raw_product_catalog',
        fullyQualifiedName:
          'sample_data.ecommerce_db.shopify.raw_product_catalog',
        description:
          'This is a raw product catalog table contains the product listing, price, seller etc.. represented in our online DB. ',
        version: 0.1,
        updatedAt: 1661336543968,
        updatedBy: 'anonymous',
        href: 'http://localhost:8585/api/v1/tables/9b30a945-239a-4cb7-93b0-f1b7425aed41',
        tableType: 'Regular',
      })
    );

    expect(res.aggregations).toEqual(
      expect.objectContaining({
        EntityType: {
          buckets: expect.arrayContaining([
            {
              key: 'table',
              doc_count: 10960,
            },
          ]),
        },
        ServiceName: {
          buckets: expect.arrayContaining([
            {
              key: 'trino',
              doc_count: 10924,
            },
            {
              key: 'sample_data',
              doc_count: 36,
            },
          ]),
        },
        Tags: {
          buckets: [],
        },
      })
    );
  });

  it('searchQuery should not return nulls', async () => {
    jest.mock('./index', () => ({
      get: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ data: mockTableSearchResponse })
        ),
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { searchQuery } = require('./searchAPI');
    const res = await searchQuery({ searchIndex: SearchIndex.TABLE });

    expect(
      !('owner' in res.hits.hits[0]._source) ||
        res.hits.hits[0]._source.owner === undefined
    ).toBeTruthy();
    // Deep checking for null values
    expect(flatten(res.hits.hits[0]._source).filter(isNull)).toHaveLength(0);
  });

  it('searchQuery should have type field', async () => {
    jest.mock('./index', () => ({
      get: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ data: mockTableSearchResponse })
        ),
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { searchQuery } = require('./searchAPI');
    const res = await searchQuery({ searchIndex: SearchIndex.TABLE });

    expect(res.hits.hits[0]._source.type).toBe('table');
  });

  it('suggestQuery should return object and text', async () => {
    jest.mock('./index', () => ({
      get: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ data: mockSuggestUserResponse })
        ),
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { suggestQuery } = require('./searchAPI');
    const res = await suggestQuery({ searchIndex: SearchIndex.USER });

    expect(res).toEqual([
      expect.objectContaining({
        _index: SearchIndex.USER,
        _source: expect.objectContaining({
          id: '2cae227c-e2c4-487c-b52c-a96ae242d90d',
          name: 'aaron_johnson0',
          fullyQualifiedName: 'aaron_johnson0',
          displayName: 'Aaron Johnson',
          version: 0.1,
          updatedAt: 1661336540995,
          updatedBy: 'anonymous',
          email: 'aaron_johnson0@gmail.com',
          href: 'http://localhost:8585/api/v1/users/2cae227c-e2c4-487c-b52c-a96ae242d90d',
          isAdmin: false,
          deleted: false,
          roles: [],
          inheritedRoles: [],
          entityType: 'user',
        }),
      }),
    ]);
  });

  it('suggestQuery should not return nulls', async () => {
    jest.mock('./index', () => ({
      get: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ data: mockSuggestUserResponse })
        ),
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { suggestQuery } = require('./searchAPI');
    const res = await suggestQuery({ searchIndex: SearchIndex.USER });

    // Deep checking for null values
    expect(flatten(res[0]._source).filter(isNull)).toHaveLength(0);
  });

  it('suggestQuery should have type field', async () => {
    jest.mock('./index', () => ({
      get: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ data: mockSuggestUserResponse })
        ),
    }));
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { suggestQuery } = require('./searchAPI');
    const res = await suggestQuery({ searchIndex: SearchIndex.USER });

    expect(res[0]._source.type).toBe('user');
  });
});
