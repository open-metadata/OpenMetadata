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
import ContextCenterArchivePage from './ContextCenterArchivePage';

// Resource-level permission (getResourcePermission(KNOWLEDGE_PAGE)) — no prior
// test coverage. This suite covers the flagged raw `permissions?.EditAll` read
// (now `canEditAll`), wired to ArchiveView's `canRestore` prop. Do not alter any
// polling/refresh logic here (recent upstream flaky-test history on this page) —
// only the permission read changed.

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

jest.mock('../../../rest/assetAPI', () => ({
  listArchivedContextFiles: jest.fn().mockResolvedValue({
    data: [{ id: 'file-1', name: 'file-1.pdf', updatedAt: 1 }],
    paging: { total: 1 },
  }),
  deleteDriveFile: jest.fn(),
  restoreDriveFile: jest.fn(),
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
  '../../../components/ContextCenter/ArchiveView/ArchiveView.component',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(({ canDelete, canRestore }) => (
        <div
          data-can-delete={String(Boolean(canDelete))}
          data-can-restore={String(Boolean(canRestore))}
          data-testid="archive-view"
        />
      )),
  })
);

const renderPage = () =>
  render(
    <MemoryRouter>
      <ContextCenterArchivePage />
    </MemoryRouter>
  );

describe('ContextCenterArchivePage — permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wires EditAll (via canEditAll) into ArchiveView canRestore when granted', async () => {
    mockGetResourcePermission.mockResolvedValue({
      Create: true,
      Delete: true,
      EditAll: true,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('archive-view')).toHaveAttribute(
        'data-can-restore',
        'true'
      );
    });
  });

  it('wires EditAll (via canEditAll) into ArchiveView canRestore when denied', async () => {
    mockGetResourcePermission.mockResolvedValue({
      Create: true,
      Delete: true,
      EditAll: false,
    });

    renderPage();

    await waitFor(() => {
      expect(mockGetResourcePermission).toHaveBeenCalled();
    });
    expect(screen.getByTestId('archive-view')).toHaveAttribute(
      'data-can-restore',
      'false'
    );
  });
});
