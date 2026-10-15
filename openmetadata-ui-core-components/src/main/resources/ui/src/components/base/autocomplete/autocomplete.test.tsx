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
import { useState } from 'react';
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
  it('provides a named remove button and the full selected label', () => {
    const label = 'service.database.schema.' + 'long_table_name_'.repeat(20);
    render(
      <Autocomplete items={[]} selectedItems={[{ id: label, label }]}>
        {(item) => (
          <Autocomplete.Item id={item.id}>{item.label}</Autocomplete.Item>
        )}
      </Autocomplete>
    );

    expect(screen.getByRole('button', { name: /remove/i })).toBeVisible();
    expect(screen.getByTitle(label)).toHaveTextContent(label);
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

const TagField = () => {
  const [tags, setTags] = useState<SelectItemType[]>([]);

  return (
    <>
      <Autocomplete
        allowsCreation
        hideDropdown
        aria-label="Identities"
        items={[]}
        selectedItems={tags}
        onItemInserted={(key) =>
          setTags((prev) => [...prev, { id: String(key), label: String(key) }])
        }>
        {(item) => (
          <Autocomplete.Item id={item.id} key={item.id}>
            {item.label}
          </Autocomplete.Item>
        )}
      </Autocomplete>
      <input aria-label="Next field" />
    </>
  );
};

const DropdownField = () => (
  <>
    <Autocomplete
      aria-label="Column"
      items={OPTIONS}
      placeholder="Select"
      selectedItems={[]}>
      {(item) => (
        <Autocomplete.Item id={item.id} key={item.id}>
          {item.label}
        </Autocomplete.Item>
      )}
    </Autocomplete>
    <input aria-label="Next field" />
  </>
);

/** Lets React flush sync-lane work without running a macrotask. */
const flushMicrotasks = async () => {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
};

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

const typeNative = (input: HTMLElement, value: string) => {
  Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    'value'
  )?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};

const pressKeyNative = (input: HTMLElement, key: string) => {
  input.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key })
  );
};

/**
 * Runs `steps` outside act() so React schedules work as it does in a browser:
 * sync-lane renders flush in microtasks, everything else waits for a later
 * task. That is what lets a step land before a deferred update renders.
 */
const runOutsideAct = async (steps: () => Promise<void>) => {
  const scope = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const actEnvironment = scope.IS_REACT_ACT_ENVIRONMENT;
  scope.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    await steps();
  } finally {
    scope.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
  }
};

// While a react-aria combobox is open, everything outside it is aria-hidden —
// including nodes added later — so screen readers and role queries lose the
// rest of the page.
describe('Autocomplete – a tag field without a dropdown', () => {
  it('never expands, so the rest of the page stays accessible while typing', async () => {
    render(<TagField />);
    const input = screen.getByRole('combobox', { name: 'Identities' });

    await userEvent.click(input);
    await userEvent.keyboard('identity');

    expect(input).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.getByRole('textbox', { name: 'Next field' })
    ).toBeInTheDocument();

    await userEvent.keyboard('{ArrowDown}');

    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('adds a tag on Enter without submitting the surrounding form', async () => {
    const onSubmit = vi.fn((event: Event) => event.preventDefault());
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent)}>
        <TagField />
      </form>
    );
    const input = screen.getByRole('combobox', { name: 'Identities' });

    await userEvent.click(input);
    await userEvent.keyboard('identity{Enter}{Enter}');

    expect(screen.getByText('identity')).toBeVisible();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  // Same type → Enter → move-on sequence as the Data Contract security form.
  it('stays collapsed when focus moves on right after Enter', async () => {
    render(<TagField />);
    const input = screen.getByRole('combobox', { name: 'Identities' });
    const nextField = screen.getByRole('textbox', { name: 'Next field' });

    await runOutsideAct(async () => {
      input.focus();
      typeNative(input, 'identity_1');
      pressKeyNative(input, 'Enter');
      await waitFor(() => expect(screen.getByText('identity_1')).toBeVisible());

      typeNative(input, 'identity_2');
      await flushMicrotasks();
      pressKeyNative(input, 'Enter');
      await flushMicrotasks();
      nextField.focus();

      await waitFor(() => expect(screen.getByText('identity_2')).toBeVisible());
      await settle();
    });

    await waitFor(() =>
      expect(input).toHaveAttribute('aria-expanded', 'false')
    );
    expect(
      screen.getByRole('textbox', { name: 'Next field' })
    ).toBeInTheDocument();
  });
});

describe('Autocomplete – focus leaves before a deferred open lands', () => {
  // react-stately reopens the menu from a passive effect when the input value
  // changes, and that update renders in a later task. Typing and moving on
  // before it renders lands the open on an unfocused combobox, which no later
  // blur would close.
  it('does not leave the dropdown open once its input has lost focus', async () => {
    render(<DropdownField />);
    const input = screen.getByRole('combobox', { name: 'Column' });
    const nextField = screen.getByRole('textbox', { name: 'Next field' });

    await runOutsideAct(async () => {
      input.focus();
      await flushMicrotasks();
      pressKeyNative(input, 'Escape');
      await settle();

      typeNative(input, 'T');
      await flushMicrotasks();
      nextField.focus();
      await settle();
    });

    // A late open is closed by a passive effect; on a loaded runner that can
    // land after settle(), so wait for it rather than assert a fixed point.
    await waitFor(() =>
      expect(input).toHaveAttribute('aria-expanded', 'false')
    );
    expect(
      screen.getByRole('textbox', { name: 'Next field' })
    ).toBeInTheDocument();
  });
});
