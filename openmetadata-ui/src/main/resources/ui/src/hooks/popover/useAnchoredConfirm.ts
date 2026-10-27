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
import { useCallback, useState } from 'react';
import { useLastPressedTrigger } from './useLastPressedTrigger';

/**
 * State for a confirmation popover opened from a component that only reports
 * the action as a callback (a shared table's `onDelete(row)`). Wrap the
 * component in `containerRef`, pass `open` as its callback, and render
 * `<ConfirmPopover {...popoverProps} />` while `target` is set; it anchors to
 * the button that was pressed.
 */
export const useAnchoredConfirm = <T>() => {
  const { containerRef, triggerRef } = useLastPressedTrigger();
  const [target, setTarget] = useState<T>();
  const close = useCallback(() => setTarget(undefined), []);
  const onOpenChange = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) {
        close();
      }
    },
    [close]
  );

  return {
    containerRef,
    target,
    open: setTarget as (target: T) => void,
    close,
    popoverProps: {
      isOpen: target !== undefined,
      triggerRef,
      onOpenChange,
    },
  };
};
