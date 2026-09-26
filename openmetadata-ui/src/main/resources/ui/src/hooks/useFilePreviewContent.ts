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

import axios, { AxiosError } from 'axios';
import { useEffect, useMemo, useState } from 'react';
import { ContextFile } from '../generated/entity/data/contextFile';
import { downloadDriveFile } from '../rest/assetAPI';
import { showErrorToast } from '../utils/ToastUtils';

export const MAX_PREVIEW_SIZE = 25 * 1024 * 1024;

export type FilePreviewContentStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'too-large'
  | 'error';

export interface FilePreviewContentState {
  status: FilePreviewContentStatus;
  blob?: Blob;
}

interface UseFilePreviewContentOptions {
  enabled?: boolean;
  // Fired once when the download fails for a non-cancellation reason. Lets a
  // caller (e.g. a modal) react — close itself — while the panel can ignore it.
  onError?: () => void;
}

// Fetches a Context Center file's bytes for preview and applies the only guards
// that bear on whether the bytes can be shown: the metadata + real-blob size
// cap. NB `processingStatus` is deliberately NOT a guard — it reflects the
// server-side text-extraction pipeline (e.g. Image → OCR → Unsupported when no
// tesseract), not whether the uploaded content exists. The content is stored at
// upload independently of extraction, so a Failed/Unsupported extraction is
// still fully previewable; a genuinely missing asset surfaces as a download
// error instead. Shared by the full-screen modal and the detail-panel
// miniature so the fetch/guard logic lives once.
export const useFilePreviewContent = (
  file?: ContextFile,
  { enabled = true, onError }: UseFilePreviewContentOptions = {}
): FilePreviewContentState => {
  const [blob, setBlob] = useState<Blob>();
  const [isLoading, setIsLoading] = useState(false);
  const [isBlobOversized, setIsBlobOversized] = useState(false);
  const [hasError, setHasError] = useState(false);

  const isMetadataTooLarge = useMemo(
    () => (file?.fileSize ?? 0) > MAX_PREVIEW_SIZE,
    [file?.fileSize]
  );

  useEffect(() => {
    if (!enabled || !file || isMetadataTooLarge) {
      return;
    }

    const controller = new AbortController();

    const fetchFile = async () => {
      setIsLoading(true);
      setIsBlobOversized(false);
      setHasError(false);
      try {
        const data = await downloadDriveFile(file.id, controller.signal);
        if (controller.signal.aborted) {
          return;
        }
        // Metadata `fileSize` can lie (stale, missing, or not yet reprocessed) —
        // the resolved blob is the source of truth for the size guard.
        if (data.size > MAX_PREVIEW_SIZE) {
          setIsBlobOversized(true);
        } else {
          setBlob(data);
        }
      } catch (error) {
        if (axios.isCancel(error) || controller.signal.aborted) {
          return;
        }
        setHasError(true);
        showErrorToast(error as AxiosError);
        onError?.();
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };
    fetchFile();

    return () => {
      controller.abort();
      setBlob(undefined);
      setIsBlobOversized(false);
      setHasError(false);
    };
  }, [enabled, file, isMetadataTooLarge, onError]);

  return useMemo(() => {
    if (isMetadataTooLarge || isBlobOversized) {
      return { status: 'too-large' };
    }
    if (hasError) {
      return { status: 'error' };
    }
    if (!enabled || !file) {
      return { status: 'idle' };
    }
    if (isLoading || !blob) {
      return { status: 'loading' };
    }

    return { status: 'ready', blob };
  }, [
    isMetadataTooLarge,
    isBlobOversized,
    hasError,
    enabled,
    file,
    isLoading,
    blob,
  ]);
};
