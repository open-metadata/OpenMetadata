import { type HTMLAttributes, type ReactNode } from "react";
import { HintText } from "@/components/base/input/hint-text";
import type { InputBaseProps } from "@/components/base/input/input";
import { TextField } from "@/components/base/input/input";
import { Label } from "@/components/base/input/label";
import { cx, sortCx } from "@/utils/cx";

interface InputPrefixProps extends HTMLAttributes<HTMLDivElement> {
    /** The position of the prefix. */
    position?: "leading" | "trailing";
    /** The size of the prefix. */
    size?: "sm" | "md";
    /** Indicates that the prefix is disabled. */
    isDisabled?: boolean;
}

export const InputPrefix = ({ isDisabled, children, ...props }: InputPrefixProps) => (
    <span
        {...props}
        className={cx(
            "tw:flex tw:text-md tw:text-tertiary tw:shadow-xs tw:ring-1 tw:ring-border-primary tw:ring-inset",
            // Styles when the prefix is within an `InputGroup`
            "tw:in-data-input-wrapper:in-data-leading:-mr-px tw:in-data-input-wrapper:in-data-leading:rounded-l-lg",
            "tw:in-data-input-wrapper:in-data-trailing:-ml-px tw:in-data-input-wrapper:in-data-trailing:rounded-r-lg",
            // Size styles based on size when within an `InputGroup`
            "tw:in-data-input-wrapper:in-data-[input-size=md]:py-2.5 tw:in-data-input-wrapper:in-data-[input-size=md]:pr-3 tw:in-data-input-wrapper:in-data-[input-size=md]:pl-3.5 tw:in-data-input-wrapper:in-data-[input-size=sm]:px-3 tw:in-data-input-wrapper:in-data-[input-size=sm]:py-2",
            // Disabled styles
            isDisabled && "tw:border-disabled tw:bg-disabled_subtle tw:text-tertiary",
            "tw:in-data-input-wrapper:group-disabled:bg-disabled_subtle tw:in-data-input-wrapper:group-disabled:text-disabled tw:in-data-input-wrapper:group-disabled:ring-border-disabled",

            props.className,
        )}
    >
        {children}
    </span>
);

// `${string}ClassName` is used to omit any className prop that ends with a `ClassName` suffix
interface InputGroupProps extends Omit<InputBaseProps, "type" | "icon" | "placeholder" | "tooltip" | "shortcut" | `${string}ClassName`> {
    /** A prefix text that is displayed in the same box as the input.*/
    prefix?: string;
    /** A leading addon that is displayed with visual separation from the input. */
    leadingAddon?: ReactNode;
    /** A trailing addon that is displayed with visual separation from the input. */
    trailingAddon?: ReactNode;
    /** The class name to apply to the input group. */
    className?: string;
    /** The children of the input group (i.e `<InputBase />`) */
    children: ReactNode;
}

export const InputGroup = ({ size = "sm", prefix, leadingAddon, trailingAddon, label, hint, children, ...props }: InputGroupProps) => {
    const hasLeading = !!leadingAddon;
    const hasTrailing = !!trailingAddon;

    const paddings = sortCx({
        sm: {
            input: cx(
                // Apply padding styles when select element is passed as a child
                hasLeading && "tw:group-has-[&>select]:px-2.5 tw:group-has-[&>select]:pl-2.5",
                hasTrailing && (prefix ? "tw:group-has-[&>select]:pr-6 tw:group-has-[&>select]:pl-0" : "tw:group-has-[&>select]:pr-6 tw:group-has-[&>select]:pl-3"),
            ),
            leadingText: "tw:pl-3",
        },
        md: {
            input: cx(
                // Apply padding styles when select element is passed as a child
                hasLeading && "tw:group-has-[&>select]:px-3 tw:group-has-[&>select]:pl-3",
                hasTrailing && (prefix ? "tw:group-has-[&>select]:pr-6 tw:group-has-[&>select]:pl-0" : "tw:group-has-[&>select]:pr-6 tw:group-has-[&>select]:pl-3"),
            ),
            leadingText: "tw:pl-3.5",
        },
    });

    return (
        <TextField
            size={size}
            aria-label={label || undefined}
            inputClassName={cx(paddings[size].input)}
            tooltipClassName={cx(hasTrailing && !hasLeading && "tw:group-has-[&>select]:right-0")}
            wrapperClassName={cx(
                "tw:z-10",
                // Apply styles based on the presence of leading or trailing elements
                hasLeading && "tw:rounded-l-none",
                hasTrailing && "tw:rounded-r-none",
                // When select element is passed as a child
                "tw:group-has-[&>select]:bg-transparent tw:group-has-[&>select]:shadow-none tw:group-has-[&>select]:ring-0 tw:group-has-[&>select]:focus-within:ring-0",
                // In `Input` component, there is "group-disabled" class so here we need to use "group-disabled:group-has-[&>select]" to avoid conflict
                "tw:group-disabled:group-has-[&>select]:bg-transparent",
            )}
            {...props}
        >
            {({ isDisabled, isInvalid, isRequired }) => (
                <>
                    {label && <Label isRequired={isRequired}>{label}</Label>}

                    <div
                        data-input-size={size}
                        className={cx(
                            "tw:group tw:relative tw:flex tw:h-max tw:w-full tw:flex-row tw:justify-center tw:rounded-lg tw:bg-primary tw:transition-all tw:duration-100 tw:ease-linear",

                            // Only apply focus ring when child is select and input is focused
                            "tw:has-[&>select]:shadow-xs tw:has-[&>select]:ring-1 tw:has-[&>select]:ring-border-primary tw:has-[&>select]:ring-inset tw:has-[&>select]:has-[input:focus]:ring-2 tw:has-[&>select]:has-[input:focus]:ring-border-brand",

                            isDisabled && "tw:cursor-not-allowed tw:has-[&>select]:bg-disabled_subtle tw:has-[&>select]:ring-border-disabled",
                            isInvalid && "tw:has-[&>select]:ring-border-error_subtle tw:has-[&>select]:has-[input:focus]:ring-border-error",
                        )}
                    >
                        {leadingAddon && <section data-leading={hasLeading || undefined}>{leadingAddon}</section>}

                        {prefix && (
                            <span className={cx("tw:my-auto tw:grow tw:pr-2", paddings[size].leadingText)}>
                                <p className={cx("tw:text-md tw:text-tertiary", isDisabled && "tw:text-disabled")}>{prefix}</p>
                            </span>
                        )}

                        {children}

                        {trailingAddon && <section data-trailing={hasTrailing || undefined}>{trailingAddon}</section>}
                    </div>

                    {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
                </>
            )}
        </TextField>
    );
};

InputGroup.Prefix = InputPrefix;

InputGroup.displayName = "InputGroup";
