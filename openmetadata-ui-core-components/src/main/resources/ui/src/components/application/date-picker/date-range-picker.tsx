import { useMemo, useState, type ReactNode } from 'react';
import {
  endOfMonth,
  endOfWeek,
  getLocalTimeZone,
  startOfMonth,
  startOfWeek,
  today,
} from '@internationalized/date';
import { useControlledState } from '@react-stately/utils';
import { Calendar as CalendarIcon, XClose } from '@untitledui/icons';
import { useDateFormatter } from 'react-aria';
import type {
  DateRangePickerProps as AriaDateRangePickerProps,
  DateValue,
} from 'react-aria-components';
import {
  DateRangePicker as AriaDateRangePicker,
  Dialog as AriaDialog,
  Group as AriaGroup,
  Popover as AriaPopover,
  useLocale,
} from 'react-aria-components';
import { Button } from '@/components/base/buttons/button';
import type { ButtonProps } from '@/components/base/buttons/button';
import { cx } from '@/utils/cx';
import type { RangeValue } from '@react-types/shared';
import { DateInput } from './date-input';
import { RangeCalendar } from './range-calendar';
import { RangePresetButton } from './range-preset';

const now = today(getLocalTimeZone());

const highlightedDates = [today(getLocalTimeZone())];

export type DateRangePickerValue = RangeValue<DateValue>;

export interface DateRangePickerPreset {
  key: string;
  label: ReactNode;
  value: DateRangePickerValue;
}

type DateRangePickerButtonProps = ButtonProps & {
  [key: `data-${string}`]: string | undefined;
};

interface DateRangePickerProps extends AriaDateRangePickerProps<DateValue> {
  /** The function to call when the apply button is clicked. */
  onApply?: (value: DateRangePickerValue | null, presetKey?: string) => void;
  /** The function to call when the cancel button is clicked. */
  onCancel?: () => void;
  /** Preset ranges to show in the side rail. */
  presets?: DateRangePickerPreset[];
  /** Label to render in the trigger button instead of the formatted date range. */
  triggerLabel?: ReactNode;
  /** Placeholder to render when there is no selected date range. */
  placeholder?: ReactNode;
  /** Props passed to the trigger button. */
  buttonProps?: DateRangePickerButtonProps;
  /** Show an inline clear action in the trigger button when a range is selected. */
  allowClear?: boolean;
  /** The function to call when the clear action is clicked. */
  onClear?: () => void;
  /** Test id for the clear action. */
  clearButtonTestId?: string;
  /** Applies and closes the picker immediately when a preset is selected. */
  applyOnPresetSelect?: boolean;
}

export const DateRangePicker = ({
  allowClear,
  applyOnPresetSelect,
  buttonProps,
  clearButtonTestId = 'clear-date-picker',
  onClear,
  value: valueProp,
  defaultValue,
  onChange,
  onApply,
  onCancel,
  placeholder = 'Select dates',
  presets: presetsProp,
  triggerLabel,
  ...props
}: DateRangePickerProps) => {
  const { locale } = useLocale();
  const formatter = useDateFormatter({
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const [value, setValue] = useControlledState(
    valueProp,
    defaultValue || null,
    onChange
  );
  const [focusedValue, setFocusedValue] = useState<DateValue | null>(null);

  const formattedStartDate = value?.start
    ? formatter.format(value.start.toDate(getLocalTimeZone()))
    : 'Select date';
  const formattedEndDate = value?.end
    ? formatter.format(value.end.toDate(getLocalTimeZone()))
    : 'Select date';

  const defaultPresets = useMemo(
    () => ({
      today: { label: 'Today', value: { start: now, end: now } },
      yesterday: {
        label: 'Yesterday',
        value: {
          start: now.subtract({ days: 1 }),
          end: now.subtract({ days: 1 }),
        },
      },
      thisWeek: {
        label: 'This week',
        value: { start: startOfWeek(now, locale), end: endOfWeek(now, locale) },
      },
      lastWeek: {
        label: 'Last week',
        value: {
          start: startOfWeek(now, locale).subtract({ weeks: 1 }),
          end: endOfWeek(now, locale).subtract({ weeks: 1 }),
        },
      },
      thisMonth: {
        label: 'This month',
        value: { start: startOfMonth(now), end: endOfMonth(now) },
      },
      lastMonth: {
        label: 'Last month',
        value: {
          start: startOfMonth(now).subtract({ months: 1 }),
          end: endOfMonth(now).subtract({ months: 1 }),
        },
      },
      thisYear: {
        label: 'This year',
        value: {
          start: startOfMonth(now.set({ month: 1 })),
          end: endOfMonth(now.set({ month: 12 })),
        },
      },
      lastYear: {
        label: 'Last year',
        value: {
          start: startOfMonth(now.set({ month: 1 }).subtract({ years: 1 })),
          end: endOfMonth(now.set({ month: 12 }).subtract({ years: 1 })),
        },
      },
      allTime: {
        label: 'All time',
        value: {
          start: now.set({ year: 2000, month: 1, day: 1 }),
          end: now,
        },
      },
    }),
    [locale]
  );
  const presets = useMemo(
    () =>
      presetsProp ??
      Object.entries(defaultPresets).map(([key, preset]) => ({
        key,
        label: preset.label,
        value: preset.value,
      })),
    [defaultPresets, presetsProp]
  );
  const calendarPresets = useMemo(
    () =>
      Object.fromEntries(
        presets
          .slice(0, 3)
          .map((preset) => [
            preset.key,
            { label: preset.label, value: preset.value },
          ])
      ),
    [presets]
  );

  const handleApply = (close: () => void, presetKey?: string) => {
    onApply?.(value, presetKey);
    close();
  };
  const triggerContent =
    triggerLabel ??
    (value ? (
      `${formattedStartDate} – ${formattedEndDate}`
    ) : (
      <span className="tw:text-placeholder">{placeholder}</span>
    ));

  return (
    <AriaDateRangePicker
      aria-label="Date range picker"
      shouldCloseOnSelect={false}
      {...props}
      value={value}
      onChange={setValue}>
      <AriaGroup>
        <Button
          color="secondary"
          iconLeading={CalendarIcon}
          size="md"
          {...buttonProps}>
          {triggerContent}
          {allowClear && value && (
            <span
              data-testid={clearButtonTestId}
              role="button"
              tabIndex={0}
              onClick={(event) => {
                event.stopPropagation();
                setValue(null);
                onClear?.();
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  setValue(null);
                  onClear?.();
                }
              }}>
              <XClose className="tw:size-4" />
            </span>
          )}
        </Button>
      </AriaGroup>
      <AriaPopover
        className={({ isEntering, isExiting }) =>
          cx(
            'tw:origin-(--trigger-anchor-point) tw:will-change-transform',
            isEntering &&
              'tw:duration-150 tw:ease-out tw:animate-in tw:fade-in tw:placement-right:slide-in-from-left-0.5 tw:placement-top:slide-in-from-bottom-0.5 tw:placement-bottom:slide-in-from-top-0.5',
            isExiting &&
              'tw:duration-100 tw:ease-in tw:animate-out tw:fade-out tw:placement-right:slide-out-to-left-0.5 tw:placement-top:slide-out-to-bottom-0.5 tw:placement-bottom:slide-out-to-top-0.5'
          )
        }
        offset={8}
        placement="bottom right">
        <AriaDialog className="tw:flex tw:rounded-2xl tw:bg-primary tw:shadow-xl tw:ring tw:ring-secondary_alt tw:focus:outline-hidden">
          {({ close }) => (
            <>
              <div className="tw:hidden tw:w-38 tw:flex-col tw:gap-0.5 tw:border-r tw:border-solid tw:border-secondary tw:p-3 tw:lg:flex">
                {Object.values(presets).map((preset) => (
                  <RangePresetButton
                    key={preset.key}
                    value={preset.value}
                    onClick={() => {
                      setValue(preset.value);
                      setFocusedValue(preset.value.start);
                      if (applyOnPresetSelect) {
                        onApply?.(preset.value, preset.key);
                        close();
                      }
                    }}>
                    {preset.label}
                  </RangePresetButton>
                ))}
              </div>
              <div className="tw:flex tw:flex-col">
                <RangeCalendar
                  focusedValue={focusedValue}
                  highlightedDates={highlightedDates}
                  presets={calendarPresets}
                  onFocusChange={setFocusedValue}
                />
                <div className="tw:flex tw:justify-between tw:gap-3 tw:border-t tw:border-secondary tw:p-4">
                  <div className="tw:hidden tw:items-center tw:gap-3 tw:md:flex">
                    <DateInput className="tw:w-36" slot="start" />
                    <div className="tw:text-md tw:text-quaternary">–</div>
                    <DateInput className="tw:w-36" slot="end" />
                  </div>
                  <div className="tw:grid tw:w-full tw:grid-cols-2 tw:gap-3 tw:md:flex tw:md:w-auto">
                    <Button
                      color="secondary"
                      size="md"
                      onClick={() => {
                        onCancel?.();
                        close();
                      }}>
                      Cancel
                    </Button>
                    <Button
                      color="primary"
                      size="md"
                      onClick={() => handleApply(close)}>
                      Apply
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </AriaDialog>
      </AriaPopover>
    </AriaDateRangePicker>
  );
};
