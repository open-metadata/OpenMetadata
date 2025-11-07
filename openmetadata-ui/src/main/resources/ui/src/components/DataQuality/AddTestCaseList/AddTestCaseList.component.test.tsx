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
  waitFor,
} from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { EntityReference, TestCase } from '../../../generated/tests/testCase';
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
jest.mock('../../../rest/testAPI', () => {
  return {
    getListTestCaseBySearch: jest.fn(),
  };
});

jest.mock('../../../constants/constants', () => ({
  getEntityDetailsPath: jest.fn(),
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

const renderWithRouter = (props: AddTestCaseModalProps) => {
  return render(
    <MemoryRouter>
      <AddTestCaseList {...props} />
    </MemoryRouter>
  );
};

describe('AddTestCaseList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetListTestCaseBySearch.mockResolvedValue({
      data: [],
      paging: {
        total: 0,
      },
    });
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

    expect(mockProps.onSubmit).toHaveBeenCalledWith([]);
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

    it('applies filters when provided', async () => {
      const filters = 'testSuiteFullyQualifiedName:sample.test.suite';

      await act(async () => {
        renderWithRouter({ ...mockProps, filters });
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenCalledWith({
          q: `* && ${filters}`,
          limit: 25,
          offset: 0,
        });
      });
    });

    it('combines search term with filters', async () => {
      const filters = 'testSuiteFullyQualifiedName:sample.test.suite';

      await act(async () => {
        renderWithRouter({ ...mockProps, filters });
      });

      const searchBar = screen.getByTestId('search-bar');

      await act(async () => {
        fireEvent.change(searchBar, { target: { value: 'column_test' } });
      });

      await waitFor(() => {
        expect(mockGetListTestCaseBySearch).toHaveBeenCalledWith({
          q: `*column_test* && ${filters}`,
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
        render(
          <AddTestCaseList {...mockProps} testCaseParams={testCaseParams} />
        );
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
        expect(onChange).toHaveBeenCalledWith([mockTestCases[0]]);
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
        expect(onChange).toHaveBeenLastCalledWith([]);
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
        expect(onChange).toHaveBeenLastCalledWith([
          mockTestCases[0],
          mockTestCases[1],
        ]);
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

      renderWithRouter(mockProps);

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

      const { container } = renderWithRouter(mockProps);

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
        fireEvent.click(testCaseCard2 as Element);
      });

      const submitBtn = screen.getByTestId('submit');

      await act(async () => {
        fireEvent.click(submitBtn);
      });

      await waitFor(() => {
        expect(onSubmit).toHaveBeenCalledWith([
          mockTestCases[0],
          mockTestCases[1],
        ]);
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
});
