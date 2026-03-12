/*
 *  Copyright 2025 Collate.
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
import type { ReactNode } from "react";
import type {
  DialogTriggerProps as AriaDialogTriggerProps,
  PopoverProps as AriaPopoverProps,
} from "react-aria-components";
import {
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  OverlayArrow as AriaOverlayArrow,
  Popover as AriaPopover,
} from "react-aria-components";
import { cx } from "@/utils/cx";

export interface PopoverProps extends Omit<AriaPopoverProps, "children"> {
  /**
   * The content to display inside the popover.
   */
  children: ReactNode;
  /**
   * Whether to show the arrow pointing toward the trigger element.
   * @default false
   */
  arrow?: boolean;
  /**
   * Optional className applied to the inner content container.
   */
  containerClassName?: string;
}

export interface PopoverTriggerProps extends AriaDialogTriggerProps {}

/**
 * PopoverTrigger manages the open/close state of a Popover.
 * Place the trigger element and a Popover as its two children.
 *
 * @example
 * <PopoverTrigger>
 *   <Button>Open</Button>
 *   <Popover>
 *     <p>Popover content</p>
 *   </Popover>
 * </PopoverTrigger>
 */
export const PopoverTrigger = (props: PopoverTriggerProps) => (
  <AriaDialogTrigger {...props} />
);

/**
 * A general-purpose floating overlay panel built on react-aria Popover.
 * Must be used as a child of PopoverTrigger.
 */
export const Popover = ({
  children,
  arrow = false,
  containerClassName,
  offset = 8,
  ...popoverProps
}: PopoverProps) => {
  return (
    <AriaPopover
      offset={offset}
      {...popoverProps}
      className={(state) =>
        cx(
          "tw:origin-(--trigger-anchor-point) tw:rounded-xl tw:bg-primary tw:shadow-lg tw:ring-1 tw:ring-secondary_alt tw:outline-hidden tw:will-change-transform",
          state.isEntering &&
            "tw:duration-150 tw:ease-out tw:animate-in tw:fade-in tw:placement-left:slide-in-from-right-0.5 tw:placement-right:slide-in-from-left-0.5 tw:placement-top:slide-in-from-bottom-0.5 tw:placement-bottom:slide-in-from-top-0.5",
          state.isExiting &&
            "tw:duration-100 tw:ease-in tw:animate-out tw:fade-out tw:placement-left:slide-out-to-right-0.5 tw:placement-right:slide-out-to-left-0.5 tw:placement-top:slide-out-to-bottom-0.5 tw:placement-bottom:slide-out-to-top-0.5",
          typeof popoverProps.className === "function"
            ? popoverProps.className(state)
            : popoverProps.className,
        )
      }
    >
      {arrow && (
        <AriaOverlayArrow>
          <svg
            viewBox="0 0 100 100"
            width={10}
            height={10}
            className="tw:fill-bg-primary tw:drop-shadow-sm tw:in-placement-left:-rotate-90 tw:in-placement-right:rotate-90 tw:in-placement-top:rotate-0 tw:in-placement-bottom:rotate-180"
          >
            <path d="M0,0 L35.858,35.858 Q50,50 64.142,35.858 L100,0 Z" />
          </svg>
        </AriaOverlayArrow>
      )}
      <AriaDialog className={cx("tw:outline-hidden", containerClassName)}>
        {children}
      </AriaDialog>
    </AriaPopover>
  );
};
