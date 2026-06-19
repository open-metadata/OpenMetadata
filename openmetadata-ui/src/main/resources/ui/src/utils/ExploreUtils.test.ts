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
import { ExploreQuickFilterField } from '../components/Explore/ExplorePage.interface';
import { FAILED_TO_FIND_INDEX_ERROR } from '../constants/explore.constants';
import { EntityFields } from '../enums/AdvancedSearch.enum';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { QueryFieldInterface } from '../pages/ExplorePage/ExplorePage.interface';
import { nlqSearch, searchQuery } from '../rest/searchAPI';
import {
  extractTermKeys,
  getExploreQueryFilterMust,
  getQuickFilterObjectForEntities,
  getQuickFilterQuery,
  getSelectedValuesFromQuickFilter,
  getSubLevelHierarchyKey,
  updateTreeData,
} from './ExplorePureUtils';
import { fetchEntityData } from './ExploreUtils';

jest.mock('../rest/searchAPI');
jest.mock('./ToastUtils');

const mockSearchQuery = searchQuery as jest.Mock;
const mockNlqSearch = nlqSearch as jest.Mock;

describe('Explore Utils', () => {
  it('should return undefined if data is empty', () => {
    const data: ExploreQuickFilterField[] = [];
    const result = getQuickFilterQuery(data);

    expect(result).toBeUndefined();
  });

  it('should generate quick filter query correctly', () => {
    const data = [
      {
        label: 'Domain',
        key: 'domains.displayName.keyword',
        value: [],
      },
      {
        label: 'Owner',
        key: 'ownerDisplayName',
        value: [],
      },
      {
        label: 'Tag',
        key: 'tags.tagFQN',
        value: [
          {
            key: 'personaldata.personal',
            label: 'personaldata.personal',
            count: 1,
          },
        ],
      },
    ];
    const result = getQuickFilterQuery(data);
    const expectedQuery = {
      query: {
        bool: {
          must: [
            {
              bool: {
                should: [
                  {
                    term: {
                      'tags.tagFQN': 'personaldata.personal',
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    };

    expect(result).toEqual(expectedQuery);
  });

  describe('extractTermKeys', () => {
    it('should return an empty array if objects is empty', () => {
      const objects: QueryFieldInterface[] = [];
      const result = extractTermKeys(objects);

      expect(result).toEqual([]);
    });

    it('should return an array of term keys', () => {
      const objects = [
        {
          bool: {
            must_not: {
              exists: {
                field: 'ownerDisplayName',
              },
            },
          },
        },
        {
          term: {
            ownerDisplayName: 'accounting',
          },
        },
      ];
      const result = extractTermKeys(objects);
      const expectedKeys = ['ownerDisplayName'];

      expect(result).toEqual(expectedKeys);
    });
  });

  it('getSelectedValuesFromQuickFilter should return correct result', () => {
    const selectedFilters = {
      Domain: [],
      Owner: [
        {
          key: 'OM_NULL_FIELD',
          label: 'label.no-entity',
        },
        {
          key: 'accounting',
          label: 'accounting',
        },
      ],
      Tag: [],
    };

    const dropdownData = [
      {
        label: 'Domain',
        key: 'domains.displayName.keyword',
      },
      {
        label: 'Owner',
        key: 'ownerDisplayName',
      },
      {
        label: 'Tag',
        key: 'tags.tagFQN',
      },
    ];

    const queryFilter = {
      query: {
        bool: {
          must: [
            {
              bool: {
                should: [
                  {
                    bool: {
                      must_not: {
                        exists: {
                          field: 'ownerDisplayName',
                        },
                      },
                    },
                  },
                  {
                    term: {
                      ownerDisplayName: 'accounting',
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    };

    expect(getSelectedValuesFromQuickFilter(dropdownData, queryFilter)).toEqual(
      selectedFilters
    );
  });

  describe('getSubLevelHierarchyKey', () => {
    it('returns the correct bucket and queryFilter when isDatabaseHierarchy is true', () => {
      const result = getSubLevelHierarchyKey(
        true,
        undefined,
        EntityFields.SERVICE,
        'testValue'
      );

      expect(result).toEqual({
        bucket: EntityFields.DATABASE_DISPLAY_NAME,
        queryFilter: {
          query: {
            bool: {
              must: {
                term: {
                  [EntityFields.SERVICE]: 'testValue',
                },
              },
            },
          },
        },
      });
    });

    it('returns the correct bucket and queryFilter when isDatabaseHierarchy is false', () => {
      const result = getSubLevelHierarchyKey(
        false,
        undefined,
        EntityFields.SERVICE,
        'testValue'
      );

      expect(result).toEqual({
        bucket: EntityFields.ENTITY_TYPE,
        queryFilter: {
          query: {
            bool: {
              must: {
                term: {
                  [EntityFields.SERVICE]: 'testValue',
                },
              },
            },
          },
        },
      });
    });

    it('returns the default bucket and an empty queryFilter when key and value are not provided', () => {
      const result = getSubLevelHierarchyKey();

      expect(result).toEqual({
        bucket: EntityFields.SERVICE_TYPE,
        queryFilter: {
          query: {
            bool: {},
          },
        },
      });
    });

    it('returns the correct bucket and queryFilter when filterType provided', () => {
      const result = getSubLevelHierarchyKey(true, [
        {
          label: 'serviceType',
          key: 'serviceType',
          value: [
            {
              key: 'athena',
              label: 'athena',
            },
          ],
        },
      ]);

      expect(result).toEqual({
        bucket: 'serviceType',
        queryFilter: {
          query: {
            bool: {
              must: [
                { bool: { should: [{ term: { serviceType: 'athena' } }] } },
              ],
            },
          },
        },
      });
    });
  });

  describe('getExploreQueryFilterMust', () => {
    it('return the must for the serviceType filter field provided', () => {
      const response = getExploreQueryFilterMust([
        {
          label: 'serviceType',
          key: 'serviceType',
          value: [
            {
              key: 'athena',
              label: 'athena',
            },
          ],
        },
      ]);

      expect(response).toEqual([
        {
          bool: {
            should: [
              {
                term: {
                  serviceType: 'athena',
                },
              },
            ],
          },
        },
      ]);
    });

    it('return the must for the service filter field provided', () => {
      const response = getExploreQueryFilterMust([
        {
          label: 'serviceType',
          key: 'serviceType',
          value: [
            {
              key: 'athena',
              label: 'athena',
            },
          ],
        },
        {
          label: 'service.displayName.keyword',
          key: 'service.displayName.keyword',
          value: [
            {
              key: 'athena_prod',
              label: 'athena_prod',
            },
          ],
        },
      ]);

      expect(response).toEqual([
        {
          bool: {
            should: [
              {
                term: {
                  serviceType: 'athena',
                },
              },
            ],
          },
        },
        {
          bool: {
            should: [
              {
                term: {
                  'service.displayName.keyword': 'athena_prod',
                },
              },
            ],
          },
        },
      ]);
    });

    it('return the must for the database filter field provided', () => {
      const response = getExploreQueryFilterMust([
        {
          label: 'serviceType',
          key: 'serviceType',
          value: [
            {
              key: 'athena',
              label: 'athena',
            },
          ],
        },
        {
          label: 'service.displayName.keyword',
          key: 'service.displayName.keyword',
          value: [
            {
              key: 'athena_prod',
              label: 'athena_prod',
            },
          ],
        },
        {
          label: 'database.name.keyword',
          key: 'database.name.keyword',
          value: [
            {
              key: 'default',
              label: 'default',
            },
          ],
        },
      ]);

      expect(response).toEqual([
        {
          bool: {
            should: [
              {
                term: {
                  serviceType: 'athena',
                },
              },
            ],
          },
        },
        {
          bool: {
            should: [
              {
                term: {
                  'service.displayName.keyword': 'athena_prod',
                },
              },
            ],
          },
        },
        {
          bool: {
            should: [
              {
                term: {
                  'database.name.keyword': 'default',
                },
              },
            ],
          },
        },
      ]);
    });

    it('return the must for the databaseSchema filter field provided', () => {
      const response = getExploreQueryFilterMust([
        {
          label: 'serviceType',
          key: 'serviceType',
          value: [
            {
              key: 'athena',
              label: 'athena',
            },
          ],
        },
        {
          label: 'service.displayName.keyword',
          key: 'service.displayName.keyword',
          value: [
            {
              key: 'athena_prod',
              label: 'athena_prod',
            },
          ],
        },
        {
          label: 'database.name.keyword',
          key: 'database.name.keyword',
          value: [
            {
              key: 'default',
              label: 'default',
            },
          ],
        },
        {
          label: 'databaseSchema.name.keyword',
          key: 'databaseSchema.name.keyword',
          value: [
            {
              key: 'default',
              label: 'default',
            },
          ],
        },
      ]);

      expect(response).toEqual([
        {
          bool: {
            should: [
              {
                term: {
                  serviceType: 'athena',
                },
              },
            ],
          },
        },
        {
          bool: {
            should: [
              {
                term: {
                  'service.displayName.keyword': 'athena_prod',
                },
              },
            ],
          },
        },
        {
          bool: {
            should: [
              {
                term: {
                  'database.name.keyword': 'default',
                },
              },
            ],
          },
        },
        {
          bool: {
            should: [
              {
                term: {
                  'databaseSchema.name.keyword': 'default',
                },
              },
            ],
          },
        },
      ]);
    });

    it('return the must for the entity type filter field provided', () => {
      const response = getExploreQueryFilterMust([
        {
          label: 'serviceType',
          key: 'serviceType',
          value: [
            {
              key: 'athena',
              label: 'athena',
            },
          ],
        },
        {
          label: 'service.displayName.keyword',
          key: 'service.displayName.keyword',
          value: [
            {
              key: 'athena_prod',
              label: 'athena_prod',
            },
          ],
        },
        {
          label: 'database.name.keyword',
          key: 'database.name.keyword',
          value: [
            {
              key: 'default',
              label: 'default',
            },
          ],
        },
        {
          label: 'databaseSchema.name.keyword',
          key: 'databaseSchema.name.keyword',
          value: [
            {
              key: 'default',
              label: 'default',
            },
          ],
        },
        {
          label: 'entityType',
          key: 'entityType',
          value: [
            {
              key: 'table',
              label: 'table',
            },
          ],
        },
      ]);

      expect(response).toEqual([
        {
          bool: {
            should: [
              {
                term: {
                  serviceType: 'athena',
                },
              },
            ],
          },
        },
        {
          bool: {
            should: [
              {
                term: {
                  'service.displayName.keyword': 'athena_prod',
                },
              },
            ],
          },
        },
        {
          bool: {
            should: [
              {
                term: {
                  'database.name.keyword': 'default',
                },
              },
            ],
          },
        },
        {
          bool: {
            should: [
              {
                term: {
                  'databaseSchema.name.keyword': 'default',
                },
              },
            ],
          },
        },
        {
          bool: {
            should: [
              {
                term: {
                  'entityType.keyword': 'table',
                },
              },
            ],
          },
        },
      ]);
    });
  });

  describe('updateTreeData', () => {
    it('updates the correct node in the tree', () => {
      const treeData = [
        { title: '1', key: '1', children: [{ title: '1.1', key: '1.1' }] },
        { title: '2', key: '2', children: [{ title: '2.1', key: '2.1' }] },
      ];

      const newChildren = [{ title: '1.1.1', key: '1.1.1' }];

      const updatedTreeData = updateTreeData(treeData, '1.1', newChildren);

      expect(updatedTreeData).toEqual([
        {
          key: '1',
          title: '1',
          children: [{ title: '1.1', key: '1.1', children: newChildren }],
        },
        { key: '2', title: '2', children: [{ title: '2.1', key: '2.1' }] },
      ]);
    });

    it('does not modify the tree if the key is not found', () => {
      const treeData = [
        { title: '1', key: '1', children: [{ title: '1.1', key: '1.1' }] },
        { title: '2', key: '2', children: [{ title: '2.1', key: '2.1' }] },
      ];

      const newChildren = [{ title: '1.1.1', key: '1.1.1' }];

      const updatedTreeData = updateTreeData(treeData, '3', newChildren);

      expect(updatedTreeData).toEqual(treeData);
    });
  });

  describe('getQuickFilterObjectForEntities', () => {
    it('return the filterObject having single entity as bucketValues', () => {
      const updatedTreeData = getQuickFilterObjectForEntities(
        EntityFields.ENTITY_TYPE_KEYWORD,
        [EntityType.PIPELINE]
      );

      expect(updatedTreeData).toEqual({
        key: 'entityType.keyword',
        label: 'entityType.keyword',
        value: [{ key: 'pipeline', label: 'pipeline' }],
      });
    });

    it('return the filterObject having multiple entity as bucketValues', () => {
      const updatedTreeData = getQuickFilterObjectForEntities(
        EntityFields.ENTITY_TYPE_KEYWORD,
        [EntityType.TABLE, EntityType.STORED_PROCEDURE]
      );

      expect(updatedTreeData).toEqual({
        key: 'entityType.keyword',
        label: 'entityType.keyword',
        value: [
          { key: 'table', label: 'table' },
          { key: 'storedProcedure', label: 'storedProcedure' },
        ],
      });
    });
  });
});

describe('fetchEntityData', () => {
  const COUNT_RESPONSE = {
    aggregations: {
      entityType: { buckets: [{ key: 'table', doc_count: 42 }] },
    },
    hits: { hits: [], total: { value: 42 } },
  };
  const RESULTS_RESPONSE = {
    hits: { hits: [{ _id: '1' }], total: { value: 42 } },
    aggregations: { 'sterms#tags.tagFQN': { buckets: [] } },
  };

  const buildParams = (overrides = {}) =>
    ({
      searchQueryParam: '',
      tabsInfo: {},
      updatedQuickFilters: undefined,
      queryFilter: {},
      searchIndex: SearchIndex.TABLE,
      showDeleted: false,
      sortValue: 'name',
      sortOrder: 'asc',
      page: 1,
      size: 15,
      isNLPRequestEnabled: false,
      tab: 'tables',
      TABS_SEARCH_INDEXES: [SearchIndex.TABLE],
      EntityTypeSearchIndexMapping: { [EntityType.TABLE]: SearchIndex.TABLE },
      setSearchHitCounts: jest.fn(),
      setSearchResults: jest.fn(),
      setUpdatedAggregations: jest.fn(),
      setShowIndexNotFoundAlert: jest.fn(),
      onNlqAppliedFilters: jest.fn(),
      ...overrides,
    } as unknown as Parameters<typeof fetchEntityData>[0]);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('issues a single search on the given index when there is no query', async () => {
    mockSearchQuery.mockResolvedValueOnce(RESULTS_RESPONSE);
    const params = buildParams();

    await fetchEntityData(params);

    expect(mockSearchQuery).toHaveBeenCalledTimes(1);
    expect(mockSearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ searchIndex: SearchIndex.TABLE })
    );
    expect(params.setSearchResults).toHaveBeenCalledWith(RESULTS_RESPONSE);
    expect(params.setUpdatedAggregations).toHaveBeenCalledWith(
      RESULTS_RESPONSE.aggregations
    );
  });

  it('runs a count then a results query and maps tab hit counts when a query is present', async () => {
    mockSearchQuery
      .mockResolvedValueOnce(COUNT_RESPONSE)
      .mockResolvedValueOnce(RESULTS_RESPONSE);
    const params = buildParams({ searchQueryParam: 'customer' });

    await fetchEntityData(params);

    expect(mockSearchQuery).toHaveBeenCalledTimes(2);
    expect(mockSearchQuery.mock.calls[0][0]).toEqual(
      expect.objectContaining({
        searchIndex: SearchIndex.DATA_ASSET,
        pageSize: 0,
      })
    );
    expect(params.setSearchHitCounts).toHaveBeenCalledWith({
      [SearchIndex.TABLE]: 42,
    });
    expect(params.setSearchResults).toHaveBeenCalledWith(RESULTS_RESPONSE);
  });

  it('ANDs the browse/filter scope into the query_filter sent to search', async () => {
    mockSearchQuery.mockResolvedValueOnce(RESULTS_RESPONSE);
    const params = buildParams({
      updatedQuickFilters: {
        query: {
          bool: {
            must: [{ term: { 'service.displayName.keyword': 'redshift' } }],
          },
        },
      },
      queryFilter: {
        query: { bool: { must: [{ term: { 'tier.tagFQN': 'Tier.Tier1' } }] } },
      },
    });

    await fetchEntityData(params);

    const sentQueryFilter = JSON.stringify(
      mockSearchQuery.mock.calls[0][0].queryFilter
    );

    expect(sentQueryFilter).toContain('redshift');
    expect(sentQueryFilter).toContain('Tier.Tier1');
  });

  it('raises the index-not-found alert on an elasticsearch index error', async () => {
    mockSearchQuery.mockRejectedValueOnce({
      response: { data: { message: FAILED_TO_FIND_INDEX_ERROR } },
    });
    const params = buildParams();

    await fetchEntityData(params);

    expect(params.setShowIndexNotFoundAlert).toHaveBeenCalledWith(true);
  });

  it('uses NLQ search and surfaces applied filters when NLP is enabled', async () => {
    mockNlqSearch.mockResolvedValueOnce(COUNT_RESPONSE).mockResolvedValueOnce({
      ...RESULTS_RESPONSE,
      applied_quick_filters: { fieldList: ['owner'] },
    });
    const params = buildParams({
      searchQueryParam: 'customer',
      isNLPRequestEnabled: true,
    });

    await fetchEntityData(params);

    expect(mockNlqSearch).toHaveBeenCalled();
    expect(mockSearchQuery).not.toHaveBeenCalled();
    expect(params.onNlqAppliedFilters).toHaveBeenCalledWith({
      fieldList: ['owner'],
    });
  });

  it('issues the results query without waiting for the count when a tab is selected', async () => {
    let resolveCount: (value: unknown) => void = () => undefined;
    mockSearchQuery
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveCount = resolve;
          })
      )
      .mockResolvedValueOnce(RESULTS_RESPONSE);
    const params = buildParams({ searchQueryParam: 'customer', tab: 'tables' });

    const pending = fetchEntityData(params);

    // Results query is already in flight while the count is still pending.
    expect(mockSearchQuery).toHaveBeenCalledTimes(2);

    resolveCount(COUNT_RESPONSE);
    await pending;

    expect(params.setSearchResults).toHaveBeenCalledWith(RESULTS_RESPONSE);
    expect(params.setSearchHitCounts).toHaveBeenCalledWith({
      [SearchIndex.TABLE]: 42,
    });
  });
});
