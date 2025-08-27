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
            "flex text-md text-tertiary shadow-xs ring-1 ring-border-primary ring-inset",
            // Styles when the prefix is within an `InputGroup`
            "in-data-input-wrapper:in-data-leading:-mr-px in-data-input-wrapper:in-data-leading:rounded-l-lg",
            "in-data-input-wrapper:in-data-trailing:-ml-px in-data-input-wrapper:in-data-trailing:rounded-r-lg",
            // Size styles based on size when within an `InputGroup`
            "in-data-input-wrapper:in-data-[input-size=md]:py-2.5 in-data-input-wrapper:in-data-[input-size=md]:pr-3 in-data-input-wrapper:in-data-[input-size=md]:pl-3.5 in-data-input-wrapper:in-data-[input-size=sm]:px-3 in-data-input-wrapper:in-data-[input-size=sm]:py-2",
            // Disabled styles
            isDisabled && "border-disabled bg-disabled_subtle text-tertiary",
            "in-data-input-wrapper:group-disabled:bg-disabled_subtle in-data-input-wrapper:group-disabled:text-disabled in-data-input-wrapper:group-disabled:ring-border-disabled",

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
                hasLeading && "group-has-[&>select]:px-2.5 group-has-[&>select]:pl-2.5",
                hasTrailing && (prefix ? "group-has-[&>select]:pr-6 group-has-[&>select]:pl-0" : "group-has-[&>select]:pr-6 group-has-[&>select]:pl-3"),
            ),
            leadingText: "pl-3",
        },
        md: {
            input: cx(
                // Apply padding styles when select element is passed as a child
                hasLeading && "group-has-[&>select]:px-3 group-has-[&>select]:pl-3",
                hasTrailing && (prefix ? "group-has-[&>select]:pr-6 group-has-[&>select]:pl-0" : "group-has-[&>select]:pr-6 group-has-[&>select]:pl-3"),
            ),
            leadingText: "pl-3.5",
        },
    });

    return (
        <TextField
            size={size}
            aria-label={label || undefined}
            inputClassName={cx(paddings[size].input)}
            tooltipClassName={cx(hasTrailing && !hasLeading && "group-has-[&>select]:right-0")}
            wrapperClassName={cx(
                "z-10",
                // Apply styles based on the presence of leading or trailing elements
                hasLeading && "rounded-l-none",
                hasTrailing && "rounded-r-none",
                // When select element is passed as a child
                "group-has-[&>select]:bg-transparent group-has-[&>select]:shadow-none group-has-[&>select]:ring-0 group-has-[&>select]:focus-within:ring-0",
                // In `Input` component, there is "group-disabled" class so here we need to use "group-disabled:group-has-[&>select]" to avoid conflict
                "group-disabled:group-has-[&>select]:bg-transparent",
            )}
            {...props}
        >
            {({ isDisabled, isInvalid, isRequired }) => (
                <>
                    {label && <Label isRequired={isRequired}>{label}</Label>}

                    <div
                        data-input-size={size}
                        className={cx(
                            "group relative flex h-max w-full flex-row justify-center rounded-lg bg-primary transition-all duration-100 ease-linear",

                            // Only apply focus ring when child is select and input is focused
                            "has-[&>select]:shadow-xs has-[&>select]:ring-1 has-[&>select]:ring-border-primary has-[&>select]:ring-inset has-[&>select]:has-[input:focus]:ring-2 has-[&>select]:has-[input:focus]:ring-border-brand",

                            isDisabled && "cursor-not-allowed has-[&>select]:bg-disabled_subtle has-[&>select]:ring-border-disabled",
                            isInvalid && "has-[&>select]:ring-border-error_subtle has-[&>select]:has-[input:focus]:ring-border-error",
                        )}
                    >
                        {leadingAddon && <section data-leading={hasLeading || undefined}>{leadingAddon}</section>}

                        {prefix && (
                            <span className={cx("my-auto grow pr-2", paddings[size].leadingText)}>
                                <p className={cx("text-md text-tertiary", isDisabled && "text-disabled")}>{prefix}</p>
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
