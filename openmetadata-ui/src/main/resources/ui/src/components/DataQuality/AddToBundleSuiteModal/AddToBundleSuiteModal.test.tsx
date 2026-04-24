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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { TestCase } from '../../../generated/tests/testCase';
import { TestSuite } from '../../../generated/tests/testSuite';
import { MOCK_TEST_CASE } from '../../../mocks/TestSuite.mock';
import {
  addTestCasesToLogicalTestSuiteBulk,
  getListTestSuitesBySearch,
} from '../../../rest/testAPI';
import AddToBundleSuiteModal from './AddToBundleSuiteModal.component';
import { AddToBundleSuiteModalProps } from './AddToBundleSuiteModal.interface';

type MockSelectProps = {
  onChange?: (value: string | undefined) => void;
  onSearch?: (value: string) => void;
  'data-testid'?: string;
};

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

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Select: ({ onChange, onSearch, 'data-testid': testId }: MockSelectProps) => (
    <div>
      <input
        data-testid={testId}
        onChange={(e) => onSearch?.(e.target.value)}
      />
      <button
        data-testid={`${testId}-option`}
        onClick={() => onChange?.('suite-1')}>
        select-option
      </button>
    </div>
  ),
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const MockDialogContent = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-content">{children}</div>
  );

  const MockDialogFooter = ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  );

  const MockDialog = Object.assign(
    ({
      children,
      title,
      onClose,
    }: {
      children: React.ReactNode;
      title: string;
      onClose: () => void;
    }) => (
      <div data-testid="dialog">
        <div data-testid="dialog-title">{title}</div>
        <button data-testid="close-button" onClick={onClose}>
          Close
        </button>
        {children}
      </div>
    ),
    {
      Content: MockDialogContent,
      Footer: MockDialogFooter,
    }
  );

  return {
    Button: ({
      children,
      onPress,
      'data-testid': testId,
      isDisabled,
    }: {
      children: React.ReactNode;
      onPress: () => void;
      'data-testid': string;
      isDisabled?: boolean;
    }) => (
      <button data-testid={testId} disabled={isDisabled} onClick={onPress}>
        {children}
      </button>
    ),
    Dialog: MockDialog,
    Modal: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="modal">{children}</div>
    ),
    ModalOverlay: ({
      children,
      isOpen,
      onOpenChange,
    }: {
      children: React.ReactNode;
      isOpen: boolean;
      onOpenChange: (open: boolean) => void;
    }) => (
      <>
        {isOpen && (
          <div data-testid="modal-overlay" onClick={() => onOpenChange(false)}>
            {children}
          </div>
        )}
      </>
    ),
  };
});

describe('AddToBundleSuiteModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useNavigate as jest.Mock).mockReturnValue(mockNavigate);
    (getListTestSuitesBySearch as jest.Mock).mockResolvedValue({
      data: mockTestSuites,
    });
    (addTestCasesToLogicalTestSuiteBulk as jest.Mock).mockResolvedValue({});
  });

  it('should render modal when open', () => {
    render(<AddToBundleSuiteModal {...mockProps} />);

    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('should not render modal when closed', () => {
    render(<AddToBundleSuiteModal {...mockProps} open={false} />);

    expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
  });

  it('should load bundle suites on mount', () => {
    render(<AddToBundleSuiteModal {...mockProps} />);

    expect(getListTestSuitesBySearch).toHaveBeenCalledWith({
      q: '*',
      limit: 15,
      testSuiteType: 'logical',
      includeEmptyTestSuites: true,
    });
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(<AddToBundleSuiteModal {...mockProps} />);

    const cancelButton = screen.getByTestId('cancel-button');
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should call onCancel when close button is clicked', () => {
    render(<AddToBundleSuiteModal {...mockProps} />);

    const closeButton = screen.getByTestId('close-button');
    fireEvent.click(closeButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should disable add button when no bundle suite is selected', () => {
    render(<AddToBundleSuiteModal {...mockProps} />);

    const addButton = screen.getByTestId('add-button');

    expect(addButton).toBeDisabled();
  });

  it('should disable add button when no test cases are selected', () => {
    const propsWithNoTestCases = {
      ...mockProps,
      selectedTestCases: [],
    };

    render(<AddToBundleSuiteModal {...propsWithNoTestCases} />);

    const addButton = screen.getByTestId('add-button');

    expect(addButton).toBeDisabled();
  });

  it('should call onCancel when add button is clicked with no test cases', async () => {
    const propsWithNoTestCases = {
      ...mockProps,
      selectedTestCases: [],
    };

    render(<AddToBundleSuiteModal {...propsWithNoTestCases} />);

    const addButton = screen.getByTestId('add-button');

    await act(async () => {
      fireEvent.click(addButton);
    });

    expect(mockOnCancel).toHaveBeenCalled();
    expect(addTestCasesToLogicalTestSuiteBulk).not.toHaveBeenCalled();
  });

  it('should enable add button when a bundle suite is selected', async () => {
    render(<AddToBundleSuiteModal {...mockProps} />);

    const selectOptionBtn = await screen.findByTestId(
      'bundle-suite-select-option'
    );

    fireEvent.click(selectOptionBtn);

    const addButton = screen.getByTestId('add-button');

    expect(addButton).not.toBeDisabled();
  });

  it('should call API and handle success flow', async () => {
    render(<AddToBundleSuiteModal {...mockProps} />);

    fireEvent.click(await screen.findByTestId('bundle-suite-select-option'));

    const addButton = screen.getByTestId('add-button');

    await act(async () => {
      fireEvent.click(addButton);
    });

    expect(addTestCasesToLogicalTestSuiteBulk).toHaveBeenCalledWith(
      'suite-1',
      expect.objectContaining({
        includeIds: ['test-1', 'test-2'],
      })
    );

    expect(mockOnAddedToExisting).toHaveBeenCalled();
    expect(mockOnCancel).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalled();
  });

  it('should search bundle suites on input', async () => {
    jest.useFakeTimers();

    render(<AddToBundleSuiteModal {...mockProps} />);

    const input = screen.getByTestId('bundle-suite-select');

    fireEvent.change(input, { target: { value: 'bundle' } });

    // Fast-forward debounce (400ms)
    act(() => {
      jest.advanceTimersByTime(400);
    });

    expect(getListTestSuitesBySearch).toHaveBeenCalledWith(
      expect.objectContaining({
        q: '*bundle*',
      })
    );

    jest.useRealTimers();
  });

  it('should not call API if no suite selected', async () => {
    render(<AddToBundleSuiteModal {...mockProps} />);

    const addButton = screen.getByTestId('add-button');

    await act(async () => {
      fireEvent.click(addButton);
    });

    expect(addTestCasesToLogicalTestSuiteBulk).not.toHaveBeenCalled();
  });

  it('should cancel if no test cases selected', async () => {
    render(<AddToBundleSuiteModal {...mockProps} selectedTestCases={[]} />);

    fireEvent.click(await screen.findByTestId('bundle-suite-select-option'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('add-button'));
    });

    expect(mockOnCancel).toHaveBeenCalled();
    expect(addTestCasesToLogicalTestSuiteBulk).not.toHaveBeenCalled();
  });
});
