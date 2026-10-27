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
import { RefObject, useCallback, useMemo, useRef } from 'react';

const TRIGGER_SELECTOR = 'button, [role="button"]';
// `click` covers presses that arrive without a pointer or key event first,
// e.g. a screen reader's virtual click.
const PRESS_EVENTS = ['pointerdown', 'keydown', 'click'] as const;

/**
 * Remembers the last button pressed inside `containerRef`, so a confirmation
 * popover can anchor to it when the component that owns the button only
 * reports the action through a callback (e.g. a shared table's `onDelete(row)`).
 * Menus portal outside the container, so a menu action resolves to the menu's
 * trigger button. A remembered button that has since left the DOM reads as
 * `null`, so the popover never anchors to a detached node.
 */
export const useLastPressedTrigger = <
  T extends HTMLElement = HTMLDivElement
>() => {
  const lastPressedRef = useRef<HTMLElement | null>(null);
  const unsubscribeRef = useRef<() => void>();

  const triggerRef = useMemo<RefObject<HTMLElement | null>>(
    () => ({
      get current() {
        const trigger = lastPressedRef.current;

        return trigger?.isConnected ? trigger : null;
      },
    }),
    []
  );

  // A callback ref, so listeners attach when the container actually mounts
  // (it is often rendered only after data loads) and detach when it unmounts.
  const containerRef = useCallback((container: T | null) => {
    unsubscribeRef.current?.();
    unsubscribeRef.current = undefined;
    if (!container) {
      return;
    }
    const remember = (event: Event) => {
      const trigger =
        event.target instanceof Element
          ? event.target.closest<HTMLElement>(TRIGGER_SELECTOR)
          : null;
      if (trigger) {
        lastPressedRef.current = trigger;
      }
    };
    PRESS_EVENTS.forEach((type) =>
      container.addEventListener(type, remember, true)
    );
    unsubscribeRef.current = () =>
      PRESS_EVENTS.forEach((type) =>
        container.removeEventListener(type, remember, true)
      );
  }, []);

  return { containerRef, triggerRef };
};
