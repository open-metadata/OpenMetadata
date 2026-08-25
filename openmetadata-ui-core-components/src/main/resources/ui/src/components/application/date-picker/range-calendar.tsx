import type { HTMLAttributes, PropsWithChildren } from 'react';
import { Fragment, useContext, useState } from 'react';
import type { CalendarDate } from '@internationalized/date';
import { ChevronLeft, ChevronRight } from '@untitledui/icons';
import { useDateFormatter } from 'react-aria';
import type {
  RangeCalendarProps as AriaRangeCalendarProps,
  DateValue,
} from 'react-aria-components';
import {
  CalendarGrid as AriaCalendarGrid,
  CalendarGridBody as AriaCalendarGridBody,
  CalendarGridHeader as AriaCalendarGridHeader,
  CalendarHeaderCell as AriaCalendarHeaderCell,
  RangeCalendar as AriaRangeCalendar,
  RangeCalendarContext,
  RangeCalendarStateContext,
  useSlottedContext,
} from 'react-aria-components';
import { Button } from '@/components/base/buttons/button';
import { useBreakpoint } from '@/hooks/use-breakpoint';
import { CalendarCell } from './cell';
import { DateInput } from './date-input';

export const RangeCalendarContextProvider = ({
  children,
}: PropsWithChildren) => {
  const [value, onChange] = useState<{
    start: DateValue;
    end: DateValue;
  } | null>(null);
  const [focusedValue, onFocusChange] = useState<DateValue | undefined>();

  return (
    <RangeCalendarContext.Provider
      value={{ value, onChange, focusedValue, onFocusChange }}>
      {children}
    </RangeCalendarContext.Provider>
  );
};

const RangeCalendarTitle = ({ part }: { part: 'start' | 'end' }) => {
  const context = useContext(RangeCalendarStateContext);

  if (!context) {
    throw new Error(
      '<RangeCalendarTitle /> must be used within a <RangeCalendar /> component.'
    );
  }

  const formatter = useDateFormatter({
    month: 'long',
    year: 'numeric',
    calendar: context.visibleRange.start.calendar.identifier,
    timeZone: context.timeZone,
  });

  const text =
    part === 'start'
      ? formatter.format(context.visibleRange.start.toDate(context.timeZone))
      : formatter.format(context.visibleRange.end.toDate(context.timeZone));

  return <>{text}</>;
};

const MobilePresetButton = ({
  value,
  children,
  ...props
}: HTMLAttributes<HTMLButtonElement> & {
  value: { start: DateValue; end: DateValue };
}) => {
  const context = useContext(RangeCalendarStateContext);

  return (
    <Button
      {...props}
      color="link-color"
      size="sm"
      slot={null}
      onClick={() => {
        context?.setValue(value);
        context?.setFocusedDate(value.start as CalendarDate);
      }}>
      {children}
    </Button>
  );
};

interface RangeCalendarProps extends AriaRangeCalendarProps<DateValue> {
  /** The dates to highlight. */
  highlightedDates?: DateValue[];
  /** The date presets to display. */
  presets?: Record<
    string,
    { label: string; value: { start: DateValue; end: DateValue } }
  >;
}

export const RangeCalendar = ({ presets, ...props }: RangeCalendarProps) => {
  const isDesktop = useBreakpoint('md');
  const context = useSlottedContext(RangeCalendarContext);

  const ContextWrapper = context ? Fragment : RangeCalendarContextProvider;

  return (
    <ContextWrapper>
      <AriaRangeCalendar
        className="tw:flex tw:items-start"
        visibleDuration={{
          months: isDesktop ? 2 : 1,
        }}
        {...props}>
        <div className="tw:flex tw:flex-col tw:gap-3 tw:px-6 tw:py-5">
          <header className="tw:relative tw:flex tw:items-center tw:justify-between tw:md:justify-start">
            <Button
              className="tw:size-8"
              color="tertiary"
              iconLeading={ChevronLeft}
              size="sm"
              slot="previous"
            />

            <h2 className="tw:absolute tw:top-1/2 tw:left-1/2 tw:-translate-x-1/2 tw:-translate-y-1/2 tw:text-sm tw:font-semibold tw:text-fg-secondary">
              <RangeCalendarTitle part="start" />
            </h2>

            <Button
              className="tw:size-8 tw:md:hidden"
              color="tertiary"
              iconLeading={ChevronRight}
              size="sm"
              slot="next"
            />
          </header>

          {!isDesktop && (
            <div className="tw:flex tw:items-center tw:gap-2 tw:md:hidden">
              <DateInput className="tw:flex-1" slot="start" />
              <div className="tw:text-md tw:text-quaternary">–</div>
              <DateInput className="tw:flex-1" slot="end" />
            </div>
          )}

          {!isDesktop && presets && (
            <div className="tw:mt-1 tw:flex tw:justify-between tw:gap-3 tw:px-2 tw:md:hidden">
              {Object.values(presets).map((preset) => (
                <MobilePresetButton key={preset.label} value={preset.value}>
                  {preset.label}
                </MobilePresetButton>
              ))}
            </div>
          )}

          <AriaCalendarGrid className="tw:w-max" weekdayStyle="short">
            <AriaCalendarGridHeader>
              {(day) => (
                <AriaCalendarHeaderCell className="tw:border-b-4 tw:border-transparent tw:p-0">
                  <div className="tw:flex tw:size-10 tw:items-center tw:justify-center tw:text-sm tw:font-medium tw:text-secondary">
                    {day.slice(0, 2)}
                  </div>
                </AriaCalendarHeaderCell>
              )}
            </AriaCalendarGridHeader>
            <AriaCalendarGridBody className="tw:[&_td]:p-0 tw:[&_tr]:border-b-4 tw:[&_tr]:border-transparent tw:[&_tr:last-of-type]:border-none">
              {(date) => <CalendarCell date={date} />}
            </AriaCalendarGridBody>
          </AriaCalendarGrid>
        </div>

        {isDesktop && (
          <div className="tw:flex tw:flex-col tw:gap-3 tw:border-l tw:border-secondary tw:px-6 tw:py-5">
            <header className="tw:relative tw:flex tw:items-center tw:justify-end">
              <h2 className="tw:absolute tw:top-1/2 tw:left-1/2 tw:-translate-x-1/2 tw:-translate-y-1/2 tw:text-sm tw:font-semibold tw:text-fg-secondary">
                <RangeCalendarTitle part="end" />
              </h2>

              <Button
                className="tw:size-8"
                color="tertiary"
                iconLeading={ChevronRight}
                size="sm"
                slot="next"
              />
            </header>

            <AriaCalendarGrid
              className="tw:w-max"
              offset={{ months: 1 }}
              weekdayStyle="short">
              <AriaCalendarGridHeader>
                {(day) => (
                  <AriaCalendarHeaderCell className="tw:border-b-4 tw:border-transparent tw:p-0">
                    <div className="tw:flex tw:size-10 tw:items-center tw:justify-center tw:text-sm tw:font-medium tw:text-secondary">
                      {day.slice(0, 2)}
                    </div>
                  </AriaCalendarHeaderCell>
                )}
              </AriaCalendarGridHeader>
              <AriaCalendarGridBody className="tw:[&_td]:p-0 tw:[&_tr]:border-b-4 tw:[&_tr]:border-transparent tw:[&_tr:last-of-type]:border-none">
                {(date) => <CalendarCell date={date} />}
              </AriaCalendarGridBody>
            </AriaCalendarGrid>
          </div>
        )}
      </AriaRangeCalendar>
    </ContextWrapper>
  );
};
