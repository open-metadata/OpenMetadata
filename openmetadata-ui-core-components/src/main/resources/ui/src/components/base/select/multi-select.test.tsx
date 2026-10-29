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
import { useListData } from 'react-aria-components';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MultiSelect } from './multi-select';
import type { SelectItemType } from './select';

const ITEMS: SelectItemType[] = [
  { id: 'table', label: 'Table' },
  { id: 'topic', label: 'Topic' },
];

const Example = ({
  showTagAvatars,
  onItemInserted,
}: {
  showTagAvatars?: boolean;
  onItemInserted?: (key: unknown) => void;
}) => {
  const selected = useListData<SelectItemType>({ initialItems: [ITEMS[0]] });

  return (
    <MultiSelect
      items={ITEMS}
      label="Entities"
      selectedItems={selected}
      showTagAvatars={showTagAvatars}
      onItemInserted={onItemInserted}>
      {(item) => (
        <MultiSelect.Item id={item.id} textValue={item.label}>
          {item.label}
        </MultiSelect.Item>
      )}
    </MultiSelect>
  );
};

describe('MultiSelect', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('anchors its popover to the trigger and matches its width', async () => {
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 0, y: 0, width: 321, height: 40 })
    );
    render(<Example />);

    await userEvent.click(screen.getByRole('combobox'));

    // The width comes from the trigger element, so it is only set when the
    // trigger ref reaches the DOM; the same ref positions the popover.
    const popover = (await screen.findByRole('listbox')).closest<HTMLElement>(
      '[data-trigger]'
    );

    expect(popover?.style.width).toBe('321px');
  });

  // react-aria commits the focused option when Tab leaves the input; a browser runs queued
  // microtasks between React's capture and bubble listeners, so this mimics one.
  it('adds nothing when Tab leaves the input with an option focused', async () => {
    vi.stubGlobal('queueMicrotask', (task: () => void) => task());
    const onItemInserted = vi.fn();
    render(<Example onItemInserted={onItemInserted} />);

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.tab();

    expect(onItemInserted).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('adds the focused option on Enter', async () => {
    const onItemInserted = vi.fn();
    render(<Example onItemInserted={onItemInserted} />);

    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.keyboard('{ArrowDown}{Enter}');

    expect(onItemInserted).toHaveBeenCalledTimes(1);
  });

  it('shows an avatar on each chip unless told the items are not people', () => {
    const { container, unmount } = render(<Example />);

    expect(container.querySelectorAll('[data-avatar]')).toHaveLength(1);

    unmount();
    const hidden = render(<Example showTagAvatars={false} />);

    expect(screen.getByText('Table')).toBeInTheDocument();
    expect(hidden.container.querySelectorAll('[data-avatar]')).toHaveLength(0);
  });
});
