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
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { usePersistentStorage } from '../../../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import {
  searchEntityTypeCounts,
  searchQuery,
} from '../../../../rest/searchAPI';
import { listTasks } from '../../../../rest/tasksAPI';
import {
  GlobalSearchQueryActionProps,
  GlobalSearchSourceContribution,
} from './GlobalSearch.types';
import GlobalSearchModal from './GlobalSearchModal';
import { useGlobalSearchStore } from './useGlobalSearchStore';

const mockNavigate = jest.fn();
let mockSources: GlobalSearchSourceContribution[] = [];

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../appModeExtensions', () => ({
  useGlobalSearchSources: () => mockSources,
  useGlobalSearchQueryAction: () => ({
    component: ({
      id,
      query,
      isActive,
      onSelect,
    }: GlobalSearchQueryActionProps) => (
      <button
        aria-selected={isActive}
        data-testid="query-action"
        id={id}
        role="option"
        onClick={onSelect}>
        {`ask ${query}`}
      </button>
    ),
    getPath: (question: string) => `/?prompt=${question}`,
    hintLabelKey: 'label.ask-assistant',
  }),
}));

jest.mock(
  '../../../common/DomainFilterChip/DomainFilterChip.component',
  () => ({
    DomainFilterChip: () => <span data-testid="domain-chip" />,
  })
);

jest.mock(
  '../../../Explore/ExploreQuickFilters',
  () =>
    ({
      onFieldValueSelect,
    }: {
      onFieldValueSelect: (field: {
        key: string;
        label: string;
        value: { key: string; label: string }[];
      }) => void;
    }) =>
      (
        <button
          aria-label="filter"
          data-testid="explore-quick-filters"
          onClick={() =>
            onFieldValueSelect({
              key: 'owners.displayName.keyword',
              label: 'Owners',
              value: [{ key: 'nobody', label: 'nobody' }],
            })
          }
        />
      )
);

// The real class pulls DomainUtils, whose import cycle leaves Task enums
// undefined when loaded from the modal.
jest.mock('../../../../utils/Domain/DomainClassBase', () => ({
  __esModule: true,
  default: { getListingFilters: () => [] },
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
  searchEntityTypeCounts: jest.fn(),
}));

jest.mock('../../../../rest/tasksAPI', () => ({
  listTasks: jest.fn(),
}));

const hit = (id: string, name: string, entityType: string) => ({
  _source: {
    id,
    name,
    displayName: name,
    entityType,
    fullyQualifiedName: `svc.db.schema.${name}`,
  },
});

const counts = (buckets: [string, number][]) => ({
  aggregations: {
    entityType: {
      buckets: buckets.map(([key, doc_count]) => ({ key, doc_count })),
    },
  },
});

const chatsSource: GlobalSearchSourceContribution = {
  key: 'chats',
  labelKey: 'label.chats',
  recentLabelKey: 'label.recent-chats',
  placeholderKey: 'message.search-chats',
  hasScopeShortcut: true,
  search: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
  recent: jest
    .fn()
    .mockResolvedValue([
      { id: 'c1', title: 'Customer Order Schema', icon: null, href: '/c/c1' },
    ]),
};

const renderModal = () =>
  render(
    <MemoryRouter>
      <GlobalSearchModal />
    </MemoryRouter>
  );

const type = async (value: string) => {
  fireEvent.change(screen.getByTestId('global-search-input'), {
    target: { value },
  });
  await act(async () => {
    jest.advanceTimersByTime(400);
  });
};

const press = (key: string, init: KeyboardEventInit = {}) =>
  fireEvent.keyDown(screen.getByTestId('global-search-input'), {
    key,
    ...init,
  });

describe('GlobalSearchModal', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockSources = [chatsSource];
    useGlobalSearchStore.setState({ isOpen: false, entry: 'all' });
    useApplicationStore.setState({
      currentUser: { id: 'u1', name: 'karthick', email: 'k@x.io' },
    });
    usePersistentStorage.setState({
      preferences: {
        karthick: {
          recentlySearched: [{ term: 'customer_id', timestamp: 1 }],
          recentlyViewed: [],
        },
      },
    } as never);
    (searchEntityTypeCounts as jest.Mock).mockImplementation(
      ({ searchIndex }: { searchIndex: string[] }) =>
        Promise.resolve(
          searchIndex[0] === 'dataAsset'
            ? counts([['table', 2]])
            : counts([
                ['table', 2],
                ['domain', 1],
              ])
        )
    );
    (searchQuery as jest.Mock).mockImplementation(({ searchIndex }) =>
      Promise.resolve(
        searchIndex === 'dataAsset'
          ? {
              hits: {
                total: { value: 2 },
                hits: [
                  hit('a1', 'customer', 'table'),
                  hit('a2', 'customer_orders', 'table'),
                ],
              },
            }
          : {
              hits: {
                total: { value: 1 },
                hits: [hit('d1', 'Customer 360', 'domain')],
              },
            }
      )
    );
    (listTasks as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('opens on ⌘K and shows only recents before typing', async () => {
    renderModal();

    await act(async () => {
      fireEvent.keyDown(window, { code: 'KeyK', key: 'k', metaKey: true });
    });

    expect(screen.getByTestId('global-search-modal')).toBeInTheDocument();
    expect(screen.queryByTestId('global-search-tabs')).not.toBeInTheDocument();
    expect(screen.getByText('customer_id')).toBeInTheDocument();
    expect(screen.getByText('label.recent-chats')).toBeInTheDocument();
    expect(screen.getByText('Customer Order Schema')).toBeInTheDocument();
  });

  it('builds a tab for each type the search API returned', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');

    expect(searchEntityTypeCounts).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('global-search-tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('global-search-tab-assets')).toBeInTheDocument();
    expect(screen.getByTestId('global-search-tab-domain')).toBeInTheDocument();
    expect(
      screen.queryByTestId('global-search-tab-tasks')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('global-search-row-d1')).toHaveTextContent(
      'Customer 360'
    );
  });

  it('carries the query, filters and sort to Explore from the assets tab', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');

    press('Tab');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    // Pick an owner filter on the Data assets tab, then hand off.
    fireEvent.click(screen.getByTestId('explore-quick-filters'));
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    fireEvent.click(screen.getByTestId('global-search-footer-action'));

    const url = decodeURIComponent(mockNavigate.mock.calls[0][0]);

    expect(url).toContain('search=customer');
    expect(url).toContain('sort=_score');
    expect(url).toContain('quickFilter=');
    expect(url).toContain('"nobody"');
    expect(useGlobalSearchStore.getState().isOpen).toBe(false);
  });

  it('moves down the list with the arrows and opens the row with Enter', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');

    // The first result starts highlighted; one ArrowDown moves to the second.
    press('ArrowDown');
    press('Enter');

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('customer_orders')
    );
  });

  it('previews a data asset on the first Enter and opens it on the second', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');
    press('Tab');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    press('ArrowDown');
    press('Enter');

    expect(screen.getByTestId('global-search-summary')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();

    press('Enter');

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('customer')
    );
  });

  it('closes on Esc when focus has left the input', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');
    // e.g. a filter or sort trigger after picking a value
    screen.getByTestId('global-search-close').focus();

    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });

    expect(useGlobalSearchStore.getState().isOpen).toBe(false);
  });

  it('opens nothing with Enter while the list reloads behind skeletons', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');

    // Switching tab reloads the list; until it lands the old rows are hidden.
    press('Tab');
    press('Enter');

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(
      screen.queryByTestId('global-search-summary')
    ).not.toBeInTheDocument();
  });

  it('leaves Enter to an IME while it is composing', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');

    press('ArrowDown');
    press('Enter', { isComposing: true });
    press('Escape', { isComposing: true });

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(screen.getByTestId('global-search-input')).toHaveValue('customer');
  });

  it('runs the plugin query action with ⌘↵ only, never with a plain Enter', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');

    // The first result is highlighted; ArrowUp reaches the action above it.
    expect(screen.getByTestId('query-action')).toHaveAttribute(
      'aria-selected',
      'false'
    );

    press('ArrowUp');

    expect(screen.getByTestId('query-action')).toHaveAttribute(
      'aria-selected',
      'true'
    );

    press('Enter');

    expect(mockNavigate).not.toHaveBeenCalled();

    press('Enter', { metaKey: true });

    expect(mockNavigate).toHaveBeenCalledWith('/?prompt=customer');
  });

  it('shows skeleton tabs and rows until the first results arrive', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    fireEvent.change(screen.getByTestId('global-search-input'), {
      target: { value: 'customer' },
    });

    expect(
      screen.getByTestId('global-search-tabs-loading')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('global-search-tab-all')
    ).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(
      screen.queryByTestId('global-search-tabs-loading')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('global-search-tab-all')).toBeInTheDocument();
  });

  it('opens scoped to the source that takes ⌥⌘K and stays open on Backspace', async () => {
    renderModal();

    await act(async () => {
      fireEvent.keyDown(window, {
        code: 'KeyK',
        key: '˚',
        metaKey: true,
        altKey: true,
      });
    });

    expect(useGlobalSearchStore.getState().entry).toBe('chats');
    expect(screen.getByTestId('global-search-input')).toHaveAttribute(
      'placeholder',
      'message.search-chats'
    );
    // Before typing, the tab counts the source's recent rows.
    expect(screen.getByTestId('global-search-tab-chats')).toHaveTextContent(
      'label.chats1'
    );
    expect(
      screen.queryByTestId('global-search-tab-all')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('global-search-everything')).toBeInTheDocument();

    // Holding Backspace to clear the text keeps firing on the empty input.
    press('Backspace');
    press('Backspace', { repeat: true });

    expect(useGlobalSearchStore.getState().isOpen).toBe(true);

    press('Escape');

    expect(useGlobalSearchStore.getState().isOpen).toBe(false);
  });

  it('closes on Escape even with a query typed', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');

    press('Escape');

    expect(useGlobalSearchStore.getState().isOpen).toBe(false);
  });

  it('keeps the arrows working after a row is clicked to preview it', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');
    press('Tab');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    const input = screen.getByTestId('global-search-input');
    const first = screen.getByTestId('global-search-row-a1');

    // Pressing a row must not move focus off the input.
    expect(fireEvent.mouseDown(first)).toBe(false);

    fireEvent.click(first);

    expect(screen.getByTestId('global-search-summary')).toBeInTheDocument();

    press('ArrowDown');

    expect(screen.getByTestId('global-search-row-a2')).toHaveAttribute(
      'aria-selected',
      'true'
    );

    fireEvent.click(screen.getByTestId('global-search-summary-close'));

    expect(input).toHaveFocus();
  });

  it('switches tabs with a click and keeps focus in the input', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');
    jest.useRealTimers();

    await userEvent.click(screen.getByTestId('global-search-tab-domain'));
    await act(async () => {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    });

    expect(screen.getByTestId('global-search-tab-domain')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('global-search-input')).toHaveFocus();
  });

  it('keeps the tab when its own filter matches nothing so it can be undone', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');
    await userEvent.click(screen.getByTestId('global-search-tab-domain'), {
      advanceTimers: jest.advanceTimersByTime,
    });
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    (searchQuery as jest.Mock).mockImplementation(({ searchIndex }) =>
      Promise.resolve({
        hits: {
          total: { value: searchIndex === 'dataAsset' ? 2 : 0 },
          hits: [],
        },
      })
    );

    fireEvent.click(screen.getByTestId('explore-quick-filters'));
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(screen.getByTestId('global-search-tab-domain')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('explore-quick-filters')).toBeInTheDocument();
  });

  it('clears the text, tab and filters together from the clear button', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');

    press('Tab');
    await act(async () => {
      jest.advanceTimersByTime(400);
    });

    expect(screen.getByTestId('explore-quick-filters')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'label.clear' }));
    await type('customer');

    expect(screen.getByTestId('global-search-input')).toHaveValue('customer');
    expect(
      screen.queryByTestId('explore-quick-filters')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('global-search-tab-all')).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });
});
