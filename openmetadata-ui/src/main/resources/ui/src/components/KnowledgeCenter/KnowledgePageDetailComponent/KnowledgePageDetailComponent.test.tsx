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
import {
  OperationPermission,
  ResourceEntity,
} from '../../../context/PermissionProvider/PermissionProvider.interface';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { showErrorToast } from '../../../utils/ToastUtils';
import KnowledgePageDetailComponent from './KnowledgePageDetailComponent';

// KnowledgePageDetailComponent.tsx had ZERO existing test coverage before this conversion
// (Task 8 Batch 2). This is a minimal permission-focused characterization suite, not a full
// render suite for the component's many other features (voting, follow, drafts, activity
// feed, related entities) — matching the precedent DomainDetails.component.test.tsx set in
// Task 8 Batch 1 for the same "no prior coverage" situation.

const MOCK_KNOWLEDGE_PAGE = {
  id: 'kp-id-1',
  name: 'test-page',
  fullyQualifiedName: 'test.page.fqn',
  displayName: 'Test Page',
  description: 'test description',
  version: 0.1,
  updatedAt: 0,
  updatedBy: 'admin',
  href: '',
  pageType: 'Article',
  page: { publicationDate: new Date(), relatedArticles: [] },
  deleted: false,
};

const mockUseEntityPermissions = jest.fn();

const setMockPermissions = (
  overrides: Partial<OperationPermission> = {},
  {
    isLoading = false,
    error = null as unknown,
    deleted = false,
  }: { isLoading?: boolean; error?: unknown; deleted?: boolean } = {}
) => {
  const permissions = overrides as OperationPermission;
  mockUseEntityPermissions.mockReturnValue({
    permissions,
    isLoading,
    error,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, deleted),
  });
};

jest.mock('../../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: (...args: unknown[]) =>
    mockUseEntityPermissions(...args),
}));

jest.mock('../../../utils/useRequiredParams', () => ({
  useRequiredParams: () => ({ fqn: 'test.page.fqn', tab: undefined }),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: jest
    .fn()
    .mockReturnValue({ currentUser: { id: 'user-1' } }),
}));

jest.mock('../../../hooks/useArticleDraftStore', () => ({
  useArticleDraftStore: jest.fn().mockReturnValue({
    setDraft: jest.fn(),
    removeDraft: jest.fn(),
    getDraft: jest.fn().mockReturnValue(undefined),
  }),
}));

jest.mock('../../../hooks/currentUserStore/useCurrentUserStore', () => ({
  useCurrentUserPreferences: jest.fn().mockReturnValue({
    preferences: { recentlyViewedQuickLinks: [] },
  }),
}));

// mockImplementation (not mockResolvedValue) — mockResolvedValue would read
// MOCK_KNOWLEDGE_PAGE eagerly at factory-execution time, which (per jest's mock-hoisting)
// runs before this file's own top-level `const` statements — a lazy closure avoids the TDZ
// crash (same gotcha noted in task-8B1-report.md).
jest.mock('../../../rest/knowledgeCenterAPI', () => ({
  getKnowledgePageByFqn: jest
    .fn()
    .mockImplementation(() => Promise.resolve(MOCK_KNOWLEDGE_PAGE)),
  patchKnowledgePage: jest.fn(),
  followKnowledgePage: jest.fn(),
  unFollowKnowledgePage: jest.fn(),
  updateKnowledgePageVote: jest.fn(),
}));

jest.mock('../../../utils/KnowledgePageUtils', () => ({
  addToKnowledgeCenterRecentViewed: jest.fn(),
  updateKnowledgeCenterRecentViewed: jest.fn(),
}));

jest.mock('../../../utils/FeedUtilsPure', () => ({
  fetchEntityTaskCountsInto: jest.fn(),
  fetchEntityActivityCountInto: jest.fn(),
  getFeedCounts: jest.fn(),
}));

jest.mock('../../../utils/TagClassBase', () => ({
  __esModule: true,
  default: { setFilterClassification: jest.fn() },
}));

jest.mock(
  '../KnowledgePageDetailRightPanel/KnowledgePageDetailRightPanel',
  () => jest.fn().mockReturnValue(null)
);

jest.mock('../../Customization/GenericProvider/GenericProvider', () => ({
  GenericProvider: jest
    .fn()
    .mockImplementation(({ children }) => <div>{children}</div>),
}));

jest.mock(
  '../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.component',
  () => ({
    ActivityFeedTab: jest.fn().mockReturnValue(null),
  })
);

jest.mock('../../ActivityFeed/ActivityThreadPanel/ActivityThreadPanel', () =>
  jest.fn().mockReturnValue(null)
);

jest.mock(
  '../../common/EntityDescription/EntityAttachmentProvider/EntityAttachmentProvider',
  () => ({
    EntityAttachmentProvider: jest
      .fn()
      .mockImplementation(({ children }) => <div>{children}</div>),
  })
);

// Captures the `readOnly` prop directly rather than exercising the real title input.
jest.mock('../TitleComponent/TitleComponent', () => ({
  TitleComponent: jest
    .fn()
    .mockImplementation(({ readOnly }) => (
      <div data-read-only={String(Boolean(readOnly))} data-testid="title" />
    )),
}));

// Captures the `editable` prop directly — same technique as TitleComponent above.
jest.mock('../../BlockEditor/BlockEditor', () => ({
  __esModule: true,
  default: jest
    .fn()
    .mockImplementation(({ editable }) => (
      <div
        data-editable={String(Boolean(editable))}
        data-testid="block-editor"
      />
    )),
}));

const renderComponent = () =>
  render(<KnowledgePageDetailComponent onPageChange={jest.fn()} />, {
    wrapper: MemoryRouter,
  });

describe('KnowledgePageDetailComponent permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockPermissions({ ...ENTITY_PERMISSIONS, ViewBasic: true });
  });

  // Guardrail: this component owns the single useEntityPermissions call whose raw
  // `permissions` object feeds GenericProvider/KnowledgePageDetailRightPanel — see
  // TableDetailsPageV1.test.tsx's afterEach for the general rationale.
  afterEach(() => {
    const calls = mockUseEntityPermissions.mock.calls;
    if (calls.length === 0) {
      return;
    }
    const [expectedResource, expectedIdentifier] = calls[0];
    calls.forEach(([resource, identifier]) => {
      expect(resource).toBe(expectedResource);
      expect(identifier).toEqual(expectedIdentifier);
    });
  });

  it('fetches permissions for the knowledge page fqn', async () => {
    renderComponent();

    await waitFor(() => {
      expect(mockUseEntityPermissions).toHaveBeenCalledWith(
        ResourceEntity.KNOWLEDGE_PAGE,
        'test.page.fqn',
        { deleted: false }
      );
    });
  });

  it('shows the permission-fetch error toast when the hook reports an error', async () => {
    setMockPermissions(
      { ...ENTITY_PERMISSIONS, ViewBasic: true },
      { error: new Error('permission fetch failed') }
    );

    renderComponent();

    // Preserved verbatim from the old fetchPermission catch: a bare
    // showErrorToast(error as AxiosError) call, no translated message.
    await waitFor(() => {
      expect(showErrorToast).toHaveBeenCalledWith(expect.any(Error));
    });
  });

  it('shows the permission ErrorPlaceHolder when view access is denied', async () => {
    setMockPermissions({
      ...ENTITY_PERMISSIONS,
      ViewBasic: false,
      ViewAll: false,
    });

    renderComponent();

    await waitFor(() => {
      expect(
        screen.getByTestId('permission-error-placeholder')
      ).toBeInTheDocument();
    });

    expect(screen.queryByTestId('title')).not.toBeInTheDocument();
  });

  it('wires canEditDescription/canEditDisplayName into BlockEditor.editable and TitleComponent.readOnly when granted', async () => {
    setMockPermissions({
      ...ENTITY_PERMISSIONS,
      ViewBasic: true,
      EditAll: true,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('title')).toHaveAttribute(
        'data-read-only',
        'false'
      );
    });

    expect(screen.getByTestId('block-editor')).toHaveAttribute(
      'data-editable',
      'true'
    );
  });

  it('locks BlockEditor/TitleComponent when edit permissions are denied', async () => {
    setMockPermissions({
      ...ENTITY_PERMISSIONS,
      ViewBasic: true,
      EditAll: false,
      EditDescription: false,
      EditDisplayName: false,
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByTestId('title')).toHaveAttribute(
        'data-read-only',
        'true'
      );
    });

    expect(screen.getByTestId('block-editor')).toHaveAttribute(
      'data-editable',
      'false'
    );
  });
});
