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

import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { Link, MemoryRouter, useLocation } from 'react-router-dom';
import { CreateMemoryModalProps } from '../../../components/ContextCenter/CreateMemoryModal/CreateMemoryModal.interface';
import { ContextMemory } from '../../../generated/entity/context/contextMemory';
import {
  getContextMemoryById,
  getContextMemoryByName,
  getListContextMemories,
} from '../../../rest/contextMemoryAPI';
import { getUserAndTeamSearch } from '../../../rest/miscAPI';
import ContextCenterMemoriesPage from './ContextCenterMemoriesPage';

// Resource-level permission (getResourcePermission(CONTEXT_MEMORY)) — no prior
// test coverage. This suite covers the flagged raw `permissions.EditAll` read
// (now `canEditAll`, wired to MemoriesView/CreateMemoryModal's `canEdit` prop).

const mockGetResourcePermission = jest.fn();

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getResourcePermission: mockGetResourcePermission,
  }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest.fn().mockReturnValue({
    currentUser: { id: 'user-1', name: 'test.user', isAdmin: false },
  }),
}));

jest.mock('../../../rest/contextMemoryAPI', () => ({
  getListContextMemories: jest.fn().mockResolvedValue({
    data: [{ id: 'memory-1', title: 'Test Memory' }],
    paging: { total: 1 },
  }),
  getContextMemoryById: jest.fn(),
  getContextMemoryByName: jest.fn(),
  deleteContextMemory: jest.fn(),
  pinContextMemory: jest.fn(),
  unpinContextMemory: jest.fn(),
}));

jest.mock('../../../rest/miscAPI', () => ({
  getUserAndTeamSearch: jest
    .fn()
    .mockResolvedValue({ data: { hits: { hits: [] } } }),
}));

jest.mock('../../../utils/ContextCenterClassBase', () => ({
  __esModule: true,
  default: { getPageContainerClassName: jest.fn().mockReturnValue('') },
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../components/common/DocumentTitle/DocumentTitle', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock(
  '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component',
  () => ({
    __esModule: true,
    default: ({ onSearch }: { onSearch?: (value: string) => void }) =>
      onSearch ? (
        <input
          aria-label="Search memories"
          data-testid="memory-search"
          onChange={(event) => onSearch(event.target.value)}
        />
      ) : null,
  })
);

jest.mock(
  '../../../components/ContextCenter/MemoriesView/MemoriesView.component',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(({ canEdit, canDelete }) => (
        <div
          data-can-delete={String(Boolean(canDelete))}
          data-can-edit={String(Boolean(canEdit))}
          data-testid="memories-view"
        />
      )),
  })
);

const mockUseMemoryConflictReviews = jest.fn().mockReturnValue({
  reviews: [],
  total: 0,
  isCountLoading: false,
  isLoading: false,
  isError: false,
  hasMore: false,
  isLoadingMore: false,
  loadMore: jest.fn(),
  retry: jest.fn(),
});

jest.mock(
  '../../../hooks/discovery/context-center/useMemoryConflictReviews',
  () => ({
    useMemoryConflictReviews: (isAdmin: boolean, isListing: boolean) =>
      mockUseMemoryConflictReviews(isAdmin, isListing),
  })
);

jest.mock(
  '../../../components/discovery/context-center/MemoryConflictReviews/MemoryConflictReviews',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(({ reviews }: { reviews: unknown[] }) => (
        <div data-review-count={reviews.length} data-testid="memory-reviews" />
      )),
  })
);

jest.mock(
  '../../../components/ContextCenter/CreateMemoryModal/CreateMemoryModal.component',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(
        ({
          canEdit,
          isOpen,
          memoryToEdit,
          onClose,
          onEditMemory,
          viewOnly,
        }: CreateMemoryModalProps) => (
          <div
            data-can-edit={String(Boolean(canEdit))}
            data-open={String(isOpen)}
            data-testid={
              viewOnly ? 'view-memory-modal' : 'create-memory-modal'
            }>
            {isOpen && (
              <>
                <span>{memoryToEdit?.name}</span>
                <button onClick={onClose}>Close memory</button>
                {viewOnly && memoryToEdit && (
                  <button onClick={() => onEditMemory?.(memoryToEdit)}>
                    Edit memory
                  </button>
                )}
              </>
            )}
          </div>
        )
      ),
  })
);

jest.mock(
  '../../../components/DataAssets/DataAssetSelectList/DataAssetSelectList',
  () => ({
    __esModule: true,
    default: ({
      onChange,
    }: {
      onChange: (value: { id: string; label: string }) => void;
    }) => (
      <button
        aria-label="Select test asset"
        data-testid="mock-asset-select"
        onClick={() => onChange({ id: 'asset-1', label: 'Test Asset' })}
      />
    ),
  })
);

const MemoryRouteControls = () => {
  const { search } = useLocation();

  return (
    <>
      <output data-testid="memory-route">{search}</output>
      <Link to="?memory=memory-two&author=test.user">Open successor</Link>
    </>
  );
};

const renderPage = (route = '/') =>
  render(
    <MemoryRouter initialEntries={[route]}>
      <ContextCenterMemoriesPage />
      <MemoryRouteControls />
    </MemoryRouter>
  );

describe('ContextCenterMemoriesPage — permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wires EditAll (via canEditAll) into MemoriesView/CreateMemoryModal canEdit when granted', async () => {
    mockGetResourcePermission.mockResolvedValue({
      Create: true,
      Delete: true,
      EditAll: true,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('memories-view')).toHaveAttribute(
        'data-can-edit',
        'true'
      );
    });

    expect(screen.getByTestId('create-memory-modal')).toHaveAttribute(
      'data-can-edit',
      'true'
    );
  });

  it('wires EditAll (via canEditAll) into MemoriesView/CreateMemoryModal canEdit when denied', async () => {
    mockGetResourcePermission.mockResolvedValue({
      Create: true,
      Delete: true,
      EditAll: false,
    });

    renderPage();

    await waitFor(() => {
      expect(mockGetResourcePermission).toHaveBeenCalled();
    });

    expect(screen.getByTestId('memories-view')).toHaveAttribute(
      'data-can-edit',
      'false'
    );
    expect(screen.getByTestId('create-memory-modal')).toHaveAttribute(
      'data-can-edit',
      'false'
    );
  });

  it.each([
    ['label.rejected', 'Rejected'],
    ['label.superseded', 'Superseded'],
    ['label.invalidated', 'Invalidated'],
  ])(
    'filters by %s while retaining author and sort controls',
    async (label, status) => {
      mockGetResourcePermission.mockResolvedValue({ EditAll: true });
      renderPage();

      await waitFor(() => {
        expect(getListContextMemories).toHaveBeenCalledWith(
          expect.objectContaining({
            statuses: 'Approved,Unprocessed',
            offset: 0,
          })
        );
      });

      fireEvent.click(screen.getByTestId('memory-status-filter'));
      fireEvent.click(await screen.findByText(label));

      await waitFor(() => {
        expect(getListContextMemories).toHaveBeenCalledWith(
          expect.objectContaining({
            statuses: `Approved,Unprocessed,${status}`,
            offset: 0,
          })
        );
        expect(getListContextMemories).toHaveBeenCalledWith(
          expect.objectContaining({
            statuses: `Approved,Unprocessed,${status}`,
            limit: 0,
            offset: 0,
          })
        );
      });

      fireEvent.click(screen.getByTestId('memory-count-card-created-by-me'));
      await waitFor(() => {
        expect(getListContextMemories).toHaveBeenCalledWith(
          expect.objectContaining({
            statuses: `Approved,Unprocessed,${status}`,
            author: 'user-1',
          })
        );
      });

      fireEvent.change(screen.getByTestId('memory-search'), {
        target: { value: 'missing glossary fact' },
      });
      fireEvent.click(screen.getByTestId('mock-asset-select'));
      await waitFor(() => {
        expect(getListContextMemories).toHaveBeenCalledWith(
          expect.objectContaining({
            statuses: `Approved,Unprocessed,${status}`,
            q: 'missing glossary fact',
            assets: 'asset-1',
            author: 'user-1',
          })
        );
      });

      fireEvent.click(screen.getByText(/label.sort/));
      fireEvent.click(await screen.findByText('label.most-used'));
      await waitFor(() => {
        expect(getListContextMemories).toHaveBeenCalledWith(
          expect.objectContaining({
            statuses: `Approved,Unprocessed,${status}`,
            q: 'missing glossary fact',
            assets: 'asset-1',
            author: 'user-1',
            sortBy: 'usageCount',
          })
        );
      });
    }
  );

  it('combines the author dropdown with selected statuses', async () => {
    mockGetResourcePermission.mockResolvedValue({ EditAll: true });
    (getUserAndTeamSearch as jest.Mock).mockResolvedValue({
      data: {
        hits: {
          hits: [
            {
              _id: 'other-user',
              _source: { name: 'other-user', displayName: 'Other User' },
            },
          ],
        },
      },
    } as Awaited<ReturnType<typeof getUserAndTeamSearch>>);
    renderPage();

    fireEvent.click(screen.getByTestId('memory-status-filter'));
    fireEvent.click(await screen.findByText('label.rejected'));
    fireEvent.click(screen.getByTestId('memory-count-card-created-by-me'));
    fireEvent.click(screen.getByTestId('author-filter-button'));
    fireEvent.click(await screen.findByText('Other User'));

    await waitFor(() => {
      expect(getListContextMemories).toHaveBeenCalledWith(
        expect.objectContaining({
          statuses: 'Approved,Unprocessed,Rejected',
          author: 'other-user',
        })
      );
    });
  });

  it('keeps the typed author results when the menu-open search resolves after them', async () => {
    mockGetResourcePermission.mockResolvedValue({ EditAll: true });
    const authorHits = (name: string, displayName: string) =>
      ({
        data: {
          hits: { hits: [{ _id: name, _source: { name, displayName } }] },
        },
      } as Awaited<ReturnType<typeof getUserAndTeamSearch>>);
    const menuOpenSearches: Array<(value: unknown) => void> = [];
    (getUserAndTeamSearch as jest.Mock).mockImplementation((query: string) =>
      query
        ? Promise.resolve(authorHits('typed-user', 'Typed User'))
        : new Promise((resolve) => {
            menuOpenSearches.push(resolve);
          })
    );
    renderPage();

    fireEvent.click(screen.getByTestId('author-filter-button'));
    fireEvent.change(
      await screen.findByPlaceholderText('label.search-entity'),
      {
        target: { value: 'typed' },
      }
    );

    expect(await screen.findByText('Typed User')).toBeInTheDocument();

    await act(async () => {
      menuOpenSearches.forEach((resolve) =>
        resolve(authorHits('other-user', 'Other User'))
      );
    });

    expect(screen.getByText('Typed User')).toBeInTheDocument();
    expect(screen.queryByText('Other User')).not.toBeInTheDocument();
  });
});

describe('ContextCenterMemoriesPage — memory links', () => {
  const memory: ContextMemory = { id: 'memory-1', name: 'memory-one' };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetResourcePermission.mockResolvedValue({ EditAll: true });
    (getContextMemoryByName as jest.Mock).mockResolvedValue(memory);
    (getContextMemoryById as jest.Mock).mockResolvedValue(memory);
  });

  it('clears a closed memory link while preserving unrelated query parameters', async () => {
    renderPage('/?memory=memory-one&author=test.user');

    await screen.findByRole('button', { name: 'Close memory' });
    fireEvent.click(screen.getByRole('button', { name: 'Close memory' }));

    await waitFor(() => {
      expect(screen.getByTestId('memory-route')).toHaveTextContent(
        '?author=test.user'
      );
      expect(screen.queryByTestId('view-memory-modal')).not.toBeInTheDocument();
    });
  });

  it('keeps the view modal closed when editing and clears the link when the editor closes', async () => {
    renderPage('/?memory=memory-one&author=test.user');

    fireEvent.click(await screen.findByRole('button', { name: 'Edit memory' }));

    await waitFor(() => {
      expect(screen.getByTestId('create-memory-modal')).toHaveAttribute(
        'data-open',
        'true'
      );
      expect(screen.queryByTestId('view-memory-modal')).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close memory' }));

    await waitFor(() => {
      expect(screen.getByTestId('memory-route')).toHaveTextContent(
        '?author=test.user'
      );
      expect(screen.getByTestId('create-memory-modal')).toHaveAttribute(
        'data-open',
        'false'
      );
      expect(screen.queryByTestId('view-memory-modal')).not.toBeInTheDocument();
    });
  });

  it('ignores a successor response that arrives after the modal is closed', async () => {
    const successor: ContextMemory = { id: 'memory-2', name: 'memory-two' };
    let resolveSuccessor: ((value: ContextMemory) => void) | undefined;
    const pendingSuccessor = new Promise<ContextMemory>((resolve) => {
      resolveSuccessor = resolve;
    });
    (getContextMemoryByName as jest.Mock).mockImplementation((name: string) =>
      name === successor.name ? pendingSuccessor : Promise.resolve(memory)
    );
    (getContextMemoryById as jest.Mock).mockImplementation((id: string) =>
      Promise.resolve(id === successor.id ? successor : memory)
    );
    renderPage('/?memory=memory-one');

    await screen.findByRole('button', { name: 'Close memory' });
    fireEvent.click(screen.getByRole('link', { name: 'Open successor' }));
    await waitFor(() => {
      expect(getContextMemoryByName).toHaveBeenCalledWith(
        'memory-two',
        expect.any(String)
      );
    });
    fireEvent.click(screen.getByRole('button', { name: 'Close memory' }));

    await act(async () => {
      resolveSuccessor?.(successor);
      await pendingSuccessor;
    });

    expect(screen.getByTestId('memory-route')).toHaveTextContent(
      '?author=test.user'
    );
    expect(screen.queryByTestId('view-memory-modal')).not.toBeInTheDocument();
  });
});

describe('ContextCenterMemoriesPage — needs review', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetResourcePermission.mockResolvedValue({ EditAll: true });
    mockUseMemoryConflictReviews.mockReturnValue({
      reviews: [{ id: 'task-1' }, { id: 'task-2' }],
      total: 2,
      isCountLoading: false,
      isLoading: false,
      isError: false,
      hasMore: false,
      isLoadingMore: false,
      loadMore: jest.fn(),
      retry: jest.fn(),
    });
  });

  afterEach(() => {
    (getListContextMemories as jest.Mock).mockResolvedValue({
      data: [{ id: 'memory-1', title: 'Test Memory' }],
      paging: { total: 1 },
    });
  });

  it('keeps open reviews reachable when there are no memories to list', async () => {
    (getListContextMemories as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    renderPage();

    fireEvent.click(
      await screen.findByTestId('memory-count-card-needs-review')
    );

    expect(await screen.findByTestId('memory-reviews')).toBeInTheDocument();
    expect(
      screen.queryByText('message.context-center-memories-empty-subtitle')
    ).not.toBeInTheDocument();
  });

  it('shows the empty state once there are neither memories nor reviews', async () => {
    (getListContextMemories as jest.Mock).mockResolvedValue({
      data: [],
      paging: { total: 0 },
    });
    mockUseMemoryConflictReviews.mockReturnValue({
      reviews: [],
      total: 0,
      isCountLoading: false,
      isLoading: false,
      isError: false,
      hasMore: false,
      isLoadingMore: false,
      loadMore: jest.fn(),
      retry: jest.fn(),
    });
    renderPage();

    expect(
      await screen.findByText('message.context-center-memories-empty-subtitle')
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId('memory-count-card-needs-review')
    ).not.toBeInTheDocument();
  });

  it('counts the open reviews and lists them in their own tab', async () => {
    renderPage();

    const card = await screen.findByTestId('memory-count-card-needs-review');

    expect(card).toHaveTextContent('2');
    expect(mockUseMemoryConflictReviews).toHaveBeenLastCalledWith(false, false);
    expect(screen.queryByTestId('memory-reviews')).not.toBeInTheDocument();

    fireEvent.click(card);

    expect(await screen.findByTestId('memory-reviews')).toHaveAttribute(
      'data-review-count',
      '2'
    );
    expect(mockUseMemoryConflictReviews).toHaveBeenLastCalledWith(false, true);
  });

  /** Reviews name their memories by reference only, so a memory search cannot find them. */
  it('hides the memory search while reviewing conflicts', async () => {
    renderPage();

    expect(await screen.findByTestId('memory-search')).toBeInTheDocument();

    fireEvent.click(
      await screen.findByTestId('memory-count-card-needs-review')
    );

    await screen.findByTestId('memory-reviews');

    expect(screen.queryByTestId('memory-search')).not.toBeInTheDocument();
  });
});
