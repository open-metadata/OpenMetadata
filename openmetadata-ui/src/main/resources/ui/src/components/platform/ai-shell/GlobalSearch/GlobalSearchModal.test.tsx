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
import { MemoryRouter } from 'react-router-dom';
import { usePersistentStorage } from '../../../../hooks/currentUserStore/useCurrentUserStore';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { searchQuery } from '../../../../rest/searchAPI';
import { listTasks } from '../../../../rest/tasksAPI';
import { GlobalSearchSourceContribution } from './GlobalSearch.types';
import GlobalSearchModal from './GlobalSearchModal';
import { useGlobalSearchStore } from './useGlobalSearchStore';

const mockNavigate = jest.fn();
const mockAskPath = jest.fn((question: string) => `/?prompt=${question}`);
let mockSources: GlobalSearchSourceContribution[] = [];

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

jest.mock('../appModeExtensions', () => ({
  useGlobalSearchSources: () => mockSources,
  useGlobalSearchAskAi: () => ({
    getPath: mockAskPath,
    labelKey: 'label.ask-assistant-about',
    hintLabelKey: 'label.ask-assistant',
  }),
}));

jest.mock(
  '../../../common/DomainFilterChip/DomainFilterChip.component',
  () => ({
    DomainFilterChip: () => <span data-testid="domain-chip" />,
  })
);

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: jest.fn(),
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
    fullyQualifiedName: `svc.db.${name}`,
  },
});

const chatsSource: GlobalSearchSourceContribution = {
  key: 'chats',
  labelKey: 'label.chats',
  recentLabelKey: 'label.recent-chats',
  placeholderKey: 'message.search-chats',
  search: jest.fn().mockResolvedValue({ count: 0, rows: [] }),
  recent: jest.fn().mockResolvedValue([
    {
      id: 'c1',
      title: 'Customer Order Schema',
      icon: null,
      href: '/conversations/c1',
    },
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
    (searchQuery as jest.Mock).mockImplementation(({ searchIndex }) =>
      Promise.resolve(
        Array.isArray(searchIndex) && searchIndex.length > 2
          ? {
              hits: {
                total: { value: 2 },
                hits: [
                  hit('a1', 'customer', 'table'),
                  hit('a2', 'customer_orders', 'table'),
                ],
              },
            }
          : { hits: { total: { value: 0 }, hits: [] } }
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
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByText('label.recent-search-plural')).toBeInTheDocument();
    expect(screen.getByText('customer_id')).toBeInTheDocument();
    expect(screen.getByText('Customer Order Schema')).toBeInTheDocument();
  });

  it('shows tabs only for types that matched and carries the query to Explore', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');

    expect(screen.getByTestId('global-search-tab-all')).toBeInTheDocument();
    expect(screen.getByTestId('global-search-tab-assets')).toBeInTheDocument();
    expect(
      screen.queryByTestId('global-search-tab-tasks')
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('global-search-tab-assets'));
    await act(async () => {
      jest.advanceTimersByTime(400);
    });
    fireEvent.click(screen.getByTestId('global-search-footer-action'));

    expect(mockNavigate).toHaveBeenCalledWith(
      expect.stringContaining('search=customer'),
      { state: { fromGlobalSearch: { query: 'customer', filterCount: 0 } } }
    );
    expect(useGlobalSearchStore.getState().isOpen).toBe(false);
  });

  it('puts the ask-AI row first and sends the query with ⌘↵', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');

    expect(screen.getByTestId('global-search-ask-ai')).toHaveAttribute(
      'aria-selected',
      'true'
    );
    expect(screen.getByTestId('global-search-ask-ai')).toHaveTextContent(
      'label.ask-assistant-about'
    );

    fireEvent.keyDown(screen.getByTestId('global-search-input'), {
      key: 'Enter',
      metaKey: true,
    });

    expect(mockNavigate).toHaveBeenCalledWith('/?prompt=customer');
  });

  it('scopes to chats from ⌥⌘K and closes on Backspace with an empty query', async () => {
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
    expect(screen.getByText('label.recent-chats')).toBeInTheDocument();
    expect(screen.getByTestId('global-search-tab-chats')).toBeInTheDocument();
    expect(
      screen.queryByTestId('global-search-tab-all')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('global-search-everything')).toBeInTheDocument();

    fireEvent.keyDown(screen.getByTestId('global-search-input'), {
      key: 'Backspace',
    });

    expect(useGlobalSearchStore.getState().isOpen).toBe(false);
  });

  it('clears the query on the first Escape and closes on the second', async () => {
    useGlobalSearchStore.setState({ isOpen: true, entry: 'all' });
    renderModal();
    await type('customer');
    const input = screen.getByTestId('global-search-input');

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(input).toHaveValue('');
    expect(useGlobalSearchStore.getState().isOpen).toBe(true);

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(useGlobalSearchStore.getState().isOpen).toBe(false);
  });
});
