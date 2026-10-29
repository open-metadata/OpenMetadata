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
        _index: SearchIndex.TABLE,
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

describe('searchAPI tests', () => {
  beforeEach(() => jest.resetModules());

  it.each([
    SearchIndex.LLM_SERVICE,
    SearchIndex.MCP_SERVICE,
    SearchIndex.MCP_EXECUTION,
    SearchIndex.PROMPT_TEMPLATE,
  ])(
    'searches %s with an array of indexes and selected fields',
    async (index) => {
      const source = { id: 'result-1', entityType: index };
      const get = jest.fn().mockResolvedValue({
        data: {
          hits: {
            total: { value: 1 },
            hits: [{ _index: index, _id: source.id, _source: source }],
          },
          aggregations: {},
        },
      });
      jest.doMock('./axiosClient', () => ({ get }));
      const {
        searchQuery,
      }: typeof import('./searchAPI') = require('./searchAPI');

      const result = await searchQuery({
        searchIndex: [index],
        fetchSource: true,
        includeFields: ['id', 'entityType'],
      });
      const entityTypes: string[] = result.hits.hits.map(
        (hit) => hit._source.entityType
      );

      expect(entityTypes).toEqual([index]);
      expect(result.hits.hits[0]._source).toEqual({ ...source, type: index });
      expect(get.mock.calls[0][1].params).toMatchObject({
        index,
        fetch_source: true,
        include_source_fields: ['id', 'entityType'],
      });
    }
  );

  describe.each(['searchQuery', 'nlqSearch'] as const)(
    '%s pagination',
    (method) => {
      it.each([
        { pageNumber: 0, pageSize: 25, from: 0 },
        { pageNumber: -1, pageSize: 25, from: 0 },
        { pageNumber: 1, pageSize: 25, from: 0 },
        { pageNumber: 2, pageSize: 25, from: 25 },
        { pageNumber: undefined, pageSize: 25, from: 0 },
        { pageNumber: 0, pageSize: 0, from: 0 },
      ])(
        'uses offset $from for page $pageNumber with size $pageSize',
        async ({ pageNumber, pageSize, from }) => {
          const mockGet = jest
            .fn()
            .mockResolvedValue({ data: mockTableSearchResponse });

          jest.doMock('./axiosClient', () => ({ get: mockGet }));

          const searchAPI: typeof import('./searchAPI') = require('./searchAPI');

          const request = {
            searchIndex: SearchIndex.TABLE,
            pageNumber,
            pageSize,
          };
          if (method === 'searchQuery') {
            await searchAPI.searchQuery(request);
          } else {
            await searchAPI.nlqSearch(request);
          }

          const [, config] = mockGet.mock.calls[0];

          expect(config.params).toMatchObject({ from, size: pageSize });
        }
      );
    }
  );

  it('searchQuery should not return nulls', async () => {
    jest.mock('./axiosClient', () => ({
      get: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ data: mockTableSearchResponse })
        ),
    }));

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
    jest.mock('./axiosClient', () => ({
      get: jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve({ data: mockTableSearchResponse })
        ),
    }));

    const { searchQuery } = require('./searchAPI');
    const res = await searchQuery({ searchIndex: SearchIndex.TABLE });

    expect(res.hits.hits[0]._source.type).toBe('table');
  });

  it('searchQuery should serialize AI governance asset indexes', async () => {
    const mockGet = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ data: mockTableSearchResponse })
      );

    jest.mock('./axiosClient', () => ({
      get: mockGet,
    }));

    const { searchQuery } = require('./searchAPI');

    await searchQuery({
      searchIndex: [
        SearchIndex.AI_APPLICATION,
        SearchIndex.LLM_MODEL,
        SearchIndex.MCP_SERVER,
      ],
      query: '**',
      fetchSource: true,
    });

    const [, config] = mockGet.mock.calls[0];

    expect(config.params.index).toBe('aiApplication,llmModel,mcpServer');
    expect(config.params.fetch_source).toBe(true);
  });

  it('nlqSearch should forward query_filter', async () => {
    const mockGet = jest
      .fn()
      .mockImplementation(() =>
        Promise.resolve({ data: mockTableSearchResponse })
      );

    jest.mock('./axiosClient', () => ({
      get: mockGet,
    }));

    const { nlqSearch }: typeof import('./searchAPI') = require('./searchAPI');

    const response = await nlqSearch({
      query: 'show tables',
      searchIndex: SearchIndex.TABLE,
      queryFilter: {
        query: {
          bool: {
            must: [
              {
                term: {
                  entityType: 'table',
                },
              },
            ],
          },
        },
      },
      pageNumber: 1,
      pageSize: 10,
    });
    const names: string[] = response.hits.hits.map((hit) => hit._source.name);

    expect(names).toEqual(['raw_product_catalog']);

    const [, config] = mockGet.mock.calls[0];

    expect(config.params.query_filter).toBe(
      JSON.stringify({
        query: {
          bool: {
            must: [
              {
                term: {
                  entityType: 'table',
                },
              },
            ],
          },
        },
      })
    );
  });

  it('rawSearchQuery marks a picker search to skip the navbar domain filter', async () => {
    const get = jest.fn().mockResolvedValue({ data: mockTableSearchResponse });
    jest.mock('./axiosClient', () => ({ get }));
    const { SKIP_DOMAIN_FILTER_HEADER } = require('../constants/constants');
    const { rawSearchQuery } = require('./searchAPI');

    await rawSearchQuery({
      searchIndex: SearchIndex.TABLE,
      skipDomainFilter: true,
    });
    await rawSearchQuery({ searchIndex: SearchIndex.TABLE });

    expect(get.mock.calls[0][1].headers).toEqual({
      [SKIP_DOMAIN_FILTER_HEADER]: 'true',
    });
    expect(get.mock.calls[1][1].headers).toBeUndefined();
  });
});
