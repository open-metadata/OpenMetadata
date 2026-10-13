/*
 *  Copyright 2022 Collate.
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
import {
  columnSortingFields,
  INITIAL_SORT_FIELD,
} from '../../constants/explore.constants';
import SortingDropDown from './SortingDropDown';

const fieldList = [
  { name: 'Popularity', value: 'totalVotes' },
  { name: 'Name', value: 'displayName.keyword' },
  { name: 'Last Updated', value: 'updatedAt' },
];

const SortingHarness = () => {
  const [sortField, setSortField] = useState('totalVotes');

  return (
    <SortingDropDown
      fieldList={fieldList}
      handleFieldDropDown={setSortField}
      sortField={sortField}
    />
  );
};

describe('SortingDropDown', () => {
  it('marks the current sort and moves that selection after choosing another field', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SortingHarness />);
    await user.click(screen.getByRole('button', { name: 'Popularity' }));
    const menu = await screen.findByRole('menu');

    expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(
      fieldList.length
    );
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Popularity' })
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Name' })
    ).toHaveAttribute('aria-checked', 'false');

    await user.click(within(menu).getByRole('menuitemradio', { name: 'Name' }));
    await user.click(screen.getByRole('button', { name: 'Name' }));

    expect(
      await screen.findByRole('menuitemradio', { name: 'Name' })
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      screen.getByRole('menuitemradio', { name: 'Popularity' })
    ).toHaveAttribute('aria-checked', 'false');
  });

  it('selects the displayed fallback for unsupported column sorts', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

    // Columns do not support the asset-level popularity default.
    expect(
      columnSortingFields.some((field) => field.value === INITIAL_SORT_FIELD)
    ).toBe(false);

    render(
      <SortingDropDown
        fieldList={columnSortingFields}
        handleFieldDropDown={jest.fn()}
        sortField={INITIAL_SORT_FIELD}
      />
    );

    expect(screen.getByTestId('sorting-dropdown-label')).toHaveTextContent(
      columnSortingFields[0].name
    );

    await user.click(screen.getByTestId('sorting-dropdown-label'));

    expect(
      await screen.findByRole('menuitemradio', {
        name: columnSortingFields[0].name,
      })
    ).toHaveAttribute('aria-checked', 'true');
  });
});
