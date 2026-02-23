import { X as CloseIcon } from "@untitledui/icons";
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import { cx } from "@/utils/cx";

const sizes = {
    xs: { root: "size-7", icon: "size-4" },
    sm: { root: "size-9", icon: "size-5" },
    md: { root: "size-10", icon: "size-5" },
    lg: { root: "size-11", icon: "size-6" },
};

const themes = {
    light: "text-fg-quaternary hover:bg-primary_hover hover:text-fg-quaternary_hover focus-visible:outline-2 focus-visible:outline-offset-2 outline-focus-ring",
    dark: "text-fg-white/70 hover:text-fg-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 outline-focus-ring",
};

interface CloseButtonProps extends AriaButtonProps {
    theme?: "light" | "dark";
    size?: "xs" | "sm" | "md" | "lg";
    label?: string;
}

export const CloseButton = ({ label, className, size = "sm", theme = "light", ...otherProps }: CloseButtonProps) => {
    return (
        <AriaButton
            {...otherProps}
            aria-label={label || "Close"}
            className={(state) =>
                cx(
                    "tw:flex tw:cursor-pointer tw:items-center tw:justify-center tw:rounded-lg tw:p-2 tw:transition tw:duration-100 tw:ease-linear tw:focus:outline-hidden",
                    sizes[size].root,
                    themes[theme],
                    typeof className === "function" ? className(state) : className,
                )
            }
        >
            <CloseIcon aria-hidden="true" className={cx("tw:shrink-0 tw:transition-inherit-all", sizes[size].icon)} />
        </AriaButton>
    );
};
