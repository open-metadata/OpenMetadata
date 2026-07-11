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
import { getAttachmentId } from '../utils/UploadAttachmentUtils';
import { useAuthenticatedImage } from './useAuthenticatedImage';

jest.mock('../rest/assetAPI', () => ({
  downloadAsset: jest.fn(),
}));

jest.mock('../utils/UploadAttachmentUtils', () => ({
  getAttachmentId: jest.fn(),
}));

const mockDownloadAsset = downloadAsset as jest.MockedFunction<
  typeof downloadAsset
>;
const mockGetAttachmentId = getAttachmentId as jest.MockedFunction<
  typeof getAttachmentId
>;

const BLOB_URL = 'blob:http://localhost/blob-1';

const attachmentSrc = (id: string) => `/api/v1/attachments/${id}/download`;

describe('useAuthenticatedImage', () => {
  let createObjectURLMock: jest.Mock;
  let revokeObjectURLMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    createObjectURLMock = jest.fn().mockReturnValue(BLOB_URL);
    revokeObjectURLMock = jest.fn();
    global.URL.createObjectURL = createObjectURLMock;
    global.URL.revokeObjectURL = revokeObjectURLMock;

    mockGetAttachmentId.mockReturnValue('attachment-id-1');
    mockDownloadAsset.mockResolvedValue(new Blob(['test']));
  });

  it('returns the original src immediately when it is not an attachment URL', async () => {
    const { result } = renderHook(() =>
      useAuthenticatedImage('/static/image.png')
    );

    expect(result.current.imageSrc).toBe('/static/image.png');
    expect(result.current.isLoading).toBe(false);
    expect(mockDownloadAsset).not.toHaveBeenCalled();
  });

  it('fetches the attachment and sets imageSrc to the created object URL', async () => {
    const src = attachmentSrc('attachment-id-fetch');
    const { result } = renderHook(() => useAuthenticatedImage(src));

    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockGetAttachmentId).toHaveBeenCalledWith(src);
    expect(mockDownloadAsset).toHaveBeenCalledWith('attachment-id-1');
    expect(result.current.imageSrc).toBe(BLOB_URL);
    expect(result.current.isLoading).toBe(false);
  });

  it('falls back to the original src when the attachment id cannot be extracted', async () => {
    mockGetAttachmentId.mockReturnValue(null);
    const src = attachmentSrc('attachment-id-invalid');
    const { result } = renderHook(() => useAuthenticatedImage(src));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockDownloadAsset).not.toHaveBeenCalled();
    expect(result.current.imageSrc).toBe(src);
    expect(result.current.isLoading).toBe(false);
  });

  it('falls back to the original src when downloadAsset rejects', async () => {
    mockDownloadAsset.mockRejectedValue(new Error('network error'));
    const src = attachmentSrc('attachment-id-reject');
    const { result } = renderHook(() => useAuthenticatedImage(src));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockDownloadAsset).toHaveBeenCalledTimes(1);
    expect(result.current.imageSrc).toBe(src);
    expect(result.current.isLoading).toBe(false);
  });

  it('falls back to the original src when downloadAsset resolves falsy', async () => {
    mockDownloadAsset.mockResolvedValue(undefined as unknown as Blob);
    const src = attachmentSrc('attachment-id-falsy');
    const { result } = renderHook(() => useAuthenticatedImage(src));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.imageSrc).toBe(src);
  });

  it('revokes the object URL on unmount once resolved', async () => {
    const src = attachmentSrc('attachment-id-unmount');
    const { unmount, result } = renderHook(() => useAuthenticatedImage(src));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.imageSrc).toBe(BLOB_URL);
    expect(revokeObjectURLMock).not.toHaveBeenCalled();

    unmount();

    expect(revokeObjectURLMock).toHaveBeenCalledWith(BLOB_URL);
  });

  it('does not revoke a blob URL still referenced by another mounted instance, and revokes it once all instances unmount', async () => {
    const src = attachmentSrc('attachment-id-shared');
    const first = renderHook(() => useAuthenticatedImage(src));
    const second = renderHook(() => useAuthenticatedImage(src));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(first.result.current.imageSrc).toBe(BLOB_URL);
    expect(second.result.current.imageSrc).toBe(BLOB_URL);

    first.unmount();

    expect(revokeObjectURLMock).not.toHaveBeenCalled();

    second.unmount();

    expect(revokeObjectURLMock).toHaveBeenCalledWith(BLOB_URL);
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);
  });

  it('fetches again on a fresh mount after a prior instance for the same src has unmounted', async () => {
    const src = attachmentSrc('attachment-id-remount');
    const first = renderHook(() => useAuthenticatedImage(src));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    first.unmount();

    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1);

    const second = renderHook(() => useAuthenticatedImage(src));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockDownloadAsset).toHaveBeenCalledTimes(2);
    expect(second.result.current.imageSrc).toBe(BLOB_URL);

    second.unmount();

    expect(revokeObjectURLMock).toHaveBeenCalledTimes(2);
  });

  it('does not revoke anything on unmount when the src was never resolved to a blob URL', async () => {
    const { unmount } = renderHook(() =>
      useAuthenticatedImage('/static/image.png')
    );

    unmount();

    expect(revokeObjectURLMock).not.toHaveBeenCalled();
  });

  it('de-dupes concurrent requests for the same src across hook instances', async () => {
    const src = attachmentSrc('attachment-id-dedupe');
    renderHook(() => useAuthenticatedImage(src));
    renderHook(() => useAuthenticatedImage(src));

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(mockDownloadAsset).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale request that resolves after src has changed to a newer attachment', async () => {
    const srcA = attachmentSrc('attachment-id-a');
    const srcB = attachmentSrc('attachment-id-b');
    const blobA = 'blob:http://localhost/blob-a';
    const blobB = 'blob:http://localhost/blob-b';

    let resolveA: (blob: Blob) => void = () => undefined;
    const deferredA = new Promise<Blob>((resolve) => {
      resolveA = resolve;
    });

    mockDownloadAsset.mockImplementation((id: string) =>
      id === 'attachment-id-a' ? deferredA : Promise.resolve(new Blob(['b']))
    );
    mockGetAttachmentId.mockImplementation((src: string) =>
      src === srcA ? 'attachment-id-a' : 'attachment-id-b'
    );
    createObjectURLMock.mockImplementation((blob: Blob) =>
      blob === undefined ? BLOB_URL : blobB
    );

    const { result, rerender } = renderHook(
      ({ src }) => useAuthenticatedImage(src),
      { initialProps: { src: srcA } }
    );

    rerender({ src: srcB });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.imageSrc).toBe(blobB);

    createObjectURLMock.mockReturnValueOnce(blobA);
    await act(async () => {
      resolveA(new Blob(['a']));
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(result.current.imageSrc).toBe(blobB);
    expect(revokeObjectURLMock).toHaveBeenCalledWith(blobA);
  });
});
