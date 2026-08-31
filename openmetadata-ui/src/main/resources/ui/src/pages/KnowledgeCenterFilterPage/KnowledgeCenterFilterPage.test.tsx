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
import KnowledgeCenterFilterPage from './KnowledgeCenterFilterPage';

// Resource-level permission (getResourcePermission(KNOWLEDGE_PAGE)) — no prior test
// coverage. This suite covers the flagged raw `permissions.ViewAll || permissions.ViewBasic`
// read (now `hasViewAccess`, via getDerivedPermissionFlags), matching the Batch 8
// ContextCenter-trio precedent (ContextCenterArchivePage.test.tsx).

const mockGetResourcePermission = jest.fn();

jest.mock('../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getResourcePermission: mockGetResourcePermission,
  }),
}));

jest.mock('../../hooks/LocationSearch/useLocationSearch', () => ({
  useLocationSearch: jest.fn().mockReturnValue({
    entityId: 'entity-1',
    entityType: EntityType.TABLE,
  }),
}));

jest.mock('../../hooks/useElementInView', () => ({
  useElementInView: jest.fn().mockReturnValue([{ current: null }, false]),
}));

jest.mock('../../rest/knowledgeCenterAPI', () => ({
  getListKnowledgePages: jest.fn().mockResolvedValue({
    data: [{ id: 'kp-1', title: 'Knowledge Page 1' }],
    paging: { total: 1 },
  }),
}));

jest.mock('../../components/KnowledgeCenter/KnowledgeCard/KnowledgeCard', () =>
  jest.fn().mockImplementation(() => <div data-testid="knowledge-card" />)
);

jest.mock('../../components/PageLayoutV1/PageLayoutV1', () =>
  jest.fn().mockImplementation(({ children }) => <div>{children}</div>)
);

const renderPage = () => render(<KnowledgeCenterFilterPage />);

describe('KnowledgeCenterFilterPage — permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
    expect(
      await screen.findByTestId('permission-error-placeholder')
    ).toBeInTheDocument();
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
