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
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
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
  it('provides a named remove button and the full selected label', async () => {
    const label = 'service.database.schema.' + 'long_table_name_'.repeat(20);
    render(
      <Autocomplete items={[]} selectedItems={[{ id: label, label }]}>
        {(item) => (
          <Autocomplete.Item id={item.id}>{item.label}</Autocomplete.Item>
        )}
      </Autocomplete>
    );

    expect(screen.getByRole('button', { name: /remove/i })).toBeVisible();
    const chip = screen.getByTestId('autocomplete-selected-item');

    expect(chip).toHaveTextContent(label);

    // react-aria ignores hover until it has seen pointer modality.
    fireEvent.mouseMove(document);
    await userEvent.hover(within(chip).getByText(label));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(label);
  });

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

describe('Autocomplete – popover header and footer', () => {
  it('renders the header and footer around the open list', async () => {
    render(
      <Autocomplete
        items={OPTIONS}
        placeholder="Select"
        popoverFooter={<div>Footer hints</div>}
        popoverHeader={<div>Showing 2 of 2</div>}
        selectedItems={[]}>
        {(item) => (
          <Autocomplete.Item id={item.id} key={item.id}>
            {item.label}
          </Autocomplete.Item>
        )}
      </Autocomplete>
    );

    expect(screen.queryByText('Showing 2 of 2')).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('combobox'));

    const listbox = await screen.findByRole('listbox');
    const header = screen.getByText('Showing 2 of 2');
    const footer = screen.getByText('Footer hints');

    expect(
      header.compareDocumentPosition(listbox) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      listbox.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });
});

describe('Autocomplete – empty state', () => {
  it('renders the given empty state instead of the default one', async () => {
    render(
      <Autocomplete
        emptyState={<div>Loading results</div>}
        items={[]}
        placeholder="Select"
        selectedItems={[]}>
        {(item) => (
          <Autocomplete.Item id={item.id} key={item.id}>
            {item.label}
          </Autocomplete.Item>
        )}
      </Autocomplete>
    );

    await userEvent.click(screen.getByRole('combobox'));

    expect(await screen.findByText('Loading results')).toBeInTheDocument();
  });
});

describe('Autocomplete – overflow chips', () => {
  const SELECTED: SelectItemType[] = ['a', 'b', 'c'].map((id) => ({
    id,
    label: `Tag ${id.toUpperCase()}`,
  }));
  const UNSELECTED: SelectItemType = { id: 'd', label: 'Tag D' };

  const renderCapped = (onItemInserted = vi.fn(), onItemCleared = vi.fn()) =>
    render(
      // Tag C is selected but not in the loaded items, like an async page.
      <Autocomplete
        items={[SELECTED[0], SELECTED[1], UNSELECTED]}
        maxVisibleItems={1}
        selectedItems={SELECTED}
        onItemCleared={onItemCleared}
        onItemInserted={onItemInserted}>
        {(item) => (
          <Autocomplete.Item id={item.id}>{item.label}</Autocomplete.Item>
        )}
      </Autocomplete>
    );

  it('keeps the default list when opened from the input', async () => {
    renderCapped();

    await userEvent.click(screen.getByRole('combobox'));

    const options = within(await screen.findByRole('listbox')).getAllByRole(
      'option'
    );

    expect(options.map((option) => option.textContent)).toEqual(['Tag D']);
  });

  it('opens the list from +N with the selected values still in it', async () => {
    renderCapped();

    await userEvent.click(screen.getByTestId('autocomplete-overflow-trigger'));

    const options = within(await screen.findByRole('listbox')).getAllByRole(
      'option'
    );

    expect(options.map((option) => option.textContent)).toEqual([
      'Tag C',
      'Tag A',
      'Tag B',
      'Tag D',
    ]);
  });

  it('drops the checkbox view once the list closes', async () => {
    renderCapped();

    await userEvent.click(screen.getByTestId('autocomplete-overflow-trigger'));
    await screen.findByRole('option', { name: 'Tag A' });
    await userEvent.keyboard('{Escape}');

    await waitFor(() =>
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    );

    await userEvent.click(screen.getByRole('combobox'));

    const options = within(await screen.findByRole('listbox')).getAllByRole(
      'option'
    );

    expect(options.map((option) => option.textContent)).toEqual(['Tag D']);
  });

  it('unselects a checked row and selects an unchecked one', async () => {
    const onItemInserted = vi.fn();
    const onItemCleared = vi.fn();
    renderCapped(onItemInserted, onItemCleared);

    await userEvent.click(screen.getByTestId('autocomplete-overflow-trigger'));
    await userEvent.click(await screen.findByRole('option', { name: 'Tag B' }));

    expect(onItemCleared).toHaveBeenCalledWith('b');

    await userEvent.click(screen.getByTestId('autocomplete-overflow-trigger'));
    await userEvent.click(await screen.findByRole('option', { name: 'Tag D' }));

    expect(onItemInserted).toHaveBeenCalledWith('d');
  });
});

describe('Autocomplete – +N checkbox view edge cases', () => {
  const SELECTED: SelectItemType[] = ['a', 'b', 'c'].map((id) => ({
    id,
    label: `Tag ${id.toUpperCase()}`,
  }));
  const LOADED: SelectItemType[] = [
    SELECTED[0],
    SELECTED[1],
    { id: 'd', label: 'Tag D' },
  ];
  const optionLabels = async () =>
    within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .map((option) => option.textContent);
  const isChecked = (name: string) =>
    screen
      .getByRole('option', { name })
      .querySelector('[class*="bg-brand-solid"]') !== null;

  it.each([['isDisabled'], ['isReadOnly']])(
    'does not open the list from +N when %s',
    async (flag) => {
      const onItemCleared = vi.fn();
      render(
        <Autocomplete
          items={LOADED}
          maxVisibleItems={1}
          selectedItems={SELECTED}
          onItemCleared={onItemCleared}
          {...{ [flag]: true }}>
          {(item) => (
            <Autocomplete.Item id={item.id}>{item.label}</Autocomplete.Item>
          )}
        </Autocomplete>
      );

      await userEvent.click(
        screen.getByTestId('autocomplete-overflow-trigger')
      );

      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(onItemCleared).not.toHaveBeenCalled();
    }
  );

  it('lists unloaded selections for static children too', async () => {
    render(
      <Autocomplete items={LOADED} maxVisibleItems={1} selectedItems={SELECTED}>
        {LOADED.map((item) => (
          <Autocomplete.Item id={String(item.id)} key={item.id}>
            {item.label}
          </Autocomplete.Item>
        ))}
      </Autocomplete>
    );

    await userEvent.click(screen.getByTestId('autocomplete-overflow-trigger'));

    expect(await optionLabels()).toEqual(['Tag C', 'Tag A', 'Tag B', 'Tag D']);
  });

  it('marks selected rows checked and can re-check an unloaded value', async () => {
    const onItemInserted = vi.fn();
    const onItemCleared = vi.fn();
    render(
      <Autocomplete
        items={LOADED}
        maxVisibleItems={1}
        selectedItems={SELECTED}
        onItemCleared={onItemCleared}
        onItemInserted={onItemInserted}>
        {(item) => (
          <Autocomplete.Item id={item.id}>{item.label}</Autocomplete.Item>
        )}
      </Autocomplete>
    );

    await userEvent.click(screen.getByTestId('autocomplete-overflow-trigger'));
    await screen.findByRole('listbox');

    expect(isChecked('Tag C')).toBe(true);
    expect(isChecked('Tag D')).toBe(false);

    await userEvent.click(screen.getByRole('option', { name: 'Tag C' }));

    expect(onItemCleared).toHaveBeenCalledWith('c');

    // A value outside the loaded items stays listed, so the uncheck can be undone.
    expect(isChecked('Tag C')).toBe(false);

    await userEvent.click(screen.getByRole('option', { name: 'Tag C' }));

    expect(onItemInserted).toHaveBeenCalledWith('c');
  });

  it('keeps the Backspace walk from the input to the last chip', async () => {
    const onItemCleared = vi.fn();
    render(
      <Autocomplete
        items={LOADED}
        maxVisibleItems={1}
        selectedItems={SELECTED}
        onItemCleared={onItemCleared}>
        {(item) => (
          <Autocomplete.Item id={item.id}>{item.label}</Autocomplete.Item>
        )}
      </Autocomplete>
    );

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('{Backspace}');

    expect(screen.getByTestId('autocomplete-overflow-trigger')).toHaveFocus();

    await userEvent.keyboard('{Backspace}{Backspace}');

    expect(onItemCleared).toHaveBeenCalledWith('a');
  });
});
