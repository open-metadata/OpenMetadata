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
import { useCallback, useEffect, useRef, useState } from 'react';
import { usePersonalSpaceStore } from '../../usePersonalSpaceStore';

/**
 * Holds every way out of a dirty settings editor (sidebar, Esc, close button,
 * breadcrumbs, Cancel) until the user decides. Registers the modal-level exit
 * guard while dirty, and records the last pressed control so the prompt can
 * anchor to it.
 */
export const useUnsavedExitGuard = (isDirty: boolean) => {
  const setExitGuard = usePersonalSpaceStore((state) => state.setExitGuard);
  const [pendingExit, setPendingExit] = useState<() => void>();
  const anchorRef = useRef<Element | null>(null);

  // ponytail: last-pressed element as anchor; plumb explicit refs if a guard
  // ever fires without a user press.
  useEffect(() => {
    // Presses inside an open prompt must not move it onto its own buttons.
    if (!isDirty || pendingExit) {
      return;
    }
    const recordAnchor = (event: Event) => {
      anchorRef.current = event.target as Element;
    };
    document.addEventListener('pointerdown', recordAnchor, true);
    document.addEventListener('keydown', recordAnchor, true);

    return () => {
      document.removeEventListener('pointerdown', recordAnchor, true);
      document.removeEventListener('keydown', recordAnchor, true);
    };
  }, [isDirty, pendingExit]);

  const guardExit = useCallback(
    (exit: () => void) => {
      if (!isDirty) {
        return false;
      }
      setPendingExit(() => exit);

      return true;
    },
    [isDirty]
  );

  const runGuarded = useCallback(
    (exit: () => void) => {
      if (!guardExit(exit)) {
        exit();
      }
    },
    [guardExit]
  );

  useEffect(() => {
    setExitGuard(isDirty ? guardExit : null);

    return () => setExitGuard(null);
  }, [isDirty, guardExit, setExitGuard]);

  const confirmExit = useCallback(() => {
    const exit = pendingExit;
    setPendingExit(undefined);
    exit?.();
  }, [pendingExit]);

  const cancelExit = useCallback(() => setPendingExit(undefined), []);

  return {
    isPromptOpen: Boolean(pendingExit),
    anchorRef,
    runGuarded,
    confirmExit,
    cancelExit,
  };
};

/**
 * A breadcrumb action that asks first when an editor has unsaved changes, as
 * the sidebar does. Undefined when the panel has no breadcrumb action.
 */
export const guardBreadcrumbAction = <K>(action?: (id: K) => void) =>
  action &&
  ((id: K) => {
    const go = () => action(id);
    if (!usePersonalSpaceStore.getState().exitGuard?.(go)) {
      go();
    }
  });
