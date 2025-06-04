/*
 *  Copyright 2023 Collate.
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
import { toNumber } from 'lodash';
import { useCallback, useEffect, useState } from 'react';

/**
 * React hook to copy text to clipboard
 * @param value the text to copy
 * @param timeout delay (in ms) to switch back to initial state once copied.
 * @param callBack execute when content is copied to clipboard
 */
export const useClipboard = (
  value: string,
  timeout = 1500,
  callBack?: () => void
) => {
  // local state
  const [hasCopied, setHasCopied] = useState(false);
  const [valueState, setValueState] = useState(value);

  // handlers
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(valueState);
      setHasCopied(true);
      callBack && callBack();
    } catch (error) {
      setHasCopied(false);
    }
  }, [valueState]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();

      return text;
    } catch (error) {
      return null;
    }
  }, []);

  // side effects
  useEffect(() => setValueState(value), [value]);

  useEffect(() => {
    let timeoutId: number | null = null;

    if (hasCopied) {
      timeoutId = toNumber(
        setTimeout(() => {
          setHasCopied(false);
        }, timeout)
      );
    }

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [timeout, hasCopied]);

  return {
    onCopyToClipBoard: handleCopy,
    onPasteFromClipBoard: handlePaste,
    hasCopied,
  };
};
