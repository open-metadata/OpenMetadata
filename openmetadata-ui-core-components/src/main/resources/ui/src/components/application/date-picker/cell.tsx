import { getDayOfWeek, getLocalTimeZone, isToday } from "@internationalized/date";
import type { CalendarCellProps as AriaCalendarCellProps } from "react-aria-components";
import { CalendarCell as AriaCalendarCell, RangeCalendarContext, useLocale, useSlottedContext } from "react-aria-components";
import { cx } from "@/utils/cx";

interface CalendarCellProps extends AriaCalendarCellProps {
    /** Whether the calendar is a range calendar. */
    isRangeCalendar?: boolean;
    /** Whether the cell is highlighted. */
    isHighlighted?: boolean;
}

export const CalendarCell = ({ date, isHighlighted, ...props }: CalendarCellProps) => {
    const { locale } = useLocale();
    const dayOfWeek = getDayOfWeek(date, locale);
    const rangeCalendarContext = useSlottedContext(RangeCalendarContext);

    const isRangeCalendar = !!rangeCalendarContext;

    const start = rangeCalendarContext?.value?.start;
    const end = rangeCalendarContext?.value?.end;

    const isAfterStart = start ? date.compare(start) > 0 : true;
    const isBeforeEnd = end ? date.compare(end) < 0 : true;

    const isAfterOrOnStart = start && date.compare(start) >= 0;
    const isBeforeOrOnEnd = end && date.compare(end) <= 0;
    const isInRange = isAfterOrOnStart && isBeforeOrOnEnd;

    const lastDayOfMonth = new Date(date.year, date.month, 0).getDate();
    const isLastDayOfMonth = date.day === lastDayOfMonth;
    const isFirstDayOfMonth = date.day === 1;

    const isTodayDate = isToday(date, getLocalTimeZone());

    return (
        <AriaCalendarCell
            {...props}
            date={date}
            className={({ isDisabled, isFocusVisible, isSelectionStart, isSelectionEnd, isSelected, isOutsideMonth }) => {
                const isRoundedLeft = isSelectionStart || dayOfWeek === 0;
                const isRoundedRight = isSelectionEnd || dayOfWeek === 6;

                return cx(
                    "tw:relative tw:size-10 tw:focus:outline-none",
                    isRoundedLeft && "tw:rounded-l-full",
                    isRoundedRight && "tw:rounded-r-full",
                    isInRange && isDisabled && "tw:bg-active",
                    isSelected && isRangeCalendar && "tw:bg-active",
                    isDisabled ? "tw:pointer-events-none" : "tw:cursor-pointer",
                    isFocusVisible ? "tw:z-10" : "tw:z-0",
                    isRangeCalendar && isOutsideMonth && "tw:hidden",

                    // Show gradient on last day of month if it's within the selected range.
                    isLastDayOfMonth &&
                        isSelected &&
                        isBeforeEnd &&
                        isRangeCalendar &&
                        "tw:after:absolute tw:after:inset-0 tw:after:translate-x-full tw:after:bg-gradient-to-l tw:after:from-transparent tw:after:to-bg-active tw:in-[[role=gridcell]:last-child]:after:hidden",

                    // Show gradient on first day of month if it's within the selected range.
                    isFirstDayOfMonth &&
                        isSelected &&
                        isAfterStart &&
                        isRangeCalendar &&
                        "tw:after:absolute tw:after:inset-0 tw:after:-translate-x-full tw:after:bg-gradient-to-r tw:after:from-transparent tw:after:to-bg-active tw:in-[[role=gridcell]:first-child]:after:hidden",
                );
            }}
        >
            {({ isDisabled, isFocusVisible, isSelectionStart, isSelectionEnd, isSelected, formattedDate }) => {
                const markedAsSelected = isSelectionStart || isSelectionEnd || (isSelected && !isDisabled && !isRangeCalendar);

                return (
                    <div
                        className={cx(
                            "tw:relative tw:flex tw:size-full tw:items-center tw:justify-center tw:rounded-full tw:text-sm",
                            // Disabled state.
                            isDisabled ? "tw:text-disabled" : "tw:text-secondary tw:hover:text-secondary_hover",
                            // Focus ring, visible while the cell has keyboard focus.
                            isFocusVisible ? "tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring" : "",
                            // Hover state for cells in the middle of the range.
                            isSelected && !isDisabled && isRangeCalendar ? "tw:font-medium" : "",
                            markedAsSelected && "tw:bg-brand-solid tw:font-medium tw:text-white tw:hover:bg-brand-solid_hover tw:hover:text-white",
                            // Hover state for non-selected cells.
                            !isSelected && !isDisabled ? "tw:hover:bg-primary_hover tw:hover:font-medium!" : "",
                            !isSelected && isTodayDate ? "tw:bg-active tw:font-medium tw:hover:bg-secondary_hover" : "",
                        )}
                    >
                        {formattedDate}

                        {(isHighlighted || isTodayDate) && (
                            <div
                                className={cx(
                                    "tw:absolute tw:bottom-1 tw:left-1/2 tw:size-1.25 tw:-translate-x-1/2 tw:rounded-full",
                                    isDisabled ? "tw:bg-fg-disabled" : markedAsSelected ? "tw:bg-fg-white" : "tw:bg-fg-brand-primary",
                                )}
                            />
                        )}
                    </div>
                );
            }}
        </AriaCalendarCell>
    );
};
