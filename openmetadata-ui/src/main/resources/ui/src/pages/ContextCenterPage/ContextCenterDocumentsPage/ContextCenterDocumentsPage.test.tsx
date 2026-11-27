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
import { MemoryRouter, useNavigate } from 'react-router-dom';
import {
  deleteDriveFile,
  getContextFileById,
  listContextFiles,
} from '../../../rest/assetAPI';
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
    default: jest.fn().mockImplementation(({ onSearch }) => (
      <div data-testid="context-center-header">
        {onSearch && (
          <button
            data-testid="trigger-search-btn"
            onClick={() => onSearch('query')}>
            search
          </button>
        )}
      </div>
    )),
  })
);

jest.mock(
  '../../../components/ContextCenter/DocumentsView/DocumentFolderView.component',
  () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(({ onSelectFolder }) => (
      <div data-testid="document-folder-view">
        {onSelectFolder && (
          <button
            data-testid="select-folder-btn"
            onClick={() => onSelectFolder('folder-1')}>
            folder
          </button>
        )}
      </div>
    )),
  })
);

jest.mock(
  '../../../components/ContextCenter/DocumentsView/DocumentsView.component',
  () => ({
    __esModule: true,
    default: jest
      .fn()
      .mockImplementation(
        ({
          canEdit,
          canDelete,
          data,
          previewFileId,
          selectedIds,
          onSelectFile,
          onClearSelection,
          onDeleteFile,
          onFileRefreshed,
          onFileUpdated,
        }) => (
          <div
            data-can-delete={String(Boolean(canDelete))}
            data-can-edit={String(Boolean(canEdit))}
            data-first-file-folder={data?.[0]?.folder?.name ?? ''}
            data-first-file-memory-count={String(data?.[0]?.memoryCount ?? '')}
            data-first-file-never-extracted={String(
              data?.[0]?.neverExtracted ?? ''
            )}
            data-first-file-status={data?.[0]?.processingStatus ?? ''}
            data-first-file-visibility={
              data?.[0]?.shareConfig?.visibility ?? ''
            }
            data-preview-file-id={previewFileId ?? ''}
            data-selected-ids={Array.from(selectedIds ?? []).join(',')}
            data-testid="documents-view">
            <button
              data-testid="select-file-btn"
              onClick={() => onSelectFile?.('file-1')}>
              select
            </button>
            {/* What a PATCH returns: stored fields only. */}
            <button
              data-testid="update-file-btn"
              onClick={() =>
                onFileUpdated?.({
                  id: 'file-1',
                  name: 'file-1.pdf',
                  processingStatus: 'Processed',
                  shareConfig: { visibility: 'Private', sharedWith: [] },
                })
              }>
              update-file
            </button>
            {/* What an Extract returns: every field the list reads. */}
            <button
              data-testid="refresh-file-btn"
              onClick={() =>
                onFileRefreshed?.({
                  id: 'file-1',
                  name: 'file-1.pdf',
                  folder: { id: 'folder-1', type: 'folder', name: 'finance' },
                  memoryCount: 0,
                  neverExtracted: false,
                  processingStatus: 'ExtractingContext',
                })
              }>
              refresh-file
            </button>
            <button
              data-testid="clear-selection-btn"
              onClick={() => onClearSelection?.()}>
              clear
            </button>
            <button
              data-testid="delete-file-btn"
              onClick={() =>
                onDeleteFile?.({ id: 'file-1', name: 'file-1.pdf' })
              }>
              delete-file
            </button>
          </div>
        )
      ),
  })
);

jest.mock(
  '../../../components/ContextCenter/DocumentsView/DocumentPreviewPanel.component',
  () => ({
    __esModule: true,
    default: ({
      file,
      onFileRefreshed,
    }: {
      file: { id: string; processingStatus?: string };
      onFileRefreshed?: (file: object) => void;
    }) => (
      <div
        data-file-status={file.processingStatus ?? ''}
        data-testid="document-preview-panel">
        <button
          data-testid="preview-refresh-file-btn"
          onClick={() =>
            onFileRefreshed?.({
              id: file.id,
              name: `${file.id}.pdf`,
              memoryCount: 0,
              neverExtracted: false,
              processingStatus: 'Failed',
            })
          }>
          refresh-preview
        </button>
      </div>
    ),
  })
);

jest.mock(
  '../../../components/ContextCenter/UploadDocumentModal/UploadDocumentModal.component',
  () => ({
    __esModule: true,
    default: () => null,
  })
);

jest.mock('../../../components/common/DeleteModal/DeleteModal', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(({ open, onDelete, onCancel }) =>
    open ? (
      <div data-testid="delete-modal">
        <button data-testid="confirm-delete-btn" onClick={onDelete}>
          confirm
        </button>
        <button data-testid="cancel-delete-btn" onClick={onCancel}>
          cancel
        </button>
      </div>
    ) : null
  ),
}));

// react-markdown ships ESM and is not in jest's transformIgnorePatterns allowlist, so the
// CreateMemoryModal this page now pulls in transitively fails to parse. Same stub the
// CreateMemoryModal suite uses.
jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

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

const NavigateTo = ({ to }: { to: string }) => {
  const navigate = useNavigate();

  return (
    <button data-testid="navigate" onClick={() => navigate(to)}>
      {to}
    </button>
  );
};

const NavigateBack = () => {
  const navigate = useNavigate();

  return (
    <button data-testid="navigate-back" onClick={() => navigate(-1)}>
      Back
    </button>
  );
};

describe('ContextCenterDocumentsPage — previewed document', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetResourcePermission.mockResolvedValue({});
  });

  it('closes the preview when Back returns to the documents list', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/context-center/documents',
          '/context-center/documents?document=file-1',
        ]}>
        <ContextCenterDocumentsPage />
        <NavigateBack />
      </MemoryRouter>
    );

    expect(
      await screen.findByTestId('document-preview-panel')
    ).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('navigate-back'));

    await waitFor(() => {
      expect(
        screen.queryByTestId('document-preview-panel')
      ).not.toBeInTheDocument();
      expect(screen.getByTestId('documents-view')).toHaveAttribute(
        'data-preview-file-id',
        ''
      );
    });
  });

  // A memory previewed from a document can link the copy it was reused from; the page stays mounted.
  it('previews the document a link opens while another is previewed', async () => {
    (getContextFileById as jest.Mock).mockResolvedValue({
      id: 'file-2',
      name: 'file-2.pdf',
    });

    render(
      <MemoryRouter
        initialEntries={['/context-center/documents?document=file-1']}>
        <ContextCenterDocumentsPage />
        <NavigateTo to="/context-center/documents?document=file-2" />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toHaveAttribute(
        'data-preview-file-id',
        'file-1'
      )
    );

    fireEvent.click(screen.getByTestId('navigate'));

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toHaveAttribute(
        'data-preview-file-id',
        'file-2'
      )
    );

    expect(getContextFileById).toHaveBeenCalledWith('file-2');
  });
});

// Selection state (selectedIds) lives on the page and must be cleared when the
// visible context changes (folder navigation, search) and pruned when a
// selected row is deleted, so stale "ghost" ids can never drive bulk actions.
describe('ContextCenterDocumentsPage — selection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetResourcePermission.mockResolvedValue({});
  });

  it('wires onClearSelection to empty the selection', async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('select-file-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toHaveAttribute(
        'data-selected-ids',
        'file-1'
      )
    );

    fireEvent.click(screen.getByTestId('clear-selection-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toHaveAttribute(
        'data-selected-ids',
        ''
      )
    );
  });

  it('clears selection when the selected folder changes', async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('select-file-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toHaveAttribute(
        'data-selected-ids',
        'file-1'
      )
    );

    fireEvent.click(screen.getByTestId('select-folder-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toHaveAttribute(
        'data-selected-ids',
        ''
      )
    );
  });

  it('clears selection when a search query is entered', async () => {
    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('select-file-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toHaveAttribute(
        'data-selected-ids',
        'file-1'
      )
    );

    fireEvent.click(screen.getByTestId('trigger-search-btn'));

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(screen.getByTestId('documents-view')).toHaveAttribute(
      'data-selected-ids',
      ''
    );
  });

  it('prunes the deleted file id from selection on single-file delete', async () => {
    (deleteDriveFile as jest.Mock).mockResolvedValue(undefined);
    (listContextFiles as jest.Mock).mockResolvedValue({
      data: [
        { id: 'file-1', name: 'file-1.pdf' },
        { id: 'file-2', name: 'file-2.pdf' },
      ],
      paging: { total: 2 },
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('select-file-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toHaveAttribute(
        'data-selected-ids',
        'file-1'
      )
    );

    fireEvent.click(screen.getByTestId('delete-file-btn'));

    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));
    });

    await waitFor(() =>
      expect(deleteDriveFile).toHaveBeenCalledWith('file-1', false)
    );

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toHaveAttribute(
        'data-selected-ids',
        ''
      )
    );
  });
});

describe('ContextCenterDocumentsPage — file writes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetResourcePermission.mockResolvedValue({});
  });

  // A write response carries only stored fields; the row keeps what its list read computed.
  it('keeps the read-only fields of a file when a write returns it', async () => {
    (listContextFiles as jest.Mock).mockResolvedValue({
      data: [
        {
          id: 'file-1',
          name: 'file-1.pdf',
          folder: { id: 'folder-1', type: 'folder', name: 'finance' },
          memoryCount: 3,
          neverExtracted: true,
          processingStatus: 'Processed',
        },
      ],
      paging: { total: 1 },
    });

    renderPage();

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toHaveAttribute(
        'data-first-file-never-extracted',
        'true'
      )
    );

    fireEvent.click(screen.getByTestId('update-file-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toHaveAttribute(
        'data-first-file-visibility',
        'Private'
      )
    );
    const view = screen.getByTestId('documents-view');

    expect(view).toHaveAttribute('data-first-file-never-extracted', 'true');
    expect(view).toHaveAttribute('data-first-file-memory-count', '3');
    expect(view).toHaveAttribute('data-first-file-folder', 'finance');
  });
});

// An Extract response, or the read after one is refused, carries every field the list reads.
describe('ContextCenterDocumentsPage — extraction refreshes', () => {
  const notExtracted = {
    id: 'file-1',
    name: 'file-1.pdf',
    folder: { id: 'folder-1', type: 'folder', name: 'finance' },
    memoryCount: 3,
    neverExtracted: true,
    processingStatus: 'Processed',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetResourcePermission.mockResolvedValue({});
    (listContextFiles as jest.Mock).mockResolvedValue({
      data: [notExtracted],
      paging: { total: 1 },
    });
  });

  // Unlike a metadata write's merge, the response replaces what the list read computed.
  it('replaces the row and its preview with the file a row extraction returns', async () => {
    render(
      <MemoryRouter
        initialEntries={['/context-center/documents?document=file-1']}>
        <ContextCenterDocumentsPage />
      </MemoryRouter>
    );

    await waitFor(() =>
      expect(screen.getByTestId('document-preview-panel')).toHaveAttribute(
        'data-file-status',
        'Processed'
      )
    );

    fireEvent.click(screen.getByTestId('refresh-file-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toHaveAttribute(
        'data-first-file-never-extracted',
        'false'
      )
    );
    const view = screen.getByTestId('documents-view');

    expect(view).toHaveAttribute('data-first-file-status', 'ExtractingContext');
    expect(view).toHaveAttribute('data-first-file-memory-count', '0');
    expect(screen.getByTestId('document-preview-panel')).toHaveAttribute(
      'data-file-status',
      'ExtractingContext'
    );
  });

  it('replaces the row with the file the preview reads after its extraction is refused', async () => {
    render(
      <MemoryRouter
        initialEntries={['/context-center/documents?document=file-1']}>
        <ContextCenterDocumentsPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByTestId('preview-refresh-file-btn'));

    await waitFor(() =>
      expect(screen.getByTestId('documents-view')).toHaveAttribute(
        'data-first-file-status',
        'Failed'
      )
    );

    expect(screen.getByTestId('documents-view')).toHaveAttribute(
      'data-first-file-never-extracted',
      'false'
    );
    expect(screen.getByTestId('document-preview-panel')).toHaveAttribute(
      'data-file-status',
      'Failed'
    );
  });
});
