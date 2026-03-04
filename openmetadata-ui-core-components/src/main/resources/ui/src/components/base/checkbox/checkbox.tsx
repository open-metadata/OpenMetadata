import type { ReactNode, Ref } from "react";
import { Checkbox as AriaCheckbox, type CheckboxProps as AriaCheckboxProps } from "react-aria-components";
import { cx } from "@/utils/cx";

export interface CheckboxBaseProps {
    size?: "sm" | "md";
    className?: string;
    isFocusVisible?: boolean;
    isSelected?: boolean;
    isDisabled?: boolean;
    isIndeterminate?: boolean;
}

export const CheckboxBase = ({ className, isSelected, isDisabled, isIndeterminate, size = "sm", isFocusVisible = false }: CheckboxBaseProps) => {
    return (
        <div
            className={cx(
                "tw:relative tw:flex tw:size-4 tw:shrink-0 tw:cursor-pointer tw:appearance-none tw:items-center tw:justify-center tw:rounded tw:bg-primary tw:ring-1 tw:ring-primary tw:ring-inset",
                size === "md" && "tw:size-5 tw:rounded-md",
                (isSelected || isIndeterminate) && "tw:bg-brand-solid tw:ring-bg-brand-solid",
                isDisabled && "tw:cursor-not-allowed tw:bg-disabled_subtle tw:ring-disabled",
                isFocusVisible && "tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring",
                className,
            )}
        >
            <svg
                aria-hidden="true"
                viewBox="0 0 14 14"
                fill="none"
                className={cx(
                    "tw:pointer-events-none tw:absolute tw:h-3 tw:w-2.5 tw:text-fg-white tw:opacity-0 tw:transition-inherit-all",
                    size === "md" && "tw:size-3.5",
                    isIndeterminate && "tw:opacity-100",
                    isDisabled && "tw:text-fg-disabled_subtle",
                )}
            >
                <path d="M2.91675 7H11.0834" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>

            <svg
                aria-hidden="true"
                viewBox="0 0 14 14"
                fill="none"
                className={cx(
                    "tw:pointer-events-none tw:absolute tw:size-3 tw:text-fg-white tw:opacity-0 tw:transition-inherit-all",
                    size === "md" && "tw:size-3.5",
                    isSelected && !isIndeterminate && "tw:opacity-100",
                    isDisabled && "tw:text-fg-disabled_subtle",
                )}
            >
                <path d="M11.6666 3.5L5.24992 9.91667L2.33325 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>
    );
};
CheckboxBase.displayName = "CheckboxBase";

interface CheckboxProps extends AriaCheckboxProps {
    ref?: Ref<HTMLLabelElement>;
    size?: "sm" | "md";
    label?: ReactNode;
    hint?: ReactNode;
}

export const Checkbox = ({ label, hint, size = "sm", className, ...ariaCheckboxProps }: CheckboxProps) => {
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
        <AriaCheckbox
            {...ariaCheckboxProps}
            className={(state) =>
                cx(
                    "tw:flex tw:items-start",
                    state.isDisabled && "tw:cursor-not-allowed",
                    sizes[size].root,
                    typeof className === "function" ? className(state) : className,
                )
            }
        >
            {({ isSelected, isIndeterminate, isDisabled, isFocusVisible }) => (
                <>
                    <CheckboxBase
                        size={size}
                        isSelected={isSelected}
                        isIndeterminate={isIndeterminate}
                        isDisabled={isDisabled}
                        isFocusVisible={isFocusVisible}
                        className={label || hint ? "tw:mt-0.5" : ""}
                    />
                    {(label || hint) && (
                        <div className={cx("tw:inline-flex tw:flex-col", sizes[size].textWrapper)}>
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
        </AriaCheckbox>
    );
};
Checkbox.displayName = "Checkbox";
