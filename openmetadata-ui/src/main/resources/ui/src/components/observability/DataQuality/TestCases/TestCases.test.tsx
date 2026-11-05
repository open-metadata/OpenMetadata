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

/* eslint-disable @typescript-eslint/no-explicit-any */
import { fireEvent, render, screen } from '@testing-library/react';
import TestCases from './TestCases';

const mockUseTestCaseListPage = jest.fn();
const mockUseDataQualityProvider = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) =>
      options?.entity ? `${key}:${options.entity}` : key,
  }),
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  EmptyPlaceholder: jest.requireActual('@openmetadata/ui-core-components')
    .EmptyPlaceholder,
  Box: ({ children, direction, gap, className }: any) => (
    <div
      className={className}
      data-direction={direction}
      data-gap={gap}
      data-testid="box">
      {children}
    </div>
  ),
}));

jest.mock('@openmetadata/ui-core-components/icons', () => ({
  ...jest.requireActual('@openmetadata/ui-core-components/icons'),
  Plus: () => <span data-testid="plus-icon" />,
}));

jest.mock('pages/DataQuality/DataQualityProvider', () => ({
  useDataQualityProvider: () => mockUseDataQualityProvider(),
}));

jest.mock('components/Database/Profiler/DataQualityTab/DataQualityTab', () => ({
  __esModule: true,
  default: ({
    afterDeleteAction,
    isLoading,
    testCases,
    enableBulkActions,
    emptyStateAction,
    deletionMode,
    hasActiveFilters,
  }: any) => (
    <div
      data-deletion-mode={deletionMode}
      data-enable-bulk-actions={String(enableBulkActions)}
      data-has-active-filters={String(hasActiveFilters)}
      data-is-loading={String(isLoading)}
      data-test-cases-count={testCases?.length ?? 0}
      data-testid="data-quality-tab">
      data-quality-tab
      <button data-testid="after-delete-action" onClick={afterDeleteAction}>
        after-delete
      </button>
      {emptyStateAction && (
        <button
          data-testid="empty-state-action"
          onClick={emptyStateAction.onPress}>
          {emptyStateAction.label}
        </button>
      )}
    </div>
  ),
}));

jest.mock(
  'components/DataQuality/TestCases/TestCaseListTableHeader.component',
  () => ({
    __esModule: true,
    default: ({
      searchValue,
      showDeleted,
      onSearch,
      onShowDeletedChange,
    }: any) => (
      <div data-search-value={searchValue} data-testid="test-case-list-header">
        <button data-testid="trigger-search" onClick={() => onSearch('abc')}>
          search
        </button>
        <button
          data-testid="show-deleted"
          onClick={() => onShowDeletedChange(!showDeleted)}>
          show-deleted
        </button>
      </div>
    ),
  })
);

jest.mock('components/DataQuality/TestCases/useTestCaseListPage', () => ({
  useTestCaseListPage: () => mockUseTestCaseListPage(),
}));

jest.mock('enums/common.enum', () => ({
  ERROR_PLACEHOLDER_TYPE: { PERMISSION: 'PERMISSION' },
}));

jest.mock('pages/DataQuality/DataQualityPage.interface', () => ({
  DataQualityPageTabs: { TEST_CASES: 'test-cases' },
}));

jest.mock('utils/ObservabilityRouterClassBase', () => ({
  __esModule: true,
  default: { getDataQualityPagePath: jest.fn(() => '/data-quality') },
}));

jest.mock('../../common/FilterChip/FilterBar', () => ({
  __esModule: true,
  default: ({ hasActiveFilters, onClearAll }: any) => (
    <div
      data-has-active-filters={String(hasActiveFilters)}
      data-testid="test-case-filter-bar">
      <button data-testid="clear-all" onClick={onClearAll}>
        clear
      </button>
    </div>
  ),
}));

jest.mock('../DqSummaryPanel', () => ({
  __esModule: true,
  default: ({ isLoading, testSummary }: any) => (
    <div
      data-has-summary={String(Boolean(testSummary))}
      data-is-loading={String(isLoading)}
      data-testid="dq-summary-panel">
      dq-summary-panel
    </div>
  ),
}));

const handleSearchParam = jest.fn();
const clearAll = jest.fn();
const handleShowDeletedChange = jest.fn();
const handleAfterDeleteAction = jest.fn();

const baseHookReturn = {
  testCasePermission: { ViewAll: true, ViewBasic: true },
  testSuitePermission: { Create: true },
  testCaseSummary: { total: 5 },
  isTestCaseSummaryLoading: false,
  searchValue: 'query',
  selectedFilter: [],
  handleMenuClick: jest.fn(),
  handleSearchParam,
  filterMenu: [],
  filters: [],
  hasActiveFilters: false,
  clearAll,
  testCase: [{ id: '1' }, { id: '2' }],
  isLoading: false,
  pagingData: {},
  showPagination: true,
  fetchTestCases: jest.fn(),
  sortTestCase: jest.fn(),
  handleTestCaseUpdate: jest.fn(),
  handleStatusSubmit: jest.fn(),
  extraDropdownContent: [],
  showDeleted: false,
  handleShowDeletedChange,
  handleAfterDeleteAction,
};

const onAddTestCase = jest.fn();

describe('TestCases', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTestCaseListPage.mockReturnValue(baseHookReturn);
    mockUseDataQualityProvider.mockReturnValue({
      createActions: {
        canCreateTestCase: true,
        onAddTestCase,
      },
    });
  });

  it('should render the filter bar, summary panel and table when permitted', () => {
    render(<TestCases />);

    expect(screen.getByTestId('test-case-filter-bar')).toBeInTheDocument();
    expect(screen.getByTestId('dq-summary-panel')).toBeInTheDocument();
    expect(screen.getByTestId('data-quality-tab')).toBeInTheDocument();
    expect(screen.getByTestId('test-case-list-header')).toBeInTheDocument();
  });

  it('should render the permission error placeholder when no view permission', () => {
    mockUseTestCaseListPage.mockReturnValue({
      ...baseHookReturn,
      testCasePermission: { ViewAll: false, ViewBasic: false },
    });

    render(<TestCases />);

    expect(
      screen.getByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('data-quality-tab')).not.toBeInTheDocument();
  });

  it('should render content when only ViewBasic permission is granted', () => {
    mockUseTestCaseListPage.mockReturnValue({
      ...baseHookReturn,
      testCasePermission: { ViewAll: false, ViewBasic: true },
    });

    render(<TestCases />);

    expect(screen.getByTestId('data-quality-tab')).toBeInTheDocument();
    expect(
      screen.queryByTestId(
        /(no-data|permission-error|search-error|create-error|assign-error)-placeholder/
      )
    ).not.toBeInTheDocument();
  });

  it('should forward summary loading flag and summary to the summary panel', () => {
    mockUseTestCaseListPage.mockReturnValue({
      ...baseHookReturn,
      isTestCaseSummaryLoading: true,
    });

    render(<TestCases />);

    const panel = screen.getByTestId('dq-summary-panel');

    expect(panel).toHaveAttribute('data-is-loading', 'true');
    expect(panel).toHaveAttribute('data-has-summary', 'true');
  });

  it('should forward loading and test cases to the data quality tab', () => {
    mockUseTestCaseListPage.mockReturnValue({
      ...baseHookReturn,
      isLoading: true,
    });

    render(<TestCases />);

    const tab = screen.getByTestId('data-quality-tab');

    expect(tab).toHaveAttribute('data-is-loading', 'true');
    expect(tab).toHaveAttribute('data-test-cases-count', '2');
  });

  it('should disable bulk actions when test suite create permission is missing', () => {
    mockUseTestCaseListPage.mockReturnValue({
      ...baseHookReturn,
      testSuitePermission: { Create: false },
    });

    render(<TestCases />);

    expect(screen.getByTestId('data-quality-tab')).toHaveAttribute(
      'data-enable-bulk-actions',
      'false'
    );
  });

  it('should wire clearAll from the hook to the filter bar', () => {
    render(<TestCases />);

    fireEvent.click(screen.getByTestId('clear-all'));

    expect(clearAll).toHaveBeenCalledTimes(1);
  });

  it('should wire the table header search to handleSearchParam', () => {
    render(<TestCases />);

    fireEvent.click(screen.getByTestId('trigger-search'));

    expect(handleSearchParam).toHaveBeenCalledWith('searchValue', 'abc');
  });

  it('should render the new test case CTA and fire onAddTestCase when create permission exists', () => {
    render(<TestCases />);

    const cta = screen.getByTestId('empty-state-action');

    expect(cta).toBeInTheDocument();
    expect(cta).toHaveTextContent('label.new-entity:label.test-case');

    fireEvent.click(cta);

    expect(onAddTestCase).toHaveBeenCalledTimes(1);
  });

  it('should not render the new test case CTA when create permission is missing', () => {
    mockUseDataQualityProvider.mockReturnValue({
      createActions: {
        canCreateTestCase: false,
        onAddTestCase,
      },
    });

    render(<TestCases />);

    expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
  });

  it('should not render the new test case CTA when createActions is undefined', () => {
    mockUseDataQualityProvider.mockReturnValue({});

    render(<TestCases />);

    expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
  });

  it('should use soft deletion and wire the show deleted toggle', () => {
    render(<TestCases />);

    expect(screen.getByTestId('data-quality-tab')).toHaveAttribute(
      'data-deletion-mode',
      'soft'
    );

    fireEvent.click(screen.getByTestId('show-deleted'));

    expect(handleShowDeletedChange).toHaveBeenCalledWith(true);
  });

  it('should refresh through handleAfterDeleteAction after a delete or restore', () => {
    render(<TestCases />);

    fireEvent.click(screen.getByTestId('after-delete-action'));

    expect(handleAfterDeleteAction).toHaveBeenCalledTimes(1);
  });

  it('should treat deleted visibility as a filter and disable bulk actions', () => {
    mockUseTestCaseListPage.mockReturnValue({
      ...baseHookReturn,
      searchValue: '',
      showDeleted: true,
    });

    render(<TestCases />);

    const tab = screen.getByTestId('data-quality-tab');

    expect(tab).toHaveAttribute('data-enable-bulk-actions', 'false');
    expect(tab).toHaveAttribute('data-has-active-filters', 'true');
    expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
  });
});
