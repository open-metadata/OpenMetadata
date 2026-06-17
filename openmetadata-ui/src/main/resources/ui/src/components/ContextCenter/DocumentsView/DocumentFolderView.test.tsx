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
import { ContextFile } from '../../../generated/entity/data/contextFile';
import { deleteFolder, listFolders } from '../../../rest/assetAPI';
import DocumentFolderView from './DocumentFolderView.component';

jest.mock('rest/assetAPI', () => ({
  listFolders: jest.fn(),
  deleteFolder: jest.fn(),
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
  FileIcon: jest.fn(({ type }: { type: string }) => (
    <span data-testid={`file-icon-${type}`} />
  )),
  Skeleton: jest.fn(() => <div data-testid="skeleton" />),
  Tree: Object.assign(
    jest.fn(({ children }: { children: React.ReactNode }) => (
      <div data-testid="tree">{children}</div>
    )),
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
  { id: 'folder-1', name: 'folder-1', displayName: 'Folder One' },
  { id: 'folder-2', name: 'folder-2', displayName: 'Folder Two' },
];

const mockFiles: ContextFile[] = [
  {
    id: 'file-1',
    name: 'report.pdf',
    fileExtension: 'pdf',
    folder: { id: 'folder-1', type: 'folder', name: 'Folder One' },
  },
  {
    id: 'file-2',
    name: 'data.csv',
    fileExtension: 'csv',
    folder: { id: 'folder-2', type: 'folder', name: 'Folder Two' },
  },
];

describe('DocumentFolderView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (listFolders as jest.Mock).mockResolvedValue(mockFolders);
  });

  it('shows skeletons while loading', () => {
    (listFolders as jest.Mock).mockReturnValue(new Promise(() => undefined));
    render(<DocumentFolderView files={mockFiles} onSelectFolder={jest.fn()} />);

    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
  });

  it('renders folder names after loading', async () => {
    render(<DocumentFolderView files={mockFiles} onSelectFolder={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('Folder One')).toBeInTheDocument()
    );

    expect(screen.getByText('Folder Two')).toBeInTheDocument();
  });

  it('calls onFoldersLoaded with fetched folders', async () => {
    const onFoldersLoaded = jest.fn();
    render(
      <DocumentFolderView
        files={mockFiles}
        onFoldersLoaded={onFoldersLoaded}
        onSelectFolder={jest.fn()}
      />
    );

    await waitFor(() =>
      expect(onFoldersLoaded).toHaveBeenCalledWith(mockFolders)
    );
  });

  it('renders files as children under their parent folder', async () => {
    render(<DocumentFolderView files={mockFiles} onSelectFolder={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('Folder One')).toBeInTheDocument()
    );

    expect(screen.getByText('report.pdf')).toBeInTheDocument();
    expect(screen.getByText('data.csv')).toBeInTheDocument();
  });

  it('shows folder and file counts in the subtitle', async () => {
    render(<DocumentFolderView files={mockFiles} onSelectFolder={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('Folder One')).toBeInTheDocument()
    );

    expect(screen.getAllByText(/2/).length).toBeGreaterThanOrEqual(1);
  });

  it('calls onSelectFolder with folderId when a folder is clicked', async () => {
    const onSelectFolder = jest.fn();
    render(
      <DocumentFolderView files={mockFiles} onSelectFolder={onSelectFolder} />
    );

    await waitFor(() =>
      expect(screen.getByText('Folder One')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText('Folder One'));

    expect(onSelectFolder).toHaveBeenCalledWith('folder-1');
  });

  it('calls onSelectFolder with undefined when the selected folder is clicked again', async () => {
    const onSelectFolder = jest.fn();
    render(
      <DocumentFolderView
        files={mockFiles}
        selectedFolderId="folder-1"
        onSelectFolder={onSelectFolder}
      />
    );

    await waitFor(() =>
      expect(screen.getByText('Folder One')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByText('Folder One'));

    expect(onSelectFolder).toHaveBeenCalledWith(undefined);
  });

  it('opens the create folder modal when the add button is clicked', async () => {
    render(<DocumentFolderView files={mockFiles} onSelectFolder={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('Folder One')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('add-folder-btn'));

    expect(screen.getByTestId('create-folder-modal')).toBeInTheDocument();
  });

  it('adds the new folder to the list after creation', async () => {
    const onFoldersLoaded = jest.fn();
    render(
      <DocumentFolderView
        files={mockFiles}
        onFoldersLoaded={onFoldersLoaded}
        onSelectFolder={jest.fn()}
      />
    );

    await waitFor(() =>
      expect(screen.getByText('Folder One')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('add-folder-btn'));
    fireEvent.click(screen.getByTestId('modal-create-btn'));

    await waitFor(() =>
      expect(screen.getByText('New Folder')).toBeInTheDocument()
    );

    expect(onFoldersLoaded).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ displayName: 'New Folder' }),
      ])
    );
  });

  it('shows delete modal when delete button is clicked', async () => {
    render(<DocumentFolderView files={mockFiles} onSelectFolder={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('Folder One')).toBeInTheDocument()
    );

    const deleteBtn = screen.getByTestId('delete-folder-btn-folder-1');
    fireEvent.click(deleteBtn);

    expect(screen.getByTestId('delete-modal')).toBeInTheDocument();
  });

  it('calls deleteFolder and removes the folder on confirm', async () => {
    (deleteFolder as jest.Mock).mockResolvedValue(undefined);
    const onFoldersLoaded = jest.fn();

    render(
      <DocumentFolderView
        files={mockFiles}
        onFoldersLoaded={onFoldersLoaded}
        onSelectFolder={jest.fn()}
      />
    );

    await waitFor(() =>
      expect(screen.getByText('Folder One')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('delete-folder-btn-folder-1'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));
    });

    await waitFor(() => expect(deleteFolder).toHaveBeenCalledWith('folder-1'));
    await waitFor(() =>
      expect(screen.queryByText('Folder One')).not.toBeInTheDocument()
    );
  });

  it('calls onSelectFolder(undefined) when the selected folder is deleted', async () => {
    (deleteFolder as jest.Mock).mockResolvedValue(undefined);
    const onSelectFolder = jest.fn();

    render(
      <DocumentFolderView
        files={mockFiles}
        selectedFolderId="folder-1"
        onSelectFolder={onSelectFolder}
      />
    );

    await waitFor(() =>
      expect(screen.getByText('Folder One')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('delete-folder-btn-folder-1'));

    await act(async () => {
      fireEvent.click(screen.getByTestId('confirm-delete-btn'));
    });

    await waitFor(() => expect(onSelectFolder).toHaveBeenCalledWith(undefined));
  });

  it('closes delete modal on cancel without deleting', async () => {
    render(<DocumentFolderView files={mockFiles} onSelectFolder={jest.fn()} />);

    await waitFor(() =>
      expect(screen.getByText('Folder One')).toBeInTheDocument()
    );

    fireEvent.click(screen.getByTestId('delete-folder-btn-folder-1'));
    fireEvent.click(screen.getByTestId('cancel-delete-btn'));

    expect(deleteFolder).not.toHaveBeenCalled();
    expect(screen.queryByTestId('delete-modal')).not.toBeInTheDocument();
  });
});
