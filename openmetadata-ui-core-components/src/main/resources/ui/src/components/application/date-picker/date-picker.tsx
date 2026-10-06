import { getLocalTimeZone, today } from '@internationalized/date';
import { useControlledState } from '@react-stately/utils';
import { Calendar as CalendarIcon } from '../../../icons';
import { useDateFormatter } from 'react-aria';
import type {
  DatePickerProps as AriaDatePickerProps,
  DateValue,
} from 'react-aria-components';
import {
  DatePicker as AriaDatePicker,
  Button as AriaButton,
  Dialog as AriaDialog,
  Group as AriaGroup,
  Popover as AriaPopover,
} from 'react-aria-components';
import { Button } from '@/components/base/buttons/button';
import { useCoreTranslation } from '@/i18n/useCoreTranslation';
import { cx } from '@/utils/cx';
import { Calendar } from './calendar';

const highlightedDates = [today(getLocalTimeZone())];

interface DatePickerProps extends AriaDatePickerProps<DateValue> {
  /** The function to call when the apply button is clicked. */
  onApply?: () => void;
  /** The function to call when the cancel button is clicked. */
  onCancel?: () => void;
  /**
   * How the closed picker presents itself.
   *
   * `button` (default) is the compact secondary button — right for a toolbar or
   * a filter bar, where the control sits among other buttons. `input` is a
   * full-width field with a leading calendar icon, shaped exactly like `Input`,
   * for a labelled form column where it has to line up with the text fields
   * above and below it.
   */
  triggerVariant?: 'button' | 'input';
  /** What the `input` trigger reads before a day is picked. */
  placeholder?: string;
}

export const DatePicker = ({
  value: valueProp,
  defaultValue,
  onChange,
  onApply,
  onCancel,
  placeholder,
  triggerVariant = 'button',
  ...props
}: DatePickerProps) => {
  const { t } = useCoreTranslation();
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

  const emptyLabel = placeholder ?? t('label.select-date', 'Select date');
  const formattedDate = value
    ? formatter.format(value.toDate(getLocalTimeZone()))
    : emptyLabel;

  return (
    <AriaDatePicker
      shouldCloseOnSelect={false}
      {...props}
      value={value}
      onChange={setValue}>
      <AriaGroup>
        {triggerVariant === 'input' ? (
          // Deliberately the same chrome `Input`'s wrapper draws — radius,
          // surface, shadow and the outline border (not a ring: WebKit does not
          // pixel-snap box-shadow) — so a picker and a text field in the same
          // form column are the same object at rest.
          <AriaButton
            // `isInvalid` comes off the picker's own props, not the button's
            // render props — react-aria scopes validation state to the field,
            // and a plain `Button` is never told about it.
            className={({ isFocusVisible, isDisabled }) =>
              cx(
                'tw:flex tw:w-full tw:cursor-pointer tw:items-center tw:gap-2 tw:rounded-lg tw:bg-primary tw:px-3.5 tw:py-2.5 tw:text-left tw:text-md tw:shadow-xs tw:outline-1 tw:-outline-offset-1 tw:outline-primary tw:transition-[outline-color,outline-width] tw:duration-100 tw:ease-linear',
                isFocusVisible &&
                  !isDisabled &&
                  'tw:outline-2 tw:-outline-offset-2 tw:outline-brand',
                isDisabled &&
                  'tw:cursor-not-allowed tw:bg-disabled_subtle tw:outline-disabled',
                props.isInvalid && 'tw:outline-error_subtle',
                props.isInvalid &&
                  isFocusVisible &&
                  'tw:outline-2 tw:-outline-offset-2 tw:outline-error'
              )
            }>
            <CalendarIcon className="tw:size-5 tw:shrink-0 tw:text-fg-quaternary" />
            {/* The empty state is a placeholder, so it takes the placeholder
                colour rather than reading as a chosen value. */}
            <span
              className={cx(
                'tw:truncate',
                value ? 'tw:text-primary' : 'tw:text-placeholder'
              )}>
              {formattedDate}
            </span>
          </AriaButton>
        ) : (
          <Button color="secondary" iconLeading={CalendarIcon} size="md">
            {formattedDate}
          </Button>
        )}
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
        {/* outline-[3px] ports the bare `tw:ring` faithfully (3px in Tailwind v4, almost
            certainly unintended vs the ring-1 used elsewhere — tracked as a follow-up). */}
        <AriaDialog className="tw:rounded-2xl tw:bg-overlay-surface tw:shadow-xl tw:outline-[3px] tw:outline-secondary_alt">
          {({ close }) => (
            <>
              <div className="tw:flex tw:px-6 tw:py-5">
                <Calendar highlightedDates={highlightedDates} />
              </div>
              <div className="tw:grid tw:grid-cols-2 tw:gap-3 tw:border-t tw:border-secondary tw:p-4">
                <Button
                  color="secondary"
                  size="md"
                  onClick={() => {
                    onCancel?.();
                    close();
                  }}>
                  {t('label.cancel', 'Cancel')}
                </Button>
                <Button
                  color="primary"
                  size="md"
                  onClick={() => {
                    onApply?.();
                    close();
                  }}>
                  {t('label.apply', 'Apply')}
                </Button>
              </div>
            </>
          )}
        </AriaDialog>
      </AriaPopover>
    </AriaDatePicker>
  );
};
