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
import { NULL_OPTION_KEY } from '../../../constants/AdvancedSearch.constants';
import { SearchDropdownProps } from '../../SearchDropdown/SearchDropdown.interface';
import FilterSelectDropdown from './FilterSelectDropdown';

// The real FilterSelect is rendered on purpose: this adapter exists only to
// translate the legacy SearchDropdown contract onto it, so mocking the core
// component would assert the translation against nothing.

const OPTIONS = [
  { key: 'snowflake', label: 'Snowflake', count: 12 },
  { key: 'bigquery', label: 'BigQuery', count: 8 },
];

const renderDropdown = (props: Partial<SearchDropdownProps> = {}) => {
  const onChange = jest.fn();
  const onSearch = jest.fn();
  const onGetInitialOptions = jest.fn();

  render(
    <FilterSelectDropdown
      immediateApply
      label="Service"
      options={OPTIONS}
      searchKey="service"
      selectedKeys={[]}
      onChange={onChange}
      onGetInitialOptions={onGetInitialOptions}
      onSearch={onSearch}
      {...props}
    />
  );

  return { onChange, onSearch, onGetInitialOptions };
};

const openDropdown = () => {
  fireEvent.click(screen.getByTestId('search-dropdown-service'));
};

describe('FilterSelectDropdown', () => {
  describe('option object translation', () => {
    it('emits the full option object and the search key, not the bare value', () => {
      const { onChange } = renderDropdown();

      openDropdown();
      fireEvent.click(screen.getByTestId('bigquery'));

      expect(onChange).toHaveBeenCalledWith(
        [{ key: 'bigquery', label: 'BigQuery', count: 8 }],
        'service'
      );
    });

    it('keeps the option objects of values that stay selected', () => {
      const { onChange } = renderDropdown({
        selectedKeys: [OPTIONS[0]],
      });

      openDropdown();
      fireEvent.click(screen.getByTestId('bigquery'));

      expect(onChange).toHaveBeenCalledWith(
        expect.arrayContaining([
          { key: 'snowflake', label: 'Snowflake', count: 12 },
          { key: 'bigquery', label: 'BigQuery', count: 8 },
        ]),
        'service'
      );
    });

    it('falls back to the value as its own label when no option is known', () => {
      // A selected key absent from `options` — the shape a URL round trip
      // produces before the aggregation has been fetched.
      const { onChange } = renderDropdown({
        options: [],
        selectedKeys: [{ key: 'orphan', label: 'orphan' }],
      });

      openDropdown();
      fireEvent.click(screen.getByTestId('orphan'));

      expect(onChange).toHaveBeenCalledWith([], 'service');
    });
  });

  describe('missing option reconstruction', () => {
    it('renders a selected value missing from options using its stored label', () => {
      renderDropdown({
        options: OPTIONS,
        selectedKeys: [{ key: 'mysql', label: 'MySQL' }],
      });

      openDropdown();

      expect(screen.getByText('MySQL')).toBeInTheDocument();
    });
  });

  describe('null option', () => {
    it('does not render the null row unless hasNullOption is set', () => {
      renderDropdown();

      openDropdown();

      expect(screen.queryByTestId(NULL_OPTION_KEY)).not.toBeInTheDocument();
    });

    it('converts the null row selection back to the null option key', () => {
      const { onChange } = renderDropdown({ hasNullOption: true });

      openDropdown();
      fireEvent.click(screen.getByTestId(NULL_OPTION_KEY));

      expect(onChange).toHaveBeenCalledWith(
        [{ key: NULL_OPTION_KEY, label: 'label.no-entity' }],
        'service'
      );
    });
  });

  describe('debounced search', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('debounces keystrokes and reports the search key', () => {
      const { onSearch } = renderDropdown();

      openDropdown();
      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'sno' },
      });

      expect(onSearch).not.toHaveBeenCalled();

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(onSearch).toHaveBeenCalledWith('sno', 'service');
    });

    it('cancels a pending keystroke when the dropdown closes', () => {
      const { onSearch } = renderDropdown();

      openDropdown();
      const searchInput = screen.getByTestId('search-input');
      fireEvent.change(searchInput, { target: { value: 'sno' } });
      // A pending search must not fetch into the next dropdown's shared
      // option state after this one is dismissed.
      fireEvent.keyDown(searchInput, { key: 'Escape' });

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(onSearch).not.toHaveBeenCalled();
    });

    it('cancels a pending keystroke on unmount', () => {
      const onSearch = jest.fn();
      const { unmount } = render(
        <FilterSelectDropdown
          immediateApply
          label="Service"
          options={OPTIONS}
          searchKey="service"
          selectedKeys={[]}
          onChange={jest.fn()}
          onSearch={onSearch}
        />
      );

      fireEvent.click(screen.getByTestId('search-dropdown-service'));
      fireEvent.change(screen.getByTestId('search-input'), {
        target: { value: 'sno' },
      });
      unmount();

      act(() => {
        jest.advanceTimersByTime(500);
      });

      expect(onSearch).not.toHaveBeenCalled();
    });
  });

  describe('legacy prop mapping', () => {
    it('requests the initial options when the dropdown opens', () => {
      const { onGetInitialOptions } = renderDropdown();

      openDropdown();

      expect(onGetInitialOptions).toHaveBeenCalledWith('service');
    });

    it('hides the search bar when hideSearchBar is set', () => {
      renderDropdown({ hideSearchBar: true });

      openDropdown();

      expect(screen.queryByTestId('search-input')).not.toBeInTheDocument();
    });

    it('renders radio rows for a single select', () => {
      renderDropdown({ singleSelect: true });

      openDropdown();

      expect(screen.getAllByRole('menuitemradio')).toHaveLength(OPTIONS.length);
    });

    it('waits for Apply when immediateApply is not set', () => {
      const { onChange } = renderDropdown({ immediateApply: false });

      openDropdown();
      fireEvent.click(screen.getByTestId('bigquery'));

      expect(onChange).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('update-btn'));

      expect(onChange).toHaveBeenCalledWith(
        [{ key: 'bigquery', label: 'BigQuery', count: 8 }],
        'service'
      );
    });

    it('never offers Select all for a single select', () => {
      renderDropdown({ showSelectAll: true, singleSelect: true });

      openDropdown();

      expect(
        screen.queryByLabelText('label.select-all')
      ).not.toBeInTheDocument();
    });
  });
});
