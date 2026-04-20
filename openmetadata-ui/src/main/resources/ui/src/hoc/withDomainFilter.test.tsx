/*
 *  Copyright 2026 Collate.
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
import { SearchIndex } from '../enums/search.enum';
import { useDomainStore } from '../hooks/useDomainStore';
import { getPathNameFromWindowLocation } from '../utils/LocationUtils';
import { withDomainFilter } from './withDomainFilter';

jest.mock('../hooks/useDomainStore');
jest.mock('../utils/LocationUtils', () => ({
  getPathNameFromWindowLocation: jest.fn(),
}));

describe('withDomainFilter', () => {
  const mockGetState = jest.fn();

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
      (getPathNameFromWindowLocation as jest.Mock).mockImplementationOnce(
        () => '/domain/test'
      );
      mockGetState.mockReturnValue({ activeDomain: 'testDomain' });

      const config = createMockConfig();
      const result = withDomainFilter(config);

      expect(result).toBe(config);
      expect(result.params).toBeUndefined();
    });

    it('should return config unchanged when path starts with /auth/logout', () => {
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/auth/logout'
      );
      mockGetState.mockReturnValue({ activeDomain: 'testDomain' });

      const config = createMockConfig();
      const result = withDomainFilter(config);

      expect(result).toBe(config);
      expect(result.params).toBeUndefined();
    });

    it('should return config unchanged when path starts with /auth/refresh', () => {
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/auth/refresh'
      );
      mockGetState.mockReturnValue({ activeDomain: 'testDomain' });

      const config = createMockConfig();
      const result = withDomainFilter(config);

      expect(result).toBe(config);
      expect(result.params).toBeUndefined();
    });

    it('should return config unchanged when method is not GET', () => {
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/api/test'
      );
      mockGetState.mockReturnValue({ activeDomain: 'testDomain' });

      const config = createMockConfig('post');
      const result = withDomainFilter(config);

      expect(result).toBe(config);
      expect(result.params).toBeUndefined();
    });

    it('should return config unchanged when activeDomain is DEFAULT_DOMAIN_VALUE', () => {
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/api/test'
      );
      mockGetState.mockReturnValue({ activeDomain: DEFAULT_DOMAIN_VALUE });

      const config = createMockConfig();
      const result = withDomainFilter(config);

      expect(result).toBe(config);
      expect(result.params).toBeUndefined();
    });
  });

  describe('regular GET requests', () => {
    it('should add domain parameter for regular GET requests with active domain', () => {
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/api/tables'
      );
      mockGetState.mockReturnValue({ activeDomain: 'engineering' });

      const config = createMockConfig('get', '/api/tables');
      const result = withDomainFilter(config);

      expect(result.params).toEqual({
        domain: 'engineering',
      });
    });

    it('should preserve existing params when adding domain parameter', () => {
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/api/tables'
      );
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
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/api/search'
      );
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
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/api/search'
      );
      mockGetState.mockReturnValue({ activeDomain: 'engineering' });

      const config = createMockConfig('get', '/search/query', {
        index: SearchIndex.TAG,
      });
      const result = withDomainFilter(config);

      expect(result).toBe(config);
      expect(result.params?.query_filter).toBeUndefined();
    });

    it('should use fullyQualifiedName field for DOMAIN index searches', () => {
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/api/search'
      );
      mockGetState.mockReturnValue({ activeDomain: 'engineering' });

      const config = createMockConfig('get', '/search/query', {
        index: SearchIndex.DOMAIN,
      });
      const result = withDomainFilter(config);
      const queryFilter = JSON.parse(result.params?.query_filter as string);
      const shouldClauses =
        queryFilter.query.bool.must[queryFilter.query.bool.must.length - 1].bool
          .should;

      expect(shouldClauses).toEqual([
        { term: { fullyQualifiedName: 'engineering' } },
        { prefix: { fullyQualifiedName: 'engineering.' } },
      ]);
    });

    it('should preserve existing query_filter and add should filter', () => {
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/api/search'
      );
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
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/api/search'
      );
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
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/api/search'
      );
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
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/api/search'
      );
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
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/api/search'
      );
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
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/api/search'
      );
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
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/api/tables'
      );
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
      (getPathNameFromWindowLocation as jest.Mock).mockReturnValueOnce(
        '/api/search'
      );
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
