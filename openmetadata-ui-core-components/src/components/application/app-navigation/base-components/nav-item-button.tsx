import type { FC, MouseEventHandler } from "react";
import { Pressable } from "react-aria-components";
import { Tooltip } from "@/components/base/tooltip/tooltip";
import { cx } from "@/utils/cx";

const styles = {
    md: {
        root: "size-10",
        icon: "size-5",
    },
    lg: {
        root: "size-12",
        icon: "size-6",
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
                        "relative flex w-full cursor-pointer items-center justify-center rounded-md bg-primary p-2 text-fg-quaternary outline-focus-ring transition duration-100 ease-linear select-none hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2",
                        current && "bg-active text-fg-quaternary_hover hover:bg-secondary_hover",
                        styles[size].root,
                        className,
                    )}
                >
                    <Icon aria-hidden="true" className={cx("shrink-0 transition-inherit-all", styles[size].icon)} />
                </a>
            </Pressable>
        </Tooltip>
    );
};
