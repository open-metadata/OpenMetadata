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
import {
  KeyboardEvent,
  MouseEvent,
  PointerEvent,
  ReactNode,
  useRef,
} from 'react';

export interface DomainSelectTriggerProps {
  toggle: () => void;
  children: ReactNode;
  disabled?: boolean;
  className?: string;
}

/**
 * The one press-handling wrapper every Domain picker trigger goes through.
 *
 * Three activation paths have to be covered, and each needs a different event:
 * - **Mouse/pen**: `pointerdown`, not `click`. The surrounding widget re-renders
 *   while a PATCH settles, and a re-render that replaces the trigger's DOM node
 *   between mousedown and mouseup makes the browser drop the `click` outright.
 * - **Touch**: deliberately *not* pointerdown — that fires when a scroll gesture
 *   merely starts on the button. Touch waits for the `click`.
 * - **Keyboard / AT**: react-aria's `usePress` preventDefaults Enter/Space and
 *   never dispatches a bubbling click, so a core `Button` child is unreachable
 *   without an explicit key handler. A screen-reader virtual activation or
 *   `element.click()` arrives as a click with `detail === 0`.
 *
 * `handledRef` stops the pointerdown path from toggling twice when the browser
 * then delivers the click.
 */
export const DomainSelectTrigger = ({
  toggle,
  children,
  disabled,
  className = 'tw:contents',
}: DomainSelectTriggerProps) => {
  const handledRef = useRef(false);

  return (
    <span
      className={className}
      role="presentation"
      onClickCapture={(e: MouseEvent<HTMLSpanElement>) => {
        e.stopPropagation();
        if (disabled) {
          return;
        }
        // Already handled on pointerdown or keydown — consume and reset.
        if (handledRef.current) {
          handledRef.current = false;

          return;
        }
        toggle();
      }}
      onKeyDownCapture={(e: KeyboardEvent<HTMLSpanElement>) => {
        if (disabled) {
          return;
        }
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          handledRef.current = true;
          toggle();
        }
      }}
      onPointerDownCapture={(e: PointerEvent<HTMLSpanElement>) => {
        // Touch waits for the click so a scroll gesture does not open the picker.
        if (disabled || e.button > 0 || e.pointerType === 'touch') {
          return;
        }
        handledRef.current = true;
        toggle();
      }}>
      {children}
    </span>
  );
};
