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
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { getListKnowledgePages } from '../../../rest/knowledgeCenterAPI';
import { searchQuery as fetchSearchResults } from '../../../rest/searchAPI';
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

jest.mock('../../../hooks/useElementInView', () => ({
  useElementInView: () => [{ current: null }, false],
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
  searchQuery: jest.fn(),
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

const renderComponent = (permissions: Partial<OperationPermission>) =>
  render(
    <KnowledgePageListComponent
      permissions={permissions as OperationPermission}
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

  it('renders the empty-state add button when view and create access are both granted', async () => {
    renderComponent({ ViewAll: true, Create: true });

    await waitFor(() => {
      expect(screen.getByTestId('add-knowledge-page-btn')).toBeInTheDocument();
    });
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
