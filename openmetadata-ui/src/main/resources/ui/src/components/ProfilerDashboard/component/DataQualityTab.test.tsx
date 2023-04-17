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
  act,
  findByTestId,
  findByText,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { MOCK_TEST_CASE } from 'mocks/TestSuite.mock';
import React from 'react';
import { DataQualityTabProps } from '../profilerDashboard.interface';
import DataQualityTab from './DataQualityTab';

const mockProps: DataQualityTabProps = {
  testCases: MOCK_TEST_CASE,
  onTestUpdate: jest.fn(),
};
const mockPermissionsData = {
  permissions: {
    all: {
      Delete: true,
      EditAll: true,
    },
  },
};
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
jest.mock('../../../hooks/authHooks', () => ({
  useAuth: () => {
    return {
      isAdminUser: mockAuthData.isAdminUser,
    };
  },
}));
jest.mock('components/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => mockPermissionsData,
}));
jest.mock('../../authentication/auth-provider/AuthProvider', () => {
  return {
    useAuthContext: jest.fn(() => ({
      isAuthDisabled: mockAuthData.isAuthDisabled,
    })),
  };
});
jest.mock('../../Loader/Loader', () => {
  return jest.fn().mockImplementation(() => {
    return <span>Loader</span>;
  });
});
jest.mock('../../common/DeleteWidget/DeleteWidgetModal', () => {
  return jest.fn().mockImplementation(({ visible, onCancel }) => {
    return (
      visible && (
        <div>
          DeleteWidgetModal
          <button onClick={onCancel}>cancel</button>
        </div>
      )
    );
  });
});
jest.mock('../../AddDataQualityTest/EditTestCaseModal', () => {
  return jest.fn().mockImplementation(({ visible, onCancel, onUpdate }) => {
    return (
      visible && (
        <div>
          EditTestCaseModal
          <button onClick={onCancel}>cancel</button>
          <button onClick={onUpdate}>submit</button>
        </div>
      )
    );
  });
});
jest.mock('./TestSummary', () => {
  return jest.fn().mockImplementation(() => {
    return <div>TestSummary</div>;
  });
});

describe('DataQualityTab test', () => {
  it('Component should render', async () => {
    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });
    const tableRows = await screen.findAllByRole('row');

    expect(tableRows).toHaveLength(6);
    expect(await screen.findByTestId('data-quality-table')).toBeVisible();
  });

  it('Table header should be visible', async () => {
    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });
    const tableRows = await screen.findAllByRole('row');
    const header = tableRows[0];

    expect(
      await findByText(header, 'label.last-run-result')
    ).toBeInTheDocument();
    expect(await findByText(header, 'label.last-run')).toBeInTheDocument();
    expect(await findByText(header, 'label.name')).toBeInTheDocument();
    expect(await findByText(header, 'label.description')).toBeInTheDocument();
    expect(await findByText(header, 'label.test-suite')).toBeInTheDocument();
    expect(await findByText(header, 'label.table')).toBeInTheDocument();
    expect(await findByText(header, 'label.column')).toBeInTheDocument();
    expect(await findByText(header, 'label.action-plural')).toBeInTheDocument();
  });

  it('Table data should be render as per data props', async () => {
    const firstRowData = MOCK_TEST_CASE[0];
    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });
    const tableRows = await screen.findAllByRole('row');
    const firstRow = tableRows[1];

    const testCaseStatus = await findByTestId(firstRow, 'test-case-status');
    const testName = await findByTestId(firstRow, firstRowData.name);
    const testSuite = await findByTestId(firstRow, 'test-suite-link');
    const tableLink = await findByTestId(firstRow, 'table-link');
    const description = await findByText(
      firstRow,
      firstRowData.description || '--'
    );
    const columnName = await findByText(firstRow, 'last_name');
    const editButton = await findByTestId(
      firstRow,
      `edit-${firstRowData.name}`
    );
    const deleteButton = await findByTestId(
      firstRow,
      `delete-${firstRowData.name}`
    );

    expect(testCaseStatus).toBeInTheDocument();
    expect(testCaseStatus.textContent).toEqual(
      firstRowData.testCaseResult?.testCaseStatus
    );
    expect(testName).toBeInTheDocument();
    expect(description).toBeInTheDocument();
    expect(testSuite).toBeInTheDocument();
    expect(testSuite.textContent).toEqual(firstRowData.testSuite.name);
    expect(tableLink).toBeInTheDocument();
    expect(tableLink.textContent).toEqual('dim_address');
    expect(columnName).toBeInTheDocument();
    expect(editButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
  });

  it('Edit functionality', async () => {
    const firstRowData = MOCK_TEST_CASE[0];
    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });
    const tableRows = await screen.findAllByRole('row');
    const firstRow = tableRows[1];
    const closeEditModel = screen.queryByText('EditTestCaseModal');
    const editButton = await findByTestId(
      firstRow,
      `edit-${firstRowData.name}`
    );

    expect(editButton).toBeInTheDocument();
    expect(closeEditModel).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(editButton);
    });
    const openEditModel = await screen.findByText('EditTestCaseModal');
    const submitBtn = await screen.findByText('submit');

    expect(openEditModel).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(submitBtn);
    });

    expect(mockProps.onTestUpdate).toHaveBeenCalled();
    expect(closeEditModel).not.toBeInTheDocument();
  });

  it('Delete functionality', async () => {
    const firstRowData = MOCK_TEST_CASE[0];
    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });
    const tableRows = await screen.findAllByRole('row');
    const firstRow = tableRows[1];
    const closeDeleteModel = screen.queryByText('DeleteWidgetModal');
    const deleteButton = await findByTestId(
      firstRow,
      `delete-${firstRowData.name}`
    );

    expect(deleteButton).toBeInTheDocument();
    expect(closeDeleteModel).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(deleteButton);
    });
    const openDeleteModel = await screen.findByText('DeleteWidgetModal');
    const cancelBtn = await screen.findByText('cancel');

    expect(openDeleteModel).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(cancelBtn);
    });

    expect(closeDeleteModel).not.toBeInTheDocument();
  });

  it("Edit test case button should be disabled if user doesn't have edit permission", async () => {
    mockPermissionsData.permissions.all.EditAll = false;

    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });

    const editButton = screen.getByTestId('edit-column_values_to_match_regex');

    expect(editButton).toBeDisabled();
  });

  it("Delete test case button should be disabled if user doesn't have delete permission", async () => {
    mockPermissionsData.permissions.all.Delete = false;

    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });

    const deleteButton = screen.getByTestId(
      'delete-column_values_to_match_regex'
    );

    expect(deleteButton).toBeDisabled();
  });
});
