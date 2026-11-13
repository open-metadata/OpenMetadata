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
import { Popover, PopoverTrigger } from '@openmetadata/ui-core-components';
import {
  ComponentProps,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useHover, useInteractOutside } from 'react-aria';
import { Button as AriaButton } from 'react-aria-components';

// Grace period that lets the pointer travel from the trigger into its popover
// without the popover closing underneath it.
const CLOSE_DELAY_MS = 120;

export interface HoverPopoverProps {
  trigger: ReactNode;
  children: ReactNode;
  /** Set on the trigger. Callers pass a literal so the Playwright impact map can trace it. */
  'data-testid'?: string;
  contentClassName?: string;
  placement?: ComponentProps<typeof Popover>['placement'];
}

/**
 * A popover that opens while its trigger or the popover itself is hovered, and on
 * press or keyboard for touch and keyboard users. The content mounts only while
 * open, so anything it fetches is fetched on demand.
 */
const HoverPopover = ({
  trigger,
  children,
  'data-testid': dataTestId,
  contentClassName,
  placement = 'top start',
}: HoverPopoverProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = undefined;
    }
  }, []);

  const open = useCallback(() => {
    clearCloseTimeout();
    setIsOpen(true);
  }, [clearCloseTimeout]);

  const close = useCallback(() => {
    clearCloseTimeout();
    closeTimeoutRef.current = setTimeout(
      () => setIsOpen(false),
      CLOSE_DELAY_MS
    );
  }, [clearCloseTimeout]);

  useEffect(() => clearCloseTimeout, [clearCloseTimeout]);

  // Hovering the popover itself keeps it open.
  const { hoverProps } = useHover({ onHoverStart: open, onHoverEnd: close });

  // `isNonModal` turns off react-aria's own outside-press and Escape dismissal,
  // so a popover opened by tap or keyboard needs them wired here. The trigger is
  // excluded because its own press already toggles the popover.
  useInteractOutside({
    ref: contentRef,
    isDisabled: !isOpen,
    onInteractOutside: (event) => {
      if (!triggerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    },
  });

  return (
    <PopoverTrigger isOpen={isOpen} onOpenChange={setIsOpen}>
      <AriaButton
        className="tw:cursor-default tw:rounded-md tw:outline-focus-ring tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2"
        data-testid={dataTestId}
        ref={triggerRef}
        onHoverEnd={close}
        onHoverStart={open}
        onKeyDown={(event) => event.key === 'Escape' && setIsOpen(false)}>
        {trigger}
      </AriaButton>
      {/* The flex chain hands react-aria's max-height down to the content, so
          only the content scrolls. */}
      <Popover
        isNonModal
        className="tw:flex tw:flex-col"
        containerClassName="tw:flex tw:min-h-0 tw:flex-col"
        placement={placement}>
        <div className={contentClassName} ref={contentRef} {...hoverProps}>
          {children}
        </div>
      </Popover>
    </PopoverTrigger>
  );
};

export default HoverPopover;
