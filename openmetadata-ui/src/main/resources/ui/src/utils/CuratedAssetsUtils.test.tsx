/*
 *  Copyright 2025 Collate.
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
import React from 'react';
import { useTranslation } from 'react-i18next';
import { searchQuery } from '../rest/searchAPI';
import {
  AlertMessage,
  EMPTY_QUERY_FILTER_STRINGS,
  getExploreURLWithFilters,
  getModifiedQueryFilterWithSelectedAssets,
  getSelectedResourceCount,
  getTotalResourceCount,
} from './CuratedAssetsUtils';

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn(),
}));

jest.mock('../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
}));

jest.mock('./QueryBuilderUtils', () => ({
  getJsonTreeFromQueryFilter: jest.fn().mockReturnValue({}),
}));

jest.mock('./RouterUtils', () => ({
  getExplorePath: jest.fn().mockReturnValue('/explore'),
}));

jest.mock('react-awesome-query-builder', () => ({
  Utils: {
    checkTree: jest.fn().mockReturnValue({}),
    loadTree: jest.fn().mockReturnValue({}),
  },
}));

jest.mock('antd', () => ({
  Alert: jest.fn().mockImplementation(({ message, className }) => (
    <div className={className} data-testid="alert">
      {message}
    </div>
  )),
}));

jest.mock('@ant-design/icons', () => ({
  InfoCircleOutlined: jest
    .fn()
    .mockImplementation(() => <div data-testid="info-icon">Info Icon</div>),
}));

describe('CuratedAssetsUtils', () => {
  beforeEach(() => {
    (useTranslation as jest.Mock).mockReturnValue({
      t: (key: string, params?: any) => {
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
      expect(screen.getByTestId('info-icon')).toBeInTheDocument();

      const link = screen.getByText('View in Explore Page').closest('a');

      expect(link).toHaveAttribute('href', '/custom-explore');
    });

    it('renders alert message with default href', () => {
      render(<AlertMessage assetCount={3} />);

      const link = screen.getByText('View in Explore Page');

      expect(link).toHaveAttribute('href', '#');
    });

    it('renders alert with correct CSS classes', () => {
      render(<AlertMessage assetCount={7} />);

      const alert = screen.getByTestId('alert');

      expect(alert).toHaveClass('bg-transparent border-none');
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
                  must: [
                    { term: { deleted: false } },
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
            ],
          },
        },
      });
    });

    it('handles empty query filter object', () => {
      const result = getModifiedQueryFilterWithSelectedAssets({}, ['table']);

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              {
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
            ],
          },
        },
      });
    });

    it('handles undefined selected resources', () => {
      const result = getModifiedQueryFilterWithSelectedAssets({});

      expect(result).toEqual({
        query: {
          bool: {
            must: [
              {
                bool: {
                  must: [
                    {
                      bool: {
                        should: [],
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
  });

  describe('getExploreURLWithFilters', () => {
    it('generates explore URL with query filters', () => {
      const result = getExploreURLWithFilters({
        queryFilter: '{"query":{"bool":{"must":[]}}}',
        selectedResource: ['table'],
        config: {},
      });

      expect(result).toBe('/explore');
    });

    it('handles invalid query filter JSON', () => {
      const result = getExploreURLWithFilters({
        queryFilter: 'invalid-json',
        selectedResource: ['table'],
        config: {},
      });

      expect(result).toBe('');
    });

    it('handles empty query filter', () => {
      const result = getExploreURLWithFilters({
        queryFilter: '',
        selectedResource: ['table'],
        config: {},
      });

      expect(result).toBe('/explore');
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
});
