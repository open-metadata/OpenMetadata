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

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { SORT_ORDER } from '../../../enums/common.enum';
import {
  useEnUsTranslations,
  useKeyEchoTranslations,
} from '../../../test/unit/enUsTranslation';
import ExploreSortDropdown from './ExploreSortDropdown';

const fieldList = [
  { name: 'Popularity', value: 'totalVotes' },
  { name: 'Name', value: 'displayName.keyword' },
  { name: 'Relevance', value: '_score' },
  { name: 'Last Updated', value: 'updatedAt' },
];

const SortHarness = ({ onChange }: { onChange: jest.Mock }) => {
  const [sort, setSort] = useState({
    field: 'totalVotes',
    order: SORT_ORDER.DESC as string,
  });

  return (
    <ExploreSortDropdown
      fieldList={fieldList}
      sortField={sort.field}
      sortOrder={sort.order}
      onChange={(field, order) => {
        onChange(field, order);
        setSort({ field, order });
      }}
    />
  );
};

const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByTestId('sorting-dropdown-label'));

  return screen.findByRole('menu');
};

describe('ExploreSortDropdown', () => {
  afterEach(() => {
    useKeyEchoTranslations();
  });

  it('groups every field with its order options and checks the current one', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SortHarness onChange={jest.fn()} />);

    expect(screen.getByTestId('sorting-dropdown-label')).toHaveTextContent(
      'Popularity'
    );

    const menu = await openMenu(user);

    // Relevance has a single order, every other field two.
    expect(within(menu).getAllByRole('menuitemradio')).toHaveLength(7);
    expect(
      within(menu).getByRole('group', { name: 'Relevance' })
    ).toBeInTheDocument();
    expect(
      within(menu).getByRole('menuitemradio', {
        name: 'label.most-votes-first',
      })
    ).toHaveAttribute('aria-checked', 'true');
    expect(
      within(menu).getByRole('menuitemradio', {
        name: 'label.fewest-votes-first',
      })
    ).toHaveAttribute('aria-checked', 'false');
  });

  it('sets field and order together in one change', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    const onChange = jest.fn();
    render(<SortHarness onChange={onChange} />);

    const menu = await openMenu(user);
    await user.click(
      within(menu).getByRole('menuitemradio', { name: 'label.z-to-a' })
    );

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(
      'displayName.keyword',
      SORT_ORDER.DESC
    );
    expect(screen.getByTestId('sorting-dropdown-label')).toHaveTextContent(
      'Name'
    );

    const reopened = await openMenu(user);

    expect(
      within(reopened).getByRole('menuitemradio', { name: 'label.z-to-a' })
    ).toHaveAttribute('aria-checked', 'true');
  });

  it('names the current field and order in a hover tooltip and follows the selection', async () => {
    useEnUsTranslations();
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<SortHarness onChange={jest.fn()} />);
    const trigger = screen.getByTestId('sorting-dropdown-label');

    await user.hover(trigger);

    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Sorted by Popularity (Most votes first)'
    );

    await user.unhover(trigger);
    const menu = await openMenu(user);
    await user.click(
      within(menu).getByRole('menuitemradio', { name: 'Z to A' })
    );
    await user.unhover(trigger);
    await user.hover(trigger);

    await waitFor(() =>
      expect(screen.getByRole('tooltip')).toHaveTextContent(
        'Sorted by Name (Z to A)'
      )
    );
  });

  it('falls back to the first field and its default order for a stale sort', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(
      <ExploreSortDropdown
        fieldList={fieldList}
        sortField="unsupported.field"
        sortOrder="sideways"
        onChange={jest.fn()}
      />
    );

    expect(screen.getByTestId('sorting-dropdown-label')).toHaveTextContent(
      'Popularity'
    );

    const menu = await openMenu(user);

    expect(
      within(menu).getByRole('menuitemradio', {
        name: 'label.most-votes-first',
      })
    ).toHaveAttribute('aria-checked', 'true');
  });
});
