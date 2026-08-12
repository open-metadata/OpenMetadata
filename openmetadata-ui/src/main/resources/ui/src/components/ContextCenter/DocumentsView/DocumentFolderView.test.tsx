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
import { createRef } from 'react';
import { deleteFolder, listContextFiles } from '../../../rest/assetAPI';
import DocumentFolderView from './DocumentFolderView.component';
import {
  DocumentFolderViewHandle,
  DocumentFolderViewProps,
} from './DocumentsView.interface';

const renderFolderView = (
  props: Partial<DocumentFolderViewProps> = {},
  ref?: React.Ref<DocumentFolderViewHandle>
) =>
  render(
    <DocumentFolderView
      folders={[]}
      isLoading={false}
      ref={ref}
      onFoldersChanged={jest.fn()}
      onSelectFolder={jest.fn()}
      {...props}
    />
  );

jest.mock('rest/assetAPI', () => ({
  listContextFiles: jest.fn(),
  deleteFolder: jest.fn(),
}));

jest.mock('../../../utils/EntityNameUtils', () => ({
  getEntityName: jest.fn((entity) => entity?.displayName ?? entity?.name ?? ''),
}));

jest.mock('../../../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
  showSuccessToast: jest.fn(),
}));

jest.mock('../../../assets/svg/ic-folder-new.svg', () => ({
  ReactComponent: jest.fn(() => <span data-testid="folder-icon" />),
}));

jest.mock('../CreateFolderModal/CreateFolderModal.component', () =>
  jest.fn(
    ({
      isOpen,
      onCreated,
      onClose,
    }: {
      isOpen: boolean;
      onCreated: (f: unknown) => void;
      onClose: () => void;
    }) =>
      isOpen ? (
        <div data-testid="create-folder-modal">
          <button
            data-testid="modal-create-btn"
            onClick={() =>
              onCreated({
                id: 'new-folder',
                name: 'new-folder',
                displayName: 'New Folder',
              })
            }>
            create
          </button>
          <button data-testid="modal-close-btn" onClick={onClose}>
            close
          </button>
        </div>
      ) : null
  )
);

jest.mock('../../../components/common/DeleteModal/DeleteModal', () =>
  jest.fn(
    ({
      open,
      onDelete,
      onCancel,
    }: {
      open: boolean;
      onDelete: () => void;
      onCancel: () => void;
    }) =>
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
  )
);

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest.fn(
    ({
      children,
      onClick,
    }: {
      children: React.ReactNode;
      onClick?: (e: React.MouseEvent) => void;
    }) => <button onClick={onClick}>{children}</button>
  ),
  Badge: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span data-testid="badge">{children}</span>
  )),
  ButtonUtility: jest.fn(
    ({
      onClick,
      'data-testid': testId,
      tooltip,
    }: {
      onClick?: (e: React.MouseEvent) => void;
      'data-testid'?: string;
      tooltip?: string;
    }) => (
      <button aria-label={tooltip} data-testid={testId} onClick={onClick}>
        btn
      </button>
    )
  ),
  Card: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div data-testid="card">{children}</div>
  )),
  Dot: jest.fn(() => <div data-testid="dot">dot</div>),
  FileIcon: jest.fn(({ type }: { type: string }) => (
    <span data-testid={`file-icon-${type}`} />
  )),
  Skeleton: jest.fn(() => <div data-testid="skeleton" />),
  Tree: Object.assign(
    jest.fn(
      ({
        children,
        expandedKeys,
        onExpandedChange,
      }: {
        children: React.ReactNode;
        expandedKeys?: Set<string>;
        onExpandedChange?: (keys: Set<string>) => void;
      }) => (
        <div data-testid="tree">
          <button
            data-testid="expand-folder-1"
            onClick={() =>
              onExpandedChange?.(new Set([...(expandedKeys ?? []), 'folder-1']))
            }>
            expand-folder-1
          </button>
          {children}
        </div>
      )
    ),
    {
      Item: jest.fn(
        ({ children, id }: { children: React.ReactNode; id: string }) => (
          <div data-testid={`tree-item-${id}`}>{children}</div>
        )
      ),
      ItemContent: jest.fn(
        ({
          children,
        }: {
          children: React.ReactNode;
          showExpandIcon?: boolean;
        }) => <div>{children}</div>
      ),
    }
  ),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

const mockFolders = [
  {
    id: 'folder-1',
    name: 'folder-1',
    displayName: 'Folder One',
    childrenCount: 3,
  },
  {
    id: 'folder-2',
    name: 'folder-2',
    displayName: 'Folder Two',
    childrenCount: 1,
  },
];

const mockFiles = [{ id: 'file-1', name: 'file-1', displayName: 'File One' }];

describe('DocumentFolderView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listContextFiles as jest.Mock).mockResolvedValue({
      data: mockFiles,
      paging: { total: mockFiles.length },
    });
  });

  it('shows skeletons while loading', () => {
    renderFolderView({ isLoading: true });

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('renders folder names from the folders prop', () => {
    renderFolderView({ folders: mockFolders });

    expect(screen.getByText('Folder One')).toBeInTheDocument();
    expect(screen.getByText('Folder Two')).toBeInTheDocument();
  });

  it('shows totalFileCount in the subtitle', () => {
    renderFolderView({ folders: mockFolders, totalFileCount: 42 });

    expect(screen.getByText('42 label.file-plural')).toBeInTheDocument();
  });

  it('calls onSelectFolder with folderId when a folder is clicked', () => {
    const onSelectFolder = jest.fn();
    renderFolderView({ folders: mockFolders, onSelectFolder });

    fireEvent.click(screen.getByText('Folder One'));

    expect(onSelectFolder).toHaveBeenCalledWith('folder-1');
  });

  it('calls onSelectFolder with undefined when the selected folder is clicked again', () => {
    const onSelectFolder = jest.fn();
    renderFolderView({
      folders: mockFolders,
      selectedFolderId: 'folder-1',
      onSelectFolder,
    });

    fireEvent.click(screen.getByText('Folder One'));

    expect(onSelectFolder).toHaveBeenCalledWith(undefined);
  });

  it('opens the create folder modal when the add button is clicked', () => {
    renderFolderView({
      canCreate: true,
      canDelete: true,
      folders: mockFolders,
    });

    fireEvent.click(screen.getByTestId('add-folder-btn'));

    expect(screen.getByTestId('create-folder-modal')).toBeInTheDocument();
  });

  it('calls onFoldersChanged after a folder is created', () => {
    const onFoldersChanged = jest.fn();
    renderFolderView({
      canCreate: true,
      canDelete: true,
      folders: mockFolders,
      onFoldersChanged,
    });

    fireEvent.click(screen.getByTestId('add-folder-btn'));
    fireEvent.click(screen.getByTestId('modal-create-btn'));

    expect(onFoldersChanged).toHaveBeenCalledTimes(1);
  });

  it('shows delete modal when delete button is clicked', () => {
    renderFolderView({
      canCreate: true,
      canDelete: true,
      folders: mockFolders,
    });

    const deleteBtn = screen.getByTestId('delete-folder-btn-folder-1');
    fireEvent.click(deleteBtn);

    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
  });

  it('calls deleteFolder and onFoldersChanged on confirm', async () => {
    (deleteFolder as jest.Mock).mockResolvedValue(undefined);
    const onFoldersChanged = jest.fn();

    renderFolderView({
      canCreate: true,
      canDelete: true,
      folders: mockFolders,
      onFoldersChanged,
    });

    fireEvent.click(screen.getByTestId('delete-folder-btn-folder-1'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));
    });

    await waitFor(() => expect(deleteFolder).toHaveBeenCalledWith('folder-1'));

    expect(onFoldersChanged).toHaveBeenCalled();
  });

  it('calls onSelectFolder(undefined) when the selected folder is deleted', async () => {
    (deleteFolder as jest.Mock).mockResolvedValue(undefined);
    const onSelectFolder = jest.fn();

    renderFolderView({
      canCreate: true,
      canDelete: true,
      folders: mockFolders,
      selectedFolderId: 'folder-1',
      onSelectFolder,
    });

    fireEvent.click(screen.getByTestId('delete-folder-btn-folder-1'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));
    });

    await waitFor(() => expect(onSelectFolder).toHaveBeenCalledWith(undefined));
  });

  it('closes delete modal on cancel without deleting', () => {
    renderFolderView({
      canCreate: true,
      canDelete: true,
      folders: mockFolders,
    });

    fireEvent.click(screen.getByTestId('delete-folder-btn-folder-1'));
    fireEvent.click(screen.getByTestId('cancel-delete-btn'));

    expect(deleteFolder).not.toHaveBeenCalled();
    expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
  });

  describe('refetchFolderFiles', () => {
    it('does nothing for folders that are not expanded', async () => {
      const ref = createRef<DocumentFolderViewHandle>();
      renderFolderView({ folders: mockFolders }, ref);

      await act(async () => {
        await ref.current?.refetchFolderFiles(['folder-1', 'folder-2']);
      });

      expect(listContextFiles).not.toHaveBeenCalled();
    });

    it('only refetches files for folders that are both passed in and expanded', async () => {
      const ref = createRef<DocumentFolderViewHandle>();
      renderFolderView({ folders: mockFolders }, ref);

      await act(async () => {
        fireEvent.click(screen.getByTestId('expand-folder-1'));
      });

      await waitFor(() =>
        expect(listContextFiles).toHaveBeenCalledWith(
          expect.objectContaining({ folderId: 'folder-1' })
        )
      );

      (listContextFiles as jest.Mock).mockClear();
      (listContextFiles as jest.Mock).mockResolvedValue({
        data: [{ id: 'file-2', name: 'file-2', displayName: 'File Two' }],
        paging: { total: 1 },
      });

      await act(async () => {
        await ref.current?.refetchFolderFiles(['folder-1', 'folder-2']);
      });

      expect(listContextFiles).toHaveBeenCalledTimes(1);
      expect(listContextFiles).toHaveBeenCalledWith(
        expect.objectContaining({ folderId: 'folder-1' })
      );

      await waitFor(() =>
        expect(screen.getByText('File Two')).toBeInTheDocument()
      );
    });
  });
});
