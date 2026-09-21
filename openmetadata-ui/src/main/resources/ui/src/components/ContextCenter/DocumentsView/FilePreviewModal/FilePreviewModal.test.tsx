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
import { ProcessingStatus } from '../../../../generated/entity/data/contextFile';
import FilePreviewModal from './FilePreviewModal';

const downloadDriveFile = jest.fn();

jest.mock('../../../../rest/assetAPI', () => ({
  downloadDriveFile: (id: string) => downloadDriveFile(id),
}));

jest.mock('../../../common/FilePreviewer/FilePreviewer', () => ({
  __esModule: true,
  default: () => <div>previewer</div>,
}));

const mockShowErrorToast = jest.fn();

jest.mock('../../../../utils/ToastUtils', () => ({
  showErrorToast: (...args: unknown[]) => mockShowErrorToast(...args),
}));

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
    await waitFor(() => expect(downloadDriveFile).toHaveBeenCalledWith('f1'));

    expect(await screen.findByText('previewer')).toBeInTheDocument();
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

  it('does not fetch when processing failed', async () => {
    render(
      <FilePreviewModal
        isOpen
        file={
          { ...baseFile, processingStatus: ProcessingStatus.Failed } as never
        }
        onClose={jest.fn()}
      />
    );

    expect(
      await screen.findByTestId('file-preview-not-supported')
    ).toBeInTheDocument();

    await waitFor(() => expect(downloadDriveFile).not.toHaveBeenCalled());
  });

  it('does not fetch when processing is unsupported', async () => {
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

    expect(
      await screen.findByTestId('file-preview-not-supported')
    ).toBeInTheDocument();

    await waitFor(() => expect(downloadDriveFile).not.toHaveBeenCalled());
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
});
