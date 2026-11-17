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
import { useCallback, useRef, useState } from 'react';

/**
 * State for a confirmation popover opened through a callback — typically a
 * shared table's `onDelete(row, trigger)`, where `trigger` is the button that
 * was pressed (or the row menu's button). Pass `open` as that callback and
 * render `<ConfirmPopover {...popoverProps} />` while `target` is set; it
 * anchors to `trigger`.
 */
export const useAnchoredConfirm = <T>() => {
  const [target, setTarget] = useState<T>();
  const triggerRef = useRef<HTMLElement | null>(null);

  const open = useCallback((nextTarget: T, trigger?: HTMLElement) => {
    triggerRef.current = trigger ?? null;
    setTarget(nextTarget);
  }, []);
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
    target,
    open,
    close,
    popoverProps: {
      isOpen: target !== undefined,
      triggerRef,
      onOpenChange,
    },
  };
};
