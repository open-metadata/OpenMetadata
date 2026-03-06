import type { DateInputProps as AriaDateInputProps } from "react-aria-components";
import { DateInput as AriaDateInput, DateSegment as AriaDateSegment } from "react-aria-components";
import { cx } from "@/utils/cx";

interface DateInputProps extends Omit<AriaDateInputProps, "children"> {}

export const DateInput = (props: DateInputProps) => {
    return (
        <AriaDateInput
            {...props}
            className={cx(
                "tw:flex tw:rounded-lg tw:bg-primary tw:px-2.5 tw:py-2 tw:text-md tw:shadow-xs tw:ring-1 tw:ring-primary tw:ring-inset tw:focus-within:ring-2 tw:focus-within:ring-brand",
                typeof props.className === "string" && props.className,
            )}
        >
            {(segment) => (
                <AriaDateSegment
                    segment={segment}
                    className={cx(
                        "tw:rounded tw:px-0.5 tw:text-primary tw:tabular-nums tw:caret-transparent tw:focus:bg-brand-solid tw:focus:font-medium tw:focus:text-white tw:focus:outline-hidden",
                        // The placeholder segment.
                        segment.isPlaceholder && "tw:text-placeholder tw:uppercase",
                        // The separator "/" segment.
                        segment.type === "literal" && "tw:text-fg-quaternary",
                    )}
                />
            )}
        </AriaDateInput>
    );
};
