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
import { ResourceEntity } from '../../../enums/permissions.enum';
import { useEntityPermissions } from '../../../hooks/useEntityPermissions/useEntityPermissions';
import { useFqn } from '../../../hooks/useFqn';
import { getDerivedPermissionFlags } from '../../../utils/PermissionDerivation';
import { DEFAULT_ENTITY_PERMISSION } from '../../../utils/PermissionsUtils';
import ContextCenterArticlesPage from './ContextCenterArticlesPage';

const ARTICLE_FQN = 'article_1';

const RESOURCE_PERMISSION = {
  ...DEFAULT_ENTITY_PERMISSION,
  Create: true,
  ViewBasic: true,
} as OperationPermission;

const OWNER_ENTITY_PERMISSION = {
  ...DEFAULT_ENTITY_PERMISSION,
  ViewAll: true,
  EditAll: true,
  EditOwners: true,
  Delete: true,
} as OperationPermission;

const mockGetResourcePermission = jest
  .fn()
  .mockResolvedValue(RESOURCE_PERMISSION);

jest.mock('../../../components/AppRouter/withActivityFeed', () => ({
  withActivityFeed: (Component: React.ComponentType) => Component,
}));

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getResourcePermission: mockGetResourcePermission,
  }),
}));

jest.mock('../../../hooks/useEntityPermissions/useEntityPermissions', () => ({
  useEntityPermissions: jest.fn(),
}));

jest.mock('../../../hooks/useFqn', () => ({
  useFqn: jest.fn(),
}));

jest.mock('../../../hooks/useApplicationStore', () => ({
  useApplicationStore: () => ({ currentUser: { id: 'user-1' } }),
}));

jest.mock('../../../hooks/useAppMode', () => ({
  useIsAiMode: () => false,
}));

jest.mock('../../../context/LimitsProvider/useLimitsStore', () => ({
  useLimitStore: () => ({ getResourceLimit: jest.fn() }),
}));

jest.mock(
  '../../../components/ContextCenter/ArticleDetailHeader/ArticleDetailHeader.component',
  () => ({
    __esModule: true,
    default: ({ permissions }: { permissions: OperationPermission }) => (
      <div data-testid="article-detail-header">
        {permissions.ViewAll && <span data-testid="can-view-all" />}
        {permissions.EditOwners && <span data-testid="can-edit-owners" />}
        {permissions.Delete && <span data-testid="can-delete" />}
      </div>
    ),
  })
);

jest.mock(
  '../../../components/KnowledgeCenter/KnowledgePageDetailComponent/KnowledgePageDetailComponent',
  () => ({ __esModule: true, default: () => null })
);

jest.mock(
  '../../../components/KnowledgeCenter/KnowledgePageListComponent/KnowledgePageListComponent',
  () => ({ __esModule: true, default: () => null })
);

jest.mock(
  '../../../components/KnowledgeCenter/KnowledgePagesHierarchy/KnowledgePagesHierarchy',
  () => ({
    __esModule: true,
    default: jest.requireActual('react').forwardRef(() => null),
  })
);

jest.mock(
  '../../../components/KnowledgeCenter/QuickLinkFormModal/QuickLinkFormModal',
  () => ({ QuickLinkFormModal: () => null })
);

jest.mock(
  '../../../components/ContextCenter/ContextCenterHeader/ContextCenterHeader.component',
  () => ({ __esModule: true, default: () => null })
);

jest.mock(
  '../../../components/ContextCenter/ArticleVersionHeader/ArticleVersionHeader.component',
  () => ({ __esModule: true, default: () => null })
);

jest.mock(
  '../../../components/ContextCenter/ArticlesListToolbar/ArticlesListToolbar',
  () => ({ __esModule: true, default: () => null })
);

jest.mock('../../../components/Explore/ExploreQuickFilters', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../../components/common/DocumentTitle/DocumentTitle', () => ({
  __esModule: true,
  default: () => null,
}));

jest.mock('../../KnowledgePageVersionPage/KnowledgePageVersionPage', () => ({
  __esModule: true,
  default: () => null,
}));

const mockEntityPermission = (permissions: OperationPermission) =>
  (useEntityPermissions as jest.Mock).mockReturnValue({
    permissions,
    isLoading: false,
    error: null,
    refresh: jest.fn(),
    ...getDerivedPermissionFlags(permissions, false),
  });

const renderPage = () =>
  render(
    <MemoryRouter>
      <ContextCenterArticlesPage />
    </MemoryRouter>
  );

describe('ContextCenterArticlesPage article header permissions', () => {
  beforeEach(() => {
    (useFqn as jest.Mock).mockReturnValue({ fqn: ARTICLE_FQN });
  });

  it('gates owner edit and delete on the open article permission, not the resource permission', async () => {
    mockEntityPermission(OWNER_ENTITY_PERMISSION);

    renderPage();

    await waitFor(() => expect(mockGetResourcePermission).toHaveBeenCalled());

    expect(useEntityPermissions).toHaveBeenCalledWith(
      ResourceEntity.KNOWLEDGE_PAGE,
      ARTICLE_FQN,
      { enabled: true }
    );
    expect(await screen.findByTestId('can-edit-owners')).toBeInTheDocument();
    expect(screen.getByTestId('can-delete')).toBeInTheDocument();
  });

  it('hides owner edit and delete when the article permission denies them', async () => {
    mockEntityPermission({
      ...DEFAULT_ENTITY_PERMISSION,
      ViewAll: true,
    } as OperationPermission);
    mockGetResourcePermission.mockResolvedValueOnce(OWNER_ENTITY_PERMISSION);

    renderPage();

    await waitFor(() => expect(mockGetResourcePermission).toHaveBeenCalled());
    // Wait for a resolved permission to reach the header so the absence checks below
    // can't pass against the initial DEFAULT_ENTITY_PERMISSION.
    await screen.findByTestId('can-view-all');

    expect(screen.queryByTestId('can-edit-owners')).not.toBeInTheDocument();
    expect(screen.queryByTestId('can-delete')).not.toBeInTheDocument();
  });
});
