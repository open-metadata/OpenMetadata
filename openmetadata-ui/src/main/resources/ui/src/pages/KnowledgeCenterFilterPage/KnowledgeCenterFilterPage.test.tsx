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
import { EntityType } from '../../enums/entity.enum';
import {
  KnowledgePage,
  PageType,
} from '../../interface/knowledge-center.interface';
import { getListKnowledgePages } from '../../rest/knowledgeCenterAPI';
import KnowledgeCenterFilterPage from './KnowledgeCenterFilterPage';

// Resource-level permission (getResourcePermission(KNOWLEDGE_PAGE)) — no prior test
// coverage. This suite covers the flagged raw `permissions.ViewAll || permissions.ViewBasic`
// read (now `hasViewAccess`, via getDerivedPermissionFlags), matching the Batch 8
// ContextCenter-trio precedent (ContextCenterArchivePage.test.tsx).

const mockGetResourcePermission = jest.fn();

// The filter identity is read from the query string via useLocationSearch. A static
// mock (the original) could only ever exercise one entity per mount, so it could not
// surface the stale-data bug that occurs when the same cached instance re-renders
// with a different entityId/entityType (the keep-alive re-render in AI app mode). The
// indirection below lets each test drive `useLocationSearch` to a new value across
// re-renders of the same mounted instance.
const mockUseLocationSearch = jest.fn();

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getResourcePermission: mockGetResourcePermission,
  }),
}));

jest.mock('../../hooks/LocationSearch/useLocationSearch', () => ({
  useLocationSearch: (...args: unknown[]) => mockUseLocationSearch(...args),
}));

jest.mock('../../hooks/useElementInView', () => ({
  useElementInView: jest.fn().mockReturnValue([{ current: null }, false]),
}));

jest.mock('../../rest/knowledgeCenterAPI', () => ({
  getListKnowledgePages: jest.fn(),
}));

jest.mock('../../components/KnowledgeCenter/KnowledgeCard/KnowledgeCard', () =>
  jest
    .fn()
    .mockImplementation(({ knowledgeItem }) => (
      <div data-testid="knowledge-card">
        {knowledgeItem?.displayName || knowledgeItem?.name || ''}
      </div>
    ))
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

const mockGetListKnowledgePages = getListKnowledgePages as jest.MockedFunction<
  typeof getListKnowledgePages
>;

// Minimal KnowledgePage fixtures. `KnowledgePage` carries many required fields that
// are irrelevant to this page's fetch/render behaviour, so the builder casts through
// `unknown` to avoid seeding every field (same pattern as KnowledgeCard.mock.ts).
const makeArticlePage = (id: string, displayName: string): KnowledgePage =>
  ({
    id,
    name: id,
    displayName,
    fullyQualifiedName: id,
    version: 1,
    updatedAt: 0,
    updatedBy: 'tester',
    href: '',
    pageType: PageType.ARTICLE,
    page: { publicationDate: 0, relatedArticles: [] },
    deleted: false,
    relatedEntities: [],
  } as unknown as KnowledgePage);

const ARTICLE_A = makeArticlePage('kp-A-1', 'Article A1');
const ARTICLE_B = makeArticlePage('kp-B-1', 'Article B1');
const DEFAULT_ARTICLE = makeArticlePage('kp-1', 'Knowledge Page 1');

const ENTITY_A = 'entity-A';
const ENTITY_B = 'entity-B';

const renderPage = () => render(<KnowledgeCenterFilterPage />);

beforeEach(() => {
  jest.clearAllMocks();
  // Shared happy-path defaults; individual tests override as needed.
  mockGetResourcePermission.mockResolvedValue({
    ViewAll: true,
    ViewBasic: true,
  });
  mockUseLocationSearch.mockReturnValue({
    entityId: 'entity-1',
    entityType: EntityType.TABLE,
  });
  mockGetListKnowledgePages.mockResolvedValue({
    data: [DEFAULT_ARTICLE],
    paging: { total: 1 },
  });
});

describe('KnowledgeCenterFilterPage — permissions', () => {
  it('renders the knowledge page listing when view access is granted', async () => {
    mockGetResourcePermission.mockResolvedValue({
      ViewAll: true,
      ViewBasic: true,
    });

    renderPage();

    // Both the loading-skeleton and the real listing share the "knowledge-page-listing"
    // testid, so wait on the content that only the resolved (non-loading) state renders.
    expect(await screen.findByTestId('knowledge-card')).toBeInTheDocument();
  });

  it('shows the permission placeholder when view access is denied', async () => {
    mockGetResourcePermission.mockResolvedValue({
      ViewAll: false,
      ViewBasic: false,
    });

    renderPage();

    await waitFor(() => {
      expect(mockGetResourcePermission).toHaveBeenCalled();
    });

    // `permission-error-placeholder` was the old ErrorPlaceHolder's testid; the
    // page now renders the core EmptyPlaceholder (base commit fa824bf1b4's
    // placeholder migration), which doesn't set that testid — assert on its
    // access-denied copy instead (see EmptyPlaceholderVariants.test.tsx precedent).
    expect(await screen.findByText('label.access-denied')).toBeInTheDocument();
    expect(screen.queryByTestId('knowledge-card')).not.toBeInTheDocument();
  });

  it('grants view access via ViewBasic alone (EditAll fallback precedent)', async () => {
    mockGetResourcePermission.mockResolvedValue({
      ViewAll: false,
      ViewBasic: true,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('knowledge-card')).toBeInTheDocument();
    });
  });
});

describe('KnowledgeCenterFilterPage — refetch on filter identity change', () => {
  // Drive the list API off the requested entityId so a stale-data bug leaves the
  // previous entity's articles on screen (the symptom the fix must prevent).
  beforeEach(() => {
    mockGetListKnowledgePages.mockImplementation((params) => {
      if (params?.entityId === ENTITY_A) {
        return Promise.resolve({ data: [ARTICLE_A], paging: { total: 1 } });
      }
      if (params?.entityId === ENTITY_B) {
        return Promise.resolve({ data: [ARTICLE_B], paging: { total: 1 } });
      }

      return Promise.resolve({ data: [], paging: { total: 0 } });
    });
  });

  it('refetches and replaces the listing when entityId changes', async () => {
    mockUseLocationSearch.mockReturnValue({
      entityId: ENTITY_A,
      entityType: EntityType.TABLE,
    });

    const { rerender } = renderPage();

    // Initial mount fetches entity A's articles.
    await waitFor(() =>
      expect(mockGetListKnowledgePages).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: ENTITY_A })
      )
    );

    expect(await screen.findByText('Article A1')).toBeInTheDocument();

    const callsBefore = mockGetListKnowledgePages.mock.calls.length;

    // Simulate the keep-alive re-render that occurs when the user navigates to
    // entity B's filter URL: same path, different query string, same instance.
    mockUseLocationSearch.mockReturnValue({
      entityId: ENTITY_B,
      entityType: EntityType.TABLE,
    });
    rerender(<KnowledgeCenterFilterPage />);

    // The fetch effect must re-fire for the new entity…
    await waitFor(() =>
      expect(mockGetListKnowledgePages).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: ENTITY_B })
      )
    );

    expect(mockGetListKnowledgePages.mock.calls.length).toBeGreaterThan(
      callsBefore
    );

    // …and the stale entity-A article must be gone, replaced by entity-B's.
    expect(await screen.findByText('Article B1')).toBeInTheDocument();
    expect(screen.queryByText('Article A1')).not.toBeInTheDocument();
  });

  it('refetches when only entityType changes', async () => {
    mockUseLocationSearch.mockReturnValue({
      entityId: ENTITY_A,
      entityType: EntityType.TABLE,
    });

    const { rerender } = renderPage();
    await waitFor(() =>
      expect(mockGetListKnowledgePages).toHaveBeenCalledWith(
        expect.objectContaining({
          entityId: ENTITY_A,
          entityType: EntityType.TABLE,
        })
      )
    );

    const callsBefore = mockGetListKnowledgePages.mock.calls.length;

    // Same entityId, different entityType — still a filter identity change.
    mockUseLocationSearch.mockReturnValue({
      entityId: ENTITY_A,
      entityType: EntityType.DATABASE,
    });
    rerender(<KnowledgeCenterFilterPage />);

    await waitFor(() =>
      expect(mockGetListKnowledgePages).toHaveBeenCalledWith(
        expect.objectContaining({ entityType: EntityType.DATABASE })
      )
    );

    expect(mockGetListKnowledgePages.mock.calls.length).toBeGreaterThan(
      callsBefore
    );
  });

  it('does not refetch on a re-render that preserves entityId and entityType', async () => {
    mockUseLocationSearch.mockReturnValue({
      entityId: ENTITY_A,
      entityType: EntityType.TABLE,
    });

    const { rerender } = renderPage();
    await waitFor(() =>
      expect(mockGetListKnowledgePages).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: ENTITY_A })
      )
    );

    const callsBefore = mockGetListKnowledgePages.mock.calls.length;

    // An unrelated re-render with the same filter identity must not trigger a fetch.
    mockUseLocationSearch.mockReturnValue({
      entityId: ENTITY_A,
      entityType: EntityType.TABLE,
    });
    rerender(<KnowledgeCenterFilterPage />);

    await waitFor(() =>
      expect(mockGetListKnowledgePages.mock.calls.length).toBe(callsBefore)
    );

    expect(mockGetListKnowledgePages.mock.calls.length).toBe(callsBefore);
  });

  it('resets paging on entity change so the refetch is a fresh first-page request', async () => {
    mockUseLocationSearch.mockReturnValue({
      entityId: ENTITY_A,
      entityType: EntityType.TABLE,
    });
    // First entity's response carries a next-page cursor.
    mockGetListKnowledgePages.mockResolvedValueOnce({
      data: [ARTICLE_A],
      paging: { total: 2, after: 'cursor-A' },
    });

    const { rerender } = renderPage();
    await waitFor(() =>
      expect(mockGetListKnowledgePages).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: ENTITY_A })
      )
    );

    // Switching entities must reset the cursor: the next request must not reuse
    // entity A's `after` cursor (which would fetch an arbitrary second page of A
    // under entity B's filter).
    mockUseLocationSearch.mockReturnValue({
      entityId: ENTITY_B,
      entityType: EntityType.TABLE,
    });
    rerender(<KnowledgeCenterFilterPage />);

    await waitFor(() =>
      expect(mockGetListKnowledgePages).toHaveBeenCalledWith(
        expect.objectContaining({ entityId: ENTITY_B })
      )
    );

    const postChangeCall = mockGetListKnowledgePages.mock.calls.at(-1)?.[0];

    expect(postChangeCall?.after).toBeUndefined();
    expect(postChangeCall?.entityId).toBe(ENTITY_B);
  });
});
