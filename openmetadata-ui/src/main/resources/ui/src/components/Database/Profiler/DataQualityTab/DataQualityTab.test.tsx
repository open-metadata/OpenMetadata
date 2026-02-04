/*
 *  Copyright 2023 Collate.
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
  findByTestId,
  findByText,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { act } from 'react';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { MOCK_PERMISSIONS } from '../../../../mocks/Glossary.mock';
import { MOCK_TEST_CASE } from '../../../../mocks/TestSuite.mock';
import { DataQualityTabProps } from '../ProfilerDashboard/profilerDashboard.interface';
import DataQualityTab from './DataQualityTab';

const mockProps: DataQualityTabProps = {
  testCases: MOCK_TEST_CASE,
  onTestUpdate: jest.fn(),
  fetchTestCases: jest.fn(),
};
const mockPermissionsData = MOCK_PERMISSIONS;
const mockAuthData = {
  isAdminUser: true,
  isAuthDisabled: false,
};
jest.mock('react-router-dom', () => ({
  Link: jest
    .fn()
    .mockImplementation(({ children, ...rest }) => (
      <span {...rest}>{children}</span>
    )),
}));
jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: () => {
    return {
      isAdminUser: mockAuthData.isAdminUser,
    };
  },
}));
jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getEntityPermissionByFqn: jest
      .fn()
      .mockImplementation(() => mockPermissionsData),
  }),
}));
jest.mock('../../../common/Loader/Loader', () => {
  return jest.fn().mockImplementation(() => {
    return <span>Loader</span>;
  });
});
jest.mock('../../../common/DeleteWidget/DeleteWidgetModal', () => {
  return jest.fn().mockImplementation(({ visible, onCancel }) => {
    return (
      visible && (
        <div>
          <p>DeleteWidgetModal</p>
          <button onClick={onCancel}>cancel</button>
        </div>
      )
    );
  });
});
jest.mock('../../../DataQuality/AddDataQualityTest/EditTestCaseModal', () => {
  return jest.fn().mockImplementation(({ visible, onCancel, onUpdate }) => {
    return (
      visible && (
        <div>
          <p>EditTestCaseModal</p>
          <button onClick={onCancel}>cancel</button>
          <button onClick={onUpdate}>submit</button>
        </div>
      )
    );
  });
});
jest.mock('../../../Modals/ConfirmationModal/ConfirmationModal', () => {
  return jest
    .fn()
    .mockImplementation(({ visible, onCancel, onConfirm, isLoading }) => {
      return (
        visible && (
          <div>
            <p>ConfirmationModal</p>
            <button onClick={onCancel}>cancel</button>
            <button onClick={onConfirm}>
              {isLoading ? (
                <span data-testid="submit-btn-loading">Loading</span>
              ) : (
                ''
              )}
              submit
            </button>
          </div>
        )
      );
    });
});

describe('DataQualityTab test', () => {
  it('Component should render', async () => {
    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });
    const tableRows = await screen.findAllByRole('row');

    expect(tableRows).toHaveLength(6);
    expect(await screen.findByTestId('test-case-table')).toBeVisible();
  });

  it('Table header should be visible', async () => {
    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });
    const tableRows = await screen.findAllByRole('row');
    const header = tableRows[0];

    expect(await findByText(header, 'label.status')).toBeInTheDocument();
    expect(
      await findByText(header, 'label.failed-slash-aborted-reason')
    ).toBeInTheDocument();
    expect(await findByText(header, 'label.last-run')).toBeInTheDocument();
    expect(await findByText(header, 'label.name')).toBeInTheDocument();
    expect(await findByText(header, 'label.table')).toBeInTheDocument();
    expect(await findByText(header, 'label.column')).toBeInTheDocument();
    expect(await findByText(header, 'label.incident')).toBeInTheDocument();
  });

  it('Should send API request with sort params on click of last-run', async () => {
    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });
    const tableRows = await screen.findAllByRole('row');
    const header = tableRows[0];
    const lastRunHeader = await findByText(header, 'label.last-run');

    expect(lastRunHeader).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(lastRunHeader);
    });

    expect(mockProps.fetchTestCases).toHaveBeenCalledWith({
      sortField: 'testCaseResult.timestamp',
      sortType: 'asc',
    });

    await act(async () => {
      fireEvent.click(lastRunHeader);
    });

    expect(mockProps.fetchTestCases).toHaveBeenCalledWith({
      sortField: 'testCaseResult.timestamp',
      sortType: 'desc',
    });

    await act(async () => {
      fireEvent.click(lastRunHeader);
    });

    expect(mockProps.fetchTestCases).toHaveBeenCalledWith(undefined);
  });

  it('Should send API request with sort params on click of name', async () => {
    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });
    const tableRows = await screen.findAllByRole('row');
    const header = tableRows[0];
    const lastRunHeader = await findByText(header, 'label.name');

    expect(lastRunHeader).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(lastRunHeader);
    });

    expect(mockProps.fetchTestCases).toHaveBeenCalledWith({
      sortField: 'name.keyword',
      sortType: 'asc',
    });

    await act(async () => {
      fireEvent.click(lastRunHeader);
    });

    expect(mockProps.fetchTestCases).toHaveBeenCalledWith({
      sortField: 'name.keyword',
      sortType: 'desc',
    });

    await act(async () => {
      fireEvent.click(lastRunHeader);
    });

    expect(mockProps.fetchTestCases).toHaveBeenCalledWith(undefined);
  });

  it('Table data should be render as per data props', async () => {
    const firstRowData = MOCK_TEST_CASE[0];
    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });
    const tableRows = await screen.findAllByRole('row');
    const firstRow = tableRows[1];

    const testName = await findByTestId(firstRow, firstRowData.name);
    const tableLink = await findByTestId(firstRow, 'table-link');
    const columnName = await findByText(firstRow, 'last_name');
    const actionDropdown = await findByTestId(
      firstRow,
      `action-dropdown-${firstRowData.name}`
    );

    expect(testName).toBeInTheDocument();
    expect(tableLink).toBeInTheDocument();
    expect(tableLink.textContent).toEqual(
      'sample_data.ecommerce_db.shopify.dim_address'
    );
    expect(columnName).toBeInTheDocument();
    expect(actionDropdown).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(actionDropdown);
    });

    const editButton = await screen.findByTestId(`edit-${firstRowData.name}`);
    const deleteButton = await screen.findByTestId(
      `delete-${firstRowData.name}`
    );

    expect(editButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
  });

  it('Remove functionality', async () => {
    const firstRowData = MOCK_TEST_CASE[0];
    await act(async () => {
      render(
        <DataQualityTab
          removeFromTestSuite={{
            testSuite: {
              id: 'testSuiteId',
              name: 'testSuiteName',
            },
            isAllowed: true,
          }}
          {...mockProps}
        />
      );
    });
    const tableRows = await screen.findAllByRole('row');
    const firstRow = tableRows[1];
    const closeRemoveModel = screen.queryByText('ConfirmationModal');
    const actionDropdown = await findByTestId(
      firstRow,
      `action-dropdown-${firstRowData.name}`
    );

    expect(actionDropdown).toBeInTheDocument();
    expect(closeRemoveModel).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(actionDropdown);
    });

    const removeButton = await screen.findByTestId(
      `remove-${firstRowData.name}`
    );

    expect(removeButton).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(removeButton);
    });
    const openRemoveModel = await screen.findByText('ConfirmationModal');

    expect(openRemoveModel).toBeInTheDocument();
  });

  it('Edit functionality - menu item is accessible', async () => {
    const firstRowData = MOCK_TEST_CASE[0];
    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });
    const tableRows = await screen.findAllByRole('row');
    const firstRow = tableRows[1];
    const actionDropdown = await findByTestId(
      firstRow,
      `action-dropdown-${firstRowData.name}`
    );

    expect(actionDropdown).toBeInTheDocument();
    expect(actionDropdown).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(actionDropdown);
    });

    const editButton = await screen.findByTestId(`edit-${firstRowData.name}`);

    expect(editButton).toBeInTheDocument();
    expect(editButton).not.toBeDisabled();
  });

  it('Delete functionality - menu item is accessible', async () => {
    const firstRowData = MOCK_TEST_CASE[0];
    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });
    const tableRows = await screen.findAllByRole('row');
    const firstRow = tableRows[1];
    const actionDropdown = await findByTestId(
      firstRow,
      `action-dropdown-${firstRowData.name}`
    );

    expect(actionDropdown).toBeInTheDocument();
    expect(actionDropdown).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(actionDropdown);
    });

    const deleteButton = await screen.findByTestId(
      `delete-${firstRowData.name}`
    );

    expect(deleteButton).toBeInTheDocument();
    expect(deleteButton).not.toBeDisabled();
  });

  it('Edit button should be enabled when isEditAllowed is true', async () => {
    const firstRowData = MOCK_TEST_CASE[0];
    await act(async () => {
      render(<DataQualityTab isEditAllowed {...mockProps} />);
    });

    const tableRows = await screen.findAllByRole('row');
    const firstRow = tableRows[1];
    const actionDropdown = await findByTestId(
      firstRow,
      `action-dropdown-${firstRowData.name}`
    );

    expect(actionDropdown).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(actionDropdown);
    });

    const editButton = await screen.findByTestId(`edit-${firstRowData.name}`);

    expect(editButton).toBeInTheDocument();
    expect(editButton).not.toBeDisabled();
  });

  it('Remove button should be visible when removeFromTestSuite.isAllowed is true', async () => {
    const firstRowData = MOCK_TEST_CASE[0];
    await act(async () => {
      render(
        <DataQualityTab
          removeFromTestSuite={{
            testSuite: {
              id: 'testSuiteId',
              name: 'testSuiteName',
            },
            isAllowed: true,
          }}
          {...mockProps}
        />
      );
    });

    const tableRows = await screen.findAllByRole('row');
    const firstRow = tableRows[1];
    const actionDropdown = await findByTestId(
      firstRow,
      `action-dropdown-${firstRowData.name}`
    );

    await act(async () => {
      fireEvent.click(actionDropdown);
    });

    const removeButton = await screen.findByTestId(
      `remove-${firstRowData.name}`
    );

    expect(removeButton).toBeInTheDocument();
    expect(removeButton).not.toBeDisabled();
  });

  it('Should display failed reason tooltip for failed test cases', async () => {
    const failedTestCase = MOCK_TEST_CASE[0];
    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });

    const reasonText = await screen.findByTestId(
      `reason-text-${failedTestCase.name}`
    );

    expect(reasonText).toBeInTheDocument();
    expect(reasonText).toHaveTextContent(
      'Found 99 value(s) matching regex pattern vs 99 value(s) in the column.'
    );
  });

  it('Should show "--" for successful test cases (no error reason)', async () => {
    const successTestCase = {
      ...MOCK_TEST_CASE[0],
      name: 'success_test_case',
      testCaseResult: {
        timestamp: 1677046336,
        testCaseStatus: TestCaseStatus.Success,
        result: undefined,
      },
    };

    await act(async () => {
      render(<DataQualityTab {...mockProps} testCases={[successTestCase]} />);
    });

    const tableRows = await screen.findAllByRole('row');
    const firstRow = tableRows[1];

    expect(
      screen.queryByTestId(`reason-text-${successTestCase.name}`)
    ).not.toBeInTheDocument();
    expect(firstRow.textContent).toContain('--');
  });

  it('Should show "--" when testCaseResult is undefined', async () => {
    const testCaseWithNoResult = {
      ...MOCK_TEST_CASE[0],
      name: 'no_result_test_case',
      testCaseResult: undefined,
    };

    await act(async () => {
      render(
        <DataQualityTab {...mockProps} testCases={[testCaseWithNoResult]} />
      );
    });

    const tableRows = await screen.findAllByRole('row');
    const firstRow = tableRows[1];

    expect(
      screen.queryByTestId(`reason-text-${testCaseWithNoResult.name}`)
    ).not.toBeInTheDocument();
    expect(firstRow.textContent).toContain('--');
  });

  it('Should display aborted reason tooltip for aborted test cases', async () => {
    const abortedTestCase = {
      ...MOCK_TEST_CASE[0],
      name: 'aborted_test_case',
      testCaseResult: {
        timestamp: 1677046336,
        testCaseStatus: TestCaseStatus.Aborted,
        result: 'Test execution was aborted due to timeout',
      },
    };

    await act(async () => {
      render(<DataQualityTab {...mockProps} testCases={[abortedTestCase]} />);
    });

    const reasonText = await screen.findByTestId(
      `reason-text-${abortedTestCase.name}`
    );

    expect(reasonText).toBeInTheDocument();
    expect(reasonText).toHaveTextContent(
      'Test execution was aborted due to timeout'
    );
  });

  it('Should use result.testCaseStatus not record.testCaseStatus for conditional rendering', async () => {
    const testCaseWithMismatchedStatus = {
      ...MOCK_TEST_CASE[0],
      name: 'mismatched_status_test',
      testCaseStatus: TestCaseStatus.Success,
      testCaseResult: {
        timestamp: 1677046336,
        testCaseStatus: TestCaseStatus.Failed,
        result:
          'This error should be displayed because result status is Failed',
      },
    };

    await act(async () => {
      render(
        <DataQualityTab
          {...mockProps}
          testCases={[testCaseWithMismatchedStatus]}
        />
      );
    });

    const reasonText = await screen.findByTestId(
      `reason-text-${testCaseWithMismatchedStatus.name}`
    );

    expect(reasonText).toBeInTheDocument();
    expect(reasonText).toHaveTextContent(
      'This error should be displayed because result status is Failed'
    );
  });

  it('Should show "--" when result exists but testCaseStatus is Success', async () => {
    const successWithResult = {
      ...MOCK_TEST_CASE[0],
      name: 'success_with_result',
      testCaseResult: {
        timestamp: 1677046336,
        testCaseStatus: TestCaseStatus.Success,
        result: 'This should not be displayed for successful tests',
      },
    };

    await act(async () => {
      render(<DataQualityTab {...mockProps} testCases={[successWithResult]} />);
    });

    expect(
      screen.queryByTestId(`reason-text-${successWithResult.name}`)
    ).not.toBeInTheDocument();
  });

  it('Should display result for Queued status when result is present', async () => {
    const queuedTestCase = {
      ...MOCK_TEST_CASE[0],
      name: 'queued_test_case',
      testCaseResult: {
        timestamp: 1677046336,
        testCaseStatus: TestCaseStatus.Queued,
        result: 'Test is queued for execution',
      },
    };

    await act(async () => {
      render(<DataQualityTab {...mockProps} testCases={[queuedTestCase]} />);
    });

    const reasonText = await screen.findByTestId(
      `reason-text-${queuedTestCase.name}`
    );

    expect(reasonText).toBeInTheDocument();
    expect(reasonText).toHaveTextContent('Test is queued for execution');
  });

  it('Should NOT display result for Success status even when result text exists', async () => {
    const successTestCases = [
      {
        ...MOCK_TEST_CASE[0],
        name: 'success_case_1',
        testCaseResult: {
          timestamp: 1677046336,
          testCaseStatus: TestCaseStatus.Success,
          result: 'Should not be visible',
        },
      },
      {
        ...MOCK_TEST_CASE[0],
        name: 'success_case_2',
        testCaseResult: {
          timestamp: 1677046336,
          testCaseStatus: TestCaseStatus.Success,
          result: 'Also should not be visible',
        },
      },
    ];

    await act(async () => {
      render(<DataQualityTab {...mockProps} testCases={successTestCases} />);
    });

    expect(
      screen.queryByTestId('reason-text-success_case_1')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('reason-text-success_case_2')
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Should not be visible')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Also should not be visible')
    ).not.toBeInTheDocument();
  });

  it('Should ALWAYS display result for non-Success statuses when result is present', async () => {
    const nonSuccessTestCases = [
      {
        ...MOCK_TEST_CASE[0],
        name: 'failed_case',
        testCaseResult: {
          timestamp: 1677046336,
          testCaseStatus: TestCaseStatus.Failed,
          result: 'Failed: Column validation error',
        },
      },
      {
        ...MOCK_TEST_CASE[0],
        name: 'aborted_case',
        testCaseResult: {
          timestamp: 1677046336,
          testCaseStatus: TestCaseStatus.Aborted,
          result: 'Aborted: Timeout exceeded',
        },
      },
      {
        ...MOCK_TEST_CASE[0],
        name: 'queued_case',
        testCaseResult: {
          timestamp: 1677046336,
          testCaseStatus: TestCaseStatus.Queued,
          result: 'Queued: Waiting for execution',
        },
      },
    ];

    await act(async () => {
      render(<DataQualityTab {...mockProps} testCases={nonSuccessTestCases} />);
    });

    const failedReason = await screen.findByTestId('reason-text-failed_case');
    const abortedReason = await screen.findByTestId('reason-text-aborted_case');
    const queuedReason = await screen.findByTestId('reason-text-queued_case');

    expect(failedReason).toBeInTheDocument();
    expect(failedReason).toHaveTextContent('Failed: Column validation error');

    expect(abortedReason).toBeInTheDocument();
    expect(abortedReason).toHaveTextContent('Aborted: Timeout exceeded');

    expect(queuedReason).toBeInTheDocument();
    expect(queuedReason).toHaveTextContent('Queued: Waiting for execution');
  });
});
