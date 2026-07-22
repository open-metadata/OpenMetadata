import { useObjectRef } from '@react-aria/utils';
import { forwardRef } from 'react';
import { useInteractOutside } from 'react-aria';
import type { PopoverProps as AriaPopoverProps } from 'react-aria-components';
import { Popover as AriaPopover } from 'react-aria-components';
import { cx } from '@/utils/cx';

interface PopoverProps extends AriaPopoverProps {
  /**
   * Whether a non-modal popover closes when the user interacts outside it.
   * Modal popovers already provide this behavior through React Aria.
   * @default false
   */
  isDismissable?: boolean;
  /**
   * Filters which outside elements may dismiss an open popover.
   * Return false for trigger elements or other interactions that should keep it open.
   */
  shouldCloseOnInteractOutside?: AriaPopoverProps['shouldCloseOnInteractOutside'];
  size: 'sm' | 'md';
}

export const Popover = forwardRef<HTMLElement, PopoverProps>(
  ({ isDismissable = false, ...props }, ref) => {
    const popoverRef = useObjectRef(ref);

    // React Aria intentionally keeps non-modal popovers open during outside
    // interaction. Opt into dismissal while preserving its standard filter.
    useInteractOutside({
      ref: popoverRef,
      isDisabled: !isDismissable || !props.isNonModal,
      onInteractOutside: (event) => {
        const target = event.target;

        if (
          target instanceof Element &&
          props.shouldCloseOnInteractOutside?.(target) === false
        ) {
          return;
        }

        props.onOpenChange?.(false);
      },
    });

    return (
      <AriaPopover
        containerPadding={0}
        offset={4}
        placement="bottom"
        ref={popoverRef}
        {...props}
        className={(state) =>
          cx(
            // Outline instead of a ring (WebKit does not pixel-snap box-shadow, so rings
            // thin/vanish in Safari when zoomed out). This ring had no `ring-inset`, so it
            // drew outward from the border-box edge — outline-offset 0 (the default) matches
            // that exactly. `outline-hidden` is gone: it would suppress this border.
            'tw:max-h-64! tw:w-(--trigger-width) tw:origin-(--trigger-anchor-point) tw:overflow-x-hidden tw:overflow-y-auto tw:rounded-lg tw:bg-primary tw:py-1 tw:shadow-lg tw:outline-1 tw:outline-secondary_alt tw:will-change-transform',

            state.isEntering &&
              'tw:duration-150 tw:ease-out tw:animate-in tw:fade-in tw:placement-right:slide-in-from-left-0.5 tw:placement-top:slide-in-from-bottom-0.5 tw:placement-bottom:slide-in-from-top-0.5',
            state.isExiting &&
              'tw:duration-100 tw:ease-in tw:animate-out tw:fade-out tw:placement-right:slide-out-to-left-0.5 tw:placement-top:slide-out-to-bottom-0.5 tw:placement-bottom:slide-out-to-top-0.5',
            props.size === 'md' && 'tw:max-h-80!',

            typeof props.className === 'function'
              ? props.className(state)
              : props.className
          )
        }
      />
    );
  }
);

Popover.displayName = 'Popover';
