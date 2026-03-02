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
import { InternalAxiosRequestConfig } from 'axios';
import { DEFAULT_DOMAIN_VALUE } from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { Domain, DomainType } from '../generated/entity/domains/domain';
import { useDomainStore } from '../hooks/useDomainStore';
import {
  getDomainOptions,
  getQueryFilterToIncludeDomain,
  isDomainExist,
  withDomainFilter,
} from '../utils/DomainUtils';
import { getPathNameFromWindowLocation } from './RouterUtils';

jest.mock('../hooks/useDomainStore');
jest.mock('./RouterUtils');

describe('getDomainOptions function', () => {
  const domains = [
    {
      id: '1',
      name: 'Domain 1',
      fullyQualifiedName: 'domain1',
      description: 'test',
      domainType: DomainType.Aggregate,
    },
  ];

  it('should return an array of ItemType objects', () => {
    const result = getDomainOptions(domains);

    expect(Array.isArray(result)).toBeTruthy();
    expect(result).toHaveLength(2);

    result.forEach((item) => {
      expect(item).toHaveProperty('label');
      expect(item).toHaveProperty('key');
    });
  });
});

describe('isDomainExist', () => {
  it('should return true if domain fqn matches directly', () => {
    const domain = {
      id: '1',
      name: 'Parent',
      fullyQualifiedName: 'parent',
    } as Domain;

    expect(isDomainExist(domain, 'parent')).toBe(true);
  });

  it('should return true if domain fqn exists in children', () => {
    const domain = {
      id: '1',
      name: 'Parent',
      fullyQualifiedName: 'parent',
      children: [
        {
          id: '2',
          name: 'Child',
          fullyQualifiedName: 'parent.child',
        },
      ],
    } as Domain;

    expect(isDomainExist(domain, 'parent.child')).toBe(true);
  });

  it('should return true if domain fqn exists in nested children', () => {
    const domain = {
      id: '1',
      name: 'Parent',
      fullyQualifiedName: 'parent',
      description: 'test',
      domainType: DomainType.Aggregate,
      children: [
        {
          id: '2',
          name: 'Child',
          fullyQualifiedName: 'parent.child',
          children: [
            {
              id: '3',
              name: 'GrandChild',
              fullyQualifiedName: 'parent.child.grandchild',
            },
          ],
        },
      ],
    } as unknown as Domain;

    expect(isDomainExist(domain, 'parent.child.grandchild')).toBe(true);
  });

  it('should return false if domain fqn does not exist', () => {
    const domain = {
      id: '1',
      name: 'Parent',
      fullyQualifiedName: 'parent',
      children: [
        {
          id: '2',
          name: 'Child',
          fullyQualifiedName: 'parent.child',
        },
      ],
    } as Domain;

    expect(isDomainExist(domain, 'nonexistent')).toBe(false);
  });

  it('should handle domain without children', () => {
    const domain = {
      id: '1',
      name: 'Parent',
      fullyQualifiedName: 'parent',
      children: [],
      description: 'test',
      domainType: DomainType.Aggregate,
    } as unknown as Domain;

    expect(isDomainExist(domain, 'parent.child')).toBe(false);
  });

  it('should handle domain with description and type', () => {
    const domain = {
      id: '1',
      name: 'Parent',
      fullyQualifiedName: 'parent',
      description: 'test description',
      domainType: DomainType.Aggregate,
      children: [
        {
          id: '2',
          name: 'Child',
          fullyQualifiedName: 'parent.child',
          children: [
            {
              id: '3',
              name: 'GrandChild',
              fullyQualifiedName: 'parent.child.grandchild',
            },
          ],
        },
      ],
    } as unknown as Domain;

    expect(isDomainExist(domain, 'parent.child.grandchild')).toBe(true);
  });

  describe('getQueryFilterToIncludeDomain', () => {
    it('should return correct query filter structure with domain and data product fqns', () => {
      const domainFqn = 'testDomain';
      const dataProductFqn = 'testDataProduct';

      const result = getQueryFilterToIncludeDomain(domainFqn, dataProductFqn);

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              {
                term: {
                  'domains.fullyQualifiedName': domainFqn,
                },
              },
              {
                bool: {
                  must_not: [
                    {
                      term: {
                        'dataProducts.fullyQualifiedName': dataProductFqn,
                      },
                    },
                  ],
                },
              },
              {
                bool: {
                  must_not: [
                    {
                      terms: {
                        entityType: [
                          EntityType.DATA_PRODUCT,
                          EntityType.TEST_SUITE,
                          EntityType.QUERY,
                          EntityType.TEST_CASE,
                        ],
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      });
    });

    it('should create filter with nested domain fqn', () => {
      const domainFqn = 'parent.child.grandchild';
      const dataProductFqn = 'product.subproduct';

      const result = getQueryFilterToIncludeDomain(domainFqn, dataProductFqn);

      const firstMust = result.query.bool.must[0] as {
        term: { 'domains.fullyQualifiedName': string };
      };

      expect(firstMust.term['domains.fullyQualifiedName']).toBe(domainFqn);

      const secondMust = result.query.bool.must[1] as {
        bool: {
          must_not: Array<{
            term: { 'dataProducts.fullyQualifiedName': string };
          }>;
        };
      };

      expect(
        secondMust.bool.must_not[0].term['dataProducts.fullyQualifiedName']
      ).toBe(dataProductFqn);
    });

    it('should exclude specific entity types', () => {
      const domainFqn = 'testDomain';
      const dataProductFqn = 'testDataProduct';

      const result = getQueryFilterToIncludeDomain(domainFqn, dataProductFqn);

      const thirdMust = result.query.bool.must[2] as {
        bool: {
          must_not: Array<{
            terms: { entityType: EntityType[] };
          }>;
        };
      };
      const excludedEntityTypes = thirdMust.bool.must_not[0].terms.entityType;

      expect(excludedEntityTypes).toContain(EntityType.DATA_PRODUCT);
      expect(excludedEntityTypes).toContain(EntityType.TEST_SUITE);
      expect(excludedEntityTypes).toContain(EntityType.QUERY);
      expect(excludedEntityTypes).toContain(EntityType.TEST_CASE);
      expect(excludedEntityTypes).toHaveLength(4);
    });

    it('should handle empty string parameters', () => {
      const domainFqn = '';
      const dataProductFqn = '';

      const result = getQueryFilterToIncludeDomain(domainFqn, dataProductFqn);

      const firstMust = result.query.bool.must[0] as {
        term: { 'domains.fullyQualifiedName': string };
      };

      expect(firstMust.term['domains.fullyQualifiedName']).toBe('');

      const secondMust = result.query.bool.must[1] as {
        bool: {
          must_not: Array<{
            term: { 'dataProducts.fullyQualifiedName': string };
          }>;
        };
      };

      expect(
        secondMust.bool.must_not[0].term['dataProducts.fullyQualifiedName']
      ).toBe('');
    });
  });
});

describe('withDomainFilter', () => {
  const mockGetState = jest.fn();
  const mockGetPathName = getPathNameFromWindowLocation as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (useDomainStore as unknown as jest.Mock).mockImplementation(() => ({
      getState: mockGetState,
    }));
    (useDomainStore.getState as jest.Mock) = mockGetState;
  });

  const createMockConfig = (
    method: string = 'get',
    url?: string,
    params?: Record<string, unknown>
  ): InternalAxiosRequestConfig =>
    ({
      method,
      url,
      params,
      headers: {},
    } as InternalAxiosRequestConfig);

  describe('should not intercept requests', () => {
    it('should return config unchanged when path starts with /domain', () => {
      mockGetPathName.mockReturnValue('/domain/test');
      mockGetState.mockReturnValue({ activeDomain: 'testDomain' });

      const config = createMockConfig();
      const result = withDomainFilter(config);

      expect(result).toBe(config);
      expect(result.params).toBeUndefined();
    });

    it('should return config unchanged when path starts with /auth/logout', () => {
      mockGetPathName.mockReturnValue('/auth/logout');
      mockGetState.mockReturnValue({ activeDomain: 'testDomain' });

      const config = createMockConfig();
      const result = withDomainFilter(config);

      expect(result).toBe(config);
      expect(result.params).toBeUndefined();
    });

    it('should return config unchanged when path starts with /auth/refresh', () => {
      mockGetPathName.mockReturnValue('/auth/refresh');
      mockGetState.mockReturnValue({ activeDomain: 'testDomain' });

      const config = createMockConfig();
      const result = withDomainFilter(config);

      expect(result).toBe(config);
      expect(result.params).toBeUndefined();
    });

    it('should return config unchanged when method is not GET', () => {
      mockGetPathName.mockReturnValue('/api/test');
      mockGetState.mockReturnValue({ activeDomain: 'testDomain' });

      const config = createMockConfig('post');
      const result = withDomainFilter(config);

      expect(result).toBe(config);
      expect(result.params).toBeUndefined();
    });

    it('should return config unchanged when activeDomain is DEFAULT_DOMAIN_VALUE', () => {
      mockGetPathName.mockReturnValue('/api/test');
      mockGetState.mockReturnValue({ activeDomain: DEFAULT_DOMAIN_VALUE });

      const config = createMockConfig();
      const result = withDomainFilter(config);

      expect(result).toBe(config);
      expect(result.params).toBeUndefined();
    });
  });

  describe('regular GET requests', () => {
    it('should add domain parameter for regular GET requests with active domain', () => {
      mockGetPathName.mockReturnValue('/api/tables');
      mockGetState.mockReturnValue({ activeDomain: 'engineering' });

      const config = createMockConfig('get', '/api/tables');
      const result = withDomainFilter(config);

      expect(result.params).toEqual({
        domain: 'engineering',
      });
    });

    it('should preserve existing params when adding domain parameter', () => {
      mockGetPathName.mockReturnValue('/api/tables');
      mockGetState.mockReturnValue({ activeDomain: 'engineering' });

      const config = createMockConfig('get', '/api/tables', {
        limit: 10,
        offset: 0,
      });
      const result = withDomainFilter(config);

      expect(result.params).toEqual({
        limit: 10,
        offset: 0,
        domain: 'engineering',
      });
    });
  });

  describe('search query requests', () => {
    it('should add should filter with term and prefix for /search/query with active domain', () => {
      mockGetPathName.mockReturnValue('/api/search');
      mockGetState.mockReturnValue({ activeDomain: 'engineering' });

      const config = createMockConfig('get', '/search/query', {
        index: SearchIndex.TABLE,
      });
      const result = withDomainFilter(config);

      expect(result.params).toHaveProperty('query_filter');

      const filter = JSON.parse(result.params?.query_filter as string);

      expect(filter).toEqual({
        query: {
          bool: {
            must: [
              {
                bool: {
                  should: [
                    {
                      term: {
                        'domains.fullyQualifiedName': 'engineering',
                      },
                    },
                    {
                      prefix: {
                        'domains.fullyQualifiedName': 'engineering.',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      });
    });

    it('should return config unchanged for TAG index searches', () => {
      mockGetPathName.mockReturnValue('/api/search');
      mockGetState.mockReturnValue({ activeDomain: 'engineering' });

      const config = createMockConfig('get', '/search/query', {
        index: SearchIndex.TAG,
      });
      const result = withDomainFilter(config);

      expect(result).toBe(config);
      expect(result.params?.query_filter).toBeUndefined();
    });

    it('should preserve existing query_filter and add should filter', () => {
      mockGetPathName.mockReturnValue('/api/search');
      mockGetState.mockReturnValue({ activeDomain: 'engineering' });

      const existingFilter = {
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
      };

      const config = createMockConfig('get', '/search/query', {
        index: SearchIndex.TABLE,
        query_filter: JSON.stringify(existingFilter),
      });
      const result = withDomainFilter(config);

      const filter = JSON.parse(result.params?.query_filter as string);

      expect(filter.query.bool.must).toHaveLength(2);
      expect(filter.query.bool.must[0]).toEqual({
        term: {
          entityType: 'table',
        },
      });
      expect(filter.query.bool.must[1]).toEqual({
        bool: {
          should: [
            {
              term: {
                'domains.fullyQualifiedName': 'engineering',
              },
            },
            {
              prefix: {
                'domains.fullyQualifiedName': 'engineering.',
              },
            },
          ],
        },
      });
    });

    it('should handle invalid JSON in query_filter gracefully', () => {
      mockGetPathName.mockReturnValue('/api/search');
      mockGetState.mockReturnValue({ activeDomain: 'engineering' });

      const config = createMockConfig('get', '/search/query', {
        index: SearchIndex.TABLE,
        query_filter: 'invalid-json',
      });
      const result = withDomainFilter(config);

      const filter = JSON.parse(result.params?.query_filter as string);

      expect(filter).toEqual({
        query: {
          bool: {
            must: [
              {
                bool: {
                  should: [
                    {
                      term: {
                        'domains.fullyQualifiedName': 'engineering',
                      },
                    },
                    {
                      prefix: {
                        'domains.fullyQualifiedName': 'engineering.',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      });
    });

    it('should handle query_filter with empty must array', () => {
      mockGetPathName.mockReturnValue('/api/search');
      mockGetState.mockReturnValue({ activeDomain: 'engineering' });

      const existingFilter = {
        query: {
          bool: {},
        },
      };

      const config = createMockConfig('get', '/search/query', {
        index: SearchIndex.TABLE,
        query_filter: JSON.stringify(existingFilter),
      });
      const result = withDomainFilter(config);

      const filter = JSON.parse(result.params?.query_filter as string);

      expect(filter.query.bool.must).toHaveLength(1);
      expect(filter.query.bool.must[0]).toEqual({
        bool: {
          should: [
            {
              term: {
                'domains.fullyQualifiedName': 'engineering',
              },
            },
            {
              prefix: {
                'domains.fullyQualifiedName': 'engineering.',
              },
            },
          ],
        },
      });
    });

    it('should handle empty object query_filter gracefully', () => {
      mockGetPathName.mockReturnValue('/api/search');
      mockGetState.mockReturnValue({ activeDomain: 'engineering' });

      const config = createMockConfig('get', '/search/query', {
        index: SearchIndex.TABLE,
        query_filter: '{}',
      });
      const result = withDomainFilter(config);

      const filter = JSON.parse(result.params?.query_filter as string);

      expect(filter).toEqual({
        query: {
          bool: {
            must: [
              {
                bool: {
                  should: [
                    {
                      term: {
                        'domains.fullyQualifiedName': 'engineering',
                      },
                    },
                    {
                      prefix: {
                        'domains.fullyQualifiedName': 'engineering.',
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      });
    });

      it('should preserve existing params when adding query_filter', () => {
        mockGetPathName.mockReturnValue('/api/search');
        mockGetState.mockReturnValue({ activeDomain: 'engineering' });

        const config = createMockConfig('get', '/search/query', {
          index: SearchIndex.TABLE,
          limit: 10,
          offset: 0,
        });
        const result = withDomainFilter(config);

        expect(result.params).toHaveProperty('index', SearchIndex.TABLE);
        expect(result.params).toHaveProperty('limit', 10);
        expect(result.params).toHaveProperty('offset', 0);
        expect(result.params).toHaveProperty('query_filter');
      });

      it('should preserve non-bool top-level clauses when adding domain filter', () => {
        mockGetPathName.mockReturnValue('/api/search');
        mockGetState.mockReturnValue({ activeDomain: 'engineering' });

        const existingFilter = JSON.stringify({
          query: {
            term: { 'some.field': 'someValue' },
            bool: { must: [{ term: { 'other.field': 'otherValue' } }] },
          },
        });

        const config = createMockConfig('get', '/search/query', {
          index: SearchIndex.TABLE,
          query_filter: existingFilter,
        });
        const result = withDomainFilter(config);

        const parsed = JSON.parse(result.params?.query_filter as string);

        expect(parsed.query.bool.must).toContainEqual({
          term: { 'some.field': 'someValue' },
        });
        expect(parsed.query.bool.must).toContainEqual({
          term: { 'other.field': 'otherValue' },
        });
        expect(parsed.query.bool.must).toContainEqual({
          bool: {
            should: [
              {
                term: {
                  'domains.fullyQualifiedName': 'engineering',
                },
              },
              {
                prefix: {
                  'domains.fullyQualifiedName': 'engineering.',
                },
              },
            ],
          },
        });
        expect(parsed.query.bool.must).toHaveLength(3);
      });
    });

  describe('nested domain paths', () => {
    it('should handle nested domain paths correctly', () => {
      mockGetPathName.mockReturnValue('/api/tables');
      mockGetState.mockReturnValue({
        activeDomain: 'engineering.backend.services',
      });

      const config = createMockConfig('get', '/api/tables');
      const result = withDomainFilter(config);

      expect(result.params).toEqual({
        domain: 'engineering.backend.services',
      });
    });

    it('should add should filter with nested domain for search queries', () => {
      mockGetPathName.mockReturnValue('/api/search');
      mockGetState.mockReturnValue({
        activeDomain: 'engineering.backend.services',
      });

      const config = createMockConfig('get', '/search/query', {
        index: SearchIndex.TABLE,
      });
      const result = withDomainFilter(config);

      const filter = JSON.parse(result.params?.query_filter as string);

      expect(filter.query.bool.must[0]).toEqual({
        bool: {
          should: [
            {
              term: {
                'domains.fullyQualifiedName': 'engineering.backend.services',
              },
            },
            {
              prefix: {
                'domains.fullyQualifiedName': 'engineering.backend.services.',
              },
            },
          ],
        },
      });
    });
  });
});
