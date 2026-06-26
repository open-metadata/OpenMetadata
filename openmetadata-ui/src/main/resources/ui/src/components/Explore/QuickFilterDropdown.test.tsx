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
import { fireEvent, render, screen } from '@testing-library/react';
import { Children, cloneElement, isValidElement, ReactElement } from 'react';
import QuickFilterDropdown from './QuickFilterDropdown';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('../../constants/AdvancedSearch.constants', () => ({
  NULL_OPTION_KEY: 'null_option_key',
}));

jest.mock('../../utils/AdvancedSearchPureUtils', () => ({
  getSelectedOptionLabelString: (options: { label: string }[]) =>
    (options ?? []).map((option) => option.label).join(', '),
}));

jest.mock('../common/Loader/Loader', () => ({
  __esModule: true,
  default: () => <div data-testid="loader" />,
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: ({
    children,
    onPress,
    'data-testid': testId,
  }: {
    children: React.ReactNode;
    onPress?: () => void;
    'data-testid'?: string;
  }) => (
    <button data-testid={testId} type="button" onClick={onPress}>
      {children}
    </button>
  ),
  Checkbox: ({
    isSelected,
    onChange,
    label,
    'data-testid': testId,
  }: {
    isSelected?: boolean;
    onChange: (checked: boolean) => void;
    label: React.ReactNode;
    'data-testid'?: string;
  }) => (
    <label data-testid={testId}>
      <input
        checked={Boolean(isSelected)}
        type="checkbox"
        onChange={(event) => onChange(event.target.checked)}
      />
      {label}
    </label>
  ),
  Input: ({
    value,
    onChange,
    placeholder,
  }: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => (
    <input
      data-testid="search-input"
      placeholder={placeholder}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
  Popover: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  PopoverTrigger: ({
    isOpen,
    onOpenChange,
    children,
  }: {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    children: React.ReactNode;
  }) => {
    const [trigger, popover] = Children.toArray(children);

    return (
      <div>
        {isValidElement(trigger) &&
          cloneElement(trigger as ReactElement, {
            onPress: () => onOpenChange(!isOpen),
          })}
        {isOpen ? popover : null}
      </div>
    );
  },
}));

const OPTIONS = [
  { key: 'table', label: 'Table', count: 5 },
  { key: 'topic', label: 'Topic', count: 3 },
];

const renderDropdown = (
  props: Partial<React.ComponentProps<typeof QuickFilterDropdown>> = {}
) =>
  render(
    <QuickFilterDropdown
      label="Entity Type"
      options={OPTIONS}
      searchKey="entityType"
      selectedKeys={[]}
      onChange={jest.fn()}
      onGetInitialOptions={jest.fn()}
      onSearch={jest.fn()}
      {...props}
    />
  );

describe('QuickFilterDropdown', () => {
  it('should fetch initial options when the dropdown is opened', () => {
    const onGetInitialOptions = jest.fn();
    renderDropdown({ onGetInitialOptions });

    fireEvent.click(screen.getByTestId('search-dropdown-entityType'));

    expect(onGetInitialOptions).toHaveBeenCalledWith('entityType');
  });

  it('should emit the selected option only after Update is clicked', () => {
    const onChange = jest.fn();
    renderDropdown({ onChange });

    fireEvent.click(screen.getByTestId('search-dropdown-entityType'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Table' }));

    expect(onChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('update-btn'));

    expect(onChange).toHaveBeenCalledWith(
      [{ key: 'table', label: 'Table', count: 5 }],
      'entityType'
    );
  });

  it('should keep a single value in single-select mode', () => {
    const onChange = jest.fn();
    renderDropdown({ onChange, singleSelect: true });

    fireEvent.click(screen.getByTestId('search-dropdown-entityType'));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Table' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Topic' }));
    fireEvent.click(screen.getByTestId('update-btn'));

    expect(onChange).toHaveBeenCalledWith(
      [{ key: 'topic', label: 'Topic', count: 3 }],
      'entityType'
    );
  });

  it('should emit the null option when it is selected', () => {
    const onChange = jest.fn();
    renderDropdown({ onChange, hasNullOption: true });

    fireEvent.click(screen.getByTestId('search-dropdown-entityType'));
    fireEvent.click(screen.getByTestId('no-option-checkbox'));
    fireEvent.click(screen.getByTestId('update-btn'));

    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ key: 'null_option_key' }),
      ]),
      'entityType'
    );
  });

  it('should debounce search input and call onSearch', () => {
    jest.useFakeTimers();
    const onSearch = jest.fn();
    renderDropdown({ onSearch });

    fireEvent.click(screen.getByTestId('search-dropdown-entityType'));
    fireEvent.change(screen.getByTestId('search-input'), {
      target: { value: 'tab' },
    });

    jest.advanceTimersByTime(500);

    expect(onSearch).toHaveBeenCalledWith('tab', 'entityType');

    jest.useRealTimers();
  });
});
