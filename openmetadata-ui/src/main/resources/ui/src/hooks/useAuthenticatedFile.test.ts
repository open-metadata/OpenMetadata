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
import { act, renderHook } from '@testing-library/react-hooks';
import { downloadAsset } from '../rest/assetAPI';
import { showErrorToast } from '../utils/ToastUtils';
import { getAttachmentId } from '../utils/UploadAttachmentUtils';
import { useAuthenticatedFile } from './useAuthenticatedFile';

jest.mock('../rest/assetAPI', () => ({
  downloadAsset: jest.fn(),
}));

jest.mock('../utils/UploadAttachmentUtils', () => ({
  getAttachmentId: jest.fn(),
}));

jest.mock('../utils/ToastUtils', () => ({
  showErrorToast: jest.fn(),
}));

jest.mock('react-i18next', () => ({
  useTranslation: jest.fn().mockImplementation(() => ({
    t: (key: string) => key,
  })),
}));

const mockDownloadAsset = downloadAsset as jest.MockedFunction<
  typeof downloadAsset
>;
const mockGetAttachmentId = getAttachmentId as jest.MockedFunction<
  typeof getAttachmentId
>;
const mockShowErrorToast = showErrorToast as jest.MockedFunction<
  typeof showErrorToast
>;

const BLOB_URL = 'blob:http://localhost/blob-1';

const attachmentUrl = (id: string) => `/api/v1/attachments/${id}/download`;

describe('useAuthenticatedFile', () => {
  let createObjectURLMock: jest.Mock;
  let revokeObjectURLMock: jest.Mock;
  let clickMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    createObjectURLMock = jest.fn().mockReturnValue(BLOB_URL);
    revokeObjectURLMock = jest.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    clickMock = jest.fn();
    jest
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(clickMock);

    mockGetAttachmentId.mockReturnValue('attachment-id-1');
    mockDownloadAsset.mockResolvedValue(new Blob(['test']));
  });

  it('does nothing when the url is not an attachment URL', async () => {
    const { result } = renderHook(() =>
      useAuthenticatedFile('/static/file.pdf')
    );

    await act(async () => {
      await result.current.downloadFile('file.pdf');
    });

    expect(mockDownloadAsset).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
  });

  it('downloads the attachment and triggers a click on a generated link', async () => {
    const url = attachmentUrl('attachment-id-download');
    const { result } = renderHook(() => useAuthenticatedFile(url));

    await act(async () => {
      await result.current.downloadFile('report.pdf');
    });

    expect(mockGetAttachmentId).toHaveBeenCalledWith(url);
    expect(mockDownloadAsset).toHaveBeenCalledWith('attachment-id-1');
    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectURLMock).toHaveBeenCalledWith(BLOB_URL);
    expect(result.current.isLoading).toBe(false);
  });

  it('shows an AxiosError-shaped toast when the attachment id cannot be extracted', async () => {
    mockGetAttachmentId.mockReturnValue(null);
    const url = attachmentUrl('attachment-id-invalid');
    const { result } = renderHook(() => useAuthenticatedFile(url));

    await act(async () => {
      await result.current.downloadFile('report.pdf');
    });

    expect(mockDownloadAsset).not.toHaveBeenCalled();
    expect(mockShowErrorToast).toHaveBeenCalledWith(
      expect.any(Error),
      'server.unexpected-error'
    );
    expect(mockShowErrorToast.mock.calls[0][0]).not.toEqual(expect.any(String));
    expect(result.current.isLoading).toBe(false);
  });

  it('shows an AxiosError-shaped toast when downloadAsset rejects', async () => {
    mockDownloadAsset.mockRejectedValue(new Error('network error'));
    const url = attachmentUrl('attachment-id-reject');
    const { result } = renderHook(() => useAuthenticatedFile(url));

    await act(async () => {
      await result.current.downloadFile('report.pdf');
    });

    expect(mockDownloadAsset).toHaveBeenCalledTimes(1);
    expect(mockShowErrorToast).toHaveBeenCalledWith(
      expect.any(Error),
      'server.unexpected-error'
    );
    expect(result.current.isLoading).toBe(false);
  });

  it('shows an AxiosError-shaped toast when downloadAsset resolves falsy', async () => {
    mockDownloadAsset.mockResolvedValue(undefined as unknown as Blob);
    const url = attachmentUrl('attachment-id-falsy');
    const { result } = renderHook(() => useAuthenticatedFile(url));

    await act(async () => {
      await result.current.downloadFile('report.pdf');
    });

    expect(mockShowErrorToast).toHaveBeenCalledWith(
      expect.any(Error),
      'server.unexpected-error'
    );
    expect(result.current.isLoading).toBe(false);
  });

  it('toggles isLoading to true while the request is in flight', async () => {
    let resolveDownload: (value: Blob) => void = () => undefined;
    mockDownloadAsset.mockReturnValue(
      new Promise((resolve) => {
        resolveDownload = resolve;
      })
    );
    const url = attachmentUrl('attachment-id-loading');
    const { result } = renderHook(() => useAuthenticatedFile(url));

    let downloadPromise: Promise<void>;
    act(() => {
      downloadPromise = result.current.downloadFile('report.pdf');
    });

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      resolveDownload(new Blob(['test']));
      await downloadPromise;
    });

    expect(result.current.isLoading).toBe(false);
  });

  it('de-dupes concurrent downloads for the same url', async () => {
    const url = attachmentUrl('attachment-id-dedupe');
    const { result } = renderHook(() => useAuthenticatedFile(url));

    await act(async () => {
      await Promise.all([
        result.current.downloadFile('report.pdf'),
        result.current.downloadFile('report.pdf'),
      ]);
    });

    expect(mockDownloadAsset).toHaveBeenCalledTimes(1);
  });
});
