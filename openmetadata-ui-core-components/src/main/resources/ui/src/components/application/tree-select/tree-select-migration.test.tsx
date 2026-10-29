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
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TreeSelect } from './tree-select';
import { TreeSelectNode } from './tree-select.types';

const children: TreeSelectNode[] = [
  { id: 'a', label: 'A', value: 'a' },
  { id: 'b', label: 'B', value: 'b' },
];
const parent: TreeSelectNode = {
  id: 'all',
  label: 'All',
  value: 'all',
  children,
};
const fetchData = async () => ({ nodes: [parent] });

describe('TreeSelect migrated selection contracts', () => {
  it('moves keyboard focus into asynchronously loaded options and selects with Enter', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <TreeSelect
        multiple
        searchable
        aria-label="Choose teams"
        fetchData={async () => ({ nodes: children })}
        id="teams"
        onChange={onChange}
      />
    );
    const input = screen.getByRole('combobox', { name: 'Choose teams' });
    expect(input).toHaveAttribute('id', 'teams');
    await user.click(input);
    await user.keyboard('{ArrowDown}');
    const firstRow = await screen.findByRole('row', { name: 'A' });
    await waitFor(() => expect(firstRow).toHaveFocus());
    expect(input).toHaveAttribute(
      'aria-controls',
      screen.getByRole('treegrid').id
    );
    await user.keyboard('{Enter}');
    await waitFor(() => expect(onChange).toHaveBeenCalledWith([children[0]]));
  });

  it('limits visible chips without discarding hidden selections', () => {
    render(
      <TreeSelect
        multiple
        fetchData={fetchData}
        maxVisibleItems={1}
        placeholder="Teams"
        value={children}
      />
    );
    expect(screen.getByText('A')).toBeInTheDocument();
    expect(screen.queryByText('B')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });
  it('collapses a selected branch in the trigger and forwards focus events', async () => {
    const onFocus = vi.fn();
    const onBlur = vi.fn();
    const user = userEvent.setup();
    render(
      <TreeSelect
        cascadeSelection
        multiple
        fetchData={fetchData}
        placeholder="Metrics"
        selectedDisplayStrategy="parent"
        value={[parent, ...children]}
        onBlur={onBlur}
        onFocus={onFocus}
      />
    );
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.queryByText('A')).not.toBeInTheDocument();
    await user.click(screen.getByRole('combobox', { name: 'Metrics' }));
    expect(onFocus).toHaveBeenCalled();
    await user.tab();
    expect(onBlur).toHaveBeenCalled();
  });
});
