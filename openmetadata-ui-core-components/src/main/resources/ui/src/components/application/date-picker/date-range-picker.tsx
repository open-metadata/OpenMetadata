import { useMemo, useState } from 'react';
import {
  endOfMonth,
  endOfWeek,
  getLocalTimeZone,
  startOfMonth,
  startOfWeek,
  today,
} from '@internationalized/date';
import { useControlledState } from '@react-stately/utils';
import { Calendar as CalendarIcon } from '../../../icons';
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
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { cx } from '@/utils/cx';
import { DateInput } from './date-input';
import { RangeCalendar } from './range-calendar';
import { RangePresetButton } from './range-preset';

export const getDateRangePresets = (
  locale: string,
  now = today(getLocalTimeZone())
) => ({
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
});

export type DateRangePresetKey = keyof ReturnType<typeof getDateRangePresets>;

const highlightedDates = [today(getLocalTimeZone())];

interface DateRangePickerProps extends AriaDateRangePickerProps<DateValue> {
  /** Called on Apply with the preset key when the range came from a preset. */
  onApply?: (presetKey?: DateRangePresetKey) => void;
  /** The function to call when the cancel button is clicked. */
  onCancel?: () => void;
  /** Size of the trigger button, to line up with the inputs beside it. */
  size?: 'sm' | 'md';
  /** Stretch the trigger across its container instead of sizing it to the dates. */
  fullWidth?: boolean;
}

export const DateRangePicker = ({
  value: valueProp,
  defaultValue,
  onChange,
  onApply,
  onCancel,
  size = 'md',
  fullWidth = false,
  ...props
}: DateRangePickerProps) => {
  const { t } = useCoreTranslation();
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

  const presets = useMemo(() => getDateRangePresets(locale), [locale]);
  const [presetKey, setPresetKey] = useState<DateRangePresetKey>();

  return (
    <AriaDateRangePicker
      aria-label={t('label.date-range-picker', 'Date range picker')}
      shouldCloseOnSelect={false}
      {...props}
      value={value}
      onChange={(range) => {
        setPresetKey(undefined);
        setValue(range);
      }}
      onOpenChange={(isOpen) => {
        // Apply reads the key before closing, so a key still set here belongs
        // to a dismissed picker and must not reach the next Apply.
        if (!isOpen) {
          setPresetKey(undefined);
        }
        props.onOpenChange?.(isOpen);
      }}>
      <AriaGroup>
        <Button
          className={cx(fullWidth && 'tw:w-full tw:justify-start')}
          color="secondary"
          iconLeading={CalendarIcon}
          size={size}>
          {!value ? (
            <span className="tw:text-placeholder">
              {t('label.select-dates', 'Select dates')}
            </span>
          ) : (
            `${formattedStartDate} – ${formattedEndDate}`
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
        offset={4}
        placement="bottom right">
        {/* `outline-[3px]` ports the bare `tw:ring` faithfully (3px in Tailwind v4 — likely
            unintended vs ring-1 elsewhere; tracked as a follow-up). `focus:outline-hidden`
            removed: it would suppress this border. */}
        <AriaDialog className="tw:flex tw:rounded-2xl tw:bg-overlay-surface tw:shadow-xl tw:outline-[3px] tw:outline-secondary_alt">
          {({ close }) => (
            <>
              <div className="tw:hidden tw:w-38 tw:flex-col tw:gap-0.5 tw:border-r tw:border-solid tw:border-secondary tw:p-3 tw:lg:flex">
                {Object.entries(presets).map(([key, preset]) => (
                  <RangePresetButton
                    key={key}
                    value={preset.value}
                    onClick={() => {
                      setPresetKey(key as DateRangePresetKey);
                      setValue(preset.value);
                      setFocusedValue(preset.value.start);
                    }}>
                    {preset.label}
                  </RangePresetButton>
                ))}
              </div>
              <div className="tw:flex tw:flex-col">
                <RangeCalendar
                  focusedValue={focusedValue}
                  highlightedDates={highlightedDates}
                  presets={{
                    lastWeek: presets.lastWeek,
                    lastMonth: presets.lastMonth,
                    lastYear: presets.lastYear,
                  }}
                  onFocusChange={setFocusedValue}
                  onPresetSelect={(key) =>
                    setPresetKey(key as DateRangePresetKey)
                  }
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
                      onClick={() => {
                        onApply?.(presetKey);
                        close();
                      }}>
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
