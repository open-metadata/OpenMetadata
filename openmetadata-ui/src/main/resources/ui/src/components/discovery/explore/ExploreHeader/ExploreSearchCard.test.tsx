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

import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { SearchIndex } from '../../../../enums/search.enum';
import { ExploreSearchCard } from './ExploreSearchCard';

const mockNavigate = jest.fn();
const mockGetExplorePath = jest.fn();
const mockAddToRecentSearched = jest.fn();
const mockInitNLP = jest.fn();
const mockSetNLPActive = jest.fn();
const mockSearchQuery = jest.fn();
const mockSetPreference = jest.fn();
let mockLocation = { pathname: '/explore', search: '' };

let mockSearchCriteria: SearchIndex | undefined = SearchIndex.TABLE;
let mockIsNLPActive = false;
let mockIsNLPEnabled = true;
let mockPersistedNLPActive: boolean | undefined;
let mockCurrentUser: { displayName?: string; name?: string } = {
  displayName: 'Admin User',
  name: 'admin',
};

const mockTranslations: Record<string, string> = {
  'label.explore-title': 'Explore Assets',
  'label.dashboard-plural': 'Dashboards',
  'label.quick-filter-plural': 'Quick filters',
  'label.recently-updated': 'Recently updated',
  'label.table-plural': 'Tables',
  'label.tier-1': 'Tier 1',
  'label.use-natural-language-search': 'Use natural language search',
  'message.explore-assets-indexed': '{{total}} assets indexed',
  'message.explore-assets-indexed-suffix': 'assets indexed',
  'message.explore-search-placeholder': 'Search across your Context Platform',
  'message.natural-language-search-active': 'Natural language search active',
};

jest.mock('react-router-dom', () => ({
  useLocation: () => mockLocation,
  useNavigate: () => mockNavigate,
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, string>) =>
      (mockTranslations[key] ?? key).replace('{{total}}', values?.total ?? ''),
  }),
}));

jest.mock('../../../../components/AppBar/Suggestions', () => ({
  __esModule: true,
  default: ({
    isNLPActive,
    onSearchTextUpdate,
    searchCriteria,
    searchText,
  }: {
    isNLPActive?: boolean;
    onSearchTextUpdate?: (value: string) => void;
    searchCriteria?: SearchIndex;
    searchText: string;
  }) =>
    isNLPActive ? (
      <button
        data-testid="nlp-suggestions-button"
        type="button"
        onClick={() => onSearchTextUpdate?.('Tables owned by marketing')}>
        NLP suggestion
      </button>
    ) : (
      <div data-testid="explore-search-suggestions">
        {searchCriteria}:{searchText}
      </div>
    ),
}));

jest.mock('../../../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: () => ({
    preferences: { isNLPActive: mockPersistedNLPActive },
    setPreference: mockSetPreference,
  }),
}));

jest.mock('../../../../hooks/useApplicationStore', () => ({
  useApplicationStore: (
    selector: (state: {
      searchCriteria?: SearchIndex;
      currentUser: typeof mockCurrentUser;
    }) => unknown
  ) =>
    selector({
      searchCriteria: mockSearchCriteria,
      currentUser: mockCurrentUser,
    }),
}));

jest.mock('../../../../hooks/useSearchStore', () => ({
  useSearchStore: () => ({
    initNLP: mockInitNLP,
    isNLPActive: mockIsNLPActive,
    isNLPEnabled: mockIsNLPEnabled,
    setNLPActive: mockSetNLPActive,
  }),
}));

jest.mock('../../../../rest/searchAPI', () => ({
  searchQuery: (...args: unknown[]) => mockSearchQuery(...args),
}));

jest.mock('../../../../utils/RecentActivityUtils', () => ({
  addToRecentSearched: (value: string) => mockAddToRecentSearched(value),
}));

jest.mock('../../../../utils/RouterUtils', () => ({
  getExplorePath: (...args: unknown[]) => mockGetExplorePath(...args),
}));

jest.mock('../../../../utils/FilterQueryUtils', () => ({
  getEntityTypeExploreQueryFilter: (entityType: string) =>
    JSON.stringify({
      query: {
        bool: {
          must: [
            {
              bool: {
                should: [{ term: { 'entityType.keyword': entityType } }],
              },
            },
          ],
        },
      },
    }),
}));

jest.mock('../../../../utils/SearchClassBase', () => ({
  __esModule: true,
  default: {
    getTabsInfo: () => ({
      dashboard: { path: 'dashboards' },
      table: { path: 'tables' },
    }),
  },
}));

jest.mock('@openmetadata/ui-core-components', () => ({
  // Preserve real input and popover behavior while simplifying unrelated layout primitives.
  ...jest.requireActual('@openmetadata/ui-core-components'),
  Box: ({
    align: _align,
    children,
    direction: _direction,
    gap: _gap,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
  ),
  Card: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <div {...(props as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>
  ),
  Divider: ({
    orientation: _orientation,
    ...props
  }: Record<string, unknown>) => (
    <hr {...(props as React.HTMLAttributes<HTMLHRElement>)} />
  ),
  Button: ({
    children,
    color: _color,
    iconLeading: IconLeading,
    onPress,
    size: _size,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => {
    const LeadingIcon =
      typeof IconLeading === 'function'
        ? (IconLeading as React.ComponentType)
        : null;

    return (
      <button
        {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}
        onClick={(event) => {
          (props as React.ButtonHTMLAttributes<HTMLButtonElement>).onClick?.(
            event
          );
          (onPress as (() => void) | undefined)?.();
        }}>
        {LeadingIcon ? <LeadingIcon /> : (IconLeading as React.ReactNode)}
        {children}
      </button>
    );
  },
  ButtonUtility: ({
    color: _color,
    icon,
    size: _size,
    tooltip: _tooltip,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <button {...(props as React.ButtonHTMLAttributes<HTMLButtonElement>)}>
      {icon as React.ReactNode}
    </button>
  ),
  Typography: ({
    align: _align,
    children,
    size: _size,
    weight: _weight,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => (
    <span {...(props as React.HTMLAttributes<HTMLSpanElement>)}>
      {children}
    </span>
  ),
}));

jest.mock('@untitledui/icons', () => ({
  Plus: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-plus" {...props} />
  ),
  SearchMd: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-search" {...props} />
  ),
}));

jest.mock(
  '../../../../assets/svg/explore-header-icon.svg',
  () => ({
    ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
      <svg data-testid="explore-search-card-icon" {...props} />
    ),
  }),
  { virtual: true }
);

jest.mock('../../../../assets/svg/ic-suggestions-active.svg', () => ({
  ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-suggestions-active" {...props} />
  ),
}));

jest.mock('../../../../assets/svg/ic-suggestions-blue.svg', () => ({
  ReactComponent: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-suggestions-blue" {...props} />
  ),
}));

const getSearchInput = () =>
  screen.getByRole('textbox', {
    name: 'Search across your Context Platform',
  });

describe('ExploreSearchCard', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockNavigate.mockClear();
    mockAddToRecentSearched.mockClear();
    mockGetExplorePath.mockReset();
    mockGetExplorePath.mockReturnValue(
      '/explore/tables?search=orders&sort=_score'
    );
    mockInitNLP.mockClear();
    mockSetNLPActive.mockClear();
    mockSetPreference.mockClear();
    mockSearchQuery.mockReset();
    mockSearchQuery.mockReturnValue(new Promise(() => undefined));
    mockIsNLPActive = false;
    mockIsNLPEnabled = true;
    mockPersistedNLPActive = undefined;
    mockSearchCriteria = SearchIndex.TABLE;
    mockCurrentUser = { displayName: 'Admin User', name: 'admin' };
    mockLocation = { pathname: '/explore', search: '' };
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the AI explore search card', () => {
    render(<ExploreSearchCard />);

    expect(screen.getByTestId('explore-search-card')).toBeInTheDocument();
    expect(screen.getByTestId('explore-search-card-icon')).toBeInTheDocument();
    expect(screen.getByTestId('explore-search-card-title')).toHaveTextContent(
      'Explore Assets'
    );
    expect(
      screen.queryByTestId('explore-search-card-subtitle')
    ).not.toBeInTheDocument();
    expect(mockInitNLP).toHaveBeenCalled();
  });

  it('removes the core input outline from the embedded search field', () => {
    render(<ExploreSearchCard />);

    expect(getSearchInput().parentElement).toHaveClass(
      'tw:outline-0!',
      'tw:focus-within:outline-0!'
    );
  });

  it('centers the search and filters in a constrained column beside the Explore information', () => {
    render(<ExploreSearchCard />);

    const headerLayout = screen.getByTestId('explore-header-layout');
    const searchActions = screen.getByTestId('explore-search-actions');
    const ossHeaderTitleRow = headerLayout.parentElement;
    const ossHeaderTitleContent = ossHeaderTitleRow?.parentElement;

    expect(screen.getByTestId('explore-search-card')).toHaveClass('tw:w-full');
    expect(headerLayout).toHaveClass('tw:w-full', 'tw:min-w-0', 'tw:flex-1');
    // Intentional cross-repository contract: AI Explore relies on the OSS
    // HeaderShell title slot remaining flexible instead of using its
    // non-shrinking actions slot for the full-width search controls.
    expect(ossHeaderTitleRow).toHaveClass('tw:min-w-0');
    expect(ossHeaderTitleContent).toHaveClass('tw:min-w-0', 'tw:flex-1');
    expect(headerLayout.closest('.tw\\:shrink-0')).toBeNull();
    expect(headerLayout).toContainElement(
      screen.getByTestId('explore-search-card-title')
    );
    expect(headerLayout).toContainElement(searchActions);
    expect(searchActions).toHaveClass(
      'tw:w-full',
      'tw:min-w-0',
      'tw:flex-1',
      'tw:max-w-5xl',
      'tw:mx-auto',
      'tw:px-8'
    );
    expect(screen.getByTestId('explore-search-form')).toHaveClass('tw:w-full');
  });

  it('displays asset count after async fetch', async () => {
    mockSearchQuery.mockResolvedValue({
      hits: { total: { value: 12480 }, hits: [] },
      aggregations: {},
    });

    render(<ExploreSearchCard />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('explore-search-card-stats')).toHaveTextContent(
      '12,480 assets indexed'
    );
    expect(mockSearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({ trackTotalHits: true })
    );
  });

  it('navigates to explore on submit', () => {
    render(<ExploreSearchCard />);

    fireEvent.change(getSearchInput(), {
      target: { value: ' orders ' },
    });
    fireEvent.submit(screen.getByTestId('explore-search-form'));

    expect(mockGetExplorePath).toHaveBeenCalledWith({
      tab: 'tables',
      search: 'orders',
      isPersistFilters: true,
      extraParameters: { sort: '_score' },
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      '/explore/tables?search=orders&sort=_score'
    );
    expect(mockAddToRecentSearched).toHaveBeenCalledWith('orders');
  });

  it('navigates to explore when Enter is pressed in the search input', () => {
    render(<ExploreSearchCard />);

    const searchInput = getSearchInput();
    fireEvent.change(searchInput, {
      target: { value: ' orders ' },
    });
    fireEvent.keyDown(searchInput, { key: 'Enter' });

    expect(mockGetExplorePath).toHaveBeenCalledWith({
      tab: 'tables',
      search: 'orders',
      isPersistFilters: true,
      extraParameters: { sort: '_score' },
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      '/explore/tables?search=orders&sort=_score'
    );
  });

  it('hydrates search input from the URL search parameter', () => {
    mockLocation = { pathname: '/explore/tables', search: '?search=orders' };

    render(<ExploreSearchCard />);

    expect(getSearchInput()).toHaveValue('orders');
  });

  it('keeps search input in sync when entity type changes preserve URL search', () => {
    mockLocation = { pathname: '/explore', search: '?search=orders' };
    const { rerender } = render(<ExploreSearchCard />);

    mockLocation = { pathname: '/explore/topics', search: '?search=invoices' };
    rerender(<ExploreSearchCard />);

    expect(getSearchInput()).toHaveValue('invoices');
  });

  it('opens suggestions while typing', async () => {
    render(<ExploreSearchCard />);

    fireEvent.change(getSearchInput(), {
      target: { value: 'orders' },
    });
    act(() => {
      jest.advanceTimersByTime(400);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('explore-search-suggestions')).toHaveTextContent(
      'table:orders'
    );
  });

  it('closes standard search suggestions when clicking outside', async () => {
    const originalPointerEvent = globalThis.PointerEvent;
    // Exercise the pointerdown + click path used by browsers, not Jest's mouse fallback.
    globalThis.PointerEvent = MouseEvent as typeof PointerEvent;

    try {
      render(<ExploreSearchCard />);

      const searchInput = getSearchInput();
      act(() => searchInput.focus());
      fireEvent.change(searchInput, {
        target: { value: 'orders' },
      });
      act(() => {
        jest.advanceTimersByTime(400);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByTestId('explore-search-popover')).toBeInTheDocument();

      fireEvent.blur(searchInput, { relatedTarget: document.body });
      fireEvent.pointerDown(document.body);
      fireEvent.click(document.body);

      expect(
        screen.queryByTestId('explore-search-popover')
      ).not.toBeInTheDocument();
    } finally {
      globalThis.PointerEvent = originalPointerEvent;
    }
  });

  it('keeps standard search suggestions open when interacting with the search input', async () => {
    const originalPointerEvent = globalThis.PointerEvent;
    globalThis.PointerEvent = MouseEvent as typeof PointerEvent;

    try {
      render(<ExploreSearchCard />);

      const searchInput = getSearchInput();
      fireEvent.change(searchInput, {
        target: { value: 'orders' },
      });
      act(() => {
        jest.advanceTimersByTime(400);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.getByTestId('explore-search-popover')).toBeInTheDocument();

      fireEvent.pointerDown(searchInput);
      fireEvent.click(searchInput);

      expect(screen.getByTestId('explore-search-popover')).toBeInTheDocument();
    } finally {
      globalThis.PointerEvent = originalPointerEvent;
    }
  });

  it('keeps suggestions open when interacting with the portalled popover', async () => {
    const originalPointerEvent = globalThis.PointerEvent;
    globalThis.PointerEvent = MouseEvent as typeof PointerEvent;

    try {
      render(<ExploreSearchCard />);

      fireEvent.change(getSearchInput(), {
        target: { value: 'orders' },
      });
      act(() => {
        jest.advanceTimersByTime(400);
      });
      await act(async () => {
        await Promise.resolve();
      });

      const popover = screen.getByTestId('explore-search-popover');
      fireEvent.pointerDown(popover);
      fireEvent.click(popover);

      expect(popover).toBeInTheDocument();
    } finally {
      globalThis.PointerEvent = originalPointerEvent;
    }
  });

  it('closes NLP suggestions when clicking outside', async () => {
    const originalPointerEvent = globalThis.PointerEvent;
    globalThis.PointerEvent = MouseEvent as typeof PointerEvent;
    mockIsNLPActive = true;

    try {
      render(<ExploreSearchCard />);

      const searchInput = getSearchInput();
      act(() => searchInput.focus());

      expect(
        await screen.findByTestId('explore-search-popover')
      ).toBeInTheDocument();

      fireEvent.blur(searchInput, { relatedTarget: document.body });
      fireEvent.pointerDown(document.body);
      fireEvent.click(document.body);

      expect(
        screen.queryByTestId('explore-search-popover')
      ).not.toBeInTheDocument();
    } finally {
      globalThis.PointerEvent = originalPointerEvent;
    }
  });

  it('clears the search text and suggestions on clear click', async () => {
    render(<ExploreSearchCard />);

    fireEvent.change(getSearchInput(), {
      target: { value: 'orders' },
    });
    act(() => {
      jest.advanceTimersByTime(400);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('explore-search-popover')).toBeInTheDocument();

    mockGetExplorePath.mockReturnValueOnce('/explore/tables?sort=_score');
    fireEvent.click(screen.getByTestId('explore-clear-search-button'));

    expect(getSearchInput()).toHaveValue('');
    expect(
      screen.queryByTestId('explore-search-popover')
    ).not.toBeInTheDocument();
    expect(mockGetExplorePath).toHaveBeenCalledWith({
      isPersistFilters: true,
      search: '',
      extraParameters: { sort: '_score' },
    });
    expect(mockNavigate).toHaveBeenCalledWith('/explore/tables?sort=_score');
  });

  it('closes suggestions on route changes', async () => {
    const { rerender } = render(<ExploreSearchCard />);

    fireEvent.change(getSearchInput(), {
      target: { value: 'orders' },
    });
    act(() => {
      jest.advanceTimersByTime(400);
    });
    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByTestId('explore-search-popover')).toBeInTheDocument();

    mockLocation = { pathname: '/dashboards', search: '' };
    rerender(<ExploreSearchCard />);

    expect(
      screen.queryByTestId('explore-search-popover')
    ).not.toBeInTheDocument();
  });

  it('does not navigate when search is empty', () => {
    render(<ExploreSearchCard />);

    fireEvent.submit(screen.getByTestId('explore-search-form'));

    expect(mockGetExplorePath).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('toggles NLP search', () => {
    render(<ExploreSearchCard />);

    fireEvent.click(screen.getByTestId('explore-nlp-toggle'));

    expect(mockSetNLPActive).toHaveBeenCalledWith(true);
    expect(mockSetPreference).toHaveBeenCalledWith({ isNLPActive: true });
  });

  it('restores the persisted NLP search preference on refresh', () => {
    mockPersistedNLPActive = true;

    render(<ExploreSearchCard />);

    expect(mockSetNLPActive).toHaveBeenCalledWith(true);
  });

  it('persists NLP search being explicitly disabled', () => {
    mockIsNLPActive = true;
    mockPersistedNLPActive = true;

    render(<ExploreSearchCard />);
    fireEvent.click(screen.getByTestId('explore-nlp-toggle'));

    expect(mockSetNLPActive).toHaveBeenLastCalledWith(false);
    expect(mockSetPreference).toHaveBeenCalledWith({ isNLPActive: false });
  });

  it('hides NLP toggle when NLP is not enabled', () => {
    mockIsNLPEnabled = false;
    render(<ExploreSearchCard />);

    expect(screen.queryByTestId('explore-nlp-toggle')).not.toBeInTheDocument();
  });

  it('shows active NLP state when NLP is on', () => {
    mockIsNLPActive = true;
    render(<ExploreSearchCard />);

    const toggle = screen.getByTestId('explore-nlp-toggle');

    expect(toggle).toHaveAttribute('title', 'Natural language search active');

    act(() => getSearchInput().focus());

    expect(screen.getByTestId('nlp-suggestions-button')).toBeInTheDocument();
  });

  it('searches selected NLP suggestion on click', () => {
    mockIsNLPActive = true;
    mockGetExplorePath.mockReturnValue(
      '/explore/tables?search=Tables%20owned%20by%20marketing&sort=_score'
    );
    render(<ExploreSearchCard />);

    act(() => getSearchInput().focus());
    fireEvent.click(screen.getByTestId('nlp-suggestions-button'));

    expect(mockGetExplorePath).toHaveBeenCalledWith({
      tab: 'tables',
      search: 'Tables owned by marketing',
      isPersistFilters: true,
      extraParameters: { sort: '_score' },
    });
    expect(mockNavigate).toHaveBeenCalledWith(
      '/explore/tables?search=Tables%20owned%20by%20marketing&sort=_score'
    );
    expect(mockAddToRecentSearched).toHaveBeenCalledWith(
      'Tables owned by marketing'
    );
  });

  it('navigates quick filter chips with quickFilter param', () => {
    render(<ExploreSearchCard />);

    fireEvent.change(getSearchInput(), {
      target: { value: 'orders' },
    });
    fireEvent.click(screen.getByTestId('explore-quick-filter-dashboards'));

    expect(getSearchInput()).toHaveValue('');
    expect(mockGetExplorePath).toHaveBeenCalledWith({
      isPersistFilters: false,
      search: '',
      extraParameters: {
        quickFilter: JSON.stringify({
          query: {
            bool: {
              must: [
                {
                  bool: {
                    should: [{ term: { 'entityType.keyword': 'dashboard' } }],
                  },
                },
              ],
            },
          },
        }),
        sort: '_score',
      },
    });
  });

  it('navigates my-assets filter with ownerDisplayName of current user', () => {
    render(<ExploreSearchCard />);

    fireEvent.click(screen.getByTestId('explore-quick-filter-my-assets'));

    expect(mockGetExplorePath).toHaveBeenCalledWith({
      isPersistFilters: false,
      search: '',
      extraParameters: {
        quickFilter: JSON.stringify({
          query: {
            bool: {
              must: [
                {
                  bool: {
                    should: [{ term: { ownerDisplayName: 'Admin User' } }],
                  },
                },
              ],
            },
          },
        }),
        sort: '_score',
      },
    });
  });

  it('navigates recently-updated filter with updatedAt sort', () => {
    render(<ExploreSearchCard />);

    fireEvent.click(
      screen.getByTestId('explore-quick-filter-recently-updated')
    );

    expect(mockGetExplorePath).toHaveBeenCalledWith({
      isPersistFilters: false,
      search: '',
      extraParameters: { sort: 'updatedAt' },
    });
  });
});
