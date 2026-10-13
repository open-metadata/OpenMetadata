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
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Placement } from 'react-aria';
import {
  mergeProps,
  useFocusVisible,
  useFocusWithin,
  useHover,
} from 'react-aria';
import { Popover as AriaPopover } from 'react-aria-components';
import { cx } from '@/utils/cx';

export interface HoverCardProps {
  /** The trigger element. */
  children: ReactNode;
  /** Card content shown while the trigger is hovered or keyboard-focused. */
  content: ReactNode;
  /** @default 'bottom' */
  placement?: Placement;
  /** Milliseconds before the card opens. @default 300 */
  openDelay?: number;
  /** Milliseconds before the card closes, giving the pointer time to move into it. @default 200 */
  closeDelay?: number;
  isDisabled?: boolean;
  /** Classes for the card surface. */
  className?: string;
}

export const HoverCard = ({
  children,
  content,
  placement = 'bottom',
  openDelay = 300,
  closeDelay = 200,
  isDisabled,
  className,
}: HoverCardProps) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [isOpen, setIsOpen] = useState(false);
  const { isFocusVisible } = useFocusVisible();

  const schedule = useCallback(
    (open: boolean) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(
        () => setIsOpen(open),
        open ? openDelay : closeDelay
      );
    },
    [openDelay, closeDelay]
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  // Listen on the document so Escape dismisses a hover-opened card too, where
  // focus is not on the trigger (WCAG 1.4.13: dismissable without moving the pointer).
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearTimeout(timer.current);
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  const { hoverProps: triggerHoverProps } = useHover({
    isDisabled,
    onHoverStart: () => schedule(true),
    onHoverEnd: () => schedule(false),
  });
  const { hoverProps: cardHoverProps } = useHover({
    isDisabled,
    onHoverStart: () => schedule(true),
    onHoverEnd: () => schedule(false),
  });
  // Only keyboard focus opens the card; a mouse click that focuses the trigger
  // is already covered by hover.
  const { focusWithinProps } = useFocusWithin({
    isDisabled,
    onFocusWithinChange: (isFocused) => {
      if (!isFocused) {
        schedule(false);
      } else if (isFocusVisible) {
        schedule(true);
      }
    },
  });

  return (
    <>
      <span
        className="tw:inline-flex tw:max-w-full"
        ref={triggerRef}
        {...mergeProps(triggerHoverProps, focusWithinProps)}>
        {children}
      </span>
      <AriaPopover
        isNonModal
        isOpen={isOpen && !isDisabled}
        offset={8}
        placement={placement}
        triggerRef={triggerRef}
        onOpenChange={setIsOpen}>
        <div
          {...cardHoverProps}
          className={cx(
            'tw:rounded-xl tw:bg-overlay-surface tw:p-4 tw:shadow-lg tw:outline-1 tw:outline-secondary_alt',
            className
          )}>
          {content}
        </div>
      </AriaPopover>
    </>
  );
};
