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
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PAGE_SIZE_MEDIUM } from '../../../constants/constants';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { getListKnowledgePages } from '../../../rest/knowledgeCenterAPI';
import { searchQuery as fetchSearchResults } from '../../../rest/searchAPI';
import { showErrorToast } from '../../../utils/ToastUtils';
import KnowledgePageListComponent from './KnowledgePageListComponent';

// KnowledgePageListComponent.tsx had ZERO existing test coverage before this conversion (Task
// 8 Batch 2). Both flags this file consumes are PURE renames — `hasViewAccess` is a literal
// match for the old `permissions.ViewAll || permissions.ViewBasic` (not a prioritized read,
// see the source's inline comment), and `canCreate` is an identical single-key `Create` read.
// Since there is no behavior difference for any input, old and new source render identically
// for every case below — this equivalence is the expected signal for a pure-rename consumer
// conversion (see task-8B1-report.md note 4), not a broken RED phase.

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest
    .fn()
    .mockReturnValue({ currentUser: { id: 'user-1' }, theme: {} }),
}));

jest.mock('../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: jest.fn().mockReturnValue({
    getResourceLimit: jest.fn().mockResolvedValue(undefined),
  }),
}));

let mockIsInView = false;

jest.mock('../../../hooks/useElementInView', () => ({
  useElementInView: () => [{ current: null }, mockIsInView],
}));

jest.mock('../../../rest/knowledgeCenterAPI', () => ({
  getListKnowledgePages: jest
    .fn()
    .mockResolvedValue({ data: [], paging: { total: 0 } }),
  postKnowledgePage: jest.fn(),
  followKnowledgePage: jest.fn(),
  unFollowKnowledgePage: jest.fn(),
  updateKnowledgePageVote: jest.fn(),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({
    hits: { hits: [], total: { value: 0 } },
  }),
}));

jest.mock('../KnowledgeCard/KnowledgeCard', () =>
  jest.fn().mockReturnValue(null)
);

jest.mock('../KnowledgePageListRightPanel/KnowledgePageListRightPanel', () =>
  jest.fn().mockReturnValue(null)
);

jest.mock('../QuickLinkFormModal/QuickLinkFormModal', () => ({
  QuickLinkFormModal: jest.fn().mockReturnValue(null),
}));

jest.mock('../../../hoc/LimitWrapper', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// `showErrorToast` is invoked from the fetch's catch block. Mocking it keeps the
// test off the real toast pipeline and lets the failure path be asserted.
jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

const renderComponent = (
  permissions: Partial<OperationPermission>,
  options: {
    onEmptyStateChange?: (isEmpty: boolean) => void;
    isPermissionsLoading?: boolean;
    searchQuery?: string;
    quickFilterQuery?: Record<string, unknown>;
    restSortField?: string;
    sortField?: string;
  } = {}
) =>
  render(
    <KnowledgePageListComponent
      isPermissionsLoading={options.isPermissionsLoading}
      permissions={permissions as OperationPermission}
      quickFilterQuery={options.quickFilterQuery}
      restSortField={options.restSortField}
      searchQuery={options.searchQuery}
      sortField={options.sortField}
      onEmptyStateChange={options.onEmptyStateChange}
      onPageChange={jest.fn()}
    />,
    { wrapper: MemoryRouter }
  );

describe('KnowledgePageListComponent permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows the permission ErrorPlaceHolder when view access is denied', async () => {
    renderComponent({ ViewAll: false, ViewBasic: false });

    // `permission-error-placeholder` was the old ErrorPlaceHolder's testid; the
    // component now renders the core EmptyPlaceholder (base commit fa824bf1b4's
    // placeholder migration), which doesn't set that testid — assert on its
    // access-denied copy instead (see EmptyPlaceholderVariants.test.tsx precedent).
    await waitFor(() => {
      expect(screen.getByText('label.access-denied')).toBeInTheDocument();
    });
  });

  it('keeps the empty-state title, documentation description and permitted add button', async () => {
    renderComponent({ ViewAll: true, Create: true });

    await waitFor(() => {
      expect(screen.getByTestId('add-knowledge-page-btn')).toBeInTheDocument();
    });

    expect(
      screen
        .getByText(/message.adding-new-entity-is-easy-just-give-it-a-spin/)
        .closest('.prose-typography')
    ).toHaveClass('tw:text-sm', 'tw:font-semibold');
    expect(
      screen.getByText(/message.refer-to-our-doc/).closest('.prose-typography')
    ).toHaveClass('tw:text-xs');
  });

  it('hides the empty-state add button when create access is denied', async () => {
    renderComponent({ ViewAll: true, Create: false });

    // `create-error-placeholder-create` was the old CreateErrorPlaceHolder's testid; the
    // component now renders the core EmptyPlaceholder (base commit fa824bf1b4's
    // placeholder migration), which doesn't set that testid — assert on its generic
    // testid instead.
    await waitFor(() => {
      expect(screen.getByTestId('empty-placeholder')).toBeInTheDocument();
    });

    expect(
      screen.queryByTestId('add-knowledge-page-btn')
    ).not.toBeInTheDocument();
  });
});

describe('KnowledgePageListComponent data path', () => {
  const mockGetList = getListKnowledgePages as jest.Mock;
  const mockSearch = fetchSearchResults as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetList.mockResolvedValue({ data: [], paging: { total: 0 } });
    mockSearch.mockResolvedValue({
      hits: { hits: [], total: { value: 0 } },
    });
  });

  it('uses the REST list path with the given sort when no filter is active', async () => {
    render(
      <KnowledgePageListComponent
        permissions={{ ViewAll: true } as OperationPermission}
        restSortField="displayName"
        sortField="displayName.keyword"
        sortOrder="asc"
        onPageChange={jest.fn()}
      />,
      { wrapper: MemoryRouter }
    );

    await waitFor(() => {
      expect(mockGetList).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: 'displayName',
          sortOrder: 'asc',
        })
      );
    });

    expect(mockSearch).not.toHaveBeenCalled();
  });

  it('routes through the search path with the queryFilter when a filter is active', async () => {
    const quickFilterQuery = {
      query: { bool: { must: [{ bool: { should: [{ term: {} }] } }] } },
    };

    render(
      <KnowledgePageListComponent
        permissions={{ ViewAll: true } as OperationPermission}
        quickFilterQuery={quickFilterQuery}
        sortField="updatedAt"
        sortOrder="desc"
        onPageChange={jest.fn()}
      />,
      { wrapper: MemoryRouter }
    );

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          queryFilter: quickFilterQuery,
          searchIndex: 'page',
          sortField: 'updatedAt',
          sortOrder: 'desc',
        })
      );
    });

    expect(mockGetList).not.toHaveBeenCalled();
  });

  it('uses the search path for an ES-only sort even without a filter', async () => {
    render(
      <KnowledgePageListComponent
        permissions={{ ViewAll: true } as OperationPermission}
        sortField="page.publicationDate"
        sortOrder="desc"
        onPageChange={jest.fn()}
      />,
      { wrapper: MemoryRouter }
    );

    await waitFor(() => {
      expect(mockSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          searchIndex: 'page',
          sortField: 'page.publicationDate',
          sortOrder: 'desc',
        })
      );
    });

    expect(mockGetList).not.toHaveBeenCalled();
  });
});

describe('KnowledgePageListComponent fetch failure and empty-state reporting', () => {
  const mockGetList = getListKnowledgePages as jest.Mock;
  const mockShowErrorToast = showErrorToast as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsInView = false;
    mockGetList.mockResolvedValue({ data: [], paging: { total: 0 } });
  });

  it('restarts paging from offset 0 when Reload follows a failed load-more', async () => {
    const page = (id: string) => ({
      data: [{ id, name: id, fullyQualifiedName: id, pageType: 'article' }],
      paging: { total: 100 },
    });
    mockGetList
      .mockResolvedValueOnce(page('p1'))
      .mockRejectedValueOnce(new Error('load-more failed'))
      .mockResolvedValueOnce(page('p1'))
      .mockResolvedValueOnce(page('p2'));
    const permissions = { ViewAll: true } as OperationPermission;
    const onPageChange = jest.fn();
    // A fresh element per render: React may bail out of re-rendering an
    // identical element, and the in-view flag only changes via the mock.
    const buildElement = () => (
      <KnowledgePageListComponent
        permissions={permissions}
        restSortField="updatedAt"
        onPageChange={onPageChange}
      />
    );
    const { rerender } = render(buildElement(), { wrapper: MemoryRouter });

    await waitFor(() => expect(mockGetList).toHaveBeenCalledTimes(1));

    mockIsInView = true;
    rerender(buildElement());

    await waitFor(() => {
      expect(
        screen.getByText('message.something-went-wrong')
      ).toBeInTheDocument();
    });

    expect(mockGetList).toHaveBeenLastCalledWith(
      expect.objectContaining({ offset: PAGE_SIZE_MEDIUM })
    );

    fireEvent.click(screen.getByRole('button', { name: 'label.reload' }));

    // Pre-fix the post-Reload load-more resumed at 2 * PAGE_SIZE_MEDIUM,
    // skipping a page.
    await waitFor(() =>
      expect(
        mockGetList.mock.calls.slice(0, 4).map(([args]) => args.offset)
      ).toEqual([0, PAGE_SIZE_MEDIUM, 0, PAGE_SIZE_MEDIUM])
    );
  });

  it('reports a non-empty state (false) to the parent when the list fetch rejects, not true', async () => {
    mockGetList.mockRejectedValue(new Error('network down'));
    const onEmptyStateChange = jest.fn();

    renderComponent(
      { ViewAll: true },
      { onEmptyStateChange, restSortField: 'updatedAt' }
    );

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onEmptyStateChange).toHaveBeenLastCalledWith(false);
    });

    // The bug report confirmed `onEmptyStateChange(true)` fired on rejection,
    // which made the parent hide the sidebar/toolbar behind the onboarding
    // placeholder. The fix must suppress the empty report on failure.
    expect(onEmptyStateChange).not.toHaveBeenCalledWith(true);
  });

  it('renders the in-place error placeholder, not the onboarding empty state, when the fetch rejects', async () => {
    mockGetList.mockRejectedValue(new Error('network down'));

    renderComponent(
      { ViewAll: true, Create: true },
      { restSortField: 'updatedAt' }
    );

    await waitFor(() => {
      expect(
        screen.getByText('message.something-went-wrong')
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText('message.temporary-error-try-reloading')
    ).toBeInTheDocument();

    // The genuine-empty onboarding placeholder must NOT render on a failed
    // fetch — that is the regression this fix prevents.
    expect(
      screen.queryByTestId('add-knowledge-page-btn')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        /message.adding-new-entity-is-easy-just-give-it-a-spin/
      )
    ).not.toBeInTheDocument();
  });

  it('renders a Reload action that retries the fetch and recovers to the list view', async () => {
    mockGetList
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({
        data: [
          {
            id: 'p1',
            name: 'p1',
            fullyQualifiedName: 'p1',
            pageType: 'article',
          },
        ],
        paging: { total: 1 },
      });

    renderComponent({ ViewAll: true }, { restSortField: 'updatedAt' });

    await waitFor(() => {
      expect(
        screen.getByText('message.something-went-wrong')
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'label.reload' }));

    await waitFor(() => {
      expect(screen.getByTestId('knowledge-page-listing')).toBeInTheDocument();
    });

    expect(
      screen.queryByText('message.something-went-wrong')
    ).not.toBeInTheDocument();
  });

  it('clears the failure flag on retry so a successful reload reports genuine emptiness', async () => {
    // First fetch fails, retry succeeds with a genuinely empty list.
    mockGetList
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({ data: [], paging: { total: 0 } });

    const onEmptyStateChange = jest.fn();
    renderComponent(
      { ViewAll: true },
      { onEmptyStateChange, restSortField: 'updatedAt' }
    );

    await waitFor(() => {
      expect(
        screen.getByText('message.something-went-wrong')
      ).toBeInTheDocument();
    });

    // After failure the parent is told the list is NOT empty (keep the layout).
    expect(onEmptyStateChange).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: 'label.reload' }));

    // After retry resolves empty, the parent is told the list IS genuinely
    // empty — the failure flag was reset at the start of the retry fetch.
    await waitFor(() => {
      expect(onEmptyStateChange).toHaveBeenLastCalledWith(true);
    });

    expect(
      screen.queryByText('message.something-went-wrong')
    ).not.toBeInTheDocument();
  });

  it('does not fire onEmptyStateChange while permissions are still loading', () => {
    const onEmptyStateChange = jest.fn();

    renderComponent(
      { ViewAll: true },
      { onEmptyStateChange, isPermissionsLoading: true }
    );

    // Permissions still loading → the fetch effect early-returns, the
    // loading skeleton renders, and the emptiness effect's
    // `!isPermissionsLoading` guard skips — so the parent is never told
    // the list is empty. Effects flush synchronously inside RTL's
    // `render`, so these assertions are stable without further awaits.
    expect(screen.getByTestId('knowledge-page-skeleton')).toBeInTheDocument();
    expect(mockGetList).not.toHaveBeenCalled();
    expect(onEmptyStateChange).not.toHaveBeenCalled();
  });

  it('reports a genuine empty list (true) when the fetch resolves with zero pages (non-regression)', async () => {
    const onEmptyStateChange = jest.fn();

    renderComponent(
      { ViewAll: true },
      { onEmptyStateChange, restSortField: 'updatedAt' }
    );

    await waitFor(() => {
      expect(onEmptyStateChange).toHaveBeenLastCalledWith(true);
    });
  });

  it('reports a non-empty list (false) when the fetch resolves with pages (non-regression)', async () => {
    mockGetList.mockResolvedValue({
      data: [{ id: 'p1', name: 'p1', fullyQualifiedName: 'p1' }],
      paging: { total: 1 },
    });

    const onEmptyStateChange = jest.fn();

    renderComponent(
      { ViewAll: true },
      { onEmptyStateChange, restSortField: 'updatedAt' }
    );

    await waitFor(() => {
      expect(onEmptyStateChange).toHaveBeenLastCalledWith(false);
    });

    expect(screen.getByTestId('knowledge-page-listing')).toBeInTheDocument();
    expect(
      screen.queryByText('message.something-went-wrong')
    ).not.toBeInTheDocument();
  });

  it('clears the failure flag when a sort change re-runs the fetch effect', async () => {
    // First fetch fails (error placeholder shows); changing the sort triggers
    // a fresh fetch via the effect's deps — the failure flag must reset so
    // the new (successful) fetch renders the list, not the error placeholder.
    mockGetList
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce({
        data: [{ id: 'p1', name: 'p1', fullyQualifiedName: 'p1' }],
        paging: { total: 1 },
      });

    const onEmptyStateChange = jest.fn();
    const { rerender } = renderComponent(
      { ViewAll: true },
      { onEmptyStateChange, restSortField: 'updatedAt' }
    );

    await waitFor(() => {
      expect(
        screen.getByText('message.something-went-wrong')
      ).toBeInTheDocument();
    });

    // RTL's `rerender` reuses the `MemoryRouter` wrapper from the initial
    // `render` — re-wrapping here would nest Routers and trip react-router's
    // invariant. Only the props that should change (sortOrder) differ.
    rerender(
      <KnowledgePageListComponent
        permissions={{ ViewAll: true } as OperationPermission}
        restSortField="updatedAt"
        sortOrder="asc"
        onEmptyStateChange={onEmptyStateChange}
        onPageChange={jest.fn()}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId('knowledge-page-listing')).toBeInTheDocument();
    });

    expect(
      screen.queryByText('message.something-went-wrong')
    ).not.toBeInTheDocument();
  });

  it('reports a non-empty state (false) when the search-path fetch rejects', async () => {
    // The catch logic lives in the shared `fetchKnowledgePages` wrapper, so a
    // search-route failure must be reported the same way as a REST failure.
    (fetchSearchResults as jest.Mock).mockRejectedValue(new Error('es down'));
    const onEmptyStateChange = jest.fn();

    renderComponent({ ViewAll: true }, { onEmptyStateChange });

    await waitFor(() => {
      expect(mockShowErrorToast).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onEmptyStateChange).toHaveBeenLastCalledWith(false);
    });

    expect(onEmptyStateChange).not.toHaveBeenCalledWith(true);
  });
});
