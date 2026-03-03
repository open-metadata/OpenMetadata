import type { ReactNode } from "react";
import type { SwitchProps as AriaSwitchProps } from "react-aria-components";
import { Switch as AriaSwitch } from "react-aria-components";
import { cx } from "@/utils/cx";

interface ToggleBaseProps {
    size?: "sm" | "md";
    slim?: boolean;
    className?: string;
    isHovered?: boolean;
    isFocusVisible?: boolean;
    isSelected?: boolean;
    isDisabled?: boolean;
}

export const ToggleBase = ({ className, isHovered, isDisabled, isFocusVisible, isSelected, slim, size = "sm" }: ToggleBaseProps) => {
    const styles = {
        default: {
            sm: {
                root: "tw:h-5 tw:w-9 tw:p-0.5",
                switch: cx("tw:size-4", isSelected && "tw:translate-x-4"),
            },
            md: {
                root: "tw:h-6 tw:w-11 tw:p-0.5",
                switch: cx("tw:size-5", isSelected && "tw:translate-x-5"),
            },
        },
        slim: {
            sm: {
                root: "tw:h-4 tw:w-8",
                switch: cx("tw:size-4", isSelected && "tw:translate-x-4"),
            },
            md: {
                root: "tw:h-5 tw:w-10",
                switch: cx("tw:size-5", isSelected && "tw:translate-x-5"),
            },
        },
    };

    const classes = slim ? styles.slim[size] : styles.default[size];

    return (
        <div
            className={cx(
                "tw:cursor-pointer tw:rounded-full tw:bg-tertiary tw:outline-focus-ring tw:transition tw:duration-150 tw:ease-linear",
                isSelected && "tw:bg-brand-solid",
                isSelected && isHovered && "tw:bg-brand-solid_hover",
                isDisabled && "tw:cursor-not-allowed tw:bg-disabled",
                isFocusVisible && "tw:outline-2 tw:outline-offset-2",

                slim && "tw:ring-1 tw:ring-secondary tw:ring-inset",
                slim && isSelected && "tw:ring-transparent",
                classes.root,
                className,
            )}
        >
            <div
                style={{
                    transition: "transform 0.15s ease-in-out, translate 0.15s ease-in-out, border-color 0.1s linear, background-color 0.1s linear",
                }}
                className={cx(
                    "tw:rounded-full tw:bg-fg-white tw:shadow-sm",
                    isDisabled && "tw:bg-toggle-button-fg_disabled",

                    slim && "tw:shadow-xs",
                    slim && "tw:border tw:border-toggle-border",
                    slim && isSelected && "tw:border-toggle-slim-border_pressed",
                    slim && isSelected && isHovered && "tw:border-toggle-slim-border_pressed-hover",

                    classes.switch,
                )}
            />
        </div>
    );
};

interface ToggleProps extends AriaSwitchProps {
    size?: "sm" | "md";
    label?: string;
    hint?: ReactNode;
    slim?: boolean;
}

export const Toggle = ({ label, hint, className, size = "sm", slim, ...ariaSwitchProps }: ToggleProps) => {
    const sizes = {
        sm: {
            root: "tw:gap-2",
            textWrapper: "",
            label: "tw:text-sm tw:font-medium",
            hint: "tw:text-sm",
        },
        md: {
            root: "tw:gap-3",
            textWrapper: "tw:gap-0.5",
            label: "tw:text-md tw:font-medium",
            hint: "tw:text-md",
        },
    };

    return (
        <AriaSwitch
            {...ariaSwitchProps}
            className={(renderProps) =>
                cx(
                    "tw:flex tw:w-max tw:items-start",
                    renderProps.isDisabled && "tw:cursor-not-allowed",
                    sizes[size].root,
                    typeof className === "function" ? className(renderProps) : className,
                )
            }
        >
            {({ isSelected, isDisabled, isFocusVisible, isHovered }) => (
                <>
                    <ToggleBase
                        slim={slim}
                        size={size}
                        isHovered={isHovered}
                        isDisabled={isDisabled}
                        isFocusVisible={isFocusVisible}
                        isSelected={isSelected}
                        className={slim ? "tw:mt-0.5" : ""}
                    />

                    {(label || hint) && (
                        <div className={cx("tw:flex tw:flex-col", sizes[size].textWrapper)}>
                            {label && <p className={cx("tw:text-secondary tw:select-none", sizes[size].label)}>{label}</p>}
                            {hint && (
                                <span className={cx("tw:text-tertiary", sizes[size].hint)} onClick={(event) => event.stopPropagation()}>
                                    {hint}
                                </span>
                            )}
                        </div>
                    )}
                </>
            )}
        </AriaSwitch>
    );
};
