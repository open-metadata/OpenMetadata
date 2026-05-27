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
import { uploadDriveFile } from '../../../rest/assetAPI';
import UploadDocumentModal from './UploadDocumentModal.component';

jest.mock('rest/assetAPI', () => ({
  uploadDriveFile: jest.fn(),
}));

jest.mock('utils/ToastUtils', () => ({
  showSuccessToast: jest.fn(),
}));

let mockOnDropFiles: ((files: FileList) => void) | undefined;
let mockOnSizeLimitExceed: ((files: FileList) => void) | undefined;

jest.mock('@openmetadata/ui-core-components', () => ({
  Button: jest.fn(
    ({
      children,
      onClick,
      isDisabled,
    }: {
      children: React.ReactNode;
      onClick?: () => void;
      isDisabled?: boolean;
    }) => (
      <button disabled={isDisabled} onClick={onClick}>
        {children}
      </button>
    )
  ),
  ButtonUtility: jest.fn(
    ({ onClick, tooltip }: { onClick?: () => void; tooltip?: string }) => (
      <button aria-label={tooltip} onClick={onClick}>
        x
      </button>
    )
  ),
  Dialog: Object.assign(
    jest.fn(
      ({
        children,
        onClose,
      }: {
        children: React.ReactNode;
        onClose: () => void;
      }) => (
        <div data-testid="dialog">
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
      Footer: jest.fn(({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      )),
      Header: jest.fn(({ title }: { title: string }) => <div>{title}</div>),
    }
  ),
  FileUpload: Object.assign(
    jest.fn(({ children }: { children: React.ReactNode }) => (
      <div>{children}</div>
    )),
    {
      Root: jest.fn(({ children }: { children: React.ReactNode }) => (
        <div>{children}</div>
      )),
      List: jest.fn(({ children }: { children: React.ReactNode }) => (
        <ul>{children}</ul>
      )),
      ListItemProgressBar: jest.fn(
        ({
          name,
          failed,
          onDelete,
          onRetry,
        }: {
          name: string;
          failed?: boolean;
          onDelete?: () => void;
          onRetry?: () => void;
        }) => (
          <li data-failed={String(failed)} data-testid={`progress-bar-${name}`}>
            {name}
            {onDelete && (
              <button data-testid={`delete-${name}`} onClick={onDelete}>
                del
              </button>
            )}
            {onRetry && (
              <button data-testid={`retry-${name}`} onClick={onRetry}>
                retry
              </button>
            )}
          </li>
        )
      ),
    }
  ),
  FileUploadDropZone: jest.fn(
    ({
      onDropFiles,
      onSizeLimitExceed,
    }: {
      onDropFiles: (files: FileList) => void;
      onSizeLimitExceed: (files: FileList) => void;
    }) => {
      mockOnDropFiles = onDropFiles;
      mockOnSizeLimitExceed = onSizeLimitExceed;

      return <div data-testid="drop-zone" />;
    }
  ),
  getReadableFileSize: jest.fn((size: number) => `${size} bytes`),
  Modal: jest.fn(({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )),
  ModalOverlay: jest.fn(
    ({ children, isOpen }: { children: React.ReactNode; isOpen: boolean }) =>
      isOpen ? <div data-testid="modal-overlay">{children}</div> : null
  ),
}));

const defaultProps = {
  isOpen: true,
  folderFqn: undefined,
  onClose: jest.fn(),
  onUploaded: jest.fn(),
};

const makeFileList = (...files: File[]): FileList => {
  const fileList = files.reduce<Record<number, File>>(
    (acc, file, index) => ({
      ...acc,
      [index]: file,
    }),
    {}
  );

  return {
    ...fileList,
    item: (index: number) => files[index] ?? null,
    length: files.length,
  } as unknown as FileList;
};

describe('UploadDocumentModal', () => {
  let uuidCounter = 0;

  beforeEach(() => {
    jest.clearAllMocks();
    mockOnDropFiles = undefined;
    mockOnSizeLimitExceed = undefined;
    uuidCounter = 0;
    Object.defineProperty(globalThis, 'crypto', {
      value: { randomUUID: () => `test-uuid-${++uuidCounter}` },
      configurable: true,
    });
  });

  it('renders the modal when isOpen is true', () => {
    render(<UploadDocumentModal {...defaultProps} />);

    expect(screen.getByTestId('modal-overlay')).toBeInTheDocument();
    expect(screen.getByTestId('dialog')).toBeInTheDocument();
  });

  it('does not render modal content when isOpen is false', () => {
    render(<UploadDocumentModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByTestId('modal-overlay')).not.toBeInTheDocument();
  });

  it('renders the drop zone', () => {
    render(<UploadDocumentModal {...defaultProps} />);

    expect(screen.getByTestId('drop-zone')).toBeInTheDocument();
  });

  it('renders cancel and attach buttons', () => {
    render(<UploadDocumentModal {...defaultProps} />);

    expect(screen.getByText(/cancel/i)).toBeInTheDocument();
    expect(screen.getByText(/attach-file-plural/i)).toBeInTheDocument();
  });

  it('attach button is disabled when no files are staged', () => {
    render(<UploadDocumentModal {...defaultProps} />);

    const attachBtn = screen.getByText(/attach-file-plural/i);

    expect(attachBtn).toBeDisabled();
  });

  it('shows staged files after files are dropped', () => {
    render(<UploadDocumentModal {...defaultProps} />);

    act(() => {
      mockOnDropFiles!(makeFileList(new File(['content'], 'test.pdf')));
    });

    expect(screen.getByText('test.pdf')).toBeInTheDocument();
  });

  it('enables the attach button when staged files exist', () => {
    render(<UploadDocumentModal {...defaultProps} />);

    act(() => {
      mockOnDropFiles!(makeFileList(new File(['content'], 'test.pdf')));
    });

    const attachBtn = screen.getByText(/attach-file-plural/i);

    expect(attachBtn).not.toBeDisabled();
  });

  it('removes a staged file when its delete button is clicked', () => {
    render(<UploadDocumentModal {...defaultProps} />);

    act(() => {
      mockOnDropFiles!(makeFileList(new File(['content'], 'remove-me.pdf')));
    });

    expect(screen.getByText('remove-me.pdf')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('delete-remove-me.pdf'));

    expect(screen.queryByText('remove-me.pdf')).not.toBeInTheDocument();
  });

  it('calls onClose when cancel button is clicked', () => {
    render(<UploadDocumentModal {...defaultProps} />);

    fireEvent.click(screen.getByText(/cancel/i));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onClose when dialog close button is clicked', () => {
    render(<UploadDocumentModal {...defaultProps} />);

    fireEvent.click(screen.getByTestId('dialog-close'));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls uploadDriveFile and onUploaded when attach is clicked', async () => {
    const mockAsset = { id: 'asset-1', name: 'test.pdf' };
    (uploadDriveFile as jest.Mock).mockResolvedValue(mockAsset);

    render(<UploadDocumentModal {...defaultProps} />);

    act(() => {
      mockOnDropFiles!(makeFileList(new File(['content'], 'test.pdf')));
    });

    fireEvent.click(screen.getByText(/attach-file-plural/i));

    await waitFor(() => expect(uploadDriveFile).toHaveBeenCalled());
    await waitFor(() =>
      expect(defaultProps.onUploaded).toHaveBeenCalledWith([mockAsset])
    );
  });

  it('shows the failed state for a file that exceeds the size limit', () => {
    render(<UploadDocumentModal {...defaultProps} />);

    act(() => {
      mockOnSizeLimitExceed!(
        makeFileList(new File(['x'.repeat(6 * 1024 * 1024)], 'huge.pdf'))
      );
    });

    const bar = screen.getByTestId('progress-bar-huge.pdf');

    expect(bar).toBeInTheDocument();
    expect(bar).toHaveAttribute('data-failed', 'true');
  });

  it('shows the failed state in the progress bar on upload error', async () => {
    (uploadDriveFile as jest.Mock).mockRejectedValue(
      new Error('upload failed')
    );

    render(<UploadDocumentModal {...defaultProps} />);

    act(() => {
      mockOnDropFiles!(makeFileList(new File(['content'], 'fail.pdf')));
    });

    fireEvent.click(screen.getByText(/attach-file-plural/i));

    const bar = await screen.findByTestId('progress-bar-fail.pdf');

    expect(bar).toHaveAttribute('data-failed', 'true');
  });

  it('shows retry button for failed uploads', async () => {
    (uploadDriveFile as jest.Mock).mockRejectedValue(
      new Error('upload failed')
    );

    render(<UploadDocumentModal {...defaultProps} />);

    act(() => {
      mockOnDropFiles!(makeFileList(new File(['content'], 'fail.pdf')));
    });

    fireEvent.click(screen.getByText(/attach-file-plural/i));

    expect(await screen.findByTestId('retry-fail.pdf')).toBeInTheDocument();
  });

  it('retries a failed upload when the retry button is clicked', async () => {
    const mockAsset = { id: 'asset-retry', name: 'fail.pdf' };
    (uploadDriveFile as jest.Mock)
      .mockRejectedValueOnce(new Error('first attempt failed'))
      .mockResolvedValueOnce(mockAsset);

    render(<UploadDocumentModal {...defaultProps} />);

    act(() => {
      mockOnDropFiles!(makeFileList(new File(['content'], 'fail.pdf')));
    });

    fireEvent.click(screen.getByText(/attach-file-plural/i));

    const retryBtn = await screen.findByTestId('retry-fail.pdf');
    fireEvent.click(retryBtn);

    await waitFor(() => expect(uploadDriveFile).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(defaultProps.onUploaded).toHaveBeenCalledWith([mockAsset])
    );
  });
});
