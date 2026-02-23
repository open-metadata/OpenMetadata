import type { ReactNode } from "react";
import type {
    ButtonProps as AriaButtonProps,
    TooltipProps as AriaTooltipProps,
    TooltipTriggerComponentProps as AriaTooltipTriggerComponentProps,
} from "react-aria-components";
import { Button as AriaButton, OverlayArrow as AriaOverlayArrow, Tooltip as AriaTooltip, TooltipTrigger as AriaTooltipTrigger } from "react-aria-components";
import { cx } from "@/utils/cx";

interface TooltipProps extends AriaTooltipTriggerComponentProps, Omit<AriaTooltipProps, "children"> {
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
    placement = "top",
    onOpenChange,
    ...tooltipProps
}: TooltipProps) => {
    const isTopOrBottomLeft = ["top left", "top end", "bottom left", "bottom end"].includes(placement);
    const isTopOrBottomRight = ["top right", "top start", "bottom right", "bottom start"].includes(placement);
    // Set negative cross offset for left and right placement to visually balance the tooltip.
    const calculatedCrossOffset = isTopOrBottomLeft ? -12 : isTopOrBottomRight ? 12 : 0;

    return (
        <AriaTooltipTrigger {...{ trigger, delay, closeDelay, isDisabled, isOpen, defaultOpen, onOpenChange }}>
            {children}

            <AriaTooltip
                {...tooltipProps}
                offset={offset}
                placement={placement}
                crossOffset={crossOffset ?? calculatedCrossOffset}
                className={({ isEntering, isExiting }) => cx(isEntering && "tw:ease-out tw:animate-in", isExiting && "tw:ease-in tw:animate-out")}
            >
                {({ isEntering, isExiting }) => (
                    <div
                        className={cx(
                            "tw:z-50 tw:flex tw:max-w-xs tw:origin-(--trigger-anchor-point) tw:flex-col tw:items-start tw:gap-1 tw:rounded-lg tw:bg-primary-solid tw:px-3 tw:shadow-lg tw:will-change-transform",
                            description ? "tw:py-3" : "tw:py-2",

                            isEntering &&
                                "tw:ease-out tw:animate-in tw:fade-in tw:zoom-in-95 tw:in-placement-left:slide-in-from-right-0.5 tw:in-placement-right:slide-in-from-left-0.5 tw:in-placement-top:slide-in-from-bottom-0.5 tw:in-placement-bottom:slide-in-from-top-0.5",
                            isExiting &&
                                "tw:ease-in tw:animate-out tw:fade-out tw:zoom-out-95 tw:in-placement-left:slide-out-to-right-0.5 tw:in-placement-right:slide-out-to-left-0.5 tw:in-placement-top:slide-out-to-bottom-0.5 tw:in-placement-bottom:slide-out-to-top-0.5",
                        )}
                    >
                        <span className="tw:text-xs tw:font-semibold tw:text-white">{title}</span>

                        {description && <span className="tw:text-xs tw:font-medium tw:text-tooltip-supporting-text">{description}</span>}

                        {arrow && (
                            <AriaOverlayArrow>
                                <svg
                                    viewBox="0 0 100 100"
                                    className="tw:size-2.5 tw:fill-bg-primary-solid tw:in-placement-left:-rotate-90 tw:in-placement-right:rotate-90 tw:in-placement-top:rotate-0 tw:in-placement-bottom:rotate-180"
                                >
                                    <path d="M0,0 L35.858,35.858 Q50,50 64.142,35.858 L100,0 Z" />
                                </svg>
                            </AriaOverlayArrow>
                        )}
                    </div>
                )}
            </AriaTooltip>
        </AriaTooltipTrigger>
    );
};

interface TooltipTriggerProps extends AriaButtonProps {}

export const TooltipTrigger = ({ children, className, ...buttonProps }: TooltipTriggerProps) => {
    return (
        <AriaButton {...buttonProps} className={(values) => cx("tw:h-max tw:w-max tw:outline-hidden", typeof className === "function" ? className(values) : className)}>
            {children}
        </AriaButton>
    );
};
