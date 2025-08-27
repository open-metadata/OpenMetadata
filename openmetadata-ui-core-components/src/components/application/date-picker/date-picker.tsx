import { getLocalTimeZone, today } from "@internationalized/date";
import { useControlledState } from "@react-stately/utils";
import { Calendar as CalendarIcon } from "@untitledui/icons";
import { useDateFormatter } from "react-aria";
import type { DatePickerProps as AriaDatePickerProps, DateValue } from "react-aria-components";
import { DatePicker as AriaDatePicker, Dialog as AriaDialog, Group as AriaGroup, Popover as AriaPopover } from "react-aria-components";
import { Button } from "@/components/base/buttons/button";
import { cx } from "@/utils/cx";
import { Calendar } from "./calendar";

const highlightedDates = [today(getLocalTimeZone())];

interface DatePickerProps extends AriaDatePickerProps<DateValue> {
    /** The function to call when the apply button is clicked. */
    onApply?: () => void;
    /** The function to call when the cancel button is clicked. */
    onCancel?: () => void;
}

export const DatePicker = ({ value: valueProp, defaultValue, onChange, onApply, onCancel, ...props }: DatePickerProps) => {
    const formatter = useDateFormatter({
        month: "short",
        day: "numeric",
        year: "numeric",
    });
    const [value, setValue] = useControlledState(valueProp, defaultValue || null, onChange);

    const formattedDate = value ? formatter.format(value.toDate(getLocalTimeZone())) : "Select date";

    return (
        <AriaDatePicker shouldCloseOnSelect={false} {...props} value={value} onChange={setValue}>
            <AriaGroup>
                <Button size="md" color="secondary" iconLeading={CalendarIcon}>
                    {formattedDate}
                </Button>
            </AriaGroup>
            <AriaPopover
                offset={8}
                placement="bottom right"
                className={({ isEntering, isExiting }) =>
                    cx(
                        "origin-(--trigger-anchor-point) will-change-transform",
                        isEntering &&
                            "duration-150 ease-out animate-in fade-in placement-right:slide-in-from-left-0.5 placement-top:slide-in-from-bottom-0.5 placement-bottom:slide-in-from-top-0.5",
                        isExiting &&
                            "duration-100 ease-in animate-out fade-out placement-right:slide-out-to-left-0.5 placement-top:slide-out-to-bottom-0.5 placement-bottom:slide-out-to-top-0.5",
                    )
                }
            >
                <AriaDialog className="rounded-2xl bg-primary shadow-xl ring ring-secondary_alt">
                    {({ close }) => (
                        <>
                            <div className="flex px-6 py-5">
                                <Calendar highlightedDates={highlightedDates} />
                            </div>
                            <div className="grid grid-cols-2 gap-3 border-t border-secondary p-4">
                                <Button
                                    size="md"
                                    color="secondary"
                                    onClick={() => {
                                        onCancel?.();
                                        close();
                                    }}
                                >
                                    Cancel
                                </Button>
                                <Button
                                    size="md"
                                    color="primary"
                                    onClick={() => {
                                        onApply?.();
                                        close();
                                    }}
                                >
                                    Apply
                                </Button>
                            </div>
                        </>
                    )}
                </AriaDialog>
            </AriaPopover>
        </AriaDatePicker>
    );
};
