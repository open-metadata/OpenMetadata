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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

// Above the virtualization threshold.
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

// jsdom has no layout, so the virtualizer sees a zero-size viewport unless the
// element sizes are stubbed (React Aria's documented setup for testing
// virtualized collections). With a real viewport only the visible slice of
// rows is mounted, which is the guarantee that keeps a 10,000-value enum
// responsive.
describe('Autocomplete – virtualized listbox', () => {
  const VIEWPORT_HEIGHT = 320;
  const ROW_HEIGHT = 40;

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(
      VIEWPORT_HEIGHT
    );
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
    // Rows are measured through their scroll size; zero would let every row
    // "fit" the viewport.
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(
      ROW_HEIGHT
    );
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(400);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('mounts only a viewport of rows and reaches far options by scrolling', async () => {
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

    const mountedRows = screen.getAllByRole('option');

    expect(mountedRows.length).toBeGreaterThan(0);
    expect(mountedRows.length).toBeLessThan(LARGE_OPTIONS.length / 4);
    expect(screen.queryByText('Value 249')).not.toBeInTheDocument();

    const listbox = screen.getByRole('listbox');
    listbox.scrollTop = LARGE_OPTIONS.length * ROW_HEIGHT;
    fireEvent.scroll(listbox);

    const lastOption = await screen.findByRole('option', { name: 'Value 249' });

    expect(screen.getAllByRole('option').length).toBeLessThan(
      LARGE_OPTIONS.length / 4
    );

    // The virtualizer disables pointer events until the scroll settles.
    await waitFor(() =>
      expect(lastOption.closest('[style*="pointer-events: none"]')).toBeNull()
    );
    await userEvent.click(lastOption);

    expect(onItemInserted).toHaveBeenCalledWith('value-249');
  });
});

// Async callers page in more results from `onPopoverScroll`. Past the
// threshold the listbox, not the popover, is the scroller, so the handler has
// to follow it or paging stops at the threshold.
describe('Autocomplete – scroll paging across the virtualization threshold', () => {
  const ROW_HEIGHT = 40;

  const renderWithItems = (
    items: SelectItemType[],
    onPopoverScroll: () => void
  ) => (
    <Autocomplete
      items={items}
      placeholder="Select"
      selectedItems={[]}
      onPopoverScroll={onPopoverScroll}>
      {(item) => (
        <Autocomplete.Item id={item.id} key={item.id}>
          {item.label}
        </Autocomplete.Item>
      )}
    </Autocomplete>
  );

  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(320);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(
      ROW_HEIGHT
    );
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(400);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('reports scrolls of the virtualized listbox', async () => {
    const onPopoverScroll = vi.fn();
    render(renderWithItems(LARGE_OPTIONS, onPopoverScroll));

    await userEvent.click(screen.getByRole('combobox'));
    fireEvent.scroll(screen.getByRole('listbox'));

    expect(onPopoverScroll).toHaveBeenCalled();
  });

  it('keeps the scroll position when a loaded page crosses the threshold', async () => {
    const onPopoverScroll = vi.fn();
    const firstPages = LARGE_OPTIONS.slice(0, 200);
    const { rerender } = render(renderWithItems(firstPages, onPopoverScroll));

    await userEvent.click(screen.getByRole('combobox'));

    const popover = screen.getByRole('listbox').parentElement as HTMLElement;
    const scrolledTo = 190 * ROW_HEIGHT;
    popover.scrollTop = scrolledTo;
    fireEvent.scroll(popover);

    expect(onPopoverScroll).toHaveBeenCalledTimes(1);

    rerender(renderWithItems(LARGE_OPTIONS, onPopoverScroll));

    expect(screen.getByRole('listbox').scrollTop).toBe(scrolledTo);
  });
});
