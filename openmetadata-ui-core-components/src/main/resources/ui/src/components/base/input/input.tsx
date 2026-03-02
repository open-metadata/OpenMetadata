import { type ComponentType, type HTMLAttributes, type ReactNode, type Ref, createContext, useContext } from "react";
import { HelpCircle, InfoCircle } from "@untitledui/icons";
import type { InputProps as AriaInputProps, TextFieldProps as AriaTextFieldProps } from "react-aria-components";
import { Group as AriaGroup, Input as AriaInput, TextField as AriaTextField } from "react-aria-components";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { Tooltip, TooltipTrigger } from "@/components/base/tooltip/tooltip";
import { cx, sortCx } from "@/utils/cx";

export interface InputBaseProps extends TextFieldProps {
    /** Tooltip message on hover. */
    tooltip?: string;
    /**
     * Input size.
     * @default "sm"
     */
    size?: "sm" | "md";
    /** Placeholder text. */
    placeholder?: string;
    /** Class name for the icon. */
    iconClassName?: string;
    /** Class name for the input. */
    inputClassName?: string;
    /** Class name for the input wrapper. */
    wrapperClassName?: string;
    /** Class name for the tooltip. */
    tooltipClassName?: string;
    /** Keyboard shortcut to display. */
    shortcut?: string | boolean;
    ref?: Ref<HTMLInputElement>;
    groupRef?: Ref<HTMLDivElement>;
    /** Icon component to display on the left side of the input. */
    icon?: ComponentType<HTMLAttributes<HTMLOrSVGElement>>;
}

export const InputBase = ({
    ref,
    tooltip,
    shortcut,
    groupRef,
    size = "sm",
    isInvalid,
    isDisabled,
    icon: Icon,
    placeholder,
    wrapperClassName,
    tooltipClassName,
    inputClassName,
    iconClassName,
    // Omit this prop to avoid invalid HTML attribute warning
    isRequired: _isRequired,
    ...inputProps
}: Omit<InputBaseProps, "label" | "hint">) => {
    // Check if the input has a leading icon or tooltip
    const hasTrailingIcon = tooltip || isInvalid;
    const hasLeadingIcon = Icon;

    // If the input is inside a `TextFieldContext`, use its context to simplify applying styles
    const context = useContext(TextFieldContext);

    const inputSize = context?.size || size;

    const sizes = sortCx({
        sm: {
            root: cx("tw:px-3 tw:py-2", hasTrailingIcon && "tw:pr-9", hasLeadingIcon && "tw:pl-10"),
            iconLeading: "tw:left-3",
            iconTrailing: "tw:right-3",
            shortcut: "tw:pr-2.5",
        },
        md: {
            root: cx("tw:px-3.5 tw:py-2.5", hasTrailingIcon && "tw:pr-9.5", hasLeadingIcon && "tw:pl-10.5"),
            iconLeading: "tw:left-3.5",
            iconTrailing: "tw:right-3.5",
            shortcut: "tw:pr-3",
        },
    });

    return (
        <AriaGroup
            {...{ isDisabled, isInvalid }}
            ref={groupRef}
            className={({ isFocusWithin, isDisabled, isInvalid }) =>
                cx(
                    "tw:relative tw:flex tw:w-full tw:flex-row tw:place-content-center tw:place-items-center tw:rounded-lg tw:bg-primary tw:shadow-xs tw:ring-1 tw:ring-primary tw:transition-shadow tw:duration-100 tw:ease-linear tw:ring-inset",

                    isFocusWithin && !isDisabled && "tw:ring-2 tw:ring-brand",

                    // Disabled state styles
                    isDisabled && "tw:cursor-not-allowed tw:bg-disabled_subtle tw:ring-disabled",
                    "tw:group-disabled:cursor-not-allowed tw:group-disabled:bg-disabled_subtle tw:group-disabled:ring-disabled",

                    // Invalid state styles
                    isInvalid && "tw:ring-error_subtle",
                    "tw:group-invalid:ring-error_subtle",

                    // Invalid state with focus-within styles
                    isInvalid && isFocusWithin && "tw:ring-2 tw:ring-error",
                    isFocusWithin && "tw:group-invalid:ring-2 tw:group-invalid:ring-error",

                    context?.wrapperClassName,
                    wrapperClassName,
                )
            }
        >
            {/* Leading icon and Payment icon */}
            {Icon && (
                <Icon
                    className={cx(
                        "tw:pointer-events-none tw:absolute tw:size-5 tw:text-fg-quaternary",
                        isDisabled && "tw:text-fg-disabled",
                        sizes[inputSize].iconLeading,
                        context?.iconClassName,
                        iconClassName,
                    )}
                />
            )}

            {/* Input field */}
            <AriaInput
                {...(inputProps as AriaInputProps)}
                ref={ref}
                placeholder={placeholder}
                className={cx(
                    "tw:m-0 tw:w-full tw:bg-transparent tw:text-md tw:text-primary tw:ring-0 tw:outline-hidden tw:placeholder:text-placeholder tw:autofill:rounded-lg tw:autofill:text-primary",
                    isDisabled && "tw:cursor-not-allowed tw:text-disabled",
                    sizes[inputSize].root,
                    context?.inputClassName,
                    inputClassName,
                )}
            />

            {/* Tooltip and help icon */}
            {tooltip && !isInvalid && (
                <Tooltip title={tooltip} placement="top">
                    <TooltipTrigger
                        className={cx(
                            "tw:absolute tw:cursor-pointer tw:text-fg-quaternary tw:transition tw:duration-200 tw:hover:text-fg-quaternary_hover tw:focus:text-fg-quaternary_hover",
                            sizes[inputSize].iconTrailing,
                            context?.tooltipClassName,
                            tooltipClassName,
                        )}
                    >
                        <HelpCircle className="tw:size-4" />
                    </TooltipTrigger>
                </Tooltip>
            )}

            {/* Invalid icon */}
            {isInvalid && (
                <InfoCircle
                    className={cx(
                        "tw:pointer-events-none tw:absolute tw:size-4 tw:text-fg-error-secondary",
                        sizes[inputSize].iconTrailing,
                        context?.tooltipClassName,
                        tooltipClassName,
                    )}
                />
            )}

            {/* Shortcut */}
            {shortcut && (
                <div
                    className={cx(
                        "tw:pointer-events-none tw:absolute tw:inset-y-0.5 tw:right-0.5 tw:z-10 tw:flex tw:items-center tw:rounded-r-[inherit] tw:bg-linear-to-r tw:from-transparent tw:to-bg-primary tw:to-40% tw:pl-8",
                        sizes[inputSize].shortcut,
                    )}
                >
                    <span
                        className={cx(
                            "tw:pointer-events-none tw:rounded tw:px-1 tw:py-px tw:text-xs tw:font-medium tw:text-quaternary tw:ring-1 tw:ring-secondary tw:select-none tw:ring-inset",
                            isDisabled && "tw:bg-transparent tw:text-disabled",
                        )}
                        aria-hidden="true"
                    >
                        {typeof shortcut === "string" ? shortcut : "⌘K"}
                    </span>
                </div>
            )}
        </AriaGroup>
    );
};

InputBase.displayName = "InputBase";

interface BaseProps {
    /** Label text for the input */
    label?: string;
    /** Helper text displayed below the input */
    hint?: ReactNode;
}

interface TextFieldProps
    extends BaseProps,
        AriaTextFieldProps,
        Pick<InputBaseProps, "size" | "wrapperClassName" | "inputClassName" | "iconClassName" | "tooltipClassName"> {
    ref?: Ref<HTMLDivElement>;
}

const TextFieldContext = createContext<TextFieldProps>({});

export const TextField = ({ className, ...props }: TextFieldProps) => {
    return (
        <TextFieldContext.Provider value={props}>
            <AriaTextField
                {...props}
                data-input-wrapper
                className={(state) =>
                    cx("tw:group tw:flex tw:h-max tw:w-full tw:flex-col tw:items-start tw:justify-start tw:gap-1.5", typeof className === "function" ? className(state) : className)
                }
            />
        </TextFieldContext.Provider>
    );
};

TextField.displayName = "TextField";

interface InputProps extends InputBaseProps, BaseProps {
    /** Whether to hide required indicator from label */
    hideRequiredIndicator?: boolean;
}

export const Input = ({
    size = "sm",
    placeholder,
    icon: Icon,
    label,
    hint,
    shortcut,
    hideRequiredIndicator,
    className,
    ref,
    groupRef,
    tooltip,
    iconClassName,
    inputClassName,
    wrapperClassName,
    tooltipClassName,
    ...props
}: InputProps) => {
    return (
        <TextField aria-label={!label ? placeholder : undefined} {...props} className={className}>
            {({ isRequired, isInvalid }) => (
                <>
                    {label && <Label isRequired={hideRequiredIndicator ? !hideRequiredIndicator : isRequired}>{label}</Label>}

                    <InputBase
                        {...{
                            ref,
                            groupRef,
                            size,
                            placeholder,
                            icon: Icon,
                            shortcut,
                            iconClassName,
                            inputClassName,
                            wrapperClassName,
                            tooltipClassName,
                            tooltip,
                        }}
                    />

                    {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
                </>
            )}
        </TextField>
    );
};

Input.displayName = "Input";
