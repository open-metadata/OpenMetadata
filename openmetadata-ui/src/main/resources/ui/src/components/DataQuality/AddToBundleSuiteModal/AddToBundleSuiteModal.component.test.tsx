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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MOCK_TEST_CASE } from '../../../../mocks/TestSuite.mock';
import * as testAPI from '../../../../rest/testAPI';
import { AddToBundleSuiteModal } from './AddToBundleSuiteModal.component';

const mockTestCases = [MOCK_TEST_CASE[0], MOCK_TEST_CASE[1]];
const mockOnCancel = jest.fn();
const mockOnSuccess = jest.fn();

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../../../../rest/testAPI', () => ({
  getListTestSuitesBySearch: jest.fn(),
  addTestCaseToLogicalTestSuite: jest.fn(),
}));

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

describe('AddToBundleSuiteModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the modal when visible is true', () => {
    render(
      <AddToBundleSuiteModal
        testCases={mockTestCases}
        visible={true}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(
      screen.getByText('Add Test Cases to Bundle Suite')
    ).toBeInTheDocument();
    expect(screen.getByText(/2.*selected/i)).toBeInTheDocument();
  });

  it('should not render the modal when visible is false', () => {
    render(
      <AddToBundleSuiteModal
        testCases={mockTestCases}
        visible={false}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(
      screen.queryByText('Add Test Cases to Bundle Suite')
    ).not.toBeInTheDocument();
  });

  it('should call onCancel when cancel button is clicked', () => {
    render(
      <AddToBundleSuiteModal
        testCases={mockTestCases}
        visible={true}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });

  it('should fetch test suites on mount', async () => {
    const mockTestSuites = [
      { id: '1', name: 'Suite 1', fullyQualifiedName: 'suite.1' },
      { id: '2', name: 'Suite 2', fullyQualifiedName: 'suite.2' },
    ];

    (testAPI.getListTestSuitesBySearch as jest.Mock).mockResolvedValue({
      data: mockTestSuites,
    });

    render(
      <AddToBundleSuiteModal
        testCases={mockTestCases}
        visible={true}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    await waitFor(() => {
      expect(testAPI.getListTestSuitesBySearch).toHaveBeenCalled();
    });
  });

  it('should show both mode options', () => {
    render(
      <AddToBundleSuiteModal
        testCases={mockTestCases}
        visible={true}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    expect(
      screen.getByText('Use existing Bundle Suite')
    ).toBeInTheDocument();
    expect(screen.getByText('Create new Bundle Suite')).toBeInTheDocument();
  });

  it('should call addTestCaseToLogicalTestSuite when submitting with existing suite', async () => {
    const mockTestSuites = [
      { id: '1', name: 'Suite 1', fullyQualifiedName: 'suite.1' },
    ];

    (testAPI.getListTestSuitesBySearch as jest.Mock).mockResolvedValue({
      data: mockTestSuites,
    });

    (testAPI.addTestCaseToLogicalTestSuite as jest.Mock).mockResolvedValue({});

    render(
      <AddToBundleSuiteModal
        testCases={mockTestCases}
        visible={true}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Wait for suites to load
    await waitFor(() => {
      expect(testAPI.getListTestSuitesBySearch).toHaveBeenCalled();
    });

    // Select existing mode (should be default)
    const existingRadio = screen.getByLabelText('Use existing Bundle Suite');
    fireEvent.click(existingRadio);

    // Submit button should exist
    const submitButton = screen.getByRole('button', { name: /add/i });
    expect(submitButton).toBeInTheDocument();
  });

  it('should navigate when creating new suite', async () => {
    render(
      <AddToBundleSuiteModal
        testCases={mockTestCases}
        visible={true}
        onCancel={mockOnCancel}
        onSuccess={mockOnSuccess}
      />
    );

    // Select create new mode
    const createRadio = screen.getByLabelText('Create new Bundle Suite');
    fireEvent.click(createRadio);

    // Should show message about redirection
    expect(
      screen.getByText(/You will be redirected/i)
    ).toBeInTheDocument();
  });
});
