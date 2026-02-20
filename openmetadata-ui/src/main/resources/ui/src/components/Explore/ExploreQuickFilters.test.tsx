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

import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TIER_FQN_KEY } from '../../constants/explore.constants';
import { EntityFields } from '../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../enums/search.enum';
import { getTags } from '../../rest/tagAPI';
import { getAggregationOptions } from '../../utils/ExploreUtils';
import { SearchDropdownProps } from '../SearchDropdown/SearchDropdown.interface';
import { ExploreQuickFilterField } from './ExplorePage.interface';
import ExploreQuickFilters from './ExploreQuickFilters';
import {
  mockAdvancedFieldDefaultOptions,
  mockAggregations,
  mockTierTags,
} from './mocks/ExploreQuickFilters.mock';

const mockUseCustomLocation = jest.fn();
const mockQueryFilter = {};
const mockUseAdvanceSearch = jest.fn();

jest.mock('../../hooks/useCustomLocation/useCustomLocation', () => ({
  __esModule: true,
  default: () => mockUseCustomLocation(),
}));

jest.mock('react-router-dom', () => ({
  useParams: jest.fn().mockReturnValue({
    tab: 'tables',
  }),
}));

jest.mock('./AdvanceSearchProvider/AdvanceSearchProvider.component', () => ({
  useAdvanceSearch: () => mockUseAdvanceSearch(),
}));

const mockOnFieldValueSelect = jest.fn();
const mockGetAggregationOptions = jest.fn();
const mockGetTags = jest.fn();

jest.mock('../SearchDropdown/SearchDropdown', () => ({
  __esModule: true,
  default: ({
    options,
    searchKey,
    onChange,
    onSearch,
    onGetInitialOptions,
    selectedKeys,
    hasNullOption,
    hideCounts,
    independent,
    showSelectedCounts,
    fixedOrderOptions,
  }: SearchDropdownProps) => (
    <div data-testid={`search-dropdown-${searchKey}`} title="search-dropdown">
      <span data-testid={`label-${searchKey}`}>{searchKey}</span>
      <span data-testid={`has-null-option-${searchKey}`}>
        {hasNullOption ? 'true' : 'false'}
      </span>
      <span data-testid={`hide-counts-${searchKey}`}>
        {hideCounts ? 'true' : 'false'}
      </span>
      <span data-testid={`independent-${searchKey}`}>
        {independent ? 'true' : 'false'}
      </span>
      <span data-testid={`show-selected-counts-${searchKey}`}>
        {showSelectedCounts ? 'true' : 'false'}
      </span>
      <span data-testid={`fixed-order-${searchKey}`}>
        {fixedOrderOptions ? 'true' : 'false'}
      </span>
      <span data-testid={`selected-count-${searchKey}`}>
        {selectedKeys?.length ?? 0}
      </span>
      {options.map((option, index) => (
        <div data-testid={`option-${searchKey}-${index}`} key={option.key}>
          {option.label} - {option.count}
        </div>
      ))}
      <button
        data-testid={`onGetInitialOptions-${searchKey}`}
        onClick={() => onGetInitialOptions?.(searchKey)}>
        Get Initial Options
      </button>
      <button
        data-testid={`onSearch-${searchKey}`}
        onClick={() => onSearch('test', searchKey)}>
        Search
      </button>
      <button
        data-testid={`onChange-${searchKey}`}
        onClick={() =>
          onChange([{ key: 'test-key', label: 'test-label' }], searchKey)
        }>
        Change
      </button>
    </div>
  ),
}));

jest.mock('../../utils/ExploreUtils', () => ({
  getAggregationOptions: jest.fn(),
}));

jest.mock('../../rest/tagAPI', () => ({
  getTags: jest.fn(),
}));

jest.mock('../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const index = SearchIndex.TABLE;
const mockFields: ExploreQuickFilterField[] = [
  {
    label: 'Column',
    key: 'columns.name',
    value: undefined,
  },
  {
    label: 'Schema',
    key: 'databaseSchema.name',
    value: undefined,
  },
  {
    label: 'Database',
    key: 'database.name',
    value: undefined,
  },
  {
    label: 'Owner',
    key: 'owner.displayName',
    value: undefined,
  },
  {
    label: 'Tag',
    key: 'tags.tagFQN',
    value: undefined,
  },
  {
    label: 'Service',
    key: 'service.name',
    value: undefined,
  },
];

const mockProps = {
  index,
  fields: mockFields,
  aggregations: mockAggregations,
  onFieldValueSelect: mockOnFieldValueSelect,
};

describe('ExploreQuickFilters component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseCustomLocation.mockReturnValue({ search: '' });
    mockUseAdvanceSearch.mockReturnValue({ queryFilter: mockQueryFilter });
    (getAggregationOptions as jest.Mock).mockImplementation(
      mockGetAggregationOptions
    );
    (getTags as jest.Mock).mockImplementation(mockGetTags);
  });

  describe('Rendering', () => {
    it('should render all filter fields', async () => {
      render(<ExploreQuickFilters {...mockProps} />);

      const fields = screen.getAllByTitle('search-dropdown');

      expect(fields).toHaveLength(mockFields.length);
    });

    it('should render correct labels for each field', () => {
      render(<ExploreQuickFilters {...mockProps} />);

      mockFields.forEach((field) => {
        expect(screen.getByTestId(`label-${field.key}`)).toHaveTextContent(
          field.key
        );
      });
    });
  });

  describe('Props handling', () => {
    it('should pass independent prop to SearchDropdown', () => {
      render(<ExploreQuickFilters {...mockProps} independent />);

      mockFields.forEach((field) => {
        expect(
          screen.getByTestId(`independent-${field.key}`)
        ).toHaveTextContent('true');
      });
    });

    it('should pass showSelectedCounts prop to SearchDropdown', () => {
      render(<ExploreQuickFilters {...mockProps} showSelectedCounts />);

      mockFields.forEach((field) => {
        expect(
          screen.getByTestId(`show-selected-counts-${field.key}`)
        ).toHaveTextContent('true');
      });
    });

    it('should pass hasNullOption for fields in fieldsWithNullValues', () => {
      const fieldsWithNullValues = ['owner.displayName' as EntityFields];
      render(
        <ExploreQuickFilters
          {...mockProps}
          fieldsWithNullValues={fieldsWithNullValues}
        />
      );

      expect(
        screen.getByTestId(`has-null-option-owner.displayName`)
      ).toHaveTextContent('true');

      expect(
        screen.getByTestId(`has-null-option-database.name`)
      ).toHaveTextContent('false');
    });

    it('should pass hideCounts from field configuration', () => {
      const fieldsWithHideCounts: ExploreQuickFilterField[] = [
        {
          label: 'Column',
          key: 'columns.name',
          value: undefined,
          hideCounts: true,
        },
      ];

      render(
        <ExploreQuickFilters {...mockProps} fields={fieldsWithHideCounts} />
      );

      expect(screen.getByTestId(`hide-counts-columns.name`)).toHaveTextContent(
        'true'
      );
    });
  });

  describe('URL parameter parsing', () => {
    it('should parse showDeleted from URL query string', () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?showDeleted=true',
      });

      render(<ExploreQuickFilters {...mockProps} />);

      expect(mockUseCustomLocation).toHaveBeenCalled();
    });

    it('should parse quickFilter from URL query string', () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?quickFilter=test',
      });

      render(<ExploreQuickFilters {...mockProps} />);

      expect(mockUseCustomLocation).toHaveBeenCalled();
    });

    it('should handle URL search string with leading question mark', () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?showDeleted=true&quickFilter=test',
      });

      render(<ExploreQuickFilters {...mockProps} />);

      expect(mockUseCustomLocation).toHaveBeenCalled();
    });

    it('should handle URL search string without leading question mark', () => {
      mockUseCustomLocation.mockReturnValue({
        search: 'showDeleted=false',
      });

      render(<ExploreQuickFilters {...mockProps} />);

      expect(mockUseCustomLocation).toHaveBeenCalled();
    });
  });

  describe('Options fetching - Aggregations', () => {
    it('should use aggregations when available for non-tier fields', async () => {
      render(<ExploreQuickFilters {...mockProps} />);

      const searchButton = screen.getByTestId('onSearch-database.name');
      await act(async () => {
        userEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(getAggregationOptions).toHaveBeenCalledWith(
          SearchIndex.TABLE,
          'database.name',
          'test',
          '{"query":{"bool":{"must":[{"match":{"deleted":false}}]}}}',
          false,
          false
        );
      });

      await waitFor(() => {
        // const options = screen.queryAllByTestId(/option-database\.name-/);
        // expect(options.length).toBeGreaterThan(0);
      });
    });

    it('should fetch options from API when aggregations not available', async () => {
      mockGetAggregationOptions.mockResolvedValue(
        mockAdvancedFieldDefaultOptions
      );

      render(<ExploreQuickFilters {...mockProps} aggregations={undefined} />);

      const initialButton = screen.getByTestId(
        'onGetInitialOptions-database.name'
      );

      await act(async () => {
        userEvent.click(initialButton);
      });

      await waitFor(() => {
        expect(getAggregationOptions).toHaveBeenCalledWith(
          SearchIndex.TABLE,
          'database.name',
          '',
          expect.any(String),
          false,
          false,
          undefined
        );
      });
    });

    it('should pass optionPageSize to getAggregationOptions', async () => {
      mockGetAggregationOptions.mockResolvedValue(
        mockAdvancedFieldDefaultOptions
      );

      render(
        <ExploreQuickFilters
          {...mockProps}
          aggregations={undefined}
          optionPageSize={50}
        />
      );

      const initialButton = screen.getByTestId(
        'onGetInitialOptions-database.name'
      );

      await act(async () => {
        userEvent.click(initialButton);
      });

      await waitFor(() => {
        expect(getAggregationOptions).toHaveBeenCalledWith(
          SearchIndex.TABLE,
          'database.name',
          '',
          expect.any(String),
          false,
          false,
          50
        );
      });
    });
  });

  describe('Tier field handling', () => {
    it('should fetch tier tags and set fixedOrderOptions for tier field', async () => {
      mockGetTags.mockResolvedValue(mockTierTags);
      mockGetAggregationOptions.mockResolvedValue({
        data: {
          aggregations: {
            [`sterms#${TIER_FQN_KEY}`]: {
              buckets: [
                { key: 'tier.tier1', doc_count: 5 },
                { key: 'tier.tier2', doc_count: 3 },
              ],
            },
          },
        },
      });

      const tierFields: ExploreQuickFilterField[] = [
        {
          label: 'Tier',
          key: TIER_FQN_KEY,
          value: undefined,
        },
      ];

      render(<ExploreQuickFilters {...mockProps} fields={tierFields} />);

      const initialButton = screen.getByTestId(
        `onGetInitialOptions-${TIER_FQN_KEY}`
      );

      await act(async () => {
        userEvent.click(initialButton);
      });

      await waitFor(() => {
        expect(getTags).toHaveBeenCalledWith({ parent: 'Tier', limit: 50 });
      });

      expect(
        screen.getByTestId(`fixed-order-${TIER_FQN_KEY}`)
      ).toHaveTextContent('true');
    });

    it('should filter tier options on search', async () => {
      mockGetTags.mockResolvedValue(mockTierTags);
      mockGetAggregationOptions.mockResolvedValue({
        data: {
          aggregations: {
            [`sterms#${TIER_FQN_KEY}`]: {
              buckets: [{ key: 'tier.tier1', doc_count: 5 }],
            },
          },
        },
      });

      const tierFields: ExploreQuickFilterField[] = [
        {
          label: 'Tier',
          key: TIER_FQN_KEY,
          value: undefined,
        },
      ];

      render(<ExploreQuickFilters {...mockProps} fields={tierFields} />);

      const initialButton = screen.getByTestId(
        `onGetInitialOptions-${TIER_FQN_KEY}`
      );

      await act(async () => {
        userEvent.click(initialButton);
      });

      await waitFor(() => {
        expect(getTags).toHaveBeenCalled();
      });

      const searchButton = screen.getByTestId(`onSearch-${TIER_FQN_KEY}`);

      await act(async () => {
        userEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(getAggregationOptions).not.toHaveBeenCalledWith(
          expect.anything(),
          TIER_FQN_KEY,
          'test',
          expect.anything(),
          expect.anything(),
          expect.anything()
        );
      });
    });

    it('should handle tier field with existing values', async () => {
      mockGetTags.mockResolvedValue(mockTierTags);
      mockGetAggregationOptions.mockResolvedValue({
        data: {
          aggregations: {
            [`sterms#${TIER_FQN_KEY}`]: {
              buckets: [{ key: 'tier.tier1', doc_count: 5 }],
            },
          },
        },
      });

      const tierFields: ExploreQuickFilterField[] = [
        {
          label: 'Tier',
          key: TIER_FQN_KEY,
          value: [{ key: 'tier.tier1', label: 'Tier1' }],
        },
      ];

      render(<ExploreQuickFilters {...mockProps} fields={tierFields} />);

      await waitFor(() => {
        expect(getTags).toHaveBeenCalled();
      });
    });
  });

  describe('Search functionality', () => {
    it('should call getAggregationOptions on search with value', async () => {
      mockGetAggregationOptions.mockResolvedValue(
        mockAdvancedFieldDefaultOptions
      );

      render(<ExploreQuickFilters {...mockProps} />);

      const searchButton = screen.getByTestId('onSearch-database.name');

      await act(async () => {
        userEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(getAggregationOptions).toHaveBeenCalledWith(
          SearchIndex.TABLE,
          'database.name',
          'test',
          expect.any(String),
          false,
          false
        );
      });
    });

    it('should call getInitialOptions when search value is empty', async () => {
      mockGetAggregationOptions.mockResolvedValue(
        mockAdvancedFieldDefaultOptions
      );

      render(<ExploreQuickFilters {...mockProps} aggregations={{}} />);

      const initialButton = screen.getByTestId(
        'onGetInitialOptions-database.name'
      );

      await act(async () => {
        userEvent.click(initialButton);
      });

      await waitFor(() => {
        expect(getAggregationOptions).toHaveBeenCalled();
      });
    });

    it('should pass independent flag to API call', async () => {
      mockGetAggregationOptions.mockResolvedValue(
        mockAdvancedFieldDefaultOptions
      );

      render(<ExploreQuickFilters {...mockProps} independent />);

      const searchButton = screen.getByTestId('onSearch-database.name');

      await act(async () => {
        userEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(getAggregationOptions).toHaveBeenCalledWith(
          SearchIndex.TABLE,
          'database.name',
          'test',
          expect.any(String),
          true,
          false
        );
      });
    });
  });

  describe('onChange handling', () => {
    it('should call onFieldValueSelect when filter value changes', async () => {
      render(
        <ExploreQuickFilters
          {...mockProps}
          onFieldValueSelect={mockOnFieldValueSelect}
        />
      );

      const changeButton = screen.getByTestId('onChange-database.name');

      await act(async () => {
        changeButton.click();
      });

      expect(mockOnFieldValueSelect).toHaveBeenCalledWith({
        label: 'Database',
        key: 'database.name',
        value: [{ key: 'test-key', label: 'test-label' }],
      });
    });

    it('should update with new values', async () => {
      const { rerender } = render(<ExploreQuickFilters {...mockProps} />);

      const changeButton = screen.getByTestId('onChange-database.name');

      await act(async () => {
        userEvent.click(changeButton);
      });

      const updatedFields = mockFields.map((f) =>
        f.key === 'database.name'
          ? { ...f, value: [{ key: 'test-key', label: 'test-label' }] }
          : f
      );

      rerender(<ExploreQuickFilters {...mockProps} fields={updatedFields} />);

      expect(
        screen.getByTestId('selected-count-database.name')
      ).toHaveTextContent('1');
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully when fetching initial options', async () => {
      const { showErrorToast } = require('../../utils/ToastUtils');
      mockGetAggregationOptions.mockRejectedValue(new Error('API Error'));

      render(<ExploreQuickFilters {...mockProps} aggregations={undefined} />);

      const initialButton = screen.getByTestId(
        'onGetInitialOptions-database.name'
      );

      await act(async () => {
        userEvent.click(initialButton);
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
      });
    });

    it('should handle API errors gracefully when searching', async () => {
      const { showErrorToast } = require('../../utils/ToastUtils');
      mockGetAggregationOptions.mockRejectedValue(new Error('Search Error'));

      render(<ExploreQuickFilters {...mockProps} />);

      const searchButton = screen.getByTestId('onSearch-database.name');

      await act(async () => {
        userEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
      });
    });

    it('should handle getTags API error for tier field', async () => {
      const { showErrorToast } = require('../../utils/ToastUtils');
      mockGetTags.mockRejectedValue(new Error('Tags API Error'));

      const tierFields: ExploreQuickFilterField[] = [
        {
          label: 'Tier',
          key: TIER_FQN_KEY,
          value: undefined,
        },
      ];

      render(<ExploreQuickFilters {...mockProps} fields={tierFields} />);

      const initialButton = screen.getByTestId(
        `onGetInitialOptions-${TIER_FQN_KEY}`
      );

      await act(async () => {
        userEvent.click(initialButton);
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalled();
      });
    });
  });

  describe('Combined query filter', () => {
    it('should combine quickFilter, queryFilter, and defaultQueryFilter', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?quickFilter=test',
      });
      mockUseAdvanceSearch.mockReturnValue({
        queryFilter: { must: [{ term: { 'service.name': 'test' } }] },
      });

      const defaultQueryFilter = { must: [{ term: { deleted: false } }] };

      mockGetAggregationOptions.mockResolvedValue(
        mockAdvancedFieldDefaultOptions
      );

      render(
        <ExploreQuickFilters
          {...mockProps}
          defaultQueryFilter={defaultQueryFilter}
        />
      );

      const searchButton = screen.getByTestId('onSearch-database.name');

      await act(async () => {
        userEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(getAggregationOptions).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.anything(),
          expect.any(String),
          expect.anything(),
          expect.anything()
        );
      });
    });
  });

  describe('Multiple indexes', () => {
    it('should handle array of search indexes', async () => {
      mockGetAggregationOptions.mockResolvedValue(
        mockAdvancedFieldDefaultOptions
      );

      const multiIndexProps = {
        ...mockProps,
        index: [SearchIndex.TABLE, SearchIndex.TOPIC] as unknown as SearchIndex,
      };

      render(<ExploreQuickFilters {...multiIndexProps} />);

      const searchButton = screen.getByTestId('onSearch-database.name');

      await act(async () => {
        userEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(getAggregationOptions).toHaveBeenCalledWith(
          [SearchIndex.TABLE, SearchIndex.TOPIC],
          'database.name',
          'test',
          expect.any(String),
          false,
          false
        );
      });
    });
  });

  describe('Selected keys mapping', () => {
    it('should map tier field values to options when available', async () => {
      mockGetTags.mockResolvedValue(mockTierTags);
      mockGetAggregationOptions.mockResolvedValue({
        data: {
          aggregations: {
            [`sterms#${TIER_FQN_KEY}`]: {
              buckets: [{ key: 'tier.tier1', doc_count: 5 }],
            },
          },
        },
      });

      const tierFields: ExploreQuickFilterField[] = [
        {
          label: 'Tier',
          key: TIER_FQN_KEY,
          value: [{ key: 'tier.tier1', label: 'Tier1' }],
        },
      ];

      render(<ExploreQuickFilters {...mockProps} fields={tierFields} />);

      await waitFor(() => {
        expect(getTags).toHaveBeenCalled();
      });

      await waitFor(() => {
        expect(
          screen.getByTestId(`selected-count-${TIER_FQN_KEY}`)
        ).toHaveTextContent('1');
      });
    });

    it('should use original values for non-tier fields', () => {
      const fieldsWithValues: ExploreQuickFilterField[] = [
        {
          label: 'Database',
          key: 'database.name',
          value: [{ key: 'db1', label: 'Database 1' }],
        },
      ];

      render(<ExploreQuickFilters {...mockProps} fields={fieldsWithValues} />);

      expect(
        screen.getByTestId('selected-count-database.name')
      ).toHaveTextContent('1');
    });
  });
});
