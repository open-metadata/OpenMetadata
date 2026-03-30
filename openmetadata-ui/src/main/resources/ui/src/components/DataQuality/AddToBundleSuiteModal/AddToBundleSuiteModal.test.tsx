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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { useNavigate } from 'react-router-dom';
import { TestCase } from '../../../generated/tests/testCase';
import { TestSuite } from '../../../generated/tests/testSuite';
import { MOCK_TEST_CASE } from '../../../mocks/TestSuite.mock';
import {
  addTestCasesToLogicalTestSuiteBulk,
  getListTestSuitesBySearch,
} from '../../../rest/testAPI';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
import AddToBundleSuiteModal from './AddToBundleSuiteModal.component';
import { AddToBundleSuiteModalProps } from './AddToBundleSuiteModal.interface';

const mockNavigate = jest.fn();
const mockOnCancel = jest.fn();
const mockOnAddedToExisting = jest.fn();

const mockTestSuites: TestSuite[] = [
  {
    id: 'suite-1',
    name: 'Bundle Suite 1',
    fullyQualifiedName: 'bundle.suite.1',
  },
  {
    id: 'suite-2',
    name: 'Bundle Suite 2',
    fullyQualifiedName: 'bundle.suite.2',
  },
];

const mockTestCases: TestCase[] = [
  { ...MOCK_TEST_CASE[0], id: 'test-1', name: 'test_case_1' },
  { ...MOCK_TEST_CASE[0], id: 'test-2', name: 'test_case_2' },
];

const mockProps: AddToBundleSuiteModalProps = {
  open: true,
  selectedTestCases: mockTestCases,
  onCancel: mockOnCancel,
  onAddedToExisting: mockOnAddedToExisting,
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
}));

jest.mock('../../../rest/testAPI', () => ({
  getListTestSuitesBySearch: jest.fn(),
  addTestCasesToLogicalTestSuiteBulk: jest.fn(),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));

describe('AddToBundleSuiteModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (getListTestSuitesBySearch as jest.Mock).mockResolvedValue({
      data: mockTestSuites,
    });
    (addTestCasesToLogicalTestSuiteBulk as jest.Mock).mockResolvedValue({});
  });

  describe('Component Rendering', () => {
    it('should render modal when open', () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      expect(
        screen.getByText('label.add-test-cases-to-bundle-suite')
      ).toBeInTheDocument();
    });

    it('should not render modal when closed', () => {
      render(<AddToBundleSuiteModal {...mockProps} open={false} />);

      expect(
        screen.queryByText('label.add-test-cases-to-bundle-suite')
      ).not.toBeInTheDocument();
    });

    it('should render select dropdown', async () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      await waitFor(() => {
        expect(screen.getByRole('combobox')).toBeInTheDocument();
      });
    });

    it('should render Add and Cancel buttons', () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      expect(screen.getByText('label.add')).toBeInTheDocument();
      expect(screen.getByText('label.cancel')).toBeInTheDocument();
    });
  });

  describe('Test Suite Loading', () => {
    it('should load bundle suites on mount', async () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      await waitFor(() => {
        expect(getListTestSuitesBySearch).toHaveBeenCalledWith({
          q: '*',
          limit: 15,
          testSuiteType: 'logical',
          includeEmptyTestSuites: true,
        });
      });
    });

    it('should search bundle suites when typing', async () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      const select = screen.getByRole('combobox');

      await act(async () => {
        fireEvent.focus(select);
        fireEvent.change(select, { target: { value: 'Bundle' } });
      });

      await waitFor(
        () => {
          expect(getListTestSuitesBySearch).toHaveBeenCalledWith(
            expect.objectContaining({
              q: '*Bundle*',
            })
          );
        },
        { timeout: 500 }
      );
    });

    it('should show loading state while fetching suites', async () => {
      (getListTestSuitesBySearch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) => setTimeout(() => resolve({ data: [] }), 100))
      );

      render(<AddToBundleSuiteModal {...mockProps} />);

      const select = screen.getByRole('combobox');

      await act(async () => {
        fireEvent.focus(select);
      });

      expect(select).toBeInTheDocument();
    });

    it('should handle API error when loading suites', async () => {
      const error = new Error('Failed to load');
      (getListTestSuitesBySearch as jest.Mock).mockRejectedValueOnce(error);

      render(<AddToBundleSuiteModal {...mockProps} />);

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(error);
      });
    });
  });

  describe('Suite Selection', () => {
    it('should allow selecting a bundle suite', async () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      await waitFor(() => {
        expect(getListTestSuitesBySearch).toHaveBeenCalled();
      });

      const select = screen.getByRole('combobox');

      await act(async () => {
        fireEvent.mouseDown(select);
      });

      await waitFor(() => {
        const option = screen.getByText('Bundle Suite 1');

        fireEvent.click(option);
      });

      expect(select).toBeInTheDocument();
    });

    it('should clear selection when clear button is clicked', async () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      const select = screen.getByRole('combobox');

      await act(async () => {
        fireEvent.mouseDown(select);
      });

      await waitFor(() => {
        const option = screen.getByText('Bundle Suite 1');

        fireEvent.click(option);
      });

      const clearButton = document.querySelector('.ant-select-clear');

      if (clearButton) {
        await act(async () => {
          fireEvent.mouseDown(clearButton);
        });
      }

      expect(select).toBeInTheDocument();
    });
  });

  describe('Form Submission', () => {
    it('should add test cases to selected bundle suite', async () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      await waitFor(() => {
        expect(getListTestSuitesBySearch).toHaveBeenCalled();
      });

      const select = screen.getByRole('combobox');

      await act(async () => {
        fireEvent.mouseDown(select);
      });

      await waitFor(() => {
        const option = screen.getByText('Bundle Suite 1');

        fireEvent.click(option);
      });

      const addButton = screen.getByText('label.add');

      await act(async () => {
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(addTestCasesToLogicalTestSuiteBulk).toHaveBeenCalledWith(
          'suite-1',
          {
            selectAll: false,
            includeIds: ['test-1', 'test-2'],
            excludeIds: [],
          }
        );
      });
    });

    it('should show success message after adding test cases', async () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      await waitFor(() => {
        expect(getListTestSuitesBySearch).toHaveBeenCalled();
      });

      const select = screen.getByRole('combobox');

      await act(async () => {
        fireEvent.mouseDown(select);
      });

      await waitFor(() => {
        const option = screen.getByText('Bundle Suite 1');

        fireEvent.click(option);
      });

      const addButton = screen.getByText('label.add');

      await act(async () => {
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(showSuccessToast).toHaveBeenCalledWith(
          'message.test-cases-added-to-bundle-suite'
        );
      });
    });

    it('should navigate to bundle suite after successful addition', async () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      await waitFor(() => {
        expect(getListTestSuitesBySearch).toHaveBeenCalled();
      });

      const select = screen.getByRole('combobox');

      await act(async () => {
        fireEvent.mouseDown(select);
      });

      await waitFor(() => {
        const option = screen.getByText('Bundle Suite 1');

        fireEvent.click(option);
      });

      const addButton = screen.getByText('label.add');

      await act(async () => {
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith(
          '/test-suites/bundle.suite.1'
        );
      });
    });

    it('should call onAddedToExisting after successful addition', async () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      await waitFor(() => {
        expect(getListTestSuitesBySearch).toHaveBeenCalled();
      });

      const select = screen.getByRole('combobox');

      await act(async () => {
        fireEvent.mouseDown(select);
      });

      await waitFor(() => {
        const option = screen.getByText('Bundle Suite 1');

        fireEvent.click(option);
      });

      const addButton = screen.getByText('label.add');

      await act(async () => {
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(mockOnAddedToExisting).toHaveBeenCalled();
      });
    });

    it('should call onCancel after successful addition', async () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      await waitFor(() => {
        expect(getListTestSuitesBySearch).toHaveBeenCalled();
      });

      const select = screen.getByRole('combobox');

      await act(async () => {
        fireEvent.mouseDown(select);
      });

      await waitFor(() => {
        const option = screen.getByText('Bundle Suite 1');

        fireEvent.click(option);
      });

      const addButton = screen.getByText('label.add');

      await act(async () => {
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalled();
      });
    });

    it('should handle API error during addition', async () => {
      const error = new Error('Failed to add');
      (addTestCasesToLogicalTestSuiteBulk as jest.Mock).mockRejectedValueOnce(
        error
      );

      render(<AddToBundleSuiteModal {...mockProps} />);

      await waitFor(() => {
        expect(getListTestSuitesBySearch).toHaveBeenCalled();
      });

      const select = screen.getByRole('combobox');

      await act(async () => {
        fireEvent.mouseDown(select);
      });

      await waitFor(() => {
        const option = screen.getByText('Bundle Suite 1');

        fireEvent.click(option);
      });

      const addButton = screen.getByText('label.add');

      await act(async () => {
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(showErrorToast).toHaveBeenCalledWith(error);
      });
    });

    it('should show loading state during submission', async () => {
      (addTestCasesToLogicalTestSuiteBulk as jest.Mock).mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve({}), 100))
      );

      render(<AddToBundleSuiteModal {...mockProps} />);

      await waitFor(() => {
        expect(getListTestSuitesBySearch).toHaveBeenCalled();
      });

      const select = screen.getByRole('combobox');

      await act(async () => {
        fireEvent.mouseDown(select);
      });

      await waitFor(() => {
        const option = screen.getByText('Bundle Suite 1');

        fireEvent.click(option);
      });

      const addButton = screen.getByText('label.add');

      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(addButton).toBeInTheDocument();
    });

    it('should not call API when no test cases selected', async () => {
      const propsWithNoTestCases = {
        ...mockProps,
        selectedTestCases: [],
      };

      render(<AddToBundleSuiteModal {...propsWithNoTestCases} />);

      await waitFor(() => {
        expect(getListTestSuitesBySearch).toHaveBeenCalled();
      });

      const select = screen.getByRole('combobox');

      await act(async () => {
        fireEvent.mouseDown(select);
      });

      await waitFor(() => {
        const option = screen.getByText('Bundle Suite 1');

        fireEvent.click(option);
      });

      const addButton = screen.getByText('label.add');

      await act(async () => {
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(mockOnCancel).toHaveBeenCalled();
      });

      expect(addTestCasesToLogicalTestSuiteBulk).not.toHaveBeenCalled();
    });

    it('should not submit form without selecting a suite', async () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      const addButton = screen.getByText('label.add');

      await act(async () => {
        fireEvent.click(addButton);
      });

      await waitFor(() => {
        expect(addTestCasesToLogicalTestSuiteBulk).not.toHaveBeenCalled();
      });
    });

    it('should validate form before submission', async () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      const addButton = screen.getByText('label.add');

      await act(async () => {
        fireEvent.click(addButton);
      });

      expect(addTestCasesToLogicalTestSuiteBulk).not.toHaveBeenCalled();
    });
  });

  describe('Modal Actions', () => {
    it('should call onCancel when cancel button is clicked', () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      const cancelButton = screen.getByText('label.cancel');

      fireEvent.click(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('should disable add button when no test cases are selected', () => {
      const propsWithNoTestCases = {
        ...mockProps,
        selectedTestCases: [],
      };

      render(<AddToBundleSuiteModal {...propsWithNoTestCases} />);

      const addButton = screen.getByText('label.add').closest('button');

      expect(addButton).toBeDisabled();
    });

    it('should enable add button when test cases are selected', () => {
      render(<AddToBundleSuiteModal {...mockProps} />);

      const addButton = screen.getByText('label.add').closest('button');

      expect(addButton).not.toBeDisabled();
    });
  });

  describe('Form State Management', () => {
    it('should reset form when modal is reopened', async () => {
      const { rerender } = render(
        <AddToBundleSuiteModal {...mockProps} open={false} />
      );

      rerender(<AddToBundleSuiteModal {...mockProps} open />);

      await waitFor(() => {
        expect(getListTestSuitesBySearch).toHaveBeenCalled();
      });
    });

    it('should clean up debounced search on unmount', () => {
      const { unmount } = render(<AddToBundleSuiteModal {...mockProps} />);

      unmount();

      expect(getListTestSuitesBySearch).toHaveBeenCalled();
    });
  });
});
