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
import { mergeProps } from '@react-aria/utils';
import type { DOMAttributes, ReactNode, RefObject } from 'react';
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import type {
  DialogTriggerProps as AriaDialogTriggerProps,
  PopoverProps as AriaPopoverProps,
} from 'react-aria-components';
import {
  Dialog as AriaDialog,
  DialogTrigger as AriaDialogTrigger,
  OverlayArrow as AriaOverlayArrow,
  Popover as AriaPopover,
} from 'react-aria-components';
import { useHover } from 'react-aria';
import { mergeRefs } from '@react-aria/utils';
import { cx } from '@/utils/cx';

/**
 * Hover handlers the trigger shares with its Popover.
 *
 * A hover popover has to survive the pointer travelling from the trigger into
 * the panel, and the panel is portalled out of the trigger's subtree — so it
 * cannot inherit the hover by containment. The trigger publishes its handlers
 * here and the Popover re-attaches them to the panel, which makes the pair
 * behave as one hover region.
 */
interface PopoverHoverValue {
  hoverProps: DOMAttributes<HTMLElement>;
  /**
   * The trigger's DOM node, for the Popover to anchor against.
   *
   * react-aria's `DialogTrigger` only wires a trigger ref through a `Button`
   * child. A hover popover's trigger is whatever the caller renders — a link,
   * a chip, a span — so without this the panel has nothing to position
   * against and lands in the page corner instead of beside the trigger.
   */
  triggerRef: RefObject<HTMLElement>;
}

const PopoverHoverContext = createContext<PopoverHoverValue | null>(null);

export interface PopoverProps extends Omit<AriaPopoverProps, 'children'> {
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

export interface PopoverTriggerProps extends AriaDialogTriggerProps {
  /**
   * How the popover opens.
   * - `press` (default): click or Enter/Space, via react-aria's DialogTrigger.
   * - `hover`: pointer enter, and still press — so a keyboard user is not
   *   locked out of content only a mouse can reach.
   *
   * Use `hover` only for a panel the pointer is meant to travel into, such as
   * a preview card. Anything purely informational belongs in a Tooltip.
   * @default 'press'
   */
  trigger?: 'press' | 'hover';
  /**
   * Milliseconds the pointer must rest on the trigger before a `hover`
   * popover opens. Ignored when `trigger` is `press`.
   * @default 300
   */
  delay?: number;
  /**
   * Milliseconds before a `hover` popover closes once the pointer has left
   * both the trigger and the panel. This is the forgiveness window for
   * crossing the gap between them, so it is not 0.
   * @default 200
   */
  closeDelay?: number;
}

const HoverPopoverTrigger = ({
  children,
  trigger: _trigger,
  delay = 300,
  closeDelay = 200,
  isOpen: controlledOpen,
  defaultOpen,
  onOpenChange,
  ...props
}: PopoverTriggerProps) => {
  const [isOpen, setIsOpen] = useState(defaultOpen ?? false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const triggerRef = useRef<HTMLElement>(null);

  const open = controlledOpen ?? isOpen;

  const setOpen = useCallback(
    (next: boolean) => {
      setIsOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange]
  );

  // A single timer for both directions: re-entering the panel before the
  // close delay elapses cancels the pending close, which is what keeps the
  // trigger -> panel journey from dismissing the thing being travelled to.
  const schedule = useCallback(
    (next: boolean, ms: number) => {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setOpen(next), ms);
    },
    [setOpen]
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  // useHover ignores touch and emulated-mouse events, so a tap does not open
  // a panel the user then cannot dismiss by "moving away".
  const { hoverProps } = useHover({
    onHoverStart: () => schedule(true, delay),
    onHoverEnd: () => schedule(false, closeDelay),
  });

  const [triggerChild, ...rest] = Children.toArray(children);

  return (
    <PopoverHoverContext.Provider value={{ hoverProps, triggerRef }}>
      <AriaDialogTrigger
        {...props}
        isOpen={open}
        onOpenChange={(next) => {
          clearTimeout(timer.current);
          setOpen(next);
        }}>
        {/*
          Only a host element is guaranteed to apply injected props and a ref.
          A composite child may take a fixed prop list and drop both — the
          handlers vanish, the card never opens, and React warns about a ref on
          a function component. Callers pass whatever they like here, so the
          wrapper is decided on the element's type rather than trusting them.
          antd avoided this with `findDOMNode`, which React no longer offers.
        */}
        {isValidElement(triggerChild) &&
        typeof triggerChild.type === 'string' ? (
          cloneElement(triggerChild, {
            ...mergeProps(
              triggerChild.props as Record<string, unknown>,
              hoverProps
            ),
            ref: mergeRefs(
              (triggerChild as { ref?: never }).ref ?? null,
              triggerRef
            ),
          } as Record<string, unknown>)
        ) : (
          <span
            {...hoverProps}
            className="tw:inline-flex"
            ref={triggerRef as RefObject<HTMLSpanElement>}>
            {triggerChild}
          </span>
        )}
        {rest}
      </AriaDialogTrigger>
    </PopoverHoverContext.Provider>
  );
};

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
export const PopoverTrigger = ({
  trigger = 'press',
  ...props
}: PopoverTriggerProps) =>
  trigger === 'hover' ? (
    <HoverPopoverTrigger trigger={trigger} {...props} />
  ) : (
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
  // Null under a press trigger, which is why this costs nothing there.
  const hover = useContext(PopoverHoverContext);

  return (
    <AriaPopover
      {...hover?.hoverProps}
      isNonModal={hover ? true : undefined}
      offset={offset}
      triggerRef={hover?.triggerRef}
      {...popoverProps}
      className={(state) =>
        cx(
          // `outline-hidden` removed: the outline now draws this popover's border (it
          // replaced a ring, which WebKit does not pixel-snap), so suppressing it would
          // erase the border.
          'tw:origin-(--trigger-anchor-point) tw:rounded-xl tw:bg-overlay-surface tw:shadow-lg tw:outline-1 tw:outline-secondary_alt tw:will-change-transform',
          state.isEntering &&
            'tw:duration-150 tw:ease-out tw:animate-in tw:fade-in tw:placement-left:slide-in-from-right-0.5 tw:placement-right:slide-in-from-left-0.5 tw:placement-top:slide-in-from-bottom-0.5 tw:placement-bottom:slide-in-from-top-0.5',
          state.isExiting &&
            'tw:duration-100 tw:ease-in tw:animate-out tw:fade-out tw:placement-left:slide-out-to-right-0.5 tw:placement-right:slide-out-to-left-0.5 tw:placement-top:slide-out-to-bottom-0.5 tw:placement-bottom:slide-out-to-top-0.5',
          typeof popoverProps.className === 'function'
            ? popoverProps.className(state)
            : popoverProps.className
        )
      }>
      {arrow && (
        <AriaOverlayArrow>
          <svg
            className="tw:fill-bg-primary tw:drop-shadow-sm tw:in-placement-left:-rotate-90 tw:in-placement-right:rotate-90 tw:in-placement-top:rotate-0 tw:in-placement-bottom:rotate-180"
            height={10}
            viewBox="0 0 100 100"
            width={10}>
            <path d="M0,0 L35.858,35.858 Q50,50 64.142,35.858 L100,0 Z" />
          </svg>
        </AriaOverlayArrow>
      )}
      <AriaDialog className={cx('tw:outline-hidden', containerClassName)}>
        {children}
      </AriaDialog>
    </AriaPopover>
  );
};
