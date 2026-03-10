import { X as CloseIcon } from "@untitledui/icons";
import { Button as AriaButton, type ButtonProps as AriaButtonProps } from "react-aria-components";
import { cx } from "@/utils/cx";

const sizes = {
    xs: { root: "tw:size-7", icon: "tw:size-4" },
    sm: { root: "tw:size-9", icon: "tw:size-5" },
    md: { root: "tw:size-10", icon: "tw:size-5" },
    lg: { root: "tw:size-11", icon: "tw:size-6" },
};

const themes = {
    light: "tw:text-fg-quaternary tw:hover:bg-primary_hover tw:hover:text-fg-quaternary_hover tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:outline-focus-ring",
    dark: "tw:text-fg-white/70 tw:hover:text-fg-white tw:hover:bg-white/20 tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:outline-focus-ring",
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
