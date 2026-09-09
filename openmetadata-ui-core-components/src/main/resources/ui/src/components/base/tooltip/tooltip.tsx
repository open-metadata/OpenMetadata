import type { ReactNode } from 'react';
import type { Placement } from 'react-aria';
import type {
  ButtonProps as AriaButtonProps,
  PressEvent,
  TooltipProps as AriaTooltipProps,
  TooltipTriggerComponentProps as AriaTooltipTriggerComponentProps,
} from 'react-aria-components';
import { forwardRef, isValidElement } from 'react';
import {
  Button as AriaButton,
  OverlayArrow as AriaOverlayArrow,
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
} from 'react-aria-components';
import { cx } from '@/utils/cx';

// HTML elements that are natively focusable and don't need an AriaButton wrapper.
// IMPORTANT: do NOT pass a container element whose children are interactive (e.g.
// a <div> containing a <button>). Tooltip only inspects the top-level element type;
// wrapping such a container would produce a button-in-button (invalid HTML / a11y).
// The caller is responsible for ensuring the direct child has no interactive descendants.
// 'button' is intentionally excluded: react-aria's hover system attaches via
// cloneElement and does not reliably fire on native buttons. Wrapping in an
// AriaButton ensures the tooltip trigger uses react-aria's own useHover/usePress.
const NATIVELY_FOCUSABLE_HTML = new Set([
  'a',
  'details',
  'input',
  'select',
  'summary',
  'textarea',
]);

interface TooltipProps
  extends AriaTooltipTriggerComponentProps,
    Omit<AriaTooltipProps, 'children' | 'placement'> {
  /**
   * Placement of the tooltip relative to the trigger. Accepts react-aria
   * values ("top", "bottom left", …).
   */
  placement?: Placement;
  /**
   * The title of the tooltip.
   */
  title: ReactNode;
  /**
   * The description of the tooltip.
   */
  description?: ReactNode;
  /**
   * Whether to show the arrow on the tooltip.
   *
   * @default false
   */
  arrow?: boolean;
  /**
   * Delay in milliseconds before the tooltip is shown.
   *
   * @default 300
   */
  delay?: number;
  /**
   * Optional className applied to the tooltip content container div.
   * Use this to override the default dark background, e.g. for a white tooltip.
   */
  containerClassName?: string;
  /**
   * className forwarded to the auto-generated focusable wrapper that Tooltip
   * creates when its child is a non-focusable element (e.g. a plain span, an
   * SVG icon, or a bare div). Providing this prop also forces wrapping even
   * for React component children that would otherwise be passed through
   * directly.
   */
  triggerClassName?: string;
  /**
   * Press handler forwarded to the auto-generated focusable wrapper. Providing
   * this prop forces wrapping (same as triggerClassName).
   */
  onTriggerPress?: (e: PressEvent) => void;
  /**
   * Passed as `isDisabled` to the auto-generated focusable wrapper. Use
   * `triggerIsDisabled={false}` to keep the help-icon wrapper interactive
   * even when a surrounding form field is disabled.
   *
   * @default false
   */
  triggerIsDisabled?: boolean;
  /**
   * When true, renders a plain non-focusable span instead of the AriaButton
   * wrapper for non-focusable children. Use this when the tooltip trigger must
   * NOT be reachable by keyboard OR by programmatic focus (e.g. chips inside a
   * data-grid cell where keyboard focus belongs to the cell, not its children).
   * Mouse hover tooltips still work. Keyboard/focus tooltip triggering is
   * intentionally skipped.
   */
  excludeTriggerFromTabOrder?: boolean;
}

export const Tooltip = ({
  title,
  description,
  children,
  arrow = false,
  delay,
  closeDelay = 0,
  trigger,
  isDisabled,
  isOpen,
  defaultOpen,
  offset = 6,
  crossOffset,
  placement = 'top',
  onOpenChange,
  containerClassName,
  triggerClassName,
  onTriggerPress,
  triggerIsDisabled = false,
  excludeTriggerFromTabOrder,
  ...tooltipProps
}: TooltipProps) => {
  const resolvedDelay = delay ?? 300;

  // Determine whether the child needs to be wrapped in a focusable AriaButton.
  // Non-focusable HTML string elements (span, div, svg, …) can't serve as
  // react-aria tooltip anchors on their own; wrap them automatically.
  // Providing triggerClassName or onTriggerPress is an explicit signal to wrap
  // even React component children (e.g. icon components).
  const shouldWrap = (() => {
    if (triggerClassName !== undefined || onTriggerPress !== undefined) {
      return true;
    }
    if (!isValidElement(children)) {
      return false;
    }
    const type = children.type;

    return typeof type === 'string' && !NATIVELY_FOCUSABLE_HTML.has(type);
  })();

  const trigger_ = shouldWrap ? (
    excludeTriggerFromTabOrder ? (
      // Use a plain span instead of AriaButton when the trigger is explicitly
      // excluded from the tab order. AriaButton with tabindex="-1" is still
      // programmatically focusable, so Ant Design FocusTrap.restoreFocus() can
      // accidentally land on it inside rdg cells. A span has no focusability at
      // all — FocusTrap cannot reach it — while RAC's TooltipTrigger still
      // passes hover handlers via cloneElement, so mouse tooltips work normally.
      <span className={triggerClassName}>{children}</span>
    ) : (
      <AriaButton
        className={cx('tw:h-max tw:w-max tw:outline-hidden', triggerClassName)}
        isDisabled={triggerIsDisabled}
        onPress={onTriggerPress}>
        {children}
      </AriaButton>
    )
  ) : (
    children
  );

  const isTopOrBottomLeft = [
    'top left',
    'top end',
    'bottom left',
    'bottom end',
  ].includes(placement);
  const isTopOrBottomRight = [
    'top right',
    'top start',
    'bottom right',
    'bottom start',
  ].includes(placement);
  // Set negative cross offset for left and right placement to visually balance the tooltip.
  const calculatedCrossOffset = isTopOrBottomLeft
    ? -12
    : isTopOrBottomRight
    ? 12
    : 0;

  return (
    <AriaTooltipTrigger
      {...{
        trigger,
        delay: resolvedDelay,
        closeDelay,
        isDisabled,
        isOpen,
        defaultOpen,
        onOpenChange,
      }}>
      {trigger_}

      <AriaTooltip
        {...tooltipProps}
        className={({ isEntering, isExiting }) =>
          cx(
            isEntering && 'tw:ease-out tw:animate-in',
            isExiting && 'tw:ease-in tw:animate-out',
            'tw:break-words' // Ensure long words in the tooltip wrap instead of overflowing.
          )
        }
        crossOffset={crossOffset ?? calculatedCrossOffset}
        offset={offset}
        placement={placement as Placement}>
        {({ isEntering, isExiting }) => (
          <>
            {arrow && (
              <AriaOverlayArrow>
                <svg
                  className="tw:block tw:size-2.5 tw:fill-bg-primary-solid tw:in-placement-left:-rotate-90 tw:in-placement-right:rotate-90 tw:in-placement-top:rotate-0 tw:in-placement-bottom:rotate-180"
                  viewBox="0 0 100 100">
                  <path d="M0,0 L35.858,35.858 Q50,50 64.142,35.858 L100,0 Z" />
                </svg>
              </AriaOverlayArrow>
            )}
            <div
              className={cx(
                'tw:z-50 tw:flex tw:max-w-xs tw:origin-(--trigger-anchor-point) tw:flex-col tw:items-start tw:gap-1 tw:rounded-lg tw:bg-primary-solid tw:px-3 tw:shadow-lg tw:will-change-transform',
                description ? 'tw:py-3' : 'tw:py-2',
                containerClassName,

                isEntering &&
                  'tw:ease-out tw:animate-in tw:fade-in tw:zoom-in-95 tw:in-placement-left:slide-in-from-right-0.5 tw:in-placement-right:slide-in-from-left-0.5 tw:in-placement-top:slide-in-from-bottom-0.5 tw:in-placement-bottom:slide-in-from-top-0.5',
                isExiting &&
                  'tw:ease-in tw:animate-out tw:fade-out tw:zoom-out-95 tw:in-placement-left:slide-out-to-right-0.5 tw:in-placement-right:slide-out-to-left-0.5 tw:in-placement-top:slide-out-to-bottom-0.5 tw:in-placement-bottom:slide-out-to-top-0.5'
              )}>
              <span className="tw:break-all tw:text-xs tw:font-semibold tw:text-white">
                {title}
              </span>

              {description && (
                <span className="tw:text-xs tw:font-medium tw:text-tooltip-supporting-text">
                  {description}
                </span>
              )}
            </div>
          </>
        )}
      </AriaTooltip>
    </AriaTooltipTrigger>
  );
};

type TooltipTriggerProps = AriaButtonProps;

/**
 * @deprecated Pass your child element directly to `<Tooltip>` instead.
 * `Tooltip` now auto-wraps non-focusable children and accepts
 * `triggerClassName` / `onTriggerPress` for the generated wrapper.
 * `TooltipTrigger` will be removed in a future release.
 *
 * AriaTooltipTrigger passes its hover/focus-open handlers down through
 * FocusableContext, not through cloned props or a plain ref — AriaButton never
 * reads that context (it only reads ButtonContext), so wrapping it directly
 * silently drops the tooltip's open/close wiring. forwardRef is required here
 * so the ref reaches the underlying DOM button.
 */
export const TooltipTrigger = forwardRef<
  HTMLButtonElement,
  TooltipTriggerProps
>(function TooltipTrigger({ children, className, ...buttonProps }, ref) {
  return (
    <AriaButton
      ref={ref}
      {...buttonProps}
      className={(values) =>
        cx(
          'tw:h-max tw:w-max tw:outline-hidden',
          typeof className === 'function' ? className(values) : className
        )
      }>
      {children}
    </AriaButton>
  );
});
