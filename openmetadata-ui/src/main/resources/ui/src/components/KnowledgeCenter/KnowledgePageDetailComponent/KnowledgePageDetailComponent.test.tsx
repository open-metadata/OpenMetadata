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
import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { OperationPermission } from '../../../context/PermissionProvider/PermissionProvider.interface';
import { EntityTabs, EntityType } from '../../../enums/entity.enum';
import { ResourceEntity } from '../../../enums/permissions.enum';
import { ENTITY_PERMISSIONS } from '../../../mocks/Permissions.mock';
import {
  getKnowledgePageByFqn,
  patchKnowledgePage,
} from '../../../rest/knowledgeCenterAPI';
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
  page: { publicationDate: '2026-10-19T00:00:00.000Z', relatedArticles: [] },
  deleted: false,
};

const mockUseEntityPermissions = jest.fn();
let mockRouteTab: string | undefined;

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
  useRequiredParams: () => ({ fqn: 'test.page.fqn', tab: mockRouteTab }),
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

const mockCustomPropertyTable = jest.fn();

jest.mock('../../common/CustomPropertyTable/CustomPropertyTable', () => ({
  CustomPropertyTable: (props: Record<string, unknown>) => {
    mockCustomPropertyTable(props);

    return <div data-testid="custom-property-table" />;
  },
}));

const renderComponent = (onPageChange = jest.fn()) =>
  render(<KnowledgePageDetailComponent onPageChange={onPageChange} />, {
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

    // `permission-error-placeholder` was the old ErrorPlaceHolder's testid; the
    // component now renders the core EmptyPlaceholder (base commit fa824bf1b4's
    // placeholder migration), which doesn't set that testid — assert on its
    // access-denied copy instead (see EmptyPlaceholderVariants.test.tsx precedent).
    await waitFor(() => {
      expect(screen.getByText('label.access-denied')).toBeInTheDocument();
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

describe('KnowledgePageDetailComponent custom properties', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouteTab = EntityTabs.CUSTOM_PROPERTIES;
    setMockPermissions({
      ...ENTITY_PERMISSIONS,
      ViewBasic: true,
      EditCustomFields: true,
      ViewCustomFields: true,
    });
  });

  afterEach(() => {
    mockRouteTab = undefined;
  });

  it('requests the extension field with the article', async () => {
    renderComponent();

    await waitFor(() => {
      expect(getKnowledgePageByFqn).toHaveBeenCalledWith('test.page.fqn', {
        fields: expect.stringContaining('extension'),
      });
    });
  });

  it('renders the custom property table for the article with its permissions', async () => {
    renderComponent();

    expect(
      await screen.findByTestId('custom-property-table')
    ).toBeInTheDocument();
    expect(mockCustomPropertyTable).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entityType: EntityType.KNOWLEDGE_PAGE,
        entityDetails: expect.objectContaining({ id: 'kp-id-1' }),
        hasEditAccess: true,
        hasPermission: true,
      })
    );
  });

  it('denies viewing and editing custom properties without those permissions', async () => {
    setMockPermissions({
      ViewBasic: true,
      EditAll: false,
      EditCustomFields: false,
      ViewAll: false,
      ViewCustomFields: false,
    });
    renderComponent();

    await screen.findByTestId('custom-property-table');

    expect(mockCustomPropertyTable).toHaveBeenLastCalledWith(
      expect.objectContaining({ hasEditAccess: false, hasPermission: false })
    );
  });

  it('renders full width without the properties panel', async () => {
    const onPageChange = jest.fn();
    renderComponent(onPageChange);
    await screen.findByTestId('custom-property-table');

    expect(onPageChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        activeTab: EntityTabs.CUSTOM_PROPERTIES,
        rightPanel: null,
      })
    );
  });

  it('keeps the properties panel on the content tab', async () => {
    mockRouteTab = EntityTabs.OVERVIEW;
    const onPageChange = jest.fn();
    renderComponent(onPageChange);
    await screen.findByTestId('block-editor');

    await waitFor(() => {
      expect(onPageChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ rightPanel: expect.anything() })
      );
    });
  });

  it('patches the article extension when a property value is saved', async () => {
    (patchKnowledgePage as jest.Mock).mockResolvedValue({
      ...MOCK_KNOWLEDGE_PAGE,
      extension: { owner: 'data-team' },
      version: 0.2,
    });
    renderComponent();
    await screen.findByTestId('custom-property-table');

    const { entityDetails, onEntityUpdate } =
      mockCustomPropertyTable.mock.calls[
        mockCustomPropertyTable.mock.calls.length - 1
      ][0];
    await act(() =>
      onEntityUpdate({ ...entityDetails, extension: { owner: 'data-team' } })
    );

    expect(patchKnowledgePage).toHaveBeenCalledWith('kp-id-1', [
      { op: 'add', path: '/extension', value: { owner: 'data-team' } },
    ]);
    expect(mockCustomPropertyTable).toHaveBeenLastCalledWith(
      expect.objectContaining({
        entityDetails: expect.objectContaining({
          extension: { owner: 'data-team' },
        }),
      })
    );
  });
});
