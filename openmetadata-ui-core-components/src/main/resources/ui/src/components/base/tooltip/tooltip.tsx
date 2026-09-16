import { cx } from '@/utils/cx';
import type { ReactNode } from 'react';
import type {
  ButtonProps as AriaButtonProps,
  PressEvent,
  TooltipProps as AriaTooltipProps,
  TooltipTriggerComponentProps as AriaTooltipTriggerComponentProps,
} from 'react-aria-components';
import {
  Button as AriaButton,
  OverlayArrow as AriaOverlayArrow,
  Tooltip as AriaTooltip,
  TooltipTrigger as AriaTooltipTrigger,
} from 'react-aria-components';

interface TooltipProps
  extends AriaTooltipTriggerComponentProps,
    Omit<AriaTooltipProps, 'children'> {
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
   * creates when its child is a non-focusable element. Providing this prop
   * forces wrapping even for React component children.
   */
  triggerClassName?: string;
  /**
   * Press handler forwarded to the auto-generated focusable wrapper. Providing
   * this prop forces wrapping (same as triggerClassName).
   */
  onTriggerPress?: (e: PressEvent) => void;
  /**
   * Passed as `isDisabled` to the auto-generated focusable wrapper.
   *
   * @default false
   */
  triggerIsDisabled?: boolean;
}

export const Tooltip = ({
  title,
  description,
  children,
  arrow = false,
  delay = 300,
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
  ...tooltipProps
}: TooltipProps) => {
  const shouldWrap =
    triggerClassName !== undefined || onTriggerPress !== undefined;

  const trigger_ = shouldWrap ? (
    <AriaButton
      className={cx('tw:h-max tw:w-max tw:outline-hidden', triggerClassName)}
      isDisabled={triggerIsDisabled}
      onPress={onTriggerPress}>
      {children}
    </AriaButton>
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
        delay,
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
        placement={placement}>
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
              <span className="tw:text-xs tw:font-semibold tw:text-white">
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

export const TooltipTrigger = ({
  children,
  className,
  ...buttonProps
}: TooltipTriggerProps) => {
  return (
    <AriaButton
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
};
