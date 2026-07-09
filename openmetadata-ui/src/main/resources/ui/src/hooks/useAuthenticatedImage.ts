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
import { getAttachmentId } from '../utils/UploadAttachmentUtils';

// Track in-flight requests globally
const pendingRequests = new Map<string, Promise<string>>();

export const useAuthenticatedImage = (src: string) => {
  const [imageSrc, setImageSrc] = useState<string>(src);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const isMounted = useRef(true);

  const fetchImage = async () => {
    if (!src?.includes('/api/v1/attachments/')) {
      setImageSrc(src);

      return;
    }

    // Check if there's already a request in flight for this src
    let request = pendingRequests.get(src);

    if (!request) {
      setIsLoading(true);
      request = (async () => {
        try {
          const attachmentId = getAttachmentId(src);
          if (!attachmentId) {
            throw new Error('Invalid attachment URL');
          }

          const response = await downloadAsset(attachmentId);
          if (!response) {
            throw new Error('Failed to fetch image');
          }

          const objectUrl = URL.createObjectURL(response);

          return objectUrl;
        } catch (error) {
          return src; // Fallback to original src
        } finally {
          if (isMounted.current) {
            setIsLoading(false);
          }
          pendingRequests.delete(src);
        }
      })();

      pendingRequests.set(src, request);
    }

    try {
      const objectUrl = await request;
      if (isMounted.current) {
        setImageSrc(objectUrl);
      }
    } catch (error) {
      if (isMounted.current) {
        setImageSrc(src);
      }
    }
  };

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    fetchImage();

    return () => {
      if (imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [src]);

  return {
    imageSrc,
    isLoading,
  };
};
