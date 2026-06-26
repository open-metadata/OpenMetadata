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
import { TestCaseListTableHeader } from './TestCaseListTableHeader.component';

jest.mock('@openmetadata/ui-core-components', () => ({
  Box: ({
    children,
    'data-testid': testId,
  }: React.PropsWithChildren<{ 'data-testid'?: string }>) => (
    <div data-testid={testId}>{children}</div>
  ),
  Input: ({
    value,
    placeholder,
    onChange,
  }: {
    value?: string;
    placeholder?: string;
    onChange?: (value: string) => void;
  }) => (
    <input
      data-testid="search-input"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange?.(e.target.value)}
    />
  ),
  Typography: ({
    children,
    'data-testid': testId,
  }: React.PropsWithChildren<{ 'data-testid'?: string }>) => (
    <span data-testid={testId}>{children}</span>
  ),
}));

jest.mock('@untitledui/icons', () => ({
  SearchLg: () => <span data-testid="search-icon" />,
}));

jest.mock('../../common/ManageMenuButton/ManageMenuButton.component', () => ({
  __esModule: true,
  default: (props: { items?: unknown[] }) => (
    <div data-testid="manage-button">
      manage-button-{(props.items || []).length}
    </div>
  ),
}));

const mockOnSearch = jest.fn();

const defaultProps = {
  searchValue: '',
  onSearch: mockOnSearch,
  extraDropdownContent: [],
};

describe('TestCaseListTableHeader component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should render the title, description, search and manage button', () => {
    render(<TestCaseListTableHeader {...defaultProps} />);

    expect(screen.getByTestId('page-header')).toBeInTheDocument();
    expect(screen.getByTestId('header-title')).toHaveTextContent(
      'label.test-case-insight-plural'
    );
    expect(screen.getByTestId('searchbar-component')).toBeInTheDocument();
    expect(screen.getByTestId('manage-button')).toBeInTheDocument();
  });

  it('should initialize the input with searchValue prop', () => {
    render(<TestCaseListTableHeader {...defaultProps} searchValue="orders" />);

    expect(screen.getByTestId('search-input')).toHaveValue('orders');
  });

  it('should sync the input when searchValue prop changes', () => {
    const { rerender } = render(
      <TestCaseListTableHeader {...defaultProps} searchValue="orders" />
    );

    expect(screen.getByTestId('search-input')).toHaveValue('orders');

    rerender(
      <TestCaseListTableHeader {...defaultProps} searchValue="customers" />
    );

    expect(screen.getByTestId('search-input')).toHaveValue('customers');
  });

  it('should update local value immediately and debounce the onSearch callback', () => {
    render(<TestCaseListTableHeader {...defaultProps} />);

    const input = screen.getByTestId('search-input');

    act(() => {
      fireEvent.change(input, { target: { value: 'foo' } });
    });

    expect(input).toHaveValue('foo');
    expect(mockOnSearch).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(500);
    });

    expect(mockOnSearch).toHaveBeenCalledWith('foo');
  });

  it('should pass extraDropdownContent through to the manage menu', () => {
    const item = (key: string) => ({
      key,
      icon: () => null,
      title: key,
      onClick: jest.fn(),
    });
    render(
      <TestCaseListTableHeader
        {...defaultProps}
        extraDropdownContent={[item('a'), item('b')]}
      />
    );

    expect(screen.getByTestId('manage-button')).toHaveTextContent(
      'manage-button-2'
    );
  });
});
