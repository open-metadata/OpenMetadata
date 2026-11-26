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
import { fireEvent, render, screen, within } from '@testing-library/react';
import { GlobalSearchListItem } from './GlobalSearch.types';
import GlobalSearchResultList, {
  GlobalSearchResultListProps,
} from './GlobalSearchResultList';

const onHover = jest.fn();
const onRetry = jest.fn();
const onSearchEverywhere = jest.fn();
const onSeeAll = jest.fn();
const onSelect = jest.fn();

const items: GlobalSearchListItem[] = [
  {
    kind: 'section',
    key: 'assets',
    label: 'Data assets',
    hasSort: true,
    seeAll: { label: 'See all 9', onPress: onSeeAll },
  },
  {
    kind: 'row',
    key: 'assets-a1',
    row: { id: 'a1', title: 'orders', icon: null },
    enterLabel: 'label.open',
    onSelect,
  },
  { kind: 'section', key: 'tasks', label: 'Tasks' },
  {
    kind: 'row',
    key: 'tasks-t1',
    row: { id: 't1', title: 'Review', icon: null },
    enterLabel: 'label.open',
    onSelect,
  },
];

const renderList = (props: Partial<GlobalSearchResultListProps> = {}) =>
  render(
    <GlobalSearchResultList
      hasError={false}
      isEmpty={false}
      isFirstLoad={false}
      isScoped={false}
      items={items}
      query="ord"
      scopeLabel="Chats"
      sortControl={<span data-testid="sort-control" />}
      onHover={onHover}
      onRetry={onRetry}
      onSearchEverywhere={onSearchEverywhere}
      {...props}
    />
  );

describe('GlobalSearchResultList', () => {
  it('shows skeleton rows on the first load', () => {
    const { container } = renderList({ isFirstLoad: true });

    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows the error state with a retry', () => {
    renderList({ hasError: true });

    expect(
      screen.getByText('message.global-search-error-title')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.reload' }));

    expect(onRetry).toHaveBeenCalled();
  });

  it('shows the empty state without a way out when not scoped', () => {
    renderList({ isEmpty: true });

    expect(screen.getByTestId('global-search-empty')).toHaveTextContent(
      'message.global-search-no-result'
    );
    expect(
      screen.getByText('message.global-search-no-result-hint')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'label.search-everywhere' })
    ).not.toBeInTheDocument();
  });

  it('offers search everywhere when scoped and empty', () => {
    renderList({
      emptyHintKey: 'message.ask-instead',
      isEmpty: true,
      isScoped: true,
    });

    expect(
      screen.getByText('message.global-search-no-type-match')
    ).toBeInTheDocument();
    expect(screen.getByText('message.ask-instead')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'label.search-everywhere' })
    );

    expect(onSearchEverywhere).toHaveBeenCalled();
  });

  it('renders sections and rows, with sort only on the sortable section', () => {
    renderList({ activeKey: 'tasks-t1' });

    // One listbox per section, named by its heading; the heading's own
    // controls (sort, "See all") sit outside it, since a listbox holds options only.
    const assets = screen.getByRole('listbox', { name: 'Data assets' });

    expect(screen.getByRole('listbox', { name: 'Tasks' })).toBeInTheDocument();
    expect(within(assets).queryByRole('button')).not.toBeInTheDocument();
    expect(within(assets).getAllByRole('option').length).toBeGreaterThan(0);
    expect(screen.getAllByTestId('sort-control')).toHaveLength(1);
    expect(screen.getByTestId('global-search-row-t1')).toHaveAttribute(
      'aria-selected',
      'true'
    );

    fireEvent.mouseMove(screen.getByTestId('global-search-row-a1'));

    expect(onHover).toHaveBeenCalledWith('assets-a1');

    fireEvent.click(screen.getByRole('button', { name: 'See all 9' }));

    expect(onSeeAll).toHaveBeenCalled();
  });
});
