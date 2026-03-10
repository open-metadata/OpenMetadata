import type { RefAttributes } from "react";
import { XClose } from "@untitledui/icons";
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import { cx } from "@/utils/cx";

interface TagCloseXProps extends AriaButtonProps, RefAttributes<HTMLButtonElement> {
    size?: "sm" | "md" | "lg";
    className?: string;
}

const styles = {
    sm: { root: "p-0.5", icon: "size-2.5" },
    md: { root: "p-0.5", icon: "size-3" },
    lg: { root: "p-0.75", icon: "size-3.5" },
};

export const TagCloseX = ({ size = "md", className, ...otherProps }: TagCloseXProps) => {
    return (
        <AriaButton
            slot="remove"
            aria-label="Remove this tag"
            className={cx(
                "tw:flex tw:cursor-pointer tw:rounded-[3px] tw:text-fg-quaternary tw:outline-transparent tw:transition tw:duration-100 tw:ease-linear tw:hover:bg-primary_hover tw:hover:text-fg-quaternary_hover tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-focus-ring tw:disabled:cursor-not-allowed",
                styles[size].root,
                className,
            )}
            {...otherProps}
        >
            <XClose className={cx("tw:transition-inherit-all", styles[size].icon)} strokeWidth="3" />
        </AriaButton>
    );
};
