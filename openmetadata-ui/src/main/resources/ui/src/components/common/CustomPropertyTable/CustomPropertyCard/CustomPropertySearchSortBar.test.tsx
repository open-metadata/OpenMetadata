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
import { SORT_OPTIONS } from './CustomPropertyCard.constants';
import { CustomPropertySortMode } from './CustomPropertyCard.interface';
import { CustomPropertySearchSortBar } from './CustomPropertySearchSortBar';

const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

const renderBar = (
  props: Partial<
    Parameters<typeof CustomPropertySearchSortBar<CustomPropertySortMode>>[0]
  > = {}
) => {
  const onSearchChange = jest.fn();
  const onSortChange = jest.fn();

  render(
    <CustomPropertySearchSortBar<CustomPropertySortMode>
      searchText=""
      sortMode="name"
      sortOptions={SORT_OPTIONS}
      onSearchChange={onSearchChange}
      onSortChange={onSortChange}
      {...props}
    />
  );

  return { onSearchChange, onSortChange };
};

describe('CustomPropertySearchSortBar', () => {
  it('reports typed search text', async () => {
    const { onSearchChange } = renderBar();

    await user.type(screen.getByTestId('custom-property-search'), 'e');

    expect(onSearchChange).toHaveBeenCalledWith('e');
  });

  it('labels the sort button with the active option and switches sort', async () => {
    const { onSortChange } = renderBar({ sortMode: 'type' });

    const sortButton = screen.getByTestId('custom-property-sort');

    expect(sortButton).toHaveTextContent('label.sort-colon-value');

    await user.click(sortButton);
    await user.click(
      await screen.findByRole('menuitemradio', {
        name: 'label.with-value-first',
      })
    );

    expect(onSortChange).toHaveBeenCalledWith('value');
  });

  it('hides the sort menu without sort options instead of crashing', () => {
    renderBar({ sortOptions: [] });

    expect(screen.getByTestId('custom-property-search')).toBeInTheDocument();
    expect(
      screen.queryByTestId('custom-property-sort')
    ).not.toBeInTheDocument();
  });
});
