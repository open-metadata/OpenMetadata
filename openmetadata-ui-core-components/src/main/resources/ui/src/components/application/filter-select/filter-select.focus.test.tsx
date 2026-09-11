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

/**
 * Focus behaviour lives in its own file on purpose: react-aria tracks the
 * active focus scope in module state, and a file that has already mounted
 * several popovers no longer reproduces a focus steal — these assertions
 * pass for the wrong reason when they share a file with the rest of the
 * suite. Vitest isolates per file, so each case here starts from a clean
 * focus-scope stack.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FilterSelect } from './filter-select';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => (key === 'label.search' ? 'Search' : key),
  }),
}));

const OPTIONS = [
  { value: 'snowflake', label: 'Snowflake' },
  { value: 'bigquery', label: 'BigQuery' },
];

describe('FilterSelect focus', () => {
  it('keeps focus in the search box when async results arrive', () => {
    const props = {
      isOpen: true as const,
      label: 'Service',
      searchable: true,
      selectedValues: [],
      onChange: () => undefined,
      onSearch: () => undefined,
    };
    const { rerender } = render(<FilterSelect {...props} options={OPTIONS} />);
    const search = screen.getByPlaceholderText('Search');
    search.focus();
    fireEvent.change(search, { target: { value: 'big' } });

    // The menu unmounts for the skeleton and remounts with the results.
    rerender(<FilterSelect {...props} isLoading options={[]} />);
    rerender(<FilterSelect {...props} options={[OPTIONS[1]]} />);

    expect(document.activeElement).toBe(screen.getByPlaceholderText('Search'));
  });

  it('leaves the options reachable by keyboard while the search box has focus', () => {
    render(
      <FilterSelect
        isOpen
        searchable
        label="Service"
        options={OPTIONS}
        selectedValues={[]}
        onChange={() => undefined}
      />
    );

    // Suppressing the menu's autofocus must not drop it out of the tab order.
    expect(screen.getByRole('menu')).toHaveAttribute('tabindex', '0');
  });
});
