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
import React, { act } from 'react';
import { TestCaseStatus } from '../../../../generated/tests/testCase';
import { MOCK_PERMISSIONS } from '../../../../mocks/Glossary.mock';
import { MOCK_TEST_CASE } from '../../../../mocks/TestSuite.mock';
import { DataQualityTabProps } from '../ProfilerDashboard/profilerDashboard.interface';
import DataQualityTab from './DataQualityTab';

// Context for dropdown and sort state in mocks
const DropdownContext = React.createContext<{
  isOpen: boolean;
  onOpenChange?: (isOpen: boolean) => void;
}>({ isOpen: false });

const SortContext = React.createContext<{
  sortDescriptor?: { column?: string; direction?: string };
  onSortChange?: (desc: {
    column?: string;
    direction?: 'ascending' | 'descending';
  }) => void;
}>({});

jest.mock('@openmetadata/ui-core-components', () => {
  const DropdownRoot = ({
    children,
    isOpen = false,
    onOpenChange,
  }: React.PropsWithChildren<{
    isOpen?: boolean;
    onOpenChange?: (isOpen: boolean) => void;
  }>) => (
    <DropdownContext.Provider value={{ isOpen, onOpenChange }}>
      {children}
    </DropdownContext.Provider>
  );

  const DropdownPopover = ({ children }: React.PropsWithChildren) => {
    const { isOpen } = React.useContext(DropdownContext);

    return isOpen ? <div>{children}</div> : null;
  };

  const DropdownMenu = ({
    items,
    children,
  }: {
    items: unknown[];
    children: (item: unknown) => React.ReactNode;
  }) => <div>{(items || []).map((item) => children(item))}</div>;

  const DropdownItem = ({
    'data-testid': testId,
    label,
    onAction,
    isDisabled,
  }: {
    'data-testid'?: string;
    label?: string;
    onAction?: () => void;
    isDisabled?: boolean;
  }) => (
    <button data-testid={testId} disabled={isDisabled} onClick={onAction}>
      {label}
    </button>
  );

  const MockButton = ({
    children,
    onClick,
    'data-testid': testId,
    isDisabled,
  }: React.PropsWithChildren<{
    onClick?: React.MouseEventHandler;
    'data-testid'?: string;
    isDisabled?: boolean;
    [key: string]: unknown;
  }>) => {
    const { onOpenChange, isOpen } = React.useContext(DropdownContext);
    const handleClick = (e: React.MouseEvent) => {
      onOpenChange?.(!isOpen);
      onClick?.(e);
    };

    return (
      <button data-testid={testId} disabled={isDisabled} onClick={handleClick}>
        {children}
      </button>
    );
  };

  const MockTableHead = ({
    label,
    id,
    allowsSorting,
  }: {
    label?: string;
    id?: string;
    allowsSorting?: boolean;
  }) => {
    const { onSortChange, sortDescriptor } = React.useContext(SortContext);
    const handleClick = () => {
      if (!allowsSorting || !onSortChange) {
        return;
      }
      const currentDir =
        sortDescriptor?.column === id ? sortDescriptor?.direction : undefined;
      const newDir = currentDir === 'ascending' ? 'descending' : 'ascending';
      onSortChange({ column: id, direction: newDir });
    };

    return (
      <th id={id} onClick={handleClick}>
        {label}
      </th>
    );
  };

  const MockTable = ({
    children,
    'data-testid': testId,
    onSortChange,
    sortDescriptor,
  }: React.PropsWithChildren<{
    'data-testid'?: string;
    onSortChange?: (desc: {
      column?: string;
      direction?: 'ascending' | 'descending';
    }) => void;
    sortDescriptor?: { column?: string; direction?: string };
    [key: string]: unknown;
  }>) => (
    <SortContext.Provider value={{ sortDescriptor, onSortChange }}>
      <table data-testid={testId}>{children}</table>
    </SortContext.Provider>
  );

  MockTable.Header = ({
    columns,
    children,
  }: {
    columns: unknown[];
    children: (col: unknown) => React.ReactNode;
  }) => (
    <thead>
      <tr>{(columns || []).map((col) => children(col))}</tr>
    </thead>
  );

  MockTable.Head = MockTableHead;

  MockTable.Body = ({
    items,
    children,
    renderEmptyState,
  }: {
    items?: unknown[];
    children: (item: unknown) => React.ReactNode;
    renderEmptyState?: () => React.ReactNode;
    dependencies?: unknown[];
  }) => (
    <tbody>
      {items && items.length > 0
        ? items.map((item) => children(item))
        : renderEmptyState?.()}
    </tbody>
  );

  MockTable.Row = ({
    children,
    id,
  }: React.PropsWithChildren<{ id?: string }>) => <tr id={id}>{children}</tr>;

  MockTable.Cell = ({
    children,
    className,
  }: React.PropsWithChildren<{ className?: string }>) => (
    <td className={className}>{children}</td>
  );

  const MockBox = ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div {...props}>{children}</div>
  );

  return {
    Box: MockBox,
    Button: MockButton,
    Skeleton: () => <span data-testid="skeleton">Loading...</span>,
    Table: MockTable,
    Tooltip: ({
      children,
      title,
    }: React.PropsWithChildren<{ title?: string }>) => (
      <div title={title}>{children}</div>
    ),
    TooltipTrigger: ({ children }: React.PropsWithChildren) => <>{children}</>,
    Typography: ({
      children,
      className,
      ...props
    }: React.PropsWithChildren<{ className?: string }>) => (
      <span className={className} {...props}>
        {children}
      </span>
    ),
    Dropdown: {
      Root: DropdownRoot,
      Popover: DropdownPopover,
      Menu: DropdownMenu,
      Item: DropdownItem,
    },
  };
});

jest.mock('../../../../rest/incidentManagerAPI', () => ({
  getListTestCaseIncidentByStateId: jest.fn().mockResolvedValue({ data: [] }),
}));

jest.mock('../../../../rest/testAPI', () => ({
  removeTestCaseFromTestSuite: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../../common/NextPrevious/NextPrevious', () =>
  jest.fn().mockImplementation(() => <div data-testid="next-previous" />)
);

jest.mock(
  '../../../common/ErrorWithPlaceholder/FilterTablePlaceHolder',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(() => <div data-testid="filter-table-placeholder" />),
  })
);

jest.mock(
  '../../../DataQuality/IncidentManager/TestCaseStatus/TestCaseIncidentManagerStatus.component',
  () =>
    jest
      .fn()
      .mockImplementation(() => <div data-testid="incident-manager-status" />)
);

jest.mock(
  '../../../DataQuality/AddToBundleSuiteModal/AddToBundleSuiteModal.component',
  () =>
    jest
      .fn()
      .mockImplementation(({ open }) =>
        open ? <div data-testid="add-to-bundle-suite-modal" /> : null
      )
);

jest.mock('../../../DataQuality/BundleSuiteForm/BundleSuiteForm', () =>
  jest.fn().mockImplementation(() => <div data-testid="bundle-suite-form" />)
);

jest.mock('../../../common/StatusBadge/StatusBadge.component', () =>
  jest
    .fn()
    .mockImplementation(({ dataTestId, label }) => (
      <span data-testid={dataTestId}>{label}</span>
    ))
);

jest.mock('../../../common/DateTimeDisplay/DateTimeDisplay', () =>
  jest.fn().mockImplementation(() => <span data-testid="date-time-display" />)
);

const mockProps: DataQualityTabProps = {
  testCases: MOCK_TEST_CASE,
  onTestUpdate: jest.fn(),
  fetchTestCases: jest.fn(),
};
const mockPermissionsData = MOCK_PERMISSIONS;
const mockNavigateDataQualityTab = jest.fn();

jest.mock('react-router-dom', () => {
  const actual =
    jest.requireActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    Link: jest
      .fn()
      .mockImplementation(({ children, ...rest }) => (
        <span {...rest}>{children}</span>
      )),
    useNavigate: () => mockNavigateDataQualityTab,
  };
});

jest.mock('../../../../hooks/authHooks', () => ({
  useAuth: () => ({
    isAdminUser: true,
  }),
}));

jest.mock('../../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getEntityPermissionByFqn: jest
      .fn()
      .mockImplementation(() => mockPermissionsData),
  }),
}));

jest.mock('../../../common/Loader/Loader', () =>
  jest.fn().mockImplementation(() => <span>Loader</span>)
);

jest.mock('../../../common/DeleteWidget/DeleteWidgetModal', () =>
  jest.fn().mockImplementation(({ visible, onCancel }) =>
    visible ? (
      <div>
        <p>DeleteWidgetModal</p>
        <button onClick={onCancel}>cancel</button>
      </div>
    ) : null
  )
);

jest.mock(
  '../../../DataQuality/AddDataQualityTest/components/EditTestCaseModalV1',
  () =>
    jest.fn().mockImplementation(({ open, onCancel, onUpdate }) =>
      open ? (
        <div>
          <p>EditTestCaseModal</p>
          <button onClick={onCancel}>cancel</button>
          <button onClick={onUpdate}>submit</button>
        </div>
      ) : null
    )
);

jest.mock('../../../Modals/ConfirmationModal/ConfirmationModal', () =>
  jest.fn().mockImplementation(({ visible, onCancel, onConfirm, isLoading }) =>
    visible ? (
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
    ) : null
  )
);

describe('DataQualityTab test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  it('Should not render table column header when showTableColumn is false', async () => {
    await act(async () => {
      render(<DataQualityTab {...mockProps} showTableColumn={false} />);
    });
    const tableRows = await screen.findAllByRole('row');
    const header = tableRows[0];

    expect(await findByText(header, 'label.name')).toBeInTheDocument();
    expect(screen.queryByText('label.table')).not.toBeInTheDocument();
  });

  it('Should send API request with sort params on click of last-run (ascending then descending)', async () => {
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
  });

  it('Should send API request with sort params on click of name (ascending then descending)', async () => {
    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });
    const tableRows = await screen.findAllByRole('row');
    const header = tableRows[0];
    const nameHeader = await findByText(header, 'label.name');

    expect(nameHeader).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(nameHeader);
    });

    expect(mockProps.fetchTestCases).toHaveBeenCalledWith({
      sortField: 'name.keyword',
      sortType: 'asc',
    });

    await act(async () => {
      fireEvent.click(nameHeader);
    });

    expect(mockProps.fetchTestCases).toHaveBeenCalledWith({
      sortField: 'name.keyword',
      sortType: 'desc',
    });
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

  it('Should show loading skeletons when isLoading is true', async () => {
    await act(async () => {
      render(<DataQualityTab {...mockProps} isLoading />);
    });

    const skeletons = await screen.findAllByTestId('skeleton');

    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('Should show empty placeholder when testCases is empty', async () => {
    await act(async () => {
      render(<DataQualityTab {...mockProps} testCases={[]} />);
    });

    expect(
      await screen.findByTestId('filter-table-placeholder')
    ).toBeInTheDocument();
  });

  it('Should show NextPrevious when pagingData and showPagination are provided', async () => {
    const pagingData = {
      paging: { total: 50 },
      currentPage: 1,
      pageSize: 10,
      pagingHandler: jest.fn(),
    };
    await act(async () => {
      render(
        <DataQualityTab
          {...mockProps}
          showPagination
          pagingData={pagingData as never}
        />
      );
    });

    expect(await screen.findByTestId('next-previous')).toBeInTheDocument();
  });

  it('Should not show NextPrevious when showPagination is false', async () => {
    const pagingData = {
      paging: { total: 50 },
      currentPage: 1,
      pageSize: 10,
      pagingHandler: jest.fn(),
    };
    await act(async () => {
      render(
        <DataQualityTab
          {...mockProps}
          pagingData={pagingData as never}
          showPagination={false}
        />
      );
    });

    expect(screen.queryByTestId('next-previous')).not.toBeInTheDocument();
  });

  it('Should stop click propagation from interactive cell wrappers', async () => {
    await act(async () => {
      render(<DataQualityTab {...mockProps} />);
    });

    const documentClick = jest.fn();
    document.body.addEventListener('click', documentClick);

    // A click inside the name cell wrapper must not bubble up to the row.
    fireEvent.click(screen.getByTestId('column_values_to_match_regex'));

    expect(documentClick).not.toHaveBeenCalled();

    // Sanity check: a cell without the wrapper lets the click bubble.
    fireEvent.click(
      screen.getByTestId('status-badge-column_values_to_match_regex')
    );

    expect(documentClick).toHaveBeenCalled();

    document.body.removeEventListener('click', documentClick);
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
