import { Time } from '@internationalized/date';
import { Clock } from '@untitledui/icons';
import type { Ref } from 'react';
import type {
  TimeFieldProps as AriaTimeFieldProps,
  TimeValue,
} from 'react-aria-components';
import {
  DateInput as AriaDateInput,
  DateSegment as AriaDateSegment,
  Group as AriaGroup,
  TimeField as AriaTimeField,
} from 'react-aria-components';
import { HintText } from '@/components/base/input/hint-text';
import { Label } from '@/components/base/input/label';
import { cx } from '@/utils/cx';

const sizes = {
  sm: 'tw:px-3 tw:py-2',
  md: 'tw:px-3.5 tw:py-2.5',
};

/** Plain time value to keep consumers decoupled from react-aria date types. */
export interface TimePickerValue {
  hour: number;
  minute: number;
}

export interface TimePickerProps
  extends Omit<
    AriaTimeFieldProps<TimeValue>,
    'children' | 'value' | 'defaultValue' | 'onChange'
  > {
  /** Currently selected time as a plain `{ hour, minute }` object. */
  value?: TimePickerValue | null;
  /** Called with the new `{ hour, minute }` value, or `null` when cleared. */
  onChange?: (value: TimePickerValue | null) => void;
  /** Label text rendered above the field. */
  label?: string;
  /** Helper or error text rendered below the field. */
  hint?: string;
  /**
   * Field size.
   * @default "sm"
   */
  size?: 'sm' | 'md';
  /** Class name for the field wrapper. */
  wrapperClassName?: string;
  ref?: Ref<HTMLDivElement>;
}

export const TimePicker = ({
  value,
  onChange,
  label,
  hint,
  size = 'sm',
  className,
  wrapperClassName,
  hourCycle = 12,
  ...props
}: TimePickerProps) => {
  const ariaValue = value ? new Time(value.hour, value.minute) : null;

  const handleChange = (time: TimeValue | null) => {
    onChange?.(time ? { hour: time.hour, minute: time.minute } : null);
  };

  return (
    <AriaTimeField
      hourCycle={hourCycle}
      {...props}
      className={(state) =>
        cx(
          'tw:flex tw:w-full tw:flex-col tw:gap-1.5',
          typeof className === 'function' ? className(state) : className
        )
      }
      value={ariaValue}
      onChange={handleChange}>
      {({ isInvalid, isDisabled }) => (
        <>
          {label && <Label>{label}</Label>}

          <AriaGroup
            className={cx(
              'tw:relative tw:flex tw:w-full tw:items-center tw:gap-2 tw:rounded-lg tw:bg-primary tw:shadow-xs tw:ring-1 tw:ring-primary tw:transition tw:duration-100 tw:ease-linear tw:ring-inset',
              'tw:focus-within:ring-2 tw:focus-within:ring-brand',
              isDisabled &&
                'tw:cursor-not-allowed tw:bg-disabled_subtle tw:ring-disabled',
              isInvalid && 'tw:ring-error_subtle',
              isInvalid && 'tw:focus-within:ring-2 tw:focus-within:ring-error',
              sizes[size],
              wrapperClassName
            )}>
            <AriaDateInput className="tw:flex tw:flex-1 tw:text-md tw:text-primary">
              {(segment) => (
                <AriaDateSegment
                  className={cx(
                    'tw:rounded tw:px-0.5 tw:text-primary tw:tabular-nums tw:caret-transparent tw:outline-hidden tw:focus:bg-brand-solid tw:focus:font-medium tw:focus:text-white',
                    segment.isPlaceholder && 'tw:text-placeholder tw:uppercase',
                    segment.type === 'literal' && 'tw:text-fg-quaternary',
                    isDisabled && 'tw:text-disabled'
                  )}
                  segment={segment}
                />
              )}
            </AriaDateInput>

            <Clock
              aria-hidden="true"
              className={cx(
                'tw:pointer-events-none tw:size-4 tw:shrink-0 tw:text-fg-quaternary',
                isDisabled && 'tw:text-fg-disabled'
              )}
            />
          </AriaGroup>

          {hint && <HintText isInvalid={isInvalid}>{hint}</HintText>}
        </>
      )}
    </AriaTimeField>
  );
};

TimePicker.displayName = 'TimePicker';
