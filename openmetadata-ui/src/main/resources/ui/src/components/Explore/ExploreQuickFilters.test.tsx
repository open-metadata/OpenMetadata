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
import { EntityFields } from '../../enums/AdvancedSearch.enum';
import { SearchIndex } from '../../enums/search.enum';
import { getAggregationOptions } from '../../utils/ExploreUtils';
import { SearchDropdownProps } from '../SearchDropdown/SearchDropdown.interface';
import { ExploreQuickFilterField } from './ExplorePage.interface';
import ExploreQuickFilters from './ExploreQuickFilters';
import {
  mockAdvancedFieldDefaultOptions,
  mockAggregations,
} from './mocks/ExploreQuickFilters.mock';

const mockUseCustomLocation = jest.fn();
const mockQueryFilter = {};
const mockUseAdvanceSearch = jest.fn();
const mockUseSearchStore = jest.fn();

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

jest.mock('../../hooks/useSearchStore', () => ({
  useSearchStore: () => mockUseSearchStore(),
}));

const mockOnFieldValueSelect = jest.fn();
const mockGetAggregationOptions = jest.fn();

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
    singleSelect,
    index: dropdownIndex,
  }: SearchDropdownProps) => (
    <div data-testid={`search-dropdown-${searchKey}`} title="search-dropdown">
      <span data-testid={`label-${searchKey}`}>{searchKey}</span>
      <span data-testid={`single-select-${searchKey}`}>
        {singleSelect ? 'true' : 'false'}
      </span>
      <span data-testid={`index-${searchKey}`}>{dropdownIndex}</span>
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
    mockUseSearchStore.mockReturnValue({ isNLPActive: false });
    (getAggregationOptions as jest.Mock).mockImplementation(
      mockGetAggregationOptions
    );
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

    it('should pass search query text to getAggregationOptions', async () => {
      mockUseCustomLocation.mockReturnValue({
        search: '?search=pets',
      });
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
          undefined,
          false,
          'pets',
          undefined
        );
      });
    });
  });

  describe('Options fetching - Aggregations', () => {
    it('should bypass pre-loaded aggregations and call API when sourceFields is set', async () => {
      mockGetAggregationOptions.mockResolvedValue(
        mockAdvancedFieldDefaultOptions
      );

      const fieldsWithSource: ExploreQuickFilterField[] = [
        {
          label: 'Database',
          key: 'database.name',
          value: undefined,
          sourceFields: 'database.displayName',
        },
      ];

      render(
        <ExploreQuickFilters
          {...mockProps}
          aggregations={mockAggregations}
          fields={fieldsWithSource}
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
          undefined,
          false,
          '',
          'database.displayName'
        );
      });
    });

    it('should use pre-loaded aggregations without API call when sourceFields is not set', async () => {
      render(
        <ExploreQuickFilters {...mockProps} aggregations={mockAggregations} />
      );

      const initialButton = screen.getByTestId(
        'onGetInitialOptions-database.name'
      );

      await act(async () => {
        userEvent.click(initialButton);
      });

      await waitFor(() => {
        expect(getAggregationOptions).not.toHaveBeenCalled();
      });
    });

    it('should use aggregations when available', async () => {
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
          false,
          undefined,
          false,
          '',
          undefined
        );
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
          undefined,
          false,
          '',
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
          50,
          false,
          '',
          undefined
        );
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
          false,
          undefined,
          false,
          '',
          undefined
        );
      });
    });

    it('should call getAggregationOptions for tier field on search', async () => {
      mockGetAggregationOptions.mockResolvedValue({
        data: {
          aggregations: {
            'sterms#tier.tagFQN': {
              buckets: [{ key: 'Tier.Tier1', doc_count: 5 }],
            },
          },
        },
      });

      const tierFields: ExploreQuickFilterField[] = [
        { label: 'Tier', key: 'tier.tagFQN', value: undefined },
      ];

      render(<ExploreQuickFilters {...mockProps} fields={tierFields} />);

      const searchButton = screen.getByTestId('onSearch-tier.tagFQN');

      await act(async () => {
        userEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(getAggregationOptions).toHaveBeenCalledWith(
          SearchIndex.TABLE,
          'tier.tagFQN',
          'test',
          expect.any(String),
          false,
          false,
          undefined,
          false,
          '',
          undefined
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
          false,
          undefined,
          false,
          '',
          undefined
        );
      });
    });

    it('should call NLQ aggregate endpoint when NLP is active', async () => {
      mockUseSearchStore.mockReturnValue({ isNLPActive: true });
      mockGetAggregationOptions.mockResolvedValue(
        mockAdvancedFieldDefaultOptions
      );

      render(<ExploreQuickFilters {...mockProps} aggregations={undefined} />);

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
          false,
          undefined,
          true,
          '',
          undefined
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
          expect.anything(),
          undefined,
          expect.anything(),
          expect.any(String),
          undefined
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
          false,
          undefined,
          false,
          '',
          undefined
        );
      });
    });
  });

  describe('Selected keys', () => {
    it('should reflect selected values for any field', () => {
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

    it('should reflect selected values for tier field', () => {
      const tierFields: ExploreQuickFilterField[] = [
        {
          label: 'Tier',
          key: 'tier.tagFQN',
          value: [{ key: 'Tier.Tier1', label: 'Tier1' }],
        },
      ];

      render(<ExploreQuickFilters {...mockProps} fields={tierFields} />);

      expect(
        screen.getByTestId('selected-count-tier.tagFQN')
      ).toHaveTextContent('1');
    });
  });

  describe('Static options (field.options)', () => {
    it('should use static field options without calling API on initial open', async () => {
      const staticFields: ExploreQuickFilterField[] = [
        {
          label: 'Status',
          key: 'status',
          value: undefined,
          options: [
            { key: 'active', label: 'Active' },
            { key: 'inactive', label: 'Inactive' },
          ],
        },
      ];

      render(<ExploreQuickFilters {...mockProps} fields={staticFields} />);

      const initialButton = screen.getByTestId('onGetInitialOptions-status');

      await act(async () => {
        userEvent.click(initialButton);
      });

      expect(getAggregationOptions).not.toHaveBeenCalled();
    });

    it('should filter static options by search value (case-insensitive)', async () => {
      const staticFields: ExploreQuickFilterField[] = [
        {
          label: 'Status',
          key: 'status',
          value: undefined,
          options: [
            { key: 'active', label: 'Active' },
            { key: 'inactive', label: 'Inactive' },
          ],
        },
      ];

      render(<ExploreQuickFilters {...mockProps} fields={staticFields} />);

      const searchButton = screen.getByTestId('onSearch-status');

      await act(async () => {
        userEvent.click(searchButton);
      });

      expect(getAggregationOptions).not.toHaveBeenCalled();
    });
  });

  describe('Field-specific searchIndex and searchKey', () => {
    it('should use field.searchIndex and field.searchKey when provided', async () => {
      mockGetAggregationOptions.mockResolvedValue(
        mockAdvancedFieldDefaultOptions
      );

      const customFields: ExploreQuickFilterField[] = [
        {
          label: 'Custom',
          key: 'custom.key',
          value: undefined,
          searchIndex: SearchIndex.TOPIC,
          searchKey: 'remapped.key',
        },
      ];

      render(<ExploreQuickFilters {...mockProps} fields={customFields} />);

      const searchButton = screen.getByTestId('onSearch-custom.key');

      await act(async () => {
        userEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(getAggregationOptions).toHaveBeenCalledWith(
          SearchIndex.TOPIC,
          'remapped.key',
          'test',
          expect.any(String),
          false,
          false,
          undefined,
          false,
          '',
          undefined
        );
      });
    });

    it('should fall back to default index/key when field-specific not provided', async () => {
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
          expect.any(String),
          expect.any(String),
          false,
          false,
          undefined,
          false,
          '',
          undefined
        );
      });
    });
  });

  describe('showDeleted URL flag', () => {
    it('should pass showDeleted=true to getAggregationOptions when set in URL', async () => {
      mockUseCustomLocation.mockReturnValue({ search: '?showDeleted=true' });
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
          true,
          undefined,
          false,
          '',
          undefined
        );
      });
    });
  });

  describe('singleSelect propagation', () => {
    it('should pass singleSelect flag from field config to SearchDropdown', () => {
      const singleSelectFields: ExploreQuickFilterField[] = [
        {
          label: 'Database',
          key: 'database.name',
          value: undefined,
          singleSelect: true,
        },
      ];

      render(
        <ExploreQuickFilters {...mockProps} fields={singleSelectFields} />
      );

      expect(
        screen.getByTestId('single-select-database.name')
      ).toHaveTextContent('true');
    });
  });

  describe('sourceFields propagation', () => {
    it('should pass sourceFields from field config to getAggregationOptions', async () => {
      mockGetAggregationOptions.mockResolvedValue(
        mockAdvancedFieldDefaultOptions
      );

      const fieldsWithSourceFields: ExploreQuickFilterField[] = [
        {
          label: 'Domain',
          key: 'domains.displayName.keyword',
          value: undefined,
          sourceFields: 'domains.displayName',
        },
      ];

      render(
        <ExploreQuickFilters
          {...mockProps}
          aggregations={undefined}
          fields={fieldsWithSourceFields}
        />
      );

      const searchButton = screen.getByTestId(
        'onSearch-domains.displayName.keyword'
      );

      await act(async () => {
        userEvent.click(searchButton);
      });

      await waitFor(() => {
        expect(getAggregationOptions).toHaveBeenCalledWith(
          SearchIndex.TABLE,
          'domains.displayName.keyword',
          'test',
          expect.any(String),
          false,
          false,
          undefined,
          false,
          '',
          'domains.displayName'
        );
      });
    });

    it('should pass sourceFields to getAggregationOptions on initial options fetch', async () => {
      mockGetAggregationOptions.mockResolvedValue({
        data: {
          aggregations: {
            'sterms#ownerDisplayName': {
              buckets: [
                {
                  key: 'john doe',
                  doc_count: 3,
                  'top_hits#top': {
                    hits: {
                      hits: [
                        {
                          _source: {
                            ownerDisplayName: ['John Doe', 'Jane Smith'],
                          },
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      });

      const ownerField: ExploreQuickFilterField[] = [
        {
          label: 'Owners',
          key: 'ownerDisplayName',
          value: undefined,
          sourceFields: 'ownerDisplayName',
        },
      ];

      render(
        <ExploreQuickFilters
          {...mockProps}
          aggregations={undefined}
          fields={ownerField}
        />
      );

      const initialButton = screen.getByTestId(
        'onGetInitialOptions-ownerDisplayName'
      );

      await act(async () => {
        userEvent.click(initialButton);
      });

      await waitFor(() => {
        expect(getAggregationOptions).toHaveBeenCalledWith(
          SearchIndex.TABLE,
          'ownerDisplayName',
          '',
          expect.any(String),
          false,
          false,
          undefined,
          false,
          '',
          'ownerDisplayName'
        );
      });
    });
  });

  describe('Multi-index display', () => {
    it('should pass first index as display index to SearchDropdown', () => {
      const multiIndexProps = {
        ...mockProps,
        index: [SearchIndex.TABLE, SearchIndex.TOPIC] as unknown as SearchIndex,
      };

      render(<ExploreQuickFilters {...multiIndexProps} />);

      expect(screen.getByTestId('index-database.name')).toHaveTextContent(
        SearchIndex.TABLE
      );
    });
  });

  describe('additionalActions', () => {
    it('should render additionalActions content', () => {
      render(
        <ExploreQuickFilters
          {...mockProps}
          additionalActions={
            <button data-testid="extra-action">Extra Action</button>
          }
        />
      );

      expect(screen.getByTestId('extra-action')).toBeInTheDocument();
    });
  });
});
