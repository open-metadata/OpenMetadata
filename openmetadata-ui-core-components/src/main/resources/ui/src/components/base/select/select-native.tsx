import { type SelectHTMLAttributes, useId } from "react";
import { ChevronDown } from "@untitledui/icons";
import { HintText } from "@/components/base/input/hint-text";
import { Label } from "@/components/base/input/label";
import { cx } from "@/utils/cx";

interface NativeSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    hint?: string;
    selectClassName?: string;
    options: { label: string; value: string; disabled?: boolean }[];
}

export const NativeSelect = ({ label, hint, options, className, selectClassName, ...props }: NativeSelectProps) => {
    const id = useId();
    const selectId = `select-native-${id}`;
    const hintId = `select-native-hint-${id}`;

    return (
        <div className={cx("tw:w-full tw:in-data-input-wrapper:w-max", className)}>
            {label && (
                <Label htmlFor={selectId} id={selectId} className="tw:mb-1.5">
                    {label}
                </Label>
            )}

            <div className="tw:relative tw:grid tw:w-full tw:items-center">
                <select
                    {...props}
                    id={selectId}
                    aria-describedby={hintId}
                    aria-labelledby={selectId}
                    className={cx(
                        "tw:appearance-none tw:rounded-lg tw:bg-primary tw:px-3.5 tw:py-2.5 tw:text-md tw:font-medium tw:text-primary tw:shadow-xs tw:ring-1 tw:ring-primary tw:outline-hidden tw:transition tw:duration-100 tw:ease-linear tw:ring-inset tw:placeholder:text-fg-quaternary tw:focus-visible:ring-2 tw:focus-visible:ring-brand tw:disabled:cursor-not-allowed tw:disabled:bg-disabled_subtle tw:disabled:text-disabled",
                        // Styles when the select is within an `InputGroup`
                        "tw:in-data-input-wrapper:flex tw:in-data-input-wrapper:h-full tw:in-data-input-wrapper:gap-1 tw:in-data-input-wrapper:bg-inherit tw:in-data-input-wrapper:px-3 tw:in-data-input-wrapper:py-2 tw:in-data-input-wrapper:font-normal tw:in-data-input-wrapper:text-tertiary tw:in-data-input-wrapper:shadow-none tw:in-data-input-wrapper:ring-transparent",
                        // Styles for the select when `TextField` is disabled
                        "tw:in-data-input-wrapper:group-disabled:pointer-events-none tw:in-data-input-wrapper:group-disabled:cursor-not-allowed tw:in-data-input-wrapper:group-disabled:bg-transparent tw:in-data-input-wrapper:group-disabled:text-disabled",
                        // Common styles for sizes and border radius within `InputGroup`
                        "tw:in-data-input-wrapper:in-data-leading:rounded-r-none tw:in-data-input-wrapper:in-data-trailing:rounded-l-none tw:in-data-input-wrapper:in-data-[input-size=md]:py-2.5 tw:in-data-input-wrapper:in-data-leading:in-data-[input-size=md]:pl-3.5 tw:in-data-input-wrapper:in-data-[input-size=sm]:py-2 tw:in-data-input-wrapper:in-data-[input-size=sm]:pl-3",
                        // For "leading" dropdown within `InputGroup`
                        "tw:in-data-input-wrapper:in-data-leading:in-data-[input-size=md]:pr-4.5 tw:in-data-input-wrapper:in-data-leading:in-data-[input-size=sm]:pr-4.5",
                        // For "trailing" dropdown within `InputGroup`
                        "tw:in-data-input-wrapper:in-data-trailing:in-data-[input-size=md]:pr-8 tw:in-data-input-wrapper:in-data-trailing:in-data-[input-size=sm]:pr-7.5",
                        selectClassName,
                    )}
                >
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                            {opt.label}
                        </option>
                    ))}
                </select>
                <ChevronDown
                    aria-hidden="true"
                    className="tw:pointer-events-none tw:absolute tw:right-3.5 tw:size-5 tw:text-fg-quaternary tw:in-data-input-wrapper:right-0 tw:in-data-input-wrapper:size-4 tw:in-data-input-wrapper:stroke-[2.625px] tw:in-data-input-wrapper:in-data-trailing:in-data-[input-size=sm]:right-3"
                />
            </div>

            {hint && (
                <HintText className="tw:mt-2" id={hintId}>
                    {hint}
                </HintText>
            )}
        </div>
    );
};
