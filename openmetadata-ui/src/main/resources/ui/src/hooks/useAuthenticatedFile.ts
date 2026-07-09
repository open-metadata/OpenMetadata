/*
 *  Copyright 2024 Collate.
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

import { useEffect, useRef, useState } from 'react';
import { downloadAsset } from '../rest/assetAPI';
import { showErrorToast } from '../utils/ToastUtils';
import { getAttachmentId } from '../utils/UploadAttachmentUtils';

// Track in-flight requests globally
const pendingRequests = new Map<string, Promise<void>>();

export const useAuthenticatedFile = (url: string) => {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isMounted = useRef(true);

  const downloadFile = async (fileName: string) => {
    if (!url?.includes('/api/v1/attachments/')) {
      return;
    }

    // Check if there's already a request in flight for this url
    let request = pendingRequests.get(url);

    if (!request) {
      setIsLoading(true);
      request = (async () => {
        try {
          const attachmentId = getAttachmentId(url);
          if (!attachmentId) {
            throw new Error('Invalid attachment URL');
          }

          const response = await downloadAsset(attachmentId);
          if (!response) {
            throw new Error('Failed to fetch file');
          }

          const blob = new Blob([response]);
          const objectUrl = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = objectUrl;
          link.download = fileName;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(objectUrl);
        } catch (error) {
          showErrorToast(error as string);
        } finally {
          if (isMounted.current) {
            setIsLoading(false);
          }
          pendingRequests.delete(url);
        }
      })();

      pendingRequests.set(url, request);
    }

    try {
      await request;
    } catch (error) {
      showErrorToast(error as string);
    }
  };

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  return {
    downloadFile,
    isLoading,
  };
};
