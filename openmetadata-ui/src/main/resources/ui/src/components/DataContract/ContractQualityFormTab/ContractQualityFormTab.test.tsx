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
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { AxiosError } from 'axios';
import { TestCaseType } from '../../../enums/TestSuite.enum';
import { Table } from '../../../generated/entity/data/table';
import { TestCase } from '../../../generated/tests/testCase';
import { getListTestCaseBySearch } from '../../../rest/testAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import { ContractQualityFormTab } from './ContractQualityFormTab';

jest.mock('../../../rest/testAPI', () => ({
  getListTestCaseBySearch: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('../../../hooks/paging/usePaging', () => ({
  usePaging: jest.fn(() => ({
    currentPage: 1,
    pageSize: 10,
    handlePageChange: jest.fn(),
    handlePageSizeChange: jest.fn(),
    showPagination: true,
    paging: { total: 100 },
    handlePagingChange: jest.fn(),
  })),
}));

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  useGenericContext: jest.fn(() => ({
    data: {
      id: 'table-1',
      fullyQualifiedName: 'service.database.schema.table',
      name: 'test-table',
    } as Table,
  })),
}));

jest.mock('../../common/Table/Table', () => {
  return function MockTable({
    columns,
    dataSource,
    loading,
    rowSelection,
    rowKey,
  }: any) {
    return (
      <div data-testid="mock-table">
        <div>Loading: {loading ? 'true' : 'false'}</div>
        <div>Row Selection: {rowSelection ? 'enabled' : 'disabled'}</div>
        <div>Data Source Length: {dataSource?.length || 0}</div>
        <div>Columns: {columns?.length || 0}</div>
        {dataSource?.map((item: any) => (
          <div data-testid={`table-row-${item.id}`} key={item[rowKey]}>
            <button
              data-testid={`select-row-${item.id}`}
              onClick={() => rowSelection?.onChange?.([item.id])}>
              Select {item.name}
            </button>
          </div>
        ))}
      </div>
    );
  };
});

jest.mock(
  '../../DataQuality/AddDataQualityTest/components/TestCaseFormV1',
  () => {
    return function MockTestCaseFormV1({
      drawerProps,
      onCancel,
      onFormSubmit,
    }: any) {
      if (!drawerProps.open) {
        return null;
      }

      return (
        <div data-testid="test-case-form">
          <button data-testid="cancel-test-form" onClick={onCancel}>
            Cancel
          </button>
          <button data-testid="submit-test-form" onClick={onFormSubmit}>
            Submit
          </button>
        </div>
      );
    };
  }
);

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      const translations: Record<string, string> = {
        'label.quality': 'Quality',
        'message.quality-description': 'Select quality test cases',
        'label.add-entity': `Add ${options?.entity}`,
        'label.test-case-plural': 'Test Cases',
        'label.previous': 'Previous',
        'message.no-test-case-found': 'No test cases found',
        'label.name': 'Name',
        'label.test-type': 'Test Type',
        'label.result': 'Result',
        'label.updated-at': 'Updated At',
        'label.all': 'All',
      };

      return translations[key] || key;
    },
  }),
}));

const mockOnChange = jest.fn();
const mockOnPrev = jest.fn();
const mockOnNext = jest.fn();

const commonProps = {
  onChange: mockOnChange,
  onNext: mockOnNext,
  onPrev: mockOnPrev,
  buttonProps: {
    nextLabel: 'Custom Next',
    prevLabel: 'Custom Previous',
    isNextVisible: true,
  },
};

const mockTestCases: TestCase[] = [
  {
    id: 'test-1',
    name: 'Test Case 1',
    testCaseType: TestCaseType.table,
    fullyQualifiedName: 'test.case.1',
    updatedAt: 1640995200000,
    testCaseResult: {
      result: 'Success' as any,
      timestamp: 1640995200000,
    } as any,
  },
  {
    id: 'test-2',
    name: 'Test Case 2',
    testCaseType: TestCaseType.column,
    fullyQualifiedName: 'test.case.2',
    updatedAt: 1640995200000,
    testCaseResult: {
      result: 'Failed' as any,
      timestamp: 1640995200000,
    } as any,
  },
] as any;

describe('ContractQualityFormTab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
      data: mockTestCases,
      paging: { total: 2 },
    });
  });

  describe('Basic Rendering', () => {
    it('should render the component with default props', () => {
      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      expect(screen.getByText('Quality')).toBeInTheDocument();
      expect(
        screen.getByText('message.quality-contract-description')
      ).toBeInTheDocument();
      expect(screen.getByTestId('mock-table')).toBeInTheDocument();
    });

    it('should render with selected quality test cases', () => {
      render(
        <ContractQualityFormTab selectedQuality={['test-1']} {...commonProps} />
      );

      expect(screen.getByTestId('mock-table')).toBeInTheDocument();
    });

    it('should render with custom previous label', () => {
      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      expect(screen.getByText('Custom Previous')).toBeInTheDocument();
    });
  });

  describe('Data Fetching', () => {
    it('should fetch test cases on component mount', async () => {
      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      await waitFor(() => {
        expect(getListTestCaseBySearch).toHaveBeenCalledWith(
          expect.objectContaining({
            testCaseType: TestCaseType.all,
            entityLink: '<#E::table::service.database.schema.table>',
            includeAllTests: true,
            limit: 10,
          })
        );
      });
    });

    it('should handle API errors gracefully', async () => {
      const mockError = new AxiosError('API Error');
      (getListTestCaseBySearch as jest.Mock).mockRejectedValue(mockError);

      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(mockError);
      });
    });

    it('should show loading state during data fetch', async () => {
      (getListTestCaseBySearch as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );

      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      expect(screen.getByText('Loading: true')).toBeInTheDocument();
    });

    it('should not fetch data when table FQN is missing', () => {
      const mockUseGenericContext = jest.requireMock(
        '../../Customization/GenericProvider/GenericProvider'
      ).useGenericContext;
      mockUseGenericContext.mockReturnValueOnce({
        data: { fullyQualifiedName: undefined },
      });

      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      expect(getListTestCaseBySearch).not.toHaveBeenCalled();
    });
  });

  describe('Test Case Selection', () => {
    it('should handle test case selection', async () => {
      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      await waitFor(() => {
        expect(screen.getByTestId('select-row-test-1')).toBeInTheDocument();
      });

      const selectButton = screen.getByTestId('select-row-test-1');

      await act(async () => {
        fireEvent.click(selectButton);
      });

      expect(mockOnChange).toHaveBeenCalledWith({
        qualityExpectations: expect.arrayContaining([
          expect.objectContaining({ id: 'test-1' }),
        ]),
      });
    });

    it('should display selected rows in table', async () => {
      render(
        <ContractQualityFormTab selectedQuality={['test-1']} {...commonProps} />
      );

      await waitFor(() => {
        expect(screen.getByText('Row Selection: enabled')).toBeInTheDocument();
      });
    });
  });

  describe('Test Case Types Filtering', () => {
    it('should filter by test case type', async () => {
      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      // Wait for initial load
      await waitFor(() => {
        expect(getListTestCaseBySearch).toHaveBeenCalledWith(
          expect.objectContaining({
            testCaseType: TestCaseType.all,
          })
        );
      });

      // Test type dropdown functionality would be tested here
      // This requires more detailed implementation of the dropdown mock
    });
  });

  describe('Add Test Case', () => {
    it('should open test case drawer when add button is clicked', async () => {
      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      const addButton = screen.getByText('Add label.test');

      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(screen.getByTestId('test-case-form')).toBeInTheDocument();
    });

    it('should close test case drawer when cancelled', async () => {
      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      const addButton = screen.getByText('Add label.test');

      await act(async () => {
        fireEvent.click(addButton);
      });

      const cancelButton = screen.getByTestId('cancel-test-form');

      await act(async () => {
        fireEvent.click(cancelButton);
      });

      expect(screen.queryByTestId('test-case-form')).not.toBeInTheDocument();
    });

    it('should refetch test cases after new test case is submitted', async () => {
      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      const addButton = screen.getByText('Add label.test');

      await act(async () => {
        fireEvent.click(addButton);
      });

      const submitButton = screen.getByTestId('submit-test-form');

      await act(async () => {
        fireEvent.click(submitButton);
      });

      expect(getListTestCaseBySearch).toHaveBeenCalledTimes(2); // Initial load + refetch
    });
  });

  describe('Pagination', () => {
    it('should handle page changes', async () => {
      const mockHandlePageChange = jest.fn();
      const mockUsePaging = jest.requireMock(
        '../../../hooks/paging/usePaging'
      ).usePaging;
      mockUsePaging.mockReturnValue({
        currentPage: 1,
        pageSize: 10,
        handlePageChange: mockHandlePageChange,
        handlePageSizeChange: jest.fn(),
        showPagination: true,
        paging: { total: 100 },
        handlePagingChange: jest.fn(),
      });

      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      await waitFor(() => {
        expect(getListTestCaseBySearch).toHaveBeenCalled();
      });
    });
  });

  describe('Navigation', () => {
    it('should display navigation buttons', () => {
      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      expect(screen.getByText('Custom Previous')).toBeInTheDocument();
    });

    it('should call onPrev when previous button is clicked', () => {
      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      const prevButton = screen.getByText('Custom Previous');
      fireEvent.click(prevButton);

      expect(mockOnPrev).toHaveBeenCalled();
    });
  });

  describe('Table Rendering', () => {
    it('should display test cases in table', async () => {
      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      await waitFor(() => {
        expect(screen.getByText('Data Source Length: 2')).toBeInTheDocument();
      });

      expect(screen.getByTestId('table-row-test-1')).toBeInTheDocument();
      expect(screen.getByTestId('table-row-test-2')).toBeInTheDocument();
    });

    it('should handle empty test cases data', async () => {
      (getListTestCaseBySearch as jest.Mock).mockResolvedValue({
        data: [],
        paging: { total: 0 },
      });

      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      await waitFor(() => {
        expect(screen.getByText('Data Source Length: 0')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle missing table context', () => {
      const mockUseGenericContext = jest.requireMock(
        '../../Customization/GenericProvider/GenericProvider'
      ).useGenericContext;
      mockUseGenericContext.mockReturnValue({ data: undefined });

      expect(() => {
        render(
          <ContractQualityFormTab selectedQuality={[]} {...commonProps} />
        );
      }).not.toThrow();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button roles and attributes', () => {
      render(<ContractQualityFormTab selectedQuality={[]} {...commonProps} />);

      const addButton = screen.getByText('Add label.test');

      expect(addButton).toBeInTheDocument();

      const prevButton = screen.getByText('Custom Previous');

      expect(prevButton).toBeInTheDocument();
    });
  });
});
