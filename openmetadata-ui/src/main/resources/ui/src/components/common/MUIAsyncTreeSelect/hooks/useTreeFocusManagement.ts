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

import { MutableRefObject, useCallback, useRef, useState } from 'react';

interface UseTreeFocusManagementProps {
  inputRef: MutableRefObject<HTMLInputElement | null>;
  anchorRef: MutableRefObject<HTMLDivElement | null>;
  disabled?: boolean;
  onCloseDropdown?: () => void;
}

export const useTreeFocusManagement = ({
  inputRef,
  anchorRef,
  disabled = false,
  onCloseDropdown,
}: UseTreeFocusManagementProps) => {
  const [focusedItem, setFocusedItem] = useState<string>('');
  const isMouseInteractionRef = useRef(false);

  const handleFocus = useCallback(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [inputRef, disabled]);

  const handleBlur = useCallback(() => {
    // Use setTimeout to check if the new focus is still within our component
    setTimeout(() => {
      const currentActiveElement = document.activeElement;

      // Close if focus moved outside our component
      if (
        anchorRef.current &&
        !anchorRef.current.contains(currentActiveElement) &&
        !(currentActiveElement as HTMLElement)?.closest('.MuiPopper-root')
      ) {
        onCloseDropdown?.();
      }
    }, 100);
  }, [onCloseDropdown, anchorRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isMouseInteractionRef.current = true;
  }, []);

  const handleFocusedItemChange = useCallback(
    (_event: React.SyntheticEvent, itemId: string) => {
      setFocusedItem(itemId);
      if (!isMouseInteractionRef.current) {
        inputRef.current?.focus();
      }
      isMouseInteractionRef.current = false;
    },
    [inputRef]
  );

  const maintainFocus = useCallback(() => {
    // Always refocus after mouse interactions to keep input active
    if (isMouseInteractionRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
        isMouseInteractionRef.current = false;
      }, 0);
    } else {
      // For keyboard interactions, maintain focus immediately
      inputRef.current?.focus();
    }
  }, [inputRef]);

  return {
    focusedItem,
    isMouseInteraction: isMouseInteractionRef.current,
    handleFocus,
    handleBlur,
    handleMouseDown,
    handleFocusedItemChange,
    maintainFocus,
  };
};
