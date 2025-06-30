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
  waitFor,
} from '@testing-library/react';
import { MOCK_PERMISSIONS } from '../../../../mocks/Glossary.mock';
import { MOCK_TEST_CASE } from '../../../../mocks/TestSuite.mock';
import { DEFAULT_ENTITY_PERMISSION } from '../../../../utils/PermissionsUtils';
import { DataQualityTabProps } from '../ProfilerDashboard/profilerDashboard.interface';
import DataQualityTab from './DataQualityTab';

const mockProps: DataQualityTabProps = {
  testCases: MOCK_TEST_CASE,
  onTestUpdate: jest.fn(),
  fetchTestCases: jest.fn(),
};
let mockPermissionsData = MOCK_PERMISSIONS;
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

describe.skip('DataQualityTab test', () => {
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

    expect(await findByText(header, 'label.incident')).toBeInTheDocument();
    expect(await findByText(header, 'label.last-run')).toBeInTheDocument();
    expect(await findByText(header, 'label.name')).toBeInTheDocument();
    expect(await findByText(header, 'label.table')).toBeInTheDocument();
    expect(await findByText(header, 'label.column')).toBeInTheDocument();
    expect(await findByText(header, 'label.action-plural')).toBeInTheDocument();
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
    const editButton = await findByTestId(
      firstRow,
      `edit-${firstRowData.name}`
    );
    const deleteButton = await findByTestId(
      firstRow,
      `delete-${firstRowData.name}`
    );

    expect(testName).toBeInTheDocument();
    expect(tableLink).toBeInTheDocument();
    expect(tableLink.textContent).toEqual(
      'sample_data.ecommerce_db.shopify.dim_address'
    );
    expect(columnName).toBeInTheDocument();
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
          }}
          {...mockProps}
        />
      );
    });
    const tableRows = await screen.findAllByRole('row');
    const firstRow = tableRows[1];
    const closeRemoveModel = screen.queryByText('ConfirmationModal');
    const removeButton = await findByTestId(
      firstRow,
      `remove-${firstRowData.name}`
    );

    expect(removeButton).toBeInTheDocument();
    expect(closeRemoveModel).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(removeButton);
    });
    const openRemoveModel = await screen.findByText('ConfirmationModal');
    const submitBtn = await screen.findByText('submit');

    expect(openRemoveModel).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(submitBtn);

      await waitFor(() => {
        const loader = screen.getByTestId('submit-btn-loading');

        expect(loader).toBeInTheDocument();
      });
    });

    expect(closeRemoveModel).not.toBeInTheDocument();
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
    mockPermissionsData = DEFAULT_ENTITY_PERMISSION;

    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });

    const editButton = screen.getByTestId('edit-column_values_to_match_regex');

    expect(editButton).toBeDisabled();

    mockPermissionsData = MOCK_PERMISSIONS;
  });

  it("Delete test case button should be disabled if user doesn't have delete permission", async () => {
    mockPermissionsData = DEFAULT_ENTITY_PERMISSION;

    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });

    const deleteButton = screen.getByTestId(
      'delete-column_values_to_match_regex'
    );

    expect(deleteButton).toBeDisabled();

    mockPermissionsData = MOCK_PERMISSIONS;
  });

  it('Only Edit test case button should be enabled if isEditAllowed is true', async () => {
    mockPermissionsData = DEFAULT_ENTITY_PERMISSION;

    await act(async () => {
      render(<DataQualityTab isEditAllowed {...mockProps} />);
    });

    const editButton = screen.getByTestId('edit-column_values_to_match_regex');
    const deleteButton = screen.getByTestId(
      'delete-column_values_to_match_regex'
    );

    expect(editButton).not.toBeDisabled();
    expect(deleteButton).toBeDisabled();

    mockPermissionsData = MOCK_PERMISSIONS;
  });
});
