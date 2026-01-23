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
import { Fields } from '@react-awesome-query-builder/antd';
import { EntityType } from '../enums/entity.enum';
import {
  QueryFieldInterface,
  QueryFilterInterface,
} from '../pages/ExplorePage/ExplorePage.interface';
import {
  addEntityTypeFilter,
  buildExploreUrlParams,
  getEntityTypeAggregationFilter,
  getJsonTreeFromQueryFilter,
  jsonLogicToElasticsearch,
  resolveFieldType,
} from './QueryBuilderUtils';

jest.mock('./StringsUtils', () => ({
  generateUUID: jest.fn(),
}));

describe('getJsonTreeFromQueryFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return a valid JSON tree structure for a given query filter', () => {
    const mockUUIDs = ['uuid1', 'uuid2', 'uuid3', 'uuid4'];
    (
      jest.requireMock('./StringsUtils').generateUUID as jest.Mock
    ).mockImplementation(() => mockUUIDs.shift());
    const queryFilter: QueryFilterInterface = {
      query: {
        bool: {
          must: [
            {
              bool: {
                must: [
                  {
                    term: {
                      field1: 'value1',
                    },
                  },
                ],
              },
            },
          ],
        },
      },
    };

    const result = getJsonTreeFromQueryFilter(queryFilter);

    expect(result).toEqual({
      type: 'group',
      properties: { conjunction: 'AND', not: false },
      children1: {
        uuid2: {
          type: 'group',
          properties: { conjunction: 'AND', not: false },
          children1: {
            uuid3: {
              type: 'rule',
              properties: {
                field: 'field1',
                operator: 'select_equals',
                value: ['value1'],
                valueSrc: ['value'],
                operatorOptions: null,
                valueType: ['select'],
                asyncListValues: [
                  {
                    key: 'value1',
                    value: 'value1',
                    children: 'value1',
                  },
                ],
              },
              id: 'uuid3',
              path: ['uuid1', 'uuid2', 'uuid3'],
            },
          },
          id: 'uuid2',
          path: ['uuid1', 'uuid2'],
        },
      },
      id: 'uuid1',
    });
  });

  it('should return an empty object if an error occurs', () => {
    const queryFilter: QueryFilterInterface = {
      query: {
        bool: {
          must: [],
        },
      },
    };

    const result = getJsonTreeFromQueryFilter(queryFilter);

    expect(result).toEqual({});
  });
});

describe('resolveFieldType', () => {
  const mockFields: Fields = {
    name: {
      type: 'text',
    },
    extension: {
      type: '!group',
      subfields: {
        expert: {
          type: 'text',
        },
        'expert.name': {
          // Direct path field
          type: 'string',
        },
        'expert.level': {
          type: 'number',
        },
        settings: {
          type: '!group',
          subfields: {
            enabled: {
              type: 'boolean',
            },
          },
        },
      },
    },
  };

  it.each([
    ['simple top-level field', 'name', 'text'],
    ['direct path in subfields', 'extension.expert.name', 'string'],
    ['nested field through normal traversal', 'extension.expert', 'text'],
    ['deeply nested field', 'extension.settings.enabled', 'boolean'],
    ['non-existent field', 'nonexistent', undefined],
    ['non-existent nested field', 'extension.nonexistent', undefined],
    ['invalid nested path', 'name.invalid.path', undefined],
  ])('should resolve %s', (_, field: string, expectedType?: string) => {
    expect(resolveFieldType(mockFields, field)).toBe(expectedType);
  });

  it('should return an empty string if the field is undefined', () => {
    expect(resolveFieldType(undefined, 'name')).toBe('');
  });
});

describe('addEntityTypeFilter', () => {
  const baseQueryFilter: QueryFilterInterface = {
    query: {
      bool: {
        must: [
          {
            bool: {
              must: [
                {
                  term: {
                    field1: 'value1',
                  },
                },
              ],
            },
          },
        ],
      },
    },
  };

  it('should return the original filter when entityType is ALL', () => {
    const result = addEntityTypeFilter({ ...baseQueryFilter }, EntityType.ALL);

    expect(result).toEqual(baseQueryFilter);
  });

  it('should add entity type filter for non-ALL entity types', () => {
    const result = addEntityTypeFilter(
      { ...baseQueryFilter },
      EntityType.TABLE
    );

    // Assert the must array exists and has correct length
    expect(result.query?.bool?.must).toBeDefined();

    const mustArray = result.query?.bool?.must as QueryFieldInterface[];

    expect(Array.isArray(mustArray)).toBe(true);
    expect(mustArray).toHaveLength(2);

    // Assert the entity type filter is added correctly
    expect(mustArray[1]).toEqual({
      bool: {
        must: [
          {
            term: {
              'entityType.keyword': EntityType.TABLE,
            },
          },
        ],
      },
    });
  });

  it('should handle undefined must array gracefully', () => {
    const queryFilter: QueryFilterInterface = {
      query: {
        bool: {},
      },
    };
    const result = addEntityTypeFilter(queryFilter, EntityType.TABLE);

    expect(result).toEqual(queryFilter);
  });

  it('should handle empty query gracefully', () => {
    const queryFilter = {} as QueryFilterInterface;
    const result = addEntityTypeFilter(queryFilter, EntityType.TABLE);

    expect(result).toEqual(queryFilter);
  });
});

describe('getEntityTypeAggregationFilter', () => {
  const baseQueryFilter: QueryFilterInterface = {
    query: {
      bool: {
        must: [
          {
            bool: {
              must: [
                {
                  term: {
                    field1: 'value1',
                  },
                },
              ],
            },
          },
        ],
      },
    },
  };

  it('should add entity type to the first must block', () => {
    const result = getEntityTypeAggregationFilter(
      { ...baseQueryFilter },
      EntityType.TABLE
    );

    // Assert the must array exists
    expect(result.query?.bool?.must).toBeDefined();

    const mustArray = result.query?.bool?.must as QueryFieldInterface[];

    expect(Array.isArray(mustArray)).toBe(true);
    expect(mustArray.length).toBeGreaterThan(0);

    // Get the first must block and assert its structure
    const firstMustBlock = mustArray[0];
    const mustBlockArray = firstMustBlock.bool?.must as QueryFieldInterface[];

    expect(mustBlockArray).toBeDefined();
    expect(Array.isArray(mustBlockArray)).toBe(true);
    expect(mustBlockArray).toHaveLength(2);

    // Assert the entity type filter is added correctly
    expect(mustBlockArray[1]).toEqual({
      term: {
        'entityType.keyword': EntityType.TABLE,
      },
    });
  });

  it('should handle undefined must array in first block gracefully', () => {
    const queryFilter: QueryFilterInterface = {
      query: {
        bool: {
          must: [
            {
              bool: {},
            },
          ],
        },
      },
    };
    const result = getEntityTypeAggregationFilter(
      queryFilter,
      EntityType.TABLE
    );

    expect(result).toEqual(queryFilter);
  });

  it('should handle empty must array gracefully', () => {
    const queryFilter: QueryFilterInterface = {
      query: {
        bool: {
          must: [],
        },
      },
    };
    const result = getEntityTypeAggregationFilter(
      queryFilter,
      EntityType.TABLE
    );

    expect(result).toEqual(queryFilter);
  });

  it('should handle empty query gracefully', () => {
    const queryFilter = {} as QueryFilterInterface;
    const result = getEntityTypeAggregationFilter(
      queryFilter,
      EntityType.TABLE
    );

    expect(result).toEqual(queryFilter);
  });
});

describe('jsonLogicToElasticsearch', () => {
  it('should convert any in operator', () => {
    const logic = {
      and: [
        {
          or: [
            {
              '==': [
                {
                  var: 'database.name',
                },
                'default',
              ],
            },
            {
              '==': [
                {
                  var: 'database.name',
                },
                'ecommerce_db',
              ],
            },
          ],
        },
      ],
    };
    const configFields = {
      'database.name': {
        label: 'Database',
        type: 'select',
      },
    };

    const result = jsonLogicToElasticsearch(logic, configFields);

    expect(result).toEqual({
      bool: {
        must: [
          {
            bool: {
              must: [
                {
                  bool: {
                    should: [
                      {
                        term: {
                          'database.name': 'default',
                        },
                      },
                      {
                        term: {
                          'database.name': 'ecommerce_db',
                        },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    });
  });

  it('should convert not in operator', () => {
    const logic = {
      and: [
        {
          '!': {
            '==': [
              {
                var: 'database.name',
              },
              ['default', 'ecommerce_db'],
            ],
          },
        },
      ],
    };
    const configFields = {
      'database.name': {
        label: 'Database',
        type: 'select',
      },
    };

    const result = jsonLogicToElasticsearch(logic, configFields);

    expect(result).toEqual({
      bool: {
        must: [
          {
            bool: {
              must: [
                {
                  bool: {
                    must_not: {
                      term: {
                        'database.name': ['default', 'ecommerce_db'],
                      },
                    },
                  },
                },
              ],
            },
          },
        ],
      },
    });
  });
});

describe('buildExploreUrlParams', () => {
  const mockTree = { id: 'root', type: 'group', children1: {} };
  const mockQFilter: QueryFilterInterface = {
    query: {
      bool: {
        must: [{ term: { 'owner.displayName.keyword': 'admin' } }],
      },
    },
  };

  it('should return empty object when both tree and qFilter are empty', () => {
    const result = buildExploreUrlParams({}, undefined);

    expect(result).toEqual({});
  });

  it('should return only queryFilter when tree is provided but qFilter is empty', () => {
    const result = buildExploreUrlParams(mockTree, undefined);

    expect(result).toEqual({
      queryFilter: JSON.stringify(mockTree),
    });
    expect(result.quickFilter).toBeUndefined();
  });

  it('should return only quickFilter when qFilter has query but tree is empty', () => {
    const result = buildExploreUrlParams({}, mockQFilter);

    expect(result).toEqual({
      quickFilter: JSON.stringify(mockQFilter),
    });
    expect(result.queryFilter).toBeUndefined();
  });

  it('should return both queryFilter and quickFilter when both are provided', () => {
    const result = buildExploreUrlParams(mockTree, mockQFilter);

    expect(result).toEqual({
      queryFilter: JSON.stringify(mockTree),
      quickFilter: JSON.stringify(mockQFilter),
    });
  });

  it('should not include quickFilter when qFilter exists but has no query property', () => {
    const qFilterWithoutQuery = {
      someOtherProp: 'value',
    } as unknown as QueryFilterInterface;
    const result = buildExploreUrlParams(mockTree, qFilterWithoutQuery);

    expect(result).toEqual({
      queryFilter: JSON.stringify(mockTree),
    });
    expect(result.quickFilter).toBeUndefined();
  });

  it('should handle null tree gracefully', () => {
    const result = buildExploreUrlParams(null, mockQFilter);

    expect(result).toEqual({
      quickFilter: JSON.stringify(mockQFilter),
    });
  });

  it('should return valid JSON strings', () => {
    const result = buildExploreUrlParams(mockTree, mockQFilter);

    expect(() => JSON.parse(result.queryFilter!)).not.toThrow();
    expect(() => JSON.parse(result.quickFilter!)).not.toThrow();
  });

  it('should produce params that can be URL encoded with proper separators', () => {
    const result = buildExploreUrlParams(mockTree, mockQFilter);

    const allParams = { mode: 'edit', ...result };
    const queryString = new URLSearchParams(allParams).toString();

    expect(queryString).toContain('mode=edit');
    expect(queryString).toContain('&');
    expect(queryString).toContain('queryFilter=');
    expect(queryString).toContain('quickFilter=');

    const decoded = new URLSearchParams(queryString);

    expect(decoded.get('mode')).toBe('edit');
    expect(JSON.parse(decoded.get('queryFilter')!)).toEqual(mockTree);
    expect(JSON.parse(decoded.get('quickFilter')!)).toEqual(mockQFilter);
  });

  it('should work correctly when only queryFilter is present with other params', () => {
    const result = buildExploreUrlParams(mockTree, undefined);

    const allParams = { mode: 'view', ...result };
    const queryString = new URLSearchParams(allParams).toString();

    expect(queryString).toContain('mode=view');
    expect(queryString).toContain('queryFilter=');
    expect(queryString).not.toContain('quickFilter=');

    const ampersandCount = (queryString.match(/&/g) || []).length;

    expect(ampersandCount).toBe(1);
  });
});
