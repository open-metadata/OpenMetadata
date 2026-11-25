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
import { render, screen } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import { QueryFilterInterface } from '../pages/ExplorePage/ExplorePage.interface';
import { searchQuery } from '../rest/searchAPI';
import {
  EMPTY_QUERY_FILTER_STRINGS,
  getExploreURLForAdvancedFilter,
  getModifiedQueryFilterWithSelectedAssets,
  getTotalResourceCount,
  isValidElasticsearchQuery,
} from './CuratedAssetsPureUtils';
import { AlertMessage, getSelectedResourceCount } from './CuratedAssetsUtils';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('./RouterUtils', () => ({
  getExplorePath: jest.fn().mockReturnValue('/explore'),
}));

jest.mock('@react-awesome-query-builder/ui', () => ({
  Utils: {
    checkTree: jest.fn().mockReturnValue({}),
    loadTree: jest.fn().mockReturnValue({}),
  },
}));

describe('CuratedAssetsUtils', () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string, params?: Record<string, unknown>) => {
        if (key === 'message.search-entity-count') {
          return `${params?.count} entities found`;
        }
        if (key === 'label.view-in-explore-page') {
          return 'View in Explore Page';
        }

        return key;
      },
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('AlertMessage', () => {
    it('renders alert message with correct asset count', () => {
      render(<AlertMessage assetCount={5} href="/custom-explore" />);

      expect(screen.getByText('5 entities found')).toBeInTheDocument();
      expect(screen.getByTestId('view-assets-banner-button')).toHaveAttribute(
        'href',
        '/custom-explore'
      );
    });

    // The link must be a control *inside* the banner, not a wrapper around it:
    // an anchor around the whole Alert puts the close button inside a link, so
    // dismissing the banner would navigate instead of closing it.
    it('does not turn the banner itself into a link', () => {
      render(<AlertMessage assetCount={5} href="/custom-explore" />);

      expect(
        screen.getByTestId('view-assets-banner-count')
      ).not.toHaveAttribute('href');
    });

    // A banner with nowhere to go must show the count alone rather than a link
    // that goes nowhere.
    it('renders the count with no link when there is no href', () => {
      render(<AlertMessage assetCount={3} />);

      expect(screen.getByText('3 entities found')).toBeInTheDocument();
      expect(
        screen.queryByTestId('view-assets-banner-button')
      ).not.toBeInTheDocument();
    });

    it('renders the count alone when the click-through is switched off', () => {
      render(
        <AlertMessage
          assetCount={7}
          href="/custom-explore"
          showExploreLink={false}
        />
      );

      expect(
        screen.getByTestId('view-assets-banner-count')
      ).toBeInTheDocument();
      expect(
        screen.queryByTestId('view-assets-banner-button')
      ).not.toBeInTheDocument();
    });
  });

  describe('getTotalResourceCount', () => {
    const mockBuckets = [
      { key: 'table', doc_count: 10 },
      { key: 'dashboard', doc_count: 5 },
      { key: 'pipeline', doc_count: 3 },
    ];

    it('calculates total count for specific selected resources', () => {
      const selectedResource = ['table', 'dashboard'];
      const result = getTotalResourceCount(mockBuckets, selectedResource);

      expect(result).toBe(15); // 10 + 5
    });

    it('calculates total count for all resources when "all" is selected', () => {
      const selectedResource = ['all'];
      const result = getTotalResourceCount(mockBuckets, selectedResource);

      expect(result).toBe(18); // 10 + 5 + 3
    });

    it('returns 0 when no resources match', () => {
      const selectedResource = ['nonexistent'];
      const result = getTotalResourceCount(mockBuckets, selectedResource);

      expect(result).toBe(0);
    });

    it('handles empty buckets array', () => {
      const selectedResource = ['table'];
      const result = getTotalResourceCount([], selectedResource);

      expect(result).toBe(0);
    });

    it('handles empty selected resources', () => {
      const result = getTotalResourceCount(mockBuckets, []);

      expect(result).toBe(0);
    });
  });

  describe('getSelectedResourceCount', () => {
    const mockSearchResponse = {
      aggregations: {
        entityType: {
          buckets: [
            { key: 'table', doc_count: 10 },
            { key: 'dashboard', doc_count: 5 },
          ],
        },
      },
    };

    it('fetches and returns entity count for selected resources', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(mockSearchResponse);

      const result = await getSelectedResourceCount({
        selectedResource: ['table', 'dashboard'],
        queryFilter: '{"query":{"bool":{"must":[]}}}',
      });

      expect(searchQuery).toHaveBeenCalledWith({
        searchIndex: 'all',
        queryFilter: { query: { bool: { must: [] } } },
      });
      expect(result).toEqual({
        entityCount: 15,
        resourcesWithNonZeroCount: ['table', 'dashboard'],
      });
    });

    it('returns resources with non-zero count', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(mockSearchResponse);

      const result = await getSelectedResourceCount({
        selectedResource: ['table', 'dashboard'],
        queryFilter: '{}',
      });

      expect(result.resourcesWithNonZeroCount).toEqual(['table', 'dashboard']);
    });

    it('handles empty query filter', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(mockSearchResponse);

      await getSelectedResourceCount({
        selectedResource: ['table'],
        queryFilter: undefined,
      });

      expect(searchQuery).toHaveBeenCalledWith({
        searchIndex: 'all',
        queryFilter: {},
      });
    });

    it('returns default values on error', async () => {
      (searchQuery as jest.Mock).mockRejectedValue(new Error('API Error'));

      const result = await getSelectedResourceCount({
        selectedResource: ['table'],
        queryFilter: '{}',
      });

      expect(result).toEqual({
        entityCount: 0,
      });
    });

    it('skips updating resource list when shouldUpdateResourceList is false', async () => {
      (searchQuery as jest.Mock).mockResolvedValue(mockSearchResponse);

      const result = await getSelectedResourceCount({
        selectedResource: ['table'],
        queryFilter: '{}',
        shouldUpdateResourceList: false,
      });

      expect(result).toEqual({
        entityCount: 10,
      });
      expect(result.resourcesWithNonZeroCount).toBeUndefined();
    });

    it('handles empty buckets in response', async () => {
      (searchQuery as jest.Mock).mockResolvedValue({
        aggregations: {
          entityType: {
            buckets: [],
          },
        },
      });

      const result = await getSelectedResourceCount({
        selectedResource: ['table'],
        queryFilter: '{}',
      });

      expect(result).toEqual({
        entityCount: 0,
        resourcesWithNonZeroCount: [],
      });
    });
  });

  describe('getModifiedQueryFilterWithSelectedAssets', () => {
    it('modifies query filter with selected resources', () => {
      const queryFilterObject = {
        query: {
          bool: {
            must: [
              {
                bool: {
                  must: [{ term: { deleted: false } }],
                },
              },
            ],
          },
        },
      };

      const selectedResource = ['table', 'dashboard'];

      const result = getModifiedQueryFilterWithSelectedAssets(
        queryFilterObject,
        selectedResource
      );

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              {
                bool: {
                  must: [{ bool: { must: [{ term: { deleted: false } }] } }],
                },
              },
              {
                bool: {
                  should: [
                    { term: { entityType: 'table' } },
                    { term: { entityType: 'dashboard' } },
                  ],
                },
              },
            ],
          },
        },
      });
    });

    it('handles empty query filter object', () => {
      const result = getModifiedQueryFilterWithSelectedAssets(
        {} as QueryFilterInterface,
        ['table']
      );

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              {
                bool: {
                  should: [{ term: { entityType: 'table' } }],
                },
              },
            ],
          },
        },
      });
    });

    it('handles undefined selected resources', () => {
      const result = getModifiedQueryFilterWithSelectedAssets(
        {} as QueryFilterInterface
      );

      // When selectedResource is undefined, function returns original queryFilterObject
      expect(result).toEqual({});
    });
  });

  describe('getExploreURLForAdvancedFilter', () => {
    const paramsOf = (url: string) =>
      new URLSearchParams(url.slice(url.indexOf('?') + 1));
    const filter = {
      query: { bool: { must: [{ term: { 'tier.tagFQN': 'Tier.Tier1' } }] } },
    };

    it('opens the saved filter as one Advanced Search group, scoped to the resources', () => {
      const params = paramsOf(
        getExploreURLForAdvancedFilter({
          queryFilter: JSON.stringify(filter),
          selectedResource: ['table'],
        })
      );

      expect(JSON.parse(params.get('queryFilter') ?? '')).toEqual({
        query: { bool: { must: [filter.query] } },
      });
      expect(JSON.parse(params.get('quickFilter') ?? '')).toEqual({
        query: {
          bool: {
            must: [{ bool: { should: [{ term: { entityType: 'table' } }] } }],
          },
        },
      });
    });

    it.each([
      ['no saved filter', ''],
      ['a filter with no query', '{}'],
    ])('carries no Advanced Search for %s', (_name, queryFilter) => {
      const params = paramsOf(
        getExploreURLForAdvancedFilter({
          queryFilter,
          selectedResource: ['table'],
        })
      );

      expect(params.has('queryFilter')).toBe(false);
      expect(params.has('quickFilter')).toBe(true);
    });

    it.each([
      ['an unreadable filter', 'invalid-json', ['table']],
      ['no resources', JSON.stringify(filter), []],
    ])('opens plain Explore for %s', (_name, queryFilter, selectedResource) => {
      expect(
        getExploreURLForAdvancedFilter({ queryFilter, selectedResource })
      ).toBe('/explore');
    });
  });

  describe('EMPTY_QUERY_FILTER_STRINGS', () => {
    it('contains expected empty query filter strings', () => {
      expect(EMPTY_QUERY_FILTER_STRINGS).toEqual([
        '{"query":{"bool":{"must":[]}}}',
        '{}',
        '',
      ]);
    });
  });

  describe('isValidElasticsearchQuery', () => {
    it('returns false for empty query strings', () => {
      expect(isValidElasticsearchQuery('')).toBe(false);
      expect(isValidElasticsearchQuery('{}')).toBe(false);
      expect(isValidElasticsearchQuery('{"query":{"bool":{"must":[]}}}')).toBe(
        false
      );
    });

    it('returns false for invalid JSON', () => {
      expect(isValidElasticsearchQuery('invalid-json')).toBe(false);
    });

    it('returns false for query without query structure', () => {
      expect(isValidElasticsearchQuery('{"data": "test"}')).toBe(false);
    });

    it('returns false for empty term objects', () => {
      const invalidQuery = JSON.stringify({
        query: {
          bool: {
            must: [
              {
                bool: {
                  must: [
                    { term: {} }, // Empty term object
                    { term: {} }, // Empty term object
                  ],
                },
              },
            ],
          },
        },
      });

      expect(isValidElasticsearchQuery(invalidQuery)).toBe(false);
    });

    it('returns true for valid term conditions', () => {
      const validQuery = JSON.stringify({
        query: {
          bool: {
            must: [
              {
                bool: {
                  must: [
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
                        descriptionStatus: 'COMPLETE',
                      },
                    },
                    {
                      bool: {
                        should: [
                          {
                            term: {
                              entityType: 'dashboard',
                            },
                          },
                          {
                            term: {
                              entityType: 'metric',
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
        },
      });

      expect(isValidElasticsearchQuery(validQuery)).toBe(true);
    });

    it('returns true for simple single condition', () => {
      const simpleQuery = JSON.stringify({
        query: {
          bool: {
            must: [
              {
                term: {
                  ownerDisplayName: 'John',
                },
              },
            ],
          },
        },
      });

      expect(isValidElasticsearchQuery(simpleQuery)).toBe(true);
    });

    it('returns true for exists conditions', () => {
      const existsQuery = JSON.stringify({
        query: {
          bool: {
            must: [
              {
                exists: {
                  field: 'ownerDisplayName',
                },
              },
            ],
          },
        },
      });

      expect(isValidElasticsearchQuery(existsQuery)).toBe(true);
    });

    it('returns false for exists conditions with empty field', () => {
      const invalidExistsQuery = JSON.stringify({
        query: {
          bool: {
            must: [
              {
                exists: {
                  field: '', // Empty field
                },
              },
            ],
          },
        },
      });

      expect(isValidElasticsearchQuery(invalidExistsQuery)).toBe(false);
    });

    it('returns true for terms array conditions', () => {
      const termsQuery = JSON.stringify({
        query: {
          bool: {
            must: [
              {
                terms: {
                  entityType: ['dashboard', 'metric'],
                },
              },
            ],
          },
        },
      });

      expect(isValidElasticsearchQuery(termsQuery)).toBe(true);
    });

    it('returns false for empty terms objects', () => {
      const invalidTermsQuery = JSON.stringify({
        query: {
          bool: {
            must: [
              {
                terms: {}, // Empty terms object
              },
            ],
          },
        },
      });

      expect(isValidElasticsearchQuery(invalidTermsQuery)).toBe(false);
    });

    it('returns false for should array with empty conditions', () => {
      const emptyShouldQuery = JSON.stringify({
        query: {
          bool: {
            should: [], // Empty should array
          },
        },
      });

      expect(isValidElasticsearchQuery(emptyShouldQuery)).toBe(false);
    });

    it('returns true for mixed must_not conditions', () => {
      const mustNotQuery = JSON.stringify({
        query: {
          bool: {
            must_not: [
              {
                term: {
                  deleted: true,
                },
              },
            ],
          },
        },
      });

      expect(isValidElasticsearchQuery(mustNotQuery)).toBe(true);
    });
  });
});
