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
import { Popover } from '@openmetadata/ui-core-components';
import { ReactNode, useRef } from 'react';
import type { Placement } from 'react-aria';

/**
 * Controlled-open contract that pickers accept from their callers, replacing
 * the antd `PopoverProps` they used to forward wholesale.
 */
export interface SelectablePopoverProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
}

interface AnchoredPopoverProps {
  /** Caller-supplied trigger; any element, not necessarily pressable. */
  children: ReactNode;
  content: ReactNode;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  placement?: Placement;
  className?: string;
  containerClassName?: string;
}

/**
 * Opens a core Popover from an arbitrary trigger. `PopoverTrigger` needs a
 * react-aria pressable child, but these pickers take whatever the caller
 * renders (a pill, a table cell, a core Button), so the popover is anchored
 * to a wrapper instead and opened from its click — which a nested button's
 * keyboard activation also dispatches. The click is caught in the capture
 * phase because react-aria pressables (e.g. a `TooltipTrigger` around the
 * trigger) stop it from bubbling.
 */
const AnchoredPopover = ({
  children,
  content,
  isOpen,
  onOpenChange,
  placement,
  className,
  containerClassName,
}: AnchoredPopoverProps) => {
  const anchorRef = useRef<HTMLSpanElement>(null);

  return (
    <>
      {/* The trigger inside is the interactive element; its keyboard activation reaches here as a click. */}
      <span
        className="tw:inline-flex tw:max-w-full"
        ref={anchorRef}
        onClickCapture={() => onOpenChange(true)}>
        {children}
      </span>
      <Popover
        className={className}
        containerClassName={containerClassName}
        isOpen={isOpen}
        placement={placement}
        triggerRef={anchorRef}
        onOpenChange={onOpenChange}>
        {content}
      </Popover>
    </>
  );
};

export default AnchoredPopover;
