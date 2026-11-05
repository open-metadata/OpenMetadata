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

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CanceledError } from 'axios';
import { useCallback, useState } from 'react';
import { ProcessingStatus } from '../../../../generated/entity/data/contextFile';
import FilePreviewModal from './FilePreviewModal';

const downloadDriveFile = jest.fn();

jest.mock('../../../../rest/assetAPI', () => ({
  downloadDriveFile: (id: string, signal?: AbortSignal) =>
    downloadDriveFile(id, signal),
}));

jest.mock('../../../common/FilePreviewer/FilePreviewer', () => ({
  __esModule: true,
  default: () => <div>previewer</div>,
}));

const mockShowErrorToast = jest.fn();

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
}));

const mockHandleAssetDownload = jest.fn();

jest.mock('../../../../utils/ContextCenterPureUtils', () => ({
  handleAssetDownload: (...args: unknown[]) => mockHandleAssetDownload(...args),
}));

const MAX_PREVIEW_SIZE = 25 * 1024 * 1024;

const baseFile = {
  id: 'f1',
  fileExtension: 'txt',
  fileSize: 10,
  processingStatus: ProcessingStatus.Processed,
};

describe('FilePreviewModal', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fetches and renders the previewer for a ready file', async () => {
    downloadDriveFile.mockResolvedValue(new Blob(['hi']));
    render(
      <FilePreviewModal isOpen file={baseFile as never} onClose={jest.fn()} />
    );
    await waitFor(() => expect(downloadDriveFile).toHaveBeenCalled());

    expect(await screen.findByText('previewer')).toBeInTheDocument();
  });

  it('passes an AbortSignal to downloadDriveFile so unmount can cancel it', async () => {
    downloadDriveFile.mockResolvedValue(new Blob(['hi']));
    render(
      <FilePreviewModal isOpen file={baseFile as never} onClose={jest.fn()} />
    );

    await waitFor(() => expect(downloadDriveFile).toHaveBeenCalled());

    expect(downloadDriveFile).toHaveBeenCalledWith(
      'f1',
      expect.any(AbortSignal)
    );
  });

  it('shows too-large message and does not fetch over the cap', async () => {
    render(
      <FilePreviewModal
        isOpen
        file={{ ...baseFile, fileSize: 26 * 1024 * 1024 } as never}
        onClose={jest.fn()}
      />
    );

    expect(
      await screen.findByTestId('file-preview-too-large')
    ).toBeInTheDocument();
    expect(downloadDriveFile).not.toHaveBeenCalled();
  });

  it('treats an oversized resolved blob as too-large even when metadata size is small', async () => {
    downloadDriveFile.mockResolvedValue(
      new Blob([new Uint8Array(MAX_PREVIEW_SIZE + 1)])
    );
    render(
      <FilePreviewModal isOpen file={baseFile as never} onClose={jest.fn()} />
    );

    expect(
      await screen.findByTestId('file-preview-too-large')
    ).toBeInTheDocument();
    expect(screen.queryByText('previewer')).not.toBeInTheDocument();
  });

  it('previews a file whose text extraction failed (content is independent of extraction)', async () => {
    downloadDriveFile.mockResolvedValue(new Blob(['hi']));
    render(
      <FilePreviewModal
        isOpen
        file={
          { ...baseFile, processingStatus: ProcessingStatus.Failed } as never
        }
        onClose={jest.fn()}
      />
    );

    await waitFor(() => expect(downloadDriveFile).toHaveBeenCalled());

    expect(await screen.findByText('previewer')).toBeInTheDocument();
  });

  it('previews a file whose extraction is unsupported (e.g. image with no OCR)', async () => {
    downloadDriveFile.mockResolvedValue(new Blob(['hi']));
    render(
      <FilePreviewModal
        isOpen
        file={
          {
            ...baseFile,
            processingStatus: ProcessingStatus.Unsupported,
          } as never
        }
        onClose={jest.fn()}
      />
    );

    await waitFor(() => expect(downloadDriveFile).toHaveBeenCalled());

    expect(await screen.findByText('previewer')).toBeInTheDocument();
  });

  it('does not refetch when the parent re-renders with a stable onClose', async () => {
    downloadDriveFile.mockResolvedValue(new Blob(['hi']));

    const ParentWithStableClose = () => {
      const [renderCount, setRenderCount] = useState(0);
      const onClose = useCallback(() => undefined, []);

      return (
        <div>
          <button
            data-testid="force-rerender"
            onClick={() => setRenderCount((prev) => prev + 1)}>
            {renderCount}
          </button>
          <FilePreviewModal isOpen file={baseFile as never} onClose={onClose} />
        </div>
      );
    };

    render(<ParentWithStableClose />);

    await waitFor(() => expect(downloadDriveFile).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByTestId('force-rerender'));
    fireEvent.click(screen.getByTestId('force-rerender'));

    await screen.findByText('previewer');

    expect(downloadDriveFile).toHaveBeenCalledTimes(1);
  });

  it('shows an error toast and closes the modal when the fetch fails', async () => {
    const onClose = jest.fn();
    downloadDriveFile.mockRejectedValue(new Error('network error'));
    render(
      <FilePreviewModal isOpen file={baseFile as never} onClose={onClose} />
    );

    await waitFor(() => expect(mockShowErrorToast).toHaveBeenCalled());

    expect(onClose).toHaveBeenCalled();
  });

  it('stays silent when the download is cancelled (no toast, no close)', async () => {
    const onClose = jest.fn();
    downloadDriveFile.mockRejectedValue(new CanceledError('canceled'));
    render(
      <FilePreviewModal isOpen file={baseFile as never} onClose={onClose} />
    );

    await waitFor(() => expect(downloadDriveFile).toHaveBeenCalled());

    expect(mockShowErrorToast).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('offers a download action from the too-large branch', async () => {
    const file = { ...baseFile, fileSize: 26 * 1024 * 1024 };
    render(
      <FilePreviewModal isOpen file={file as never} onClose={jest.fn()} />
    );

    const downloadButton = await screen.findByText('label.download');
    fireEvent.click(downloadButton);

    expect(mockHandleAssetDownload).toHaveBeenCalledWith(file);
  });
});
