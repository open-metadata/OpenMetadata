import { type HTMLAttributes } from "react";
import { type DateValue, RangeCalendarContext, useSlottedContext } from "react-aria-components";
import { cx } from "@/utils/cx";

interface RangePresetButtonProps extends HTMLAttributes<HTMLButtonElement> {
    value: { start: DateValue; end: DateValue };
}

export const RangePresetButton = ({ value, className, children, ...props }: RangePresetButtonProps) => {
    const context = useSlottedContext(RangeCalendarContext);

    const isSelected = context?.value?.start?.compare(value.start) === 0 && context?.value?.end?.compare(value.end) === 0;

    return (
        <button
            {...props}
            className={cx(
                "tw:cursor-pointer tw:rounded-md tw:px-3 tw:py-2 tw:text-left tw:text-sm tw:font-medium tw:outline-focus-ring tw:transition tw:duration-100 tw:ease-linear tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2",
                isSelected ? "tw:bg-active tw:text-secondary_hover tw:hover:bg-secondary_hover" : "tw:text-secondary tw:hover:bg-primary_hover tw:hover:text-secondary_hover",
                className,
            )}
        >
            {children}
        </button>
    );
};
