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
import { SearchIndex } from '../../../../enums/search.enum';
import { EntityTableFilter } from './TableFilters.component';

// Mock the dependencies
jest.mock('../../../utils/ExploreUtils', () => ({
  getAggregationOptions: jest.fn(
    (searchIndex, fieldKey, searchText, queryFilter) => {
      // Parse the query filter to determine if we're looking for glossary terms or regular tags
      let buckets: Array<{ key: string; doc_count: number }> = [];

      try {
        const parsedFilter = JSON.parse(queryFilter);
        const isGlossaryFilter = parsedFilter?.query?.bool?.must?.some(
          (clause: any) => clause?.term?.['tags.source'] === 'Glossary'
        );
        const isTagsFilter = parsedFilter?.query?.bool?.must_not?.some(
          (clause: any) => clause?.term?.['tags.source'] === 'Glossary'
        );

        if (fieldKey === 'tags.tagFQN' && isGlossaryFilter) {
          // Return glossary terms
          buckets = [
            { key: 'Glossary.BusinessTerm', doc_count: 3 },
            { key: 'Glossary.DataQuality', doc_count: 2 },
          ];
        } else if (fieldKey === 'tags.tagFQN' && isTagsFilter) {
          // Return regular tags
          buckets = [
            { key: 'production', doc_count: 8 },
            { key: 'critical', doc_count: 6 },
          ];
        } else if (fieldKey === 'owners.name.keyword') {
          buckets = [
            { key: 'user1', doc_count: 5 },
            { key: 'user2', doc_count: 3 },
          ];
        } else if (fieldKey === 'domainType.keyword') {
          buckets = [
            { key: 'Aggregate', doc_count: 10 },
            { key: 'Consumer-aligned', doc_count: 7 },
          ];
        }
      } catch {
        // Fallback for malformed query filters
        if (fieldKey === 'owners.name.keyword') {
          buckets = [
            { key: 'user1', doc_count: 5 },
            { key: 'user2', doc_count: 3 },
          ];
        }
      }

      return Promise.resolve({
        data: {
          aggregations: {
            [fieldKey]: { buckets },
          },
        },
      });
    }
  ),
}));

jest.mock('../../../utils/AdvancedSearchUtils', () => ({
  getOptionsFromAggregationBucket: jest.fn((buckets) =>
    buckets.map((bucket: { key: string; doc_count: number }) => ({
      key: bucket.key,
      label: bucket.key,
      count: bucket.doc_count,
    }))
  ),
}));

jest.mock('../../SearchDropdown/SearchDropdown', () => {
  return function MockSearchDropdown({ label }: { label: string }) {
    return <div data-testid={`search-dropdown-${label}`}>{label}</div>;
  };
});

const mockProps = {
  filters: {
    owners: [],
    glossaryTerms: [],
    domainTypes: [],
    tags: [],
  },
  searchIndex: SearchIndex.DOMAIN,
  onFilterChange: jest.fn(),
  onClearAll: jest.fn(),
};

describe('EntityTableFilter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render search dropdowns for domain filters', () => {
    render(<EntityTableFilter {...mockProps} />);

    // Should render owner filter
    expect(
      screen.getByTestId('search-dropdown-label.owner-plural')
    ).toBeInTheDocument();

    // Should render domain type filter for domain search index
    expect(
      screen.getByTestId('search-dropdown-label.domain-type')
    ).toBeInTheDocument();

    // Should render tags filter
    expect(
      screen.getByTestId('search-dropdown-label.tag-plural')
    ).toBeInTheDocument();

    // Should render glossary terms filter
    expect(
      screen.getByTestId('search-dropdown-label.glossary-term-plural')
    ).toBeInTheDocument();
  });

  it('should render only basic filters for non-domain search indexes', () => {
    const propsWithDataProduct = {
      ...mockProps,
      searchIndex: SearchIndex.DATA_PRODUCT,
    };

    render(<EntityTableFilter {...propsWithDataProduct} />);

    // Should render owner filter
    expect(
      screen.getByTestId('search-dropdown-label.owner-plural')
    ).toBeInTheDocument();

    // Should render tags filter
    expect(
      screen.getByTestId('search-dropdown-label.tag-plural')
    ).toBeInTheDocument();

    // Should render glossary terms filter
    expect(
      screen.getByTestId('search-dropdown-label.glossary-term-plural')
    ).toBeInTheDocument();

    // Should NOT render domain type filter for non-domain search index
    expect(
      screen.queryByTestId('search-dropdown-label.domain-type')
    ).not.toBeInTheDocument();
  });

  it('should render clear all button when filters are active', () => {
    const propsWithFilters = {
      ...mockProps,
      filters: {
        ...mockProps.filters,
        owners: ['user1'],
      },
    };

    render(<EntityTableFilter {...propsWithFilters} />);

    expect(screen.getByText('label.clear-all')).toBeInTheDocument();
  });

  it('should render clear all button when glossary terms are active', () => {
    const propsWithGlossaryFilters = {
      ...mockProps,
      filters: {
        ...mockProps.filters,
        glossaryTerms: ['Glossary.BusinessTerm'],
      },
    };

    render(<EntityTableFilter {...propsWithGlossaryFilters} />);

    expect(screen.getByText('label.clear-all')).toBeInTheDocument();
  });

  it('should not render clear all button when no filters are active', () => {
    render(<EntityTableFilter {...mockProps} />);

    expect(screen.queryByText('label.clear-all')).not.toBeInTheDocument();
  });
});
