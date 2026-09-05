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
import ContextCenterDocumentsPage from './ContextCenterDocumentsPage';

// Resource-level permission (getResourcePermission(KNOWLEDGE_PAGE)) — no prior
// test coverage. This suite covers the flagged raw `permissions.EditAll` read
// (now `canEditAll`), wired to DocumentsView's `canEdit` prop.

const mockGetResourcePermission = jest.fn();

jest.mock('../../../context/PermissionProvider/PermissionProvider', () => ({
  usePermissionProvider: () => ({
    getResourcePermission: mockGetResourcePermission,
  }),
}));

jest.mock('../../../rest/assetAPI', () => ({
  listContextFiles: jest.fn().mockResolvedValue({
    data: [{ id: 'file-1', name: 'file-1.pdf' }],
    paging: { total: 1 },
  }),
  listFolders: jest.fn().mockResolvedValue({ data: [], paging: { total: 0 } }),
  getContextFileById: jest.fn(),
  deleteDriveFile: jest.fn(),
  downloadDriveFiles: jest.fn(),
  bulkDeleteDriveFiles: jest.fn(),
  bulkMoveFilesToFolder: jest.fn(),
}));

jest.mock('../../../rest/searchAPI', () => ({
  searchQuery: jest.fn().mockResolvedValue({ hits: { hits: [] } }),
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
  '../../../components/ContextCenter/DocumentsView/DocumentFolderView.component',
  () => ({
    __esModule: true,
    default: () => <div data-testid="document-folder-view" />,
  })
);

jest.mock(
  '../../../components/ContextCenter/DocumentsView/DocumentsView.component',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(({ canEdit, canDelete }) => (
        <div
          data-can-delete={String(Boolean(canDelete))}
          data-can-edit={String(Boolean(canEdit))}
          data-testid="documents-view"
        />
      )),
  })
);

jest.mock(
  '../../../components/ContextCenter/UploadDocumentModal/UploadDocumentModal.component',
  () => ({
    __esModule: true,
    default: () => null,
  })
);

jest.mock('react-reflex', () => ({
  ReflexContainer: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ReflexElement: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  ReflexSplitter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}));

const renderPage = () =>
  render(
    <MemoryRouter>
      <ContextCenterDocumentsPage />
    </MemoryRouter>
  );

describe('ContextCenterDocumentsPage — permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('wires EditAll (via canEditAll) into DocumentsView canEdit when granted', async () => {
    mockGetResourcePermission.mockResolvedValue({
      Create: true,
      Delete: true,
      EditAll: true,
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId('documents-view')).toHaveAttribute(
        'data-can-edit',
        'true'
      );
    });
  });

  it('wires EditAll (via canEditAll) into DocumentsView canEdit when denied', async () => {
    mockGetResourcePermission.mockResolvedValue({
      Create: true,
      Delete: true,
      EditAll: false,
    });

    renderPage();

    await waitFor(() => {
      expect(mockGetResourcePermission).toHaveBeenCalled();
    });

    expect(screen.getByTestId('documents-view')).toHaveAttribute(
      'data-can-edit',
      'false'
    );
  });
});
