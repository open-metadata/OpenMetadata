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
import {
    fireEvent,
    queryByAttribute,
    render,
    screen,
    waitFor
} from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EntityReference, TestCase } from '../../../generated/tests/testCase';
import { getAggregateFieldOptions } from '../../../rest/miscAPI';
import { searchQuery } from '../../../rest/searchAPI';
import { getListTestCaseBySearch } from '../../../rest/testAPI';
import { AddTestCaseList } from './AddTestCaseList.component';
import { AddTestCaseModalProps } from './AddTestCaseList.interface';

jest.mock('../../common/ErrorWithPlaceholder/ErrorPlaceHolder', () => {
  return jest.fn().mockImplementation(() => <div>Error Placeholder Mock</div>);
});

jest.mock('../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => <div>Loader Mock</div>);
});

jest.mock('../../common/SearchBarComponent/SearchBar.component', () => {
  return jest.fn().mockImplementation(({ onSearch, searchValue }) => (
    <div>
      <input
        data-testid="search-bar"
        value={searchValue}
        onChange={(e) => onSearch(e.target.value)}
      />
    </div>
  ));
});
jest.mock('../../../utils/StringsUtils', () => {
  return {
    replacePlus: jest.fn().mockImplementation((fqn) => fqn),
  };
});
jest.mock('../../../utils/FeedUtils', () => {
  return {
    getEntityFQN: jest.fn().mockImplementation((fqn) => fqn),
  };
});
jest.mock('../../../utils/EntityUtils', () => {
  return {
    getEntityName: jest
      .fn()
      .mockImplementation(
        (entity: EntityReference) => entity?.displayName ?? entity?.name
      ),
    getColumnNameFromEntityLink: jest.fn().mockImplementation((fqn) => fqn),
  };
});
jest.mock('../../../utils/CommonUtils', () => {
  return {
    getNameFromFQN: jest.fn().mockImplementation((fqn) => fqn),
  };
});
jest.mock('../../../rest/testAPI', () => ({
  getListTestCaseBySearch: jest.fn(),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({
    hits: { hits: [] },
  }),
}));

jest.mock('../../../rest/miscAPI', () => ({
  getAggregateFieldOptions: jest.fn().mockResolvedValue({
    data: {
      aggregations: {
        'sterms#columns.name.keyword': { buckets: [] },
      },
    },
  }),
}));

jest.mock('../../../constants/constants', () => ({
  ...jest.requireActual('../../../constants/constants'),
  getEntityDetailsPath: jest.fn(),
  PAGE_SIZE_BASE: 15,
  PAGE_SIZE_MEDIUM: 25,
}));

const mockProps: AddTestCaseModalProps = {
  onCancel: jest.fn(),
  onSubmit: jest.fn(),
  cancelText: 'Cancel',
  submitText: 'Submit',
  selectedTest: [],
  onChange: jest.fn(),
  showButton: true,
};

jest.mock('../../../utils/RouterUtils', () => ({
  getEntityDetailsPath: jest.fn().mockReturnValue('/path/to/entity'),
}));

jest.mock('./AddTestCaseListFilters.component', () => ({
  __esModule: true,
  default: function MockAddTestCaseListFilters({
    hideTableFilter = false,
    onChange,
    onSearch,
  }: {
    hideTableFilter?: boolean;
    onChange: (
      values: { key: string; label: string }[],
      searchKey: string
    ) => void;
    onSearch?: (searchText: string, searchKey: string) => void;
  }) {
    return (
      <div data-testid="add-test-case-list-filters">
        <button
          data-testid="filter-status-success"
          type="button"
          onClick={() =>
            onChange([{ key: 'Success', label: 'Success' }], 'status')
          }>
          Apply status Success
        </button>
        <button
          data-testid="filter-test-type-table"
          type="button"
          onClick={() =>
            onChange([{ key: 'table', label: 'Table' }], 'testType')
          }>
          Apply testType table
        </button>
        {!hideTableFilter && (
          <>
            <button
              data-testid="filter-table"
              type="button"
              onClick={() =>
                onChange(
                  [
                    {
                      key: 'sample.table',
                      label: 'sample.table',
                    },
                  ],
                  'table'
                )
              }>
              Apply table filter
            </button>
            <button
              data-testid="filter-table-search"
              type="button"
              onClick={() => onSearch?.('table_search_term', 'table')}>
              Trigger table search
            </button>
          </>
        )}
        <button
          data-testid="filter-column"
          type="button"
          onClick={() =>
            onChange([{ key: 'sample.table::id', label: 'id' }], 'column')
          }>
          Apply column filter
        </button>
      </div>
    );
  },
}));

const mockGetListTestCaseBySearch =
  getListTestCaseBySearch as jest.MockedFunction<
    typeof getListTestCaseBySearch
  >;

const mockTestCases: TestCase[] = [
  {
    id: 'test-case-1',
    name: 'test_case_1',
    displayName: 'Test Case 1',
    entityLink: '<#E::table::sample.table>',
    testDefinition: {
      id: 'test-def-1',
      name: 'table_column_count_to_equal',
      displayName: 'Table Column Count To Equal',
    },
  } as TestCase,
  {
    id: 'test-case-2',
    name: 'test_case_2',
    displayName: 'Test Case 2',
    entityLink: '<#E::table::sample.table::columns::id>',
    testDefinition: {
      id: 'test-def-2',
      name: 'column_values_to_be_unique',
      displayName: 'Column Values To Be Unique',
    },
  } as TestCase,
  {
    id: 'test-case-3',
    name: 'test_case_3',
    displayName: 'Test Case 3',
    entityLink: '<#E::table::another.table>',
    testDefinition: {
      id: 'test-def-3',
      name: 'table_row_count_to_be_between',
      displayName: 'Table Row Count To Be Between',
    },
  } as TestCase,
];

const payloadPartial = (testCases: TestCase[]) => ({
  selectAll: false,
  includeIds: testCases.map((c) => c.id ?? '').filter(Boolean),
  excludeIds: [] as string[],
  testCases,
});

const payloadEmpty = () => ({
  selectAll: false,
  includeIds: [] as string[],
  excludeIds: [] as string[],
  testCases: [] as TestCase[],
});

const renderWithRouter = (props: AddTestCaseModalProps) => {
  return render(
    <MemoryRouter>
      <AddTestCaseList {...props} />
    </MemoryRouter>
  );
};

describe('AddTestCaseList', () => {
  beforeEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
    mockGetListTestCaseBySearch.mockResolvedValue({
      data: [],
      paging: {
        total: 0,
      },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the component with initial state', async () => {
    await act(async () => {
      renderWithRouter(mockProps);
    });

    expect(screen.getByTestId('search-bar')).toBeInTheDocument();
    expect(screen.getByTestId('cancel')).toBeInTheDocument();
    expect(screen.getByTestId('submit')).toBeInTheDocument();
    expect(mockGetListTestCaseBySearch).toHaveBeenCalledWith({
      q: '*',
      limit: 25,
      offset: 0,
    });
  });

  it('renders empty state when no test cases are found', async () => {
    await act(async () => {
      renderWithRouter(mockProps);
    });

    await waitFor(() => {
      expect(screen.getByText('Error Placeholder Mock')).toBeInTheDocument();
    });
  });

  it('renders test cases when data is available', async () => {
    mockGetListTestCaseBySearch.mockResolvedValue({
      data: mockTestCases,
      paging: {
        total: 3,
      },
    });

    await act(async () => {
      renderWithRouter(mockProps);
    });

    await waitFor(() => {
      expect(screen.getByTestId('test_case_1')).toBeInTheDocument();
      expect(screen.getByTestId('test_case_2')).toBeInTheDocument();
      expect(screen.getByTestId('test_case_3')).toBeInTheDocument();
    });
  });

  it('calls onCancel when cancel button is clicked', async () => {
    await act(async () => {
      renderWithRouter(mockProps);
    });
    fireEvent.click(screen.getByTestId('cancel'));

    expect(mockProps.onCancel).toHaveBeenCalled();
  });

  it('calls onSubmit when submit button is clicked', async () => {
    await act(async () => {
      renderWithRouter(mockProps);
    });
    const submitBtn = screen.getByTestId('submit');
    fireEvent.click(submitBtn);
    await waitFor(() => {
      const loader = queryByAttribute('aria-label', submitBtn, 'loading');

      expect(loader).toBeInTheDocument();
    });

    expect(mockProps.onSubmit).toHaveBeenCalledWith({
      selectAll: false,
      includeIds: [],
      excludeIds: [],
    });
  });

  it('does not render submit and cancel buttons when showButton is false', async () => {
    await act(async () => {
      renderWithRouter({ ...mockProps, showButton: false });
    });

    expect(screen.queryByTestId('cancel')).toBeNull();
    expect(screen.queryByTestId('submit')).toBeNull();
  });

  describe('Search functionality', () => {
    it('triggers search when search term is entered', async () => {
      await act(async () => {
        renderWithRouter(mockProps);
      });

      const searchBar = screen.getByTestId('search-bar');

      await act(async () => {
        fireEvent.change(searchBar, { target: { value: 'test_search' } });
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenCalledWith({
          q: '*test_search*',
          limit: 25,
          offset: 0,
        });
      });
    });

    it('applies testCaseFilters when provided', async () => {
      const testCaseFilters = 'testSuiteFullyQualifiedName:sample.test.suite';

      await act(async () => {
        renderWithRouter({ ...mockProps, testCaseFilters });
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenCalledWith({
          q: `* && ${testCaseFilters}`,
          limit: 25,
          offset: 0,
        });
      });
    });

    it('combines search term with testCaseFilters', async () => {
      const testCaseFilters = 'testSuiteFullyQualifiedName:sample.test.suite';

      await act(async () => {
        renderWithRouter({ ...mockProps, testCaseFilters });
      });

      const searchBar = screen.getByTestId('search-bar');

      await act(async () => {
        fireEvent.change(searchBar, { target: { value: 'column_test' } });
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenCalledWith({
          q: `*column_test* && ${testCaseFilters}`,
          limit: 25,
          offset: 0,
        });
      });
    });

    it('passes testCaseParams to API call', async () => {
      const testCaseParams = {
        testSuiteId: 'test-suite-123',
        includeFields: ['testDefinition', 'testSuite'],
      };

      await act(async () => {
        renderWithRouter({
          ...mockProps,
          testCaseParams,
        });
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenCalledWith({
          q: '*',
          limit: 25,
          offset: 0,
          ...testCaseParams,
        });
      });
    });
  });

  describe('hideTableFilter and columnFilters', () => {
    it('does not display table filter when hideTableFilter is true', async () => {
      await act(async () => {
        renderWithRouter({ ...mockProps, hideTableFilter: true });
      });

      expect(screen.queryByTestId('filter-table')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId('filter-table-search')
      ).not.toBeInTheDocument();
      expect(
        screen.getByTestId('add-test-case-list-filters')
      ).toBeInTheDocument();
      expect(screen.getByTestId('filter-column')).toBeInTheDocument();
    });

    it('displays table filter when hideTableFilter is false', async () => {
      await act(async () => {
        renderWithRouter({ ...mockProps, hideTableFilter: false });
      });

      expect(screen.getByTestId('filter-table')).toBeInTheDocument();
      expect(screen.getByTestId('filter-table-search')).toBeInTheDocument();
    });

    it('calls getAggregateFieldOptions with columnFilters when columnFilters is passed', async () => {
      const columnFilters = 'fullyQualifiedName:"service.db.schema.my_table"';
      const mockGetAggregateFieldOptions =
        getAggregateFieldOptions as jest.MockedFunction<
          typeof getAggregateFieldOptions
        >;

      await act(async () => {
        renderWithRouter({ ...mockProps, columnFilters });
      });

      await waitFor(() => {
        expect(mockGetAggregateFieldOptions).toHaveBeenCalled();
      });

      const call = mockGetAggregateFieldOptions.mock.calls.find(
        (args) => args[3] === columnFilters
      );

      expect(call).toBeDefined();
      expect(call?.[3]).toBe(columnFilters);
    });

    it('calls getAggregateFieldOptions with empty string for columnFilters when columnFilters is not passed', async () => {
      const mockGetAggregateFieldOptions =
        getAggregateFieldOptions as jest.MockedFunction<
          typeof getAggregateFieldOptions
        >;

      await act(async () => {
        renderWithRouter(mockProps);
      });

      await waitFor(() => {
        expect(mockGetAggregateFieldOptions).toHaveBeenCalled();
      });

      const call = mockGetAggregateFieldOptions.mock.calls[0];

      expect(call?.[3]).toBe('');
    });
  });

  describe('Filters', () => {
    it('renders filter section', async () => {
      await act(async () => {
        renderWithRouter(mockProps);
      });

      expect(
        screen.getByTestId('add-test-case-list-filters')
      ).toBeInTheDocument();
    });

    it('calls API with testCaseStatus when status filter is applied', async () => {
      mockGetListTestCaseBySearch.mockResolvedValue({
        data: mockTestCases,
        paging: { total: 3 },
      });

      await act(async () => {
        renderWithRouter(mockProps);
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenCalledWith(
          expect.objectContaining({
            q: '*',
            limit: 25,
            offset: 0,
          })
        );
      });

      mockGetListTestCaseBySearch.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByTestId('filter-status-success'));
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenCalledWith(
          expect.objectContaining({
            q: '*',
            limit: 25,
            offset: 0,
            testCaseStatus: 'Success',
          })
        );
      });
    });

    it('calls API with testCaseType when test type filter is applied', async () => {
      mockGetListTestCaseBySearch.mockResolvedValue({
        data: mockTestCases,
        paging: { total: 3 },
      });

      await act(async () => {
        renderWithRouter(mockProps);
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenCalled();
      });

      mockGetListTestCaseBySearch.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByTestId('filter-test-type-table'));
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenCalledWith(
          expect.objectContaining({
            q: '*',
            limit: 25,
            offset: 0,
            testCaseType: 'table',
          })
        );
      });
    });

    it('calls API with columnName when column filter is applied', async () => {
      mockGetListTestCaseBySearch.mockResolvedValue({
        data: mockTestCases,
        paging: { total: 3 },
      });

      await act(async () => {
        renderWithRouter(mockProps);
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenCalled();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('filter-column'));
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenLastCalledWith(
          expect.objectContaining({
            columnName: 'id',
          })
        );
      });
    });

    it('filters list by table selection (server-side)', async () => {
      mockGetListTestCaseBySearch.mockImplementation((params) => {
        if (params?.entityLink === '<#E::table::sample.table>') {
          return Promise.resolve({
            data: [mockTestCases[0]],
            paging: { total: 1 },
          });
        }

        return Promise.resolve({
          data: mockTestCases,
          paging: { total: 3 },
        });
      });

      await act(async () => {
        renderWithRouter(mockProps);
      });

      await waitFor(() => {
        expect(screen.getByTestId('test_case_1')).toBeInTheDocument();
        expect(screen.getByTestId('test_case_3')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('filter-table'));
      });

      expect(mockGetListTestCaseBySearch).toHaveBeenLastCalledWith(
        expect.objectContaining({
          entityLink: '<#E::table::sample.table>',
        })
      );
    });

    it('filters list by column selection (server-side)', async () => {
      mockGetListTestCaseBySearch.mockImplementation((params) => {
        if (params?.columnName) {
          return Promise.resolve({
            data: [mockTestCases[1]],
            paging: { total: 1 },
          });
        }

        return Promise.resolve({
          data: mockTestCases,
          paging: { total: 3 },
        });
      });

      await act(async () => {
        renderWithRouter(mockProps);
      });

      await waitFor(() => {
        expect(screen.getByTestId('test_case_1')).toBeInTheDocument();
        expect(screen.getByTestId('test_case_3')).toBeInTheDocument();
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId('filter-column'));
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenLastCalledWith(
          expect.objectContaining({
            columnName: 'id',
          })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('test_case_2')).toBeInTheDocument();
      });
    });

    it('table filter search calls search API', async () => {
      jest.useFakeTimers();
      mockGetListTestCaseBySearch.mockResolvedValue({
        data: mockTestCases,
        paging: { total: 3 },
      });

      await act(async () => {
        renderWithRouter(mockProps);
      });

      await waitFor(() => {
        expect(screen.getByTestId('filter-table-search')).toBeInTheDocument();
      });

      const mockSearchQuery = searchQuery as jest.MockedFunction<
        typeof searchQuery
      >;
      mockSearchQuery.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByTestId('filter-table-search'));
      });

      act(() => {
        jest.advanceTimersByTime(1000);
      });

      await waitFor(() => {
        expect(mockSearchQuery).toHaveBeenCalledWith(
          expect.objectContaining({
            query: '*table_search_term*',
            searchIndex: 'table',
          })
        );
      });
    });
  });

  describe('Test case selection', () => {
    beforeEach(() => {
      mockGetListTestCaseBySearch.mockResolvedValue({
        data: mockTestCases,
        paging: {
          total: 3,
        },
      });
    });

    it('selects a test case when clicked', async () => {
      const onChange = jest.fn();

      await act(async () => {
        renderWithRouter({ ...mockProps, onChange });
      });

      await waitFor(() => {
        expect(screen.getByTestId('test_case_1')).toBeInTheDocument();
      });

      const testCaseCard = screen
        .getByTestId('test_case_1')
        .closest('.cursor-pointer');

      expect(testCaseCard).not.toBeNull();

      await act(async () => {
        fireEvent.click(testCaseCard as Element);
      });

      await waitFor(() => {
        expect(onChange).toHaveBeenCalledWith(
          payloadPartial([mockTestCases[0]])
        );
      });

      const checkbox = screen.getByTestId('checkbox-test_case_1');

      expect(checkbox).toHaveProperty('checked', true);
    });

    it('deselects a test case when clicked again', async () => {
      const onChange = jest.fn();

      await act(async () => {
        renderWithRouter({ ...mockProps, onChange });
      });

      await waitFor(() => {
        expect(screen.getByTestId('test_case_1')).toBeInTheDocument();
      });

      const testCaseCard = screen
        .getByTestId('test_case_1')
        .closest('.cursor-pointer');

      expect(testCaseCard).not.toBeNull();

      await act(async () => {
        fireEvent.click(testCaseCard as Element);
      });

      await act(async () => {
        fireEvent.click(testCaseCard as Element);
      });

      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith(payloadEmpty());
      });

      const checkbox = screen.getByTestId('checkbox-test_case_1');

      expect(checkbox).toHaveProperty('checked', false);
    });

    it('handles multiple test case selections', async () => {
      const onChange = jest.fn();

      await act(async () => {
        renderWithRouter({ ...mockProps, onChange });
      });

      await waitFor(() => {
        expect(screen.getByTestId('test_case_1')).toBeInTheDocument();
      });

      const testCaseCard1 = screen
        .getByTestId('test_case_1')
        .closest('.cursor-pointer');
      const testCaseCard2 = screen
        .getByTestId('test_case_2')
        .closest('.cursor-pointer');

      expect(testCaseCard1).not.toBeNull();
      expect(testCaseCard2).not.toBeNull();

      await act(async () => {
        fireEvent.click(testCaseCard1 as Element);
      });

      await act(async () => {
        fireEvent.click(testCaseCard2 as Element);
      });

      await waitFor(() => {
        expect(onChange).toHaveBeenLastCalledWith(
          payloadPartial([mockTestCases[0], mockTestCases[1]])
        );
      });
    });

    it('pre-selects test cases when selectedTest prop is provided', async () => {
      mockGetListTestCaseBySearch.mockResolvedValue({
        data: [mockTestCases[0], mockTestCases[1]],
        paging: {
          total: 2,
        },
      });

      await act(async () => {
        renderWithRouter({
          ...mockProps,
          selectedTest: ['test_case_1', 'test_case_2'],
        });
      });

      await waitFor(() => {
        const checkbox1 = screen.getByTestId('checkbox-test_case_1');
        const checkbox2 = screen.getByTestId('checkbox-test_case_2');

        expect(checkbox1).toHaveProperty('checked', true);
        expect(checkbox2).toHaveProperty('checked', true);
      });
    });

    it('handles test cases without id gracefully', async () => {
      const testCasesWithoutId = [{ ...mockTestCases[0], id: undefined }];

      mockGetListTestCaseBySearch.mockResolvedValue({
        data: testCasesWithoutId,
        paging: {
          total: 1,
        },
      });

      const onChange = jest.fn();

      await act(async () => {
        renderWithRouter({ ...mockProps, onChange });
      });

      await waitFor(() => {
        expect(screen.getByTestId('test_case_1')).toBeInTheDocument();
      });

      const testCaseCard = screen
        .getByTestId('test_case_1')
        .closest('.cursor-pointer');

      expect(testCaseCard).not.toBeNull();

      await act(async () => {
        fireEvent.click(testCaseCard as Element);
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('Pagination and virtual list', () => {
    it('fetches data with correct pagination parameters', async () => {
      mockGetListTestCaseBySearch.mockResolvedValue({
        data: mockTestCases.slice(0, 2),
        paging: {
          total: 3,
        },
      });

      await act(async () => {
        renderWithRouter(mockProps);
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenCalledWith({
          q: '*',
          limit: 25,
          offset: 0,
        });
      });

      await waitFor(() => {
        expect(screen.getByTestId('test_case_1')).toBeInTheDocument();
        expect(screen.getByTestId('test_case_2')).toBeInTheDocument();
      });
    });

    it('maintains search term with API calls', async () => {
      mockGetListTestCaseBySearch.mockResolvedValue({
        data: [mockTestCases[0]],
        paging: {
          total: 2,
        },
      });

      renderWithRouter(mockProps);

      const searchBar = screen.getByTestId('search-bar');

      await act(async () => {
        fireEvent.change(searchBar, { target: { value: 'specific_test' } });
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenCalledWith({
          q: '*specific_test*',
          limit: 25,
          offset: 0,
        });
      });
    });

    it('uses virtual list for performance optimization', async () => {
      mockGetListTestCaseBySearch.mockResolvedValue({
        data: mockTestCases,
        paging: {
          total: 100,
        },
      });

      const { container } = await act(async () => renderWithRouter(mockProps));

      await waitFor(() => {
        expect(screen.getByTestId('test_case_1')).toBeInTheDocument();
      });

      const virtualList = container.querySelector('.rc-virtual-list-holder');

      expect(virtualList).toBeInTheDocument();
    });
  });

  describe('Submit functionality', () => {
    it('submits selected test cases', async () => {
      mockGetListTestCaseBySearch.mockResolvedValue({
        data: mockTestCases,
        paging: {
          total: 3,
        },
      });

      const onSubmit = jest.fn();

      await act(async () => {
        renderWithRouter({ ...mockProps, onSubmit });
      });

      await waitFor(() => {
        expect(screen.getByTestId('test_case_1')).toBeInTheDocument();
      });

      const testCaseCard1 = screen
        .getByTestId('test_case_1')
        .closest('.cursor-pointer');
      const testCaseCard2 = screen
        .getByTestId('test_case_2')
        .closest('.cursor-pointer');

      expect(testCaseCard1).not.toBeNull();
      expect(testCaseCard2).not.toBeNull();

      await act(async () => {
        fireEvent.click(testCaseCard1 as Element);
      });
      await act(async () => {
        fireEvent.click(testCaseCard2 as Element);
      });

      await waitFor(() => {
        expect(screen.getByTestId('checkbox-test_case_2')).toHaveProperty(
          'checked',
          true
        );
      });

      const submitBtn = screen.getByTestId('submit');

      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith({
          selectAll: false,
          includeIds: expect.arrayContaining(['test-case-1', 'test-case-2']),
          excludeIds: [],
        });
        expect(onSubmit.mock.calls[0][0].includeIds).toHaveLength(2);
      });
    });

    it('handles async submit operations', async () => {
      mockGetListTestCaseBySearch.mockResolvedValue({
        data: mockTestCases,
        paging: {
          total: 3,
        },
      });

      const onSubmit = jest
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 100))
        );

      await act(async () => {
        renderWithRouter({ ...mockProps, onSubmit });
      });

      await waitFor(() => {
        expect(screen.getByTestId('test_case_1')).toBeInTheDocument();
      });

      const submitBtn = screen.getByTestId('submit');

      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        const loader = queryByAttribute('aria-label', submitBtn, 'loading');

        expect(loader).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalled();
      });
    });
  });

  describe('Column test cases', () => {
    it('displays column information for column test cases', async () => {
      const columnTestCase: TestCase = {
        id: 'column-test',
        name: 'column_test',
        displayName: 'Column Test',
        entityLink: '<#E::table::sample.table::columns::user_id>',
        testDefinition: {
          id: 'test-def',
          name: 'column_values_to_be_unique',
          displayName: 'Column Values To Be Unique',
        },
      } as TestCase;

      mockGetListTestCaseBySearch.mockResolvedValue({
        data: [columnTestCase],
        paging: {
          total: 1,
        },
      });

      await act(async () => {
        renderWithRouter(mockProps);
      });

      await waitFor(() => {
        expect(screen.getByTestId('column_test')).toBeInTheDocument();
      });

      expect(screen.getByText('label.column:')).toBeInTheDocument();
    });

    it('does not display column information for table test cases', async () => {
      const tableTestCase: TestCase = {
        id: 'table-test',
        name: 'table_test',
        displayName: 'Table Test',
        entityLink: '<#E::table::sample.table>',
        testDefinition: {
          id: 'test-def',
          name: 'table_row_count_to_be_between',
          displayName: 'Table Row Count To Be Between',
        },
      } as TestCase;

      mockGetListTestCaseBySearch.mockResolvedValue({
        data: [tableTestCase],
        paging: {
          total: 1,
        },
      });

      await act(async () => {
        renderWithRouter(mockProps);
      });

      await waitFor(() => {
        expect(screen.getByTestId('table_test')).toBeInTheDocument();
      });

      expect(screen.queryByText('label.column:')).not.toBeInTheDocument();
    });
  });

  it('renders select all button when items exist', async () => {
    mockGetListTestCaseBySearch.mockResolvedValue({
      data: mockTestCases,
      paging: { total: 3 },
    });

    await act(async () => {
      renderWithRouter({ ...mockProps });
    });

    await waitFor(() => {
      expect(screen.getByTestId('test_case_1')).toBeInTheDocument();
    });

    expect(screen.getByTestId('select-all-test-cases')).toBeInTheDocument();
  });

  it('does not render select all button when no items', async () => {
    mockGetListTestCaseBySearch.mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });

    await act(async () => {
      renderWithRouter({ ...mockProps });
    });

    await waitFor(() => {
      expect(screen.getByText('Error Placeholder Mock')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('select-all-test-cases')).toBeNull();
  });

  it('select-all checkbox selects all loaded rows', async () => {
    mockGetListTestCaseBySearch.mockResolvedValue({
      data: mockTestCases,
      paging: { total: 3 },
    });

    await act(async () => {
      renderWithRouter({ ...mockProps });
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-all-test-cases')).toBeInTheDocument();
    });

    expect(screen.getByText('label.select-all (3)')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-all-test-cases'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('checkbox-test_case_3')).toHaveProperty(
        'checked',
        true
      );
    });
  });

  it('selects all items when select all is clicked and none are selected', async () => {
    mockGetListTestCaseBySearch.mockResolvedValue({
      data: mockTestCases,
      paging: { total: 3 },
    });

    const onChange = jest.fn();

    await act(async () => {
      renderWithRouter({
        ...mockProps,
        onChange,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-all-test-cases')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-all-test-cases'));
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(payloadPartial(mockTestCases));
    });

    expect(screen.getByTestId('checkbox-test_case_1')).toHaveProperty(
      'checked',
      true
    );
    expect(screen.getByTestId('checkbox-test_case_2')).toHaveProperty(
      'checked',
      true
    );
    expect(screen.getByTestId('checkbox-test_case_3')).toHaveProperty(
      'checked',
      true
    );
  });

  it('selects all items when select all is clicked and some are selected', async () => {
    mockGetListTestCaseBySearch.mockResolvedValue({
      data: mockTestCases,
      paging: { total: 3 },
    });

    const onChange = jest.fn();

    await act(async () => {
      renderWithRouter({
        ...mockProps,
        onChange,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-all-test-cases')).toBeInTheDocument();
    });

    const card1 = screen.getByTestId('test_case_1').closest('.cursor-pointer');
    fireEvent.click(card1 as Element);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(payloadPartial([mockTestCases[0]]));
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-all-test-cases'));
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith(payloadPartial(mockTestCases));
    });

    expect(screen.getByTestId('checkbox-test_case_1')).toHaveProperty(
      'checked',
      true
    );
    expect(screen.getByTestId('checkbox-test_case_2')).toHaveProperty(
      'checked',
      true
    );
    expect(screen.getByTestId('checkbox-test_case_3')).toHaveProperty(
      'checked',
      true
    );
  });

  it('deselects all items when select all is clicked and all are selected', async () => {
    mockGetListTestCaseBySearch.mockResolvedValue({
      data: mockTestCases,
      paging: { total: 3 },
    });

    const onChange = jest.fn();

    await act(async () => {
      renderWithRouter({
        ...mockProps,
        onChange,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-all-test-cases')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-all-test-cases'));
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(payloadPartial(mockTestCases));
    });

    onChange.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-all-test-cases'));
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith(payloadEmpty());
    });

    expect(screen.getByTestId('checkbox-test_case_1')).toHaveProperty(
      'checked',
      false
    );
    expect(screen.getByTestId('checkbox-test_case_2')).toHaveProperty(
      'checked',
      false
    );
    expect(screen.getByTestId('checkbox-test_case_3')).toHaveProperty(
      'checked',
      false
    );
  });

  it('calls onChange with all items when select all is clicked', async () => {
    mockGetListTestCaseBySearch.mockResolvedValue({
      data: mockTestCases,
      paging: { total: 3 },
    });

    const onChange = jest.fn();

    await act(async () => {
      renderWithRouter({
        ...mockProps,
        onChange,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-all-test-cases')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-all-test-cases'));
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(payloadPartial(mockTestCases));
  });

  it('shows select all total link when loaded count is less than total and all loaded are selected', async () => {
    mockGetListTestCaseBySearch.mockResolvedValue({
      data: mockTestCases.slice(0, 2),
      paging: { total: 45 },
    });

    await act(async () => {
      renderWithRouter({ ...mockProps });
    });

    await waitFor(() => {
      expect(screen.getByTestId('test_case_1')).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId('select-all-total-test-cases')
    ).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-all-test-cases'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-all-total-test-cases')).toBeVisible();
    });

    expect(screen.getByTestId('select-all-total-test-cases')).toHaveTextContent(
      'label.select-all-count-test-cases'
    );
  });

  it('calls onChange with selectAll when select all total link is clicked', async () => {
    mockGetListTestCaseBySearch.mockResolvedValue({
      data: mockTestCases.slice(0, 2),
      paging: { total: 10 },
    });

    const onChange = jest.fn();

    await act(async () => {
      renderWithRouter({ ...mockProps, onChange });
    });

    await waitFor(() => {
      expect(screen.getByTestId('test_case_1')).toBeInTheDocument();
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-all-test-cases'));
    });

    await waitFor(() => {
      expect(screen.getByTestId('select-all-total-test-cases')).toBeVisible();
    });

    onChange.mockClear();

    await act(async () => {
      fireEvent.click(screen.getByTestId('select-all-total-test-cases'));
    });

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({
        selectAll: true,
        includeIds: [],
        excludeIds: [],
        testCases: [],
      });
    });
  });
});
