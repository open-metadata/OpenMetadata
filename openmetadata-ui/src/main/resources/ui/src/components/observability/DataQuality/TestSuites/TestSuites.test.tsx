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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ReactNode } from 'react';
import TestSuites from './TestSuites';

const mockUseTestSuitesListPage = jest.fn();
const mockUseDataQualityProvider = jest.fn();

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: any) =>
      options?.entity ? `${key}:${options.entity}` : key,
  }),
}));

jest.mock('pages/DataQuality/DataQualityProvider', () => ({
  useDataQualityProvider: () => mockUseDataQualityProvider(),
}));

jest.mock('@openmetadata/ui-core-components', () => {
  const Tabs: any = ({ children, selectedKey, onSelectionChange }: any) => (
    <div data-selected={selectedKey} data-testid="sub-tabs">
      <button
        data-testid="select-bundle"
        onClick={() => onSelectionChange('bundle-suites')}>
        bundle
      </button>
      {children}
    </div>
  );
  Tabs.List = ({ children }: { children?: ReactNode }) => (
    <div data-testid="sub-tabs-list">{children}</div>
  );
  Tabs.Item = ({
    children,
    id,
    'data-testid': testId,
  }: {
    children?: ReactNode;
    id?: string;
    'data-testid'?: string;
  }) => (
    <span data-id={id} data-testid={testId}>
      {children}
    </span>
  );

  return {
    Box: ({ children, direction, className }: any) => (
      <div className={className} data-direction={direction} data-testid="box">
        {children}
      </div>
    ),
    Input: ({
      value,
      onChange,
      placeholder,
    }: {
      value?: string;
      onChange?: (...args: never[]) => void;
      placeholder?: string;
    }) => (
      <input
        aria-label="suite-search-input"
        data-testid="suite-search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e: any) => onChange(e.target.value)}
      />
    ),
    Tabs,
  };
});

jest.mock('@untitledui/icons', () => ({
  ChevronDown: () => <span data-testid="chevron-down" />,
  Plus: () => <span data-testid="plus-icon" />,
  SearchLg: () => <span data-testid="search-icon" />,
}));

jest.mock('components/common/ErrorWithPlaceholder/ErrorPlaceHolder', () => ({
  __esModule: true,
  default: ({ type }: { type?: string }) => (
    <div data-testid="error-placeholder" data-type={type}>
      error-placeholder
    </div>
  ),
}));

jest.mock(
  'components/common/UserTeamSelectableList/UserTeamSelectableList.component',
  () => ({
    UserTeamSelectableList: ({
      children,
      onUpdate,
    }: {
      children?: ReactNode;
      onUpdate?: (...args: never[]) => void;
    }) => (
      <div data-testid="owner-selectable-list">
        <button data-testid="update-owner" onClick={() => onUpdate('owner-1')}>
          update-owner
        </button>
        {children}
      </div>
    ),
  })
);

jest.mock(
  'components/DataQuality/TestSuite/TestSuiteList/TestSuitesTable.component',
  () => ({
    TestSuitesTable: ({
      isLoading,
      data,
      hasActiveFilters,
      subTab,
      emptyStateAction,
    }: any) => (
      <div
        data-has-active-filters={String(hasActiveFilters)}
        data-is-loading={String(isLoading)}
        data-row-count={data?.length ?? 0}
        data-sub-tab={subTab}
        data-testid="test-suites-table">
        test-suites-table
        {emptyStateAction && (
          <button
            data-testid="empty-state-action"
            onClick={emptyStateAction.onPress}>
            {emptyStateAction.label}
          </button>
        )}
      </div>
    ),
  })
);

jest.mock(
  'components/DataQuality/TestSuite/TestSuiteList/useTestSuitesListPage',
  () => ({
    useTestSuitesListPage: () => mockUseTestSuitesListPage(),
  })
);

jest.mock('enums/common.enum', () => ({
  ERROR_PLACEHOLDER_TYPE: { PERMISSION: 'PERMISSION' },
}));

jest.mock('pages/DataQuality/DataQualityPage.interface', () => ({
  DataQualitySubTabs: {
    TABLE_SUITES: 'table-suites',
    BUNDLE_SUITES: 'bundle-suites',
  },
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
const handleOwnerSelect = jest.fn();
const handleSubTabChange = jest.fn();

const baseHookReturn = {
  subTab: 'table-suites',
  params: {},
  searchValue: '',
  selectedOwner: undefined,
  ownerFilterValue: undefined,
  testSuitePermission: { ViewAll: true, ViewBasic: true },
  sortedData: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
  isLoading: false,
  columnList: [],
  sortDescriptor: {},
  setSortDescriptor: jest.fn(),
  currentPage: 1,
  pageSize: 10,
  paging: {},
  showPagination: true,
  handlePageSizeChange: jest.fn(),
  handleTestSuitesPageChange: jest.fn(),
  handleSearchParam,
  handleOwnerSelect,
  handleSubTabChange,
  isTestCaseSummaryLoading: false,
  testCaseSummary: { total: 9 },
};

const onAddBundleSuite = jest.fn();

describe('TestSuites', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTestSuitesListPage.mockReturnValue(baseHookReturn);
    mockUseDataQualityProvider.mockReturnValue({
      createActions: {
        canCreateBundleSuite: true,
        onAddBundleSuite,
      },
    });
  });

  it('should render owner filter, summary panel and table when permitted', () => {
    render(<TestSuites />);

    expect(screen.getByTestId('owner-selectable-list')).toBeInTheDocument();
    expect(screen.getByTestId('dq-summary-panel')).toBeInTheDocument();
    expect(screen.getByTestId('test-suites-table')).toBeInTheDocument();
  });

  it('should render the permission error placeholder when no view permission', () => {
    mockUseTestSuitesListPage.mockReturnValue({
      ...baseHookReturn,
      testSuitePermission: { ViewAll: false, ViewBasic: false },
    });

    render(<TestSuites />);

    expect(screen.getByTestId('error-placeholder')).toHaveAttribute(
      'data-type',
      'PERMISSION'
    );
    expect(screen.queryByTestId('test-suites-table')).not.toBeInTheDocument();
  });

  it('should forward summary loading flag and summary to the summary panel', () => {
    mockUseTestSuitesListPage.mockReturnValue({
      ...baseHookReturn,
      isTestCaseSummaryLoading: true,
    });

    render(<TestSuites />);

    const panel = screen.getByTestId('dq-summary-panel');

    expect(panel).toHaveAttribute('data-is-loading', 'true');
    expect(panel).toHaveAttribute('data-has-summary', 'true');
  });

  it('should forward loading and sorted data to the table', () => {
    mockUseTestSuitesListPage.mockReturnValue({
      ...baseHookReturn,
      isLoading: true,
    });

    render(<TestSuites />);

    const table = screen.getByTestId('test-suites-table');

    expect(table).toHaveAttribute('data-is-loading', 'true');
    expect(table).toHaveAttribute('data-row-count', '3');
    expect(table).toHaveAttribute('data-sub-tab', 'table-suites');
  });

  it('should mark active filters when params are non-empty', () => {
    mockUseTestSuitesListPage.mockReturnValue({
      ...baseHookReturn,
      params: { owner: 'someone' },
    });

    render(<TestSuites />);

    expect(screen.getByTestId('test-suites-table')).toHaveAttribute(
      'data-has-active-filters',
      'true'
    );
  });

  it('should mark no active filters when params are empty', () => {
    render(<TestSuites />);

    expect(screen.getByTestId('test-suites-table')).toHaveAttribute(
      'data-has-active-filters',
      'false'
    );
  });

  it('should wire owner selection to handleOwnerSelect', () => {
    render(<TestSuites />);

    fireEvent.click(screen.getByTestId('update-owner'));

    expect(handleOwnerSelect).toHaveBeenCalledWith('owner-1');
  });

  it('should wire sub-tab change to handleSubTabChange', () => {
    render(<TestSuites />);

    fireEvent.click(screen.getByTestId('select-bundle'));

    expect(handleSubTabChange).toHaveBeenCalled();
  });

  it('should call handleSearchParam (debounced) when typing in the search box', async () => {
    render(<TestSuites />);

    fireEvent.change(screen.getByTestId('suite-search-input'), {
      target: { value: 'hello' },
    });

    await waitFor(
      () => {
        expect(handleSearchParam).toHaveBeenCalledWith('hello', 'searchValue');
      },
      { timeout: 1000 }
    );
  });

  it('should fall back to an empty search box when searchValue is undefined', () => {
    mockUseTestSuitesListPage.mockReturnValue({
      ...baseHookReturn,
      searchValue: undefined,
    });

    render(<TestSuites />);

    expect(
      (screen.getByTestId('suite-search-input') as HTMLInputElement).value
    ).toBe('');
  });

  it('should use the bundle-suite search placeholder on the bundle sub-tab', () => {
    mockUseTestSuitesListPage.mockReturnValue({
      ...baseHookReturn,
      subTab: 'bundle-suites',
    });

    render(<TestSuites />);

    expect(screen.getByTestId('suite-search-input')).toHaveAttribute(
      'placeholder',
      'label.search-entity:label.bundle-suite-plural'
    );
  });

  it('should render the new bundle suite CTA and fire onAddBundleSuite when create permission exists', () => {
    render(<TestSuites />);

    const cta = screen.getByTestId('empty-state-action');

    expect(cta).toBeInTheDocument();
    expect(cta).toHaveTextContent('label.new-entity:label.bundle-suite');

    fireEvent.click(cta);

    expect(onAddBundleSuite).toHaveBeenCalledTimes(1);
  });

  it('should not render the new bundle suite CTA when create permission is missing', () => {
    mockUseDataQualityProvider.mockReturnValue({
      createActions: {
        canCreateBundleSuite: false,
        onAddBundleSuite,
      },
    });

    render(<TestSuites />);

    expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
  });

  it('should not render the new bundle suite CTA when createActions is undefined', () => {
    mockUseDataQualityProvider.mockReturnValue({});

    render(<TestSuites />);

    expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
  });
});
