import { type ReactNode, type Ref, createContext, useContext } from "react";
import {
    Radio as AriaRadio,
    RadioGroup as AriaRadioGroup,
    type RadioGroupProps as AriaRadioGroupProps,
    type RadioProps as AriaRadioProps,
} from "react-aria-components";
import { cx } from "@/utils/cx";

export interface RadioGroupContextType {
    size?: "sm" | "md";
}

const RadioGroupContext = createContext<RadioGroupContextType | null>(null);

export interface RadioButtonBaseProps {
    size?: "sm" | "md";
    className?: string;
    isFocusVisible?: boolean;
    isSelected?: boolean;
    isDisabled?: boolean;
}

export const RadioButtonBase = ({ className, isFocusVisible, isSelected, isDisabled, size = "sm" }: RadioButtonBaseProps) => {
    return (
        <div
            className={cx(
                "tw:flex tw:size-4 tw:min-h-4 tw:min-w-4 tw:cursor-pointer tw:appearance-none tw:items-center tw:justify-center tw:rounded-full tw:bg-primary tw:ring-1 tw:ring-primary tw:ring-inset",
                size === "md" && "tw:size-5 tw:min-h-5 tw:min-w-5",
                isSelected && !isDisabled && "tw:bg-brand-solid tw:ring-bg-brand-solid",
                isDisabled && "tw:cursor-not-allowed tw:border-disabled tw:bg-disabled_subtle",
                isFocusVisible && "tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring",
                className,
            )}
        >
            <div
                className={cx(
                    "tw:size-1.5 tw:rounded-full tw:bg-fg-white tw:opacity-0 tw:transition-inherit-all",
                    size === "md" && "tw:size-2",
                    isDisabled && "tw:bg-fg-disabled_subtle",
                    isSelected && "tw:opacity-100",
                )}
            />
        </div>
    );
};
RadioButtonBase.displayName = "RadioButtonBase";

interface RadioButtonProps extends AriaRadioProps {
    size?: "sm" | "md";
    label?: ReactNode;
    hint?: ReactNode;
    ref?: Ref<HTMLLabelElement>;
}

export const RadioButton = ({ label, hint, className, size = "sm", ...ariaRadioProps }: RadioButtonProps) => {
    const context = useContext(RadioGroupContext);

    size = context?.size ?? size;

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
        <AriaRadio
            {...ariaRadioProps}
            className={(renderProps) =>
                cx(
                    "tw:flex tw:items-start",
                    renderProps.isDisabled && "tw:cursor-not-allowed",
                    sizes[size].root,
                    typeof className === "function" ? className(renderProps) : className,
                )
            }
        >
            {({ isSelected, isDisabled, isFocusVisible }) => (
                <>
                    <RadioButtonBase
                        size={size}
                        isSelected={isSelected}
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
        </AriaRadio>
    );
};
RadioButton.displayName = "RadioButton";

interface RadioGroupProps extends RadioGroupContextType, AriaRadioGroupProps {
    children: ReactNode;
    className?: string;
}

export const RadioGroup = ({ children, className, size = "sm", ...props }: RadioGroupProps) => {
    return (
        <RadioGroupContext.Provider value={{ size }}>
            <AriaRadioGroup {...props} className={cx("tw:flex tw:flex-col tw:gap-4", className)}>
                {children}
            </AriaRadioGroup>
        </RadioGroupContext.Provider>
    );
};
