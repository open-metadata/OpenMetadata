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
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SelectItemType } from '../select/select';
import { Autocomplete } from './autocomplete';

const OPTIONS: SelectItemType[] = [
  { id: 'pii', label: 'PII' },
  { id: 'tier1', label: 'Tier 1' },
];

const renderAutocomplete = (onItemInserted: (id: unknown) => void) =>
  render(
    <Autocomplete
      items={OPTIONS}
      placeholder="Select"
      selectedItems={[]}
      onItemInserted={onItemInserted}>
      {(item) => (
        <Autocomplete.Item id={item.id} key={item.id}>
          {item.label}
        </Autocomplete.Item>
      )}
    </Autocomplete>
  );

describe('Autocomplete – selection commit', () => {
  it('inserts the focused option on Enter', async () => {
    const onItemInserted = vi.fn();
    renderAutocomplete(onItemInserted);

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(onItemInserted).toHaveBeenCalledWith('pii');
  });

  // react-aria's ComboBox commits the focused option when the input loses focus,
  // and the listbox focuses whatever option the pointer last passed over — so
  // tabbing out inserted a value the user never picked. In a query builder that
  // silently changes what the filter means.
  it('inserts nothing when focus leaves the input', async () => {
    const onItemInserted = vi.fn();
    renderAutocomplete(onItemInserted);

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.tab();

    expect(onItemInserted).not.toHaveBeenCalled();
  });
});

// Above the virtualization threshold. jsdom has no layout, so the virtualizer
// cannot window rows here; this guards filtering and selection on that path.
const LARGE_OPTIONS: SelectItemType[] = Array.from(
  { length: 250 },
  (_, index) => ({ id: `value-${index}`, label: `Value ${index}` })
);

describe('Autocomplete – large option lists', () => {
  it('filters the full list and inserts a match', async () => {
    const onItemInserted = vi.fn();
    render(
      <Autocomplete
        items={LARGE_OPTIONS}
        placeholder="Select"
        selectedItems={[]}
        onItemInserted={onItemInserted}>
        {(item) => (
          <Autocomplete.Item id={item.id} key={item.id}>
            {item.label}
          </Autocomplete.Item>
        )}
      </Autocomplete>
    );

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('Value 249');

    expect(screen.getAllByRole('option')).toHaveLength(1);

    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(onItemInserted).toHaveBeenCalledWith('value-249');
  });
});
