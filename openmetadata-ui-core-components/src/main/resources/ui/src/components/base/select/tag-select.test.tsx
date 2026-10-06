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
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TagSelect, type TagSelectProps } from './tag-select';

const OPTIONS = [
  { id: 'pii', label: 'PII' },
  { id: 'tier1', label: 'Tier 1' },
  { id: 'gold', label: 'Gold', isDisabled: true },
];

const Controlled = (props: Partial<TagSelectProps>) => {
  const [value, setValue] = useState<string[]>(props.value ?? []);

  return (
    <TagSelect
      label="Tags"
      options={OPTIONS}
      placeholder="Pick tags"
      {...props}
      value={value}
      onChange={(ids) => {
        setValue(ids);
        props.onChange?.(ids);
      }}
    />
  );
};

const chips = () =>
  screen.queryByRole('grid')
    ? within(screen.getByRole('grid'))
        .getAllByRole('row')
        .map((row) => row.textContent)
    : [];

describe('TagSelect', () => {
  it('shows the placeholder when nothing is selected', () => {
    render(<Controlled />);

    expect(screen.getByText('Pick tags')).toBeInTheDocument();
    expect(chips()).toEqual([]);
  });

  it('selects options from the list and renders them as chips', async () => {
    const onChange = vi.fn();
    render(<Controlled onChange={onChange} />);

    await userEvent.click(screen.getByRole('button', { name: /Tags/ }));
    await userEvent.click(screen.getByRole('option', { name: 'PII' }));
    await userEvent.click(screen.getByRole('option', { name: 'Tier 1' }));

    expect(onChange).toHaveBeenLastCalledWith(['pii', 'tier1']);
    expect(chips()).toEqual(['PII', 'Tier 1']);
    expect(screen.getByRole('option', { name: 'Gold' })).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('removes a value via its chip remove button', async () => {
    const onChange = vi.fn();
    render(<Controlled value={['pii', 'tier1']} onChange={onChange} />);

    const piiRow = within(screen.getByRole('grid')).getByRole('row', {
      name: 'PII',
    });
    await userEvent.click(within(piiRow).getByRole('button'));

    expect(onChange).toHaveBeenLastCalledWith(['tier1']);
    expect(chips()).toEqual(['Tier 1']);
  });

  it('clears everything with allowClear', async () => {
    const onChange = vi.fn();
    render(<Controlled allowClear value={['pii']} onChange={onChange} />);

    await userEvent.click(
      screen.getByRole('button', { name: 'label.clear-all' })
    );

    expect(onChange).toHaveBeenLastCalledWith([]);
    expect(chips()).toEqual([]);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('hides remove and clear controls when disabled', () => {
    render(<Controlled allowClear isDisabled value={['pii']} />);

    expect(
      screen.queryByRole('button', { name: 'label.clear-all' })
    ).toBeNull();
    expect(within(screen.getByRole('grid')).queryByRole('button')).toBeNull();
  });
});
