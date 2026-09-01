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
  default: { getContainerClassName: jest.fn().mockReturnValue('') },
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
    default: () => <div data-testid="context-center-header" />,
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

jest.mock(
  '../../../components/ContextCenter/CreateMemoryModal/CreateMemoryModal.component',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(({ canEdit }) => (
        <div
          data-can-edit={String(Boolean(canEdit))}
          data-testid="create-memory-modal"
        />
      )),
  })
);

jest.mock(
  '../../../components/DataAssets/DataAssetSelectList/DataAssetSelectList',
  () => ({
    __esModule: true,
    default: () => <div data-testid="data-asset-select-list" />,
  })
);

const renderPage = () =>
  render(
    <MemoryRouter>
      <ContextCenterMemoriesPage />
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
});
