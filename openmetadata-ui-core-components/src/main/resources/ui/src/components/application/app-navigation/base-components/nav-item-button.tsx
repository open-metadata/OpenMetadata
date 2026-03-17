import type { FC, MouseEventHandler } from "react";
import { Pressable } from "react-aria-components";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";

const styles = {
    md: {
        root: "tw:size-10",
        icon: "tw:size-5",
    },
    lg: {
        root: "tw:size-12",
        icon: "tw:size-6",
    },
};

interface NavItemButtonProps {
    /** Whether the collapsible nav item is open. */
    open?: boolean;
    /** URL to navigate to when the button is clicked. */
    href?: string;
    /** Label text for the button. */
    label: string;
    /** Icon component to display. */
    icon: FC<{ className?: string }>;
    /** Whether the button is currently active. */
    current?: boolean;
    /** Size of the button. */
    size?: "md" | "lg";
    /** Handler for click events. */
    onClick?: MouseEventHandler;
    /** Additional CSS classes to apply to the button. */
    className?: string;
    /** Placement of the tooltip. */
    tooltipPlacement?: "top" | "right" | "bottom" | "left";
}

export const NavItemButton = ({
    current: current,
    label,
    href,
    icon: Icon,
    size = "md",
    className,
    tooltipPlacement = "right",
    onClick,
}: NavItemButtonProps) => {
    return (
        <Tooltip title={label} placement={tooltipPlacement}>
            <Pressable>
                <a
                    href={href}
                    aria-label={label}
                    onClick={onClick}
                    className={cx(
                        "tw:relative tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-md tw:bg-primary tw:p-2 tw:text-fg-quaternary tw:outline-focus-ring tw:transition tw:duration-100 tw:ease-linear tw:select-none tw:hover:bg-primary_hover tw:hover:text-fg-quaternary_hover tw:focus-visible:z-10 tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2",
                        current && "tw:bg-active tw:text-fg-quaternary_hover tw:hover:bg-secondary_hover",
                        styles[size].root,
                        className,
                    )}
                >
                    <Icon aria-hidden="true" className={cx("tw:shrink-0 tw:transition-inherit-all", styles[size].icon)} />
                </a>
            </Pressable>
        </Tooltip>
    );
};
