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
import { fireEvent, render, screen } from '@testing-library/react';
import SelectionCardGroup from './SelectionCardGroup';
import { SelectionOption } from './SelectionCardGroup.interface';

const OPTIONS: SelectionOption[] = [
  {
    value: 'table',
    label: 'Table Level',
    description: 'Table description',
    icon: <span />,
  },
  {
    value: 'column',
    label: 'Column Level',
    description: 'Column description',
    icon: <span />,
    isBeta: true,
  },
];

describe('SelectionCardGroup', () => {
  it('marks only the card matching value as selected', () => {
    render(<SelectionCardGroup options={OPTIONS} value="column" />);

    const [table, column] = screen.getAllByRole('radio');

    expect(table).toHaveAttribute('aria-checked', 'false');
    expect(table).not.toHaveClass('selected');
    expect(column).toHaveAttribute('aria-checked', 'true');
    expect(column).toHaveClass('selection-card', 'selected', 'has-beta');
    expect(screen.getByRole('radiogroup')).toHaveClass('selection-card-group');
  });

  it('calls onChange and onClick with the clicked option', () => {
    const onChange = jest.fn();
    const onClick = jest.fn();
    render(
      <SelectionCardGroup
        options={OPTIONS}
        value="table"
        onChange={onChange}
        onClick={onClick}
      />
    );

    fireEvent.click(screen.getByText('Column Level'));

    expect(onChange).toHaveBeenCalledWith('column');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('selects with Enter and Space', () => {
    const onChange = jest.fn();
    render(<SelectionCardGroup options={OPTIONS} onChange={onChange} />);

    const [table, column] = screen.getAllByRole('radio');
    fireEvent.keyDown(table, { key: 'Enter' });
    fireEvent.keyDown(column, { key: ' ' });

    expect(onChange.mock.calls).toEqual([['table'], ['column']]);
  });

  it('ignores clicks and keys when disabled', () => {
    const onChange = jest.fn();
    render(
      <SelectionCardGroup disabled options={OPTIONS} onChange={onChange} />
    );

    const [table] = screen.getAllByRole('radio');
    fireEvent.click(table);
    fireEvent.keyDown(table, { key: 'Enter' });

    expect(onChange).not.toHaveBeenCalled();
    expect(table).toHaveAttribute('tabindex', '-1');
    expect(table).toHaveClass('disabled');
  });
});
