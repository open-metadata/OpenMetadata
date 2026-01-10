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
import { useCallback, useEffect, useState } from 'react';

const fallbackCopyTextToClipboard = (text: string): boolean => {
  const textArea = document.createElement('textarea');
  textArea.value = text;
  textArea.style.position = 'fixed';
  textArea.style.opacity = '0';
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);

    return successful;
  } catch {
    document.body.removeChild(textArea);

    return false;
  }
};

export const useCopyToClipboard = (timeout = 2000) => {
  const [copiedValue, setCopiedValue] = useState<string>();

  useEffect(() => {
    if (!copiedValue) {
      return;
    }

    const timer = setTimeout(() => setCopiedValue(undefined), timeout);

    return () => clearTimeout(timer);
  }, [copiedValue, timeout]);

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedValue(text);

      return true;
    } catch {
      try {
        const success = fallbackCopyTextToClipboard(text);
        if (success) {
          setCopiedValue(text);
        }

        return success;
      } catch {
        return false;
      }
    }
  }, []);

  return { copyToClipboard, copiedValue };
};
