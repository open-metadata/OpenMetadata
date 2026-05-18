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

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { moveFileToFolder } from 'rest/assetAPI';
import { DocFile } from '../DocumentsView/DocumentsView.interface';
import MoveToFolderModal from './MoveToFolderModal.component';

jest.mock('rest/assetAPI', () => ({
  moveFileToFolder: jest.fn(),
}));

let mockOnSelectionChange: ((key: React.Key) => void) | undefined;

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest.fn(
    ({
      children,
      onPress,
      isDisabled,
      'data-testid': testId,
    }: {
      children: React.ReactNode;
      onPress?: () => void;
      isDisabled?: boolean;
      'data-testid'?: string;
    }) => (
      <button data-testid={testId} disabled={isDisabled} onClick={onPress}>
        {children}
      </button>
    )
  ),
  Dialog: Object.assign(
    jest.fn(
      ({
        children,
        title,
        onClose,
      }: {
        children: React.ReactNode;
        title: string;
        onClose: () => void;
      }) => (
        <div data-testid="dialog">
          <span>{title}</span>
          <button data-testid="dialog-close" onClick={onClose}>
            close
          </button>
          {children}
        </div>
      )
    ),
    {
      Content: jest.fn(({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      )),
    }
  ),
  Modal: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  ModalOverlay: jest.fn(
    ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
      isOpen ? <div data-testid="modal-overlay">{children}</div> : null
  ),
  Select: Object.assign(
    jest.fn(
      ({
        children,
        onSelectionChange,
        'data-testid': testId,
      }: {
        children: React.ReactNode;
        onSelectionChange?: (key: React.Key) => void;
        'data-testid'?: string;
      }) => {
        mockOnSelectionChange = onSelectionChange;

        return (
          <div data-testid={testId ?? 'select-root'}>{children}</div>
        );
      }
    ),
    {
      Item: jest.fn(({ id, label }: { id: string; label: string }) => (
        <button
          data-testid={`select-item-${id}`}
          onClick={() => mockOnSelectionChange?.(id)}>
          {label}
        </button>
      )),
    }
  ),
  Typography: jest.fn(({ children }: { children: React.ReactNode }) => (
    <span>{children}</span>
  )),
}));

jest.mock('utils/ContextCenterUtils', () => ({
  FileTypeBadge: jest.fn(({ fileType }: { fileType: string }) => (
    <span data-testid="file-type-badge">{fileType}</span>
  )),
}));

const mockFile: DocFile = {
  id: 'asset-1',
  driveFileId: 'drive-1',
  name: 'report.pdf',
  fileType: 'pdf',
  sizeLabel: '2 MB',
  folderId: 'folder-a',
};

const mockFolders = [
  { id: 'folder-a', name: 'folder-a', displayName: 'Folder A' },
  { id: 'folder-b', name: 'folder-b', displayName: 'Folder B' },
  { id: 'folder-c', name: 'folder-c', displayName: 'Folder C' },
];

const defaultProps = {
  file: mockFile,
  folders: mockFolders,
  isOpen: true,
  onClose: jest.fn(),
  onMoved: jest.fn(),
};

describe('MoveToFolderModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockOnSelectionChange = undefined;
  });

  it('renders when isOpen is true', () => {
    render(<MoveToFolderModal {...defaultProps} />);

    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(<MoveToFolderModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
  });

  it('renders the file name', () => {
    render(<MoveToFolderModal {...defaultProps} />);

    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('renders the current folder name', () => {
    render(<MoveToFolderModal {...defaultProps} />);

    expect(screen.getByText('Folder A')).toBeInTheDocument();
  });

  it('shows "no-folder" when file has no folderId', () => {
    render(
      <MoveToFolderModal
        {...defaultProps}
        file={{ ...mockFile, folderId: undefined }}
      />
    );

    expect(screen.getByText(/no-folder/i)).toBeInTheDocument();
  });

  it('excludes the current folder from select options', () => {
    render(<MoveToFolderModal {...defaultProps} />);

    expect(screen.queryByTestId('select-item-folder-a')).not.toBeInTheDocument();
    expect(screen.getByTestId('select-item-folder-b')).toBeInTheDocument();
    expect(screen.getByTestId('select-item-folder-c')).toBeInTheDocument();
  });

  it('save button is disabled when no folder is selected', () => {
    render(<MoveToFolderModal {...defaultProps} />);

    expect(screen.getByTestId('move-folder-save-btn')).toBeDisabled();
  });

  it('save button is enabled after selecting a folder', () => {
    render(<MoveToFolderModal {...defaultProps} />);

    act(() => {
      mockOnSelectionChange?.('folder-b');
    });

    expect(screen.getByTestId('move-folder-save-btn')).not.toBeDisabled();
  });

  it('calls moveFileToFolder with driveFileId and selected folder on save', async () => {
    (moveFileToFolder as jest.Mock).mockResolvedValue(undefined);

    render(<MoveToFolderModal {...defaultProps} />);

    act(() => {
      mockOnSelectionChange?.('folder-b');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('move-folder-save-btn'));
    });

    expect(moveFileToFolder).toHaveBeenCalledWith('drive-1', 'folder-b');
  });

  it('falls back to file.id when driveFileId is undefined', async () => {
    (moveFileToFolder as jest.Mock).mockResolvedValue(undefined);

    render(
      <MoveToFolderModal
        {...defaultProps}
        file={{ ...mockFile, driveFileId: undefined }}
      />
    );

    act(() => {
      mockOnSelectionChange?.('folder-b');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('move-folder-save-btn'));
    });

    expect(moveFileToFolder).toHaveBeenCalledWith('asset-1', 'folder-b');
  });

  it('calls onMoved with file and targetFolderId on success', async () => {
    (moveFileToFolder as jest.Mock).mockResolvedValue(undefined);

    render(<MoveToFolderModal {...defaultProps} />);

    act(() => {
      mockOnSelectionChange?.('folder-b');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('move-folder-save-btn'));
    });

    await waitFor(() =>
      expect(defaultProps.onMoved).toHaveBeenCalledWith(mockFile, 'folder-b')
    );
  });

  it('calls onClose after successful move', async () => {
    (moveFileToFolder as jest.Mock).mockResolvedValue(undefined);

    render(<MoveToFolderModal {...defaultProps} />);

    act(() => {
      mockOnSelectionChange?.('folder-b');
    });

    await act(async () => {
      fireEvent.click(screen.getByTestId('move-folder-save-btn'));
    });

    await waitFor(() => expect(defaultProps.onClose).toHaveBeenCalled());
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<MoveToFolderModal {...defaultProps} />);

    fireEvent.click(screen.getByText(/cancel/i));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when dialog close button is clicked', () => {
    render(<MoveToFolderModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('dialog-close'));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('does not call moveFileToFolder when no folder selected', async () => {
    render(<MoveToFolderModal {...defaultProps} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId('move-folder-save-btn'));
    });

    expect(moveFileToFolder).not.toHaveBeenCalled();
  });
});
