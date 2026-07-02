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
import { fireEvent, render, screen } from '@testing-library/react';
import { ReactNode, act } from 'react';
import { TestSuite } from '../../../../generated/tests/testCase';
import { DataQualitySubTabs } from '../../../../pages/DataQuality/DataQualityPage.interface';
import {
  TestSuiteListPanel,
  TestSuiteListPanelProps,
} from './TestSuiteListPanel.component';

jest.mock('@openmetadata/ui-core-components', () => {
  const react = require('react');
  const cloneWith = (children: ReactNode, props: Record<string, unknown>) =>
    react.Children.map(children, (child: ReactNode) =>
      react.isValidElement(child) ? react.cloneElement(child, props) : child
    );

  type SelectionChange = (key: string | number) => void;

  const TabsComponent = ({
    children,
    onSelectionChange,
    selectedKey,
  }: {
    children?: ReactNode;
    onSelectionChange?: SelectionChange;
    selectedKey?: string | number;
  }) => (
    <div data-selected-key={selectedKey} data-testid="sub-tabs">
      {cloneWith(children, { onSelectionChange })}
    </div>
  );

  const List = ({
    children,
    onSelectionChange,
  }: {
    children?: ReactNode;
    onSelectionChange?: SelectionChange;
  }) => <div>{cloneWith(children, { onSelectionChange })}</div>;

  const Item = ({
    children,
    id,
    'data-testid': testId,
    onSelectionChange,
  }: {
    children?: ReactNode;
    id?: string | number;
    'data-testid'?: string;
    onSelectionChange?: SelectionChange;
  }) => (
    <button
      data-testid={testId}
      onClick={() => id !== undefined && onSelectionChange?.(id)}>
      {children}
    </button>
  );

  const Tabs = Object.assign(TabsComponent, { List, Item });

  return {
    Box: ({
      children,
      className,
      'data-testid': testId,
    }: {
      children?: ReactNode;
      className?: string;
      'data-testid'?: string;
    }) => (
      <div className={className} data-testid={testId}>
        {children}
      </div>
    ),
    Input: ({
      placeholder,
      value,
      onChange,
    }: {
      placeholder?: string;
      value?: string;
      onChange: (value: string) => void;
    }) => (
      <input
        data-testid="search-input"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    ),
    Tabs,
  };
});

jest.mock('@untitledui/icons', () => ({ SearchLg: () => <span /> }));

jest.mock('./TestSuitesTable.component', () => ({
  TestSuitesTable: (props: {
    isLoading: boolean;
    data: TestSuite[];
    subTab: string;
  }) => (
    <div
      data-is-loading={String(props.isLoading)}
      data-rows={props.data.length}
      data-sub-tab={props.subTab}
      data-testid="test-suites-table"
    />
  ),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { entity?: string }) =>
      options?.entity ? `${key}:${options.entity}` : key,
  }),
}));

const renderPanel = (overrides: Partial<TestSuiteListPanelProps> = {}) => {
  const props: TestSuiteListPanelProps = {
    columnList: [],
    data: [],
    isLoading: false,
    subTab: DataQualitySubTabs.TABLE_SUITES,
    hasActiveFilters: false,
    onSortChange: jest.fn(),
    currentPage: 1,
    pageSize: 15,
    paging: { total: 0 },
    showPagination: false,
    pagingHandler: jest.fn(),
    onShowSizeChange: jest.fn(),
    searchValue: '',
    onSearch: jest.fn(),
    onSubTabChange: jest.fn(),
    ...overrides,
  };

  return { props, ...render(<TestSuiteListPanel {...props} />) };
};

describe('TestSuiteListPanel', () => {
  it('should render the toggle, search box and table', () => {
    renderPanel();

    expect(screen.getByTestId('table-suite-radio-btn')).toBeInTheDocument();
    expect(screen.getByTestId('bundle-suite-radio-btn')).toBeInTheDocument();
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('test-suites-table')).toBeInTheDocument();
  });

  it('should forward table props to the shared table', () => {
    renderPanel({
      isLoading: true,
      data: [
        { id: '1' } as unknown as TestSuite,
        { id: '2' } as unknown as TestSuite,
      ],
      subTab: DataQualitySubTabs.BUNDLE_SUITES,
    });

    const table = screen.getByTestId('test-suites-table');

    expect(table).toHaveAttribute('data-is-loading', 'true');
    expect(table).toHaveAttribute('data-rows', '2');
    expect(table).toHaveAttribute('data-sub-tab', 'bundle-suites');
  });

  it('should notify the parent when the bundle toggle is clicked', () => {
    const onSubTabChange = jest.fn();
    renderPanel({ onSubTabChange });

    fireEvent.click(screen.getByTestId('bundle-suite-radio-btn'));

    expect(onSubTabChange).toHaveBeenCalledWith(
      new Set([DataQualitySubTabs.BUNDLE_SUITES])
    );
  });

  it('should notify the parent when the table toggle is clicked', () => {
    const onSubTabChange = jest.fn();
    renderPanel({
      onSubTabChange,
      subTab: DataQualitySubTabs.BUNDLE_SUITES,
    });

    fireEvent.click(screen.getByTestId('table-suite-radio-btn'));

    expect(onSubTabChange).toHaveBeenCalledWith(
      new Set([DataQualitySubTabs.TABLE_SUITES])
    );
  });

  it('should debounce the search before notifying the parent', () => {
    jest.useFakeTimers();
    const onSearch = jest.fn();
    renderPanel({ onSearch });

    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'sales' },
    });

    expect(onSearch).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(onSearch).toHaveBeenCalledWith('sales');

    jest.useRealTimers();
  });

  it('should build the search placeholder from the active sub-tab', () => {
    const { rerender, props } = renderPanel({
      subTab: DataQualitySubTabs.TABLE_SUITES,
    });

    expect(screen.getByTestId('search-input')).toHaveAttribute(
      'placeholder',
      'label.search-entity:label.table-suite-plural'
    );

    rerender(
      <TestSuiteListPanel
        {...props}
        subTab={DataQualitySubTabs.BUNDLE_SUITES}
      />
    );

    expect(screen.getByTestId('search-input')).toHaveAttribute(
      'placeholder',
      'label.search-entity:label.bundle-suite-plural'
    );
  });
});
