/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import {
  Box,
  ButtonUtility,
  DateRangePicker,
} from '@openmetadata/ui-core-components';
import { XClose } from '@openmetadata/ui-core-components/icons';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  dateValueToEndOfDayMillis,
  dateValueToMillis,
  millisToPickerDateValue,
  PickerDateValue,
} from '../../../utils/date-time/calendarDate.utils';

type PickerRange = { start: PickerDateValue; end: PickerDateValue } | null;

export interface DateRangeFilterProps {
  startTs?: number;
  endTs?: number;
  /** `sm` matches the trigger to the sm filter inputs. */
  size?: 'sm' | 'md';
  /** Stretch the trigger across its container, like the inputs beside it. */
  fullWidth?: boolean;
  /** Controlled popover open state (for single-open filter coordination). */
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Commit handler — compatible with the hook's `onDateRangeChange`. */
  onApply: (range: { startTs: number; endTs: number }) => void;
  /** Shows a clear button while a range is set; called when it is pressed. */
  onClear?: () => void;
}

const toPickerRange = (startTs?: number, endTs?: number): PickerRange => {
  const start = millisToPickerDateValue(startTs);
  const end = millisToPickerDateValue(endTs);

  return start && end ? { start, end } : null;
};

/**
 * Adapts the core (untitled-ui) `DateRangePicker`, which speaks
 * `@internationalized/date` values, to the dashboard's epoch-millis
 * `DateRangeObject`. Selection is staged locally and committed on Apply.
 */
export const DateRangeFilter = ({
  startTs,
  endTs,
  size = 'md',
  fullWidth = false,
  isOpen,
  onOpenChange,
  onApply,
  onClear,
}: DateRangeFilterProps) => {
  const { t } = useTranslation();
  const [value, setValue] = useState<PickerRange>(() =>
    toPickerRange(startTs, endTs)
  );

  // Re-sync the staged value when the committed range changes upstream.
  useEffect(() => {
    setValue(toPickerRange(startTs, endTs));
  }, [startTs, endTs]);

  // Discard any uncommitted (staged) selection when single-open coordination
  // force-closes the picker (isOpen -> false). react-aria does NOT emit
  // onOpenChange for this externally-driven close, so the effect below is the
  // only signal for that path. User-initiated closes (Escape / outside click /
  // Apply / Cancel) are handled by `handleOpenChange` instead (see below).
  useEffect(() => {
    if (isOpen === false) {
      setValue(toPickerRange(startTs, endTs));
    }
  }, [isOpen, startTs, endTs]);

  // Intercept every close event — including uncontrolled usage where the
  // caller passes no `isOpen`/`onOpenChange` — so an abandoned (never-applied)
  // selection is reverted and reopening shows the committed range. The
  // `[isOpen]` effect above covers the force-close path react-aria won't
  // report here; together they cover both close origins.
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setValue(toPickerRange(startTs, endTs));
    }
    onOpenChange?.(open);
  };

  const handleApply = () => {
    if (value?.start && value?.end) {
      onApply({
        startTs: dateValueToMillis(value.start),
        endTs: dateValueToEndOfDayMillis(value.end),
      });
    }
  };

  const handleCancel = () => {
    setValue(toPickerRange(startTs, endTs));
  };

  const picker = (
    <DateRangePicker
      fullWidth={fullWidth}
      isOpen={isOpen}
      size={size}
      value={value}
      onApply={handleApply}
      onCancel={handleCancel}
      onChange={setValue}
      onOpenChange={handleOpenChange}
    />
  );

  if (!onClear) {
    return picker;
  }

  return (
    <Box inline align="center" gap={2}>
      {picker}
      {startTs !== undefined && endTs !== undefined && (
        <ButtonUtility
          aria-label={t('label.clear')}
          color="tertiary"
          data-testid="clear-date-filter"
          icon={<XClose size={14} />}
          onClick={onClear}
        />
      )}
    </Box>
  );
};

export default DateRangeFilter;
