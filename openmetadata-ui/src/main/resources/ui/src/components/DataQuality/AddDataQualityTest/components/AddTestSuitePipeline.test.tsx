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
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { AddTestSuitePipelineProps } from '../AddDataQualityTest.interface';
import AddTestSuitePipeline from './AddTestSuitePipeline';
const mockUseHistory = {
  goBack: jest.fn(),
};
jest.mock('../../../../hooks/useFqn', () => ({
  useFqn: jest.fn().mockReturnValue({ fqn: 'test-suite-fqn' }),
}));
jest.mock('../../AddTestCaseList/AddTestCaseList.component', () => ({
  AddTestCaseList: jest
    .fn()
    .mockImplementation(() => <div>AddTestCaseList.component</div>),
}));
jest.mock('react-router-dom', () => ({
  useHistory: jest.fn().mockImplementation(() => mockUseHistory),
}));

const mockProps: AddTestSuitePipelineProps = {
  isLoading: false,
  onSubmit: jest.fn(),
};

describe('AddTestSuitePipeline', () => {
  it('renders form fields', () => {
    render(<AddTestSuitePipeline {...mockProps} />);

    // Assert that the form fields are rendered
    expect(screen.getByTestId('pipeline-name')).toBeInTheDocument();
    expect(screen.getByTestId('enable-debug-log')).toBeInTheDocument();
    expect(screen.getByTestId('cron-container')).toBeInTheDocument();
    expect(screen.getByTestId('select-all-test-cases')).toBeInTheDocument();
    expect(screen.getByTestId('deploy-button')).toBeInTheDocument();
    expect(screen.getByTestId('cancel')).toBeInTheDocument();
  });

  it('calls onSubmit when submit button is clicked', async () => {
    render(<AddTestSuitePipeline {...mockProps} />);

    fireEvent.change(screen.getByTestId('pipeline-name'), {
      target: { value: 'Test Suite pipeline' },
    });
    await act(async () => {
      await fireEvent.click(screen.getByTestId('enable-debug-log'));
    });
    await act(async () => {
      await fireEvent.click(screen.getByTestId('select-all-test-cases'));
    });
    await act(async () => {
      await fireEvent.click(screen.getByTestId('deploy-button'));
    });

    // Assert that onSubmit is called with the correct values
    expect(mockProps.onSubmit).toHaveBeenCalledWith({
      enableDebugLog: true,
      name: 'Test Suite pipeline',
      period: '',
      repeatFrequency: undefined,
      selectAllTestCases: true,
      testCases: undefined,
    });
  });

  it('calls onCancel when cancel button is clicked and onCancel button is provided', async () => {
    const mockOnCancel = jest.fn();
    render(<AddTestSuitePipeline {...mockProps} onCancel={mockOnCancel} />);

    await act(async () => {
      await fireEvent.click(screen.getByTestId('cancel'));
    });

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('calls history.goBack when cancel button is clicked and onCancel button is not provided', async () => {
    render(<AddTestSuitePipeline {...mockProps} />);

    await act(async () => {
      await fireEvent.click(screen.getByTestId('cancel'));
    });

    expect(mockUseHistory.goBack).toHaveBeenCalled();
  });

  it('Hide AddTestCaseList after clicking on select-all-test-cases switch', async () => {
    render(<AddTestSuitePipeline {...mockProps} />);

    // Assert that AddTestCaseList.component is now visible
    expect(screen.getByText('AddTestCaseList.component')).toBeInTheDocument();

    // Click on the select-all-test-cases switch
    await act(async () => {
      await fireEvent.click(screen.getByTestId('select-all-test-cases'));
    });

    // Assert that AddTestCaseList.component is not initially visible
    expect(screen.queryByText('AddTestCaseList.component')).toBeNull();
  });

  it('renders with initial data', () => {
    const initialData = {
      enableDebugLog: true,
      name: 'Initial Test Suite',
      repeatFrequency: '* 0 0 0',
      selectAllTestCases: true,
      testCases: ['test-case-1', 'test-case-2'],
    };

    render(<AddTestSuitePipeline {...mockProps} initialData={initialData} />);

    // Assert that the form fields are rendered with the initial data
    expect(screen.getByTestId('pipeline-name')).toHaveValue(initialData.name);
    expect(screen.getByTestId('enable-debug-log')).toBeChecked();
    expect(screen.getByTestId('select-all-test-cases')).toBeChecked();
    expect(screen.getByTestId('deploy-button')).toBeInTheDocument();
    expect(screen.getByTestId('cancel')).toBeInTheDocument();
  });

  it('testCases removal should work', async () => {
    const initialData = {
      enableDebugLog: true,
      name: 'Initial Test Suite',
      repeatFrequency: '* 0 0 0',
      selectAllTestCases: false,
      testCases: ['test-case-1', 'test-case-2'],
    };

    render(<AddTestSuitePipeline {...mockProps} initialData={initialData} />);

    await act(async () => {
      await fireEvent.click(screen.getByTestId('select-all-test-cases'));
    });

    expect(screen.queryByText('AddTestCaseList.component')).toBeNull();

    await act(async () => {
      await fireEvent.click(screen.getByTestId('deploy-button'));
    });

    // Assert that onSubmit is called with the initial data
    expect(mockProps.onSubmit).toHaveBeenCalledWith({
      ...initialData,
      period: '',
      selectAllTestCases: true,
      testCases: undefined,
    });
  });
});
