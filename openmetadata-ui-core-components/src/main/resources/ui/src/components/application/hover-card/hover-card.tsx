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
import {
  OverlayArrow as AriaOverlayArrow,
  Popover as AriaPopover,
} from 'react-aria-components';
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
  /** When supplied, the caller detects hover instead of the DOM trigger. */
  isExternalTriggerHovered?: boolean;
  /** Releases an external anchor once it is no longer needed. */
  onCloseComplete?: () => void;
  /** Distance in px between the trigger and the card. @default 8 */
  offset?: number;
  /** Whether to show an arrow pointing toward the trigger. @default false */
  arrow?: boolean;
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
  isExternalTriggerHovered,
  onCloseComplete,
  offset = 8,
  arrow = false,
  className,
}: HoverCardProps) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const dismissed = useRef(false);
  const hasExternalAnchor = useRef(false);
  const onCloseCompleteRef = useRef(onCloseComplete);
  const [isOpen, setIsOpen] = useState(false);
  const [isTriggerHovered, setIsTriggerHovered] = useState(false);
  const [isTriggerFocused, setIsTriggerFocused] = useState(false);
  const [isCardHovered, setIsCardHovered] = useState(false);
  const [isCardFocused, setIsCardFocused] = useState(false);
  const { isFocusVisible } = useFocusVisible();

  const isExternal = isExternalTriggerHovered !== undefined;
  const isTriggerActive =
    isExternalTriggerHovered ?? (isTriggerHovered || isTriggerFocused);
  const shouldStayOpen = isOpen && (isCardHovered || isCardFocused);

  const close = useCallback(() => {
    setIsOpen(false);
    setIsCardHovered(false);
    setIsCardFocused(false);
  }, []);

  useEffect(() => {
    onCloseCompleteRef.current = onCloseComplete;
  }, [onCloseComplete]);

  useEffect(() => {
    if (isExternalTriggerHovered) {
      hasExternalAnchor.current = true;
    }
    if (!isTriggerActive) {
      dismissed.current = false;
    }
    if (isDisabled) {
      close();
    } else if (isTriggerActive || shouldStayOpen) {
      if (!isOpen && !dismissed.current) {
        timer.current = setTimeout(() => setIsOpen(true), openDelay);
      }
    } else if (isOpen || hasExternalAnchor.current) {
      timer.current = setTimeout(
        () => {
          close();
          if (hasExternalAnchor.current) {
            hasExternalAnchor.current = false;
            onCloseCompleteRef.current?.();
          }
        },
        isOpen ? closeDelay : 0
      );
    }

    return () => clearTimeout(timer.current);
  }, [
    close,
    closeDelay,
    isDisabled,
    isExternalTriggerHovered,
    isOpen,
    isTriggerActive,
    openDelay,
    shouldStayOpen,
  ]);

  const dismiss = useCallback(() => {
    clearTimeout(timer.current);
    dismissed.current = true;
    close();
  }, [close]);

  // Focus may still be outside the card when a keyboard dismissal is needed.
  useEffect(() => {
    if (isDisabled || (!isTriggerActive && !isOpen)) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismiss();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dismiss, isDisabled, isOpen, isTriggerActive]);

  const { hoverProps: triggerHoverProps } = useHover({
    isDisabled: isDisabled || isExternal,
    onHoverChange: setIsTriggerHovered,
  });
  const { hoverProps: cardHoverProps } = useHover({
    isDisabled,
    onHoverChange: setIsCardHovered,
  });
  const { focusWithinProps: cardFocusWithinProps } = useFocusWithin({
    isDisabled,
    onFocusWithinChange: setIsCardFocused,
  });
  const { focusWithinProps } = useFocusWithin({
    isDisabled: isDisabled || isExternal,
    onFocusWithinChange: (isFocused) =>
      setIsTriggerFocused(isFocused && isFocusVisible),
  });

  return (
    <>
      <span
        // min-w-0: in a flex row the trigger can shrink, so a truncating
        // child (an entity link) ellipsizes instead of holding the row open.
        className="tw:inline-flex tw:min-w-0 tw:max-w-full"
        ref={triggerRef}
        {...mergeProps(triggerHoverProps, focusWithinProps)}>
        {children}
      </span>
      <AriaPopover
        isNonModal
        isOpen={isOpen && !isDisabled}
        offset={offset}
        placement={placement}
        shouldCloseOnInteractOutside={() => false}
        triggerRef={triggerRef}
        onOpenChange={(open) => {
          if (!open) {
            dismiss();
          }
        }}>
        {arrow && (
          <AriaOverlayArrow>
            <svg
              // Shifted 1px into the card so it covers the card's outline instead of sitting on it.
              className="tw:block tw:fill-bg-floating tw:drop-shadow-sm tw:in-placement-left:-translate-x-px tw:in-placement-left:-rotate-90 tw:in-placement-right:translate-x-px tw:in-placement-right:rotate-90 tw:in-placement-top:-translate-y-px tw:in-placement-top:rotate-0 tw:in-placement-bottom:translate-y-px tw:in-placement-bottom:rotate-180"
              height={20}
              viewBox="0 0 100 100"
              width={20}>
              <path d="M0,0 L35.858,35.858 Q50,50 64.142,35.858 L100,0 Z" />
            </svg>
          </AriaOverlayArrow>
        )}
        <div
          {...mergeProps(cardHoverProps, cardFocusWithinProps)}
          className={cx(
            'tw:rounded-xl tw:bg-floating tw:p-4 tw:shadow-raised tw:dark:text-primary tw:outline-1 tw:outline-secondary_alt',
            className
          )}>
          {content}
        </div>
      </AriaPopover>
    </>
  );
};
