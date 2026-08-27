import type { RefAttributes } from 'react';
import type { PopoverProps as AriaPopoverProps } from 'react-aria-components';
import { Popover as AriaPopover } from 'react-aria-components';
import { cx } from '@/utils/cx';

interface PopoverProps extends AriaPopoverProps, RefAttributes<HTMLElement> {
  size: 'sm' | 'md';
}

export const Popover = (props: PopoverProps) => {
  return (
    <AriaPopover
      // Combobox/select popups must be non-modal: modal popovers apply
      // aria-hidden to the rest of the page (ariaHideOutside), and when the
      // popover unmounts abruptly (its owner re-renders away) that cleanup
      // never runs — leaving the whole app invisible to the accessibility
      // tree (and to role-based queries) while looking perfectly normal.
      isNonModal
      // Mark the non-modal listbox as a top layer. Without this, when the select
      // lives inside a dismissable overlay (SlideoutMenu drawer / centered Modal)
      // that overlay treats an option click as an interaction *outside* itself
      // and its focus trap reclaims focus from the portaled listbox — dismissing
      // the drawer or flickering the listbox closed mid-open (options never go
      // "stable"). react-aria honors this marker in both paths: useInteractOutside
      // (no ancestor dismiss) and FocusScope (no focus reclaim). It only auto-sets
      // it for toasts, so non-modal popovers must opt in explicitly.
      containerPadding={0}
      data-react-aria-top-layer="true"
      offset={4}
      placement="bottom"
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
};
