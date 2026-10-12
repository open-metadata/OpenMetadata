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
import { DateRangePicker } from '@openmetadata/ui-core-components';
import { useEffect, useState } from 'react';
import type { DateValue } from 'react-aria-components';
import { dateValueToMillis, millisToDateValue } from './calendarDate.utils';

type PickerRange = { start: DateValue; end: DateValue } | null;

export interface DqDateRangeFilterProps {
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
}

/**
 * Adapts the core (untitled-ui) `DateRangePicker`, which speaks
 * `@internationalized/date` values, to the dashboard's epoch-millis
 * `DateRangeObject`. Selection is staged locally and committed on Apply.
 */
export const DqDateRangeFilter = ({
  startTs,
  endTs,
  size = 'md',
  fullWidth = false,
  isOpen,
  onOpenChange,
  onApply,
}: DqDateRangeFilterProps) => {
  const buildValue = (): PickerRange => {
    const start = millisToDateValue(startTs);
    const end = millisToDateValue(endTs);

    return start && end ? { start, end } : null;
  };

  const [value, setValue] = useState<PickerRange>(buildValue);

  // Re-sync the staged value when the committed range changes upstream.
  useEffect(() => {
    const start = millisToDateValue(startTs);
    const end = millisToDateValue(endTs);
    setValue(start && end ? { start, end } : null);
  }, [startTs, endTs]);

  // Discard any uncommitted (staged) selection when single-open coordination
  // force-closes the picker (isOpen -> false). react-aria does NOT emit
  // onOpenChange for this externally-driven close, so the effect below is the
  // only signal for that path. User-initiated closes (Escape / outside click /
  // Apply / Cancel) are handled by `handleOpenChange` instead (see below).
  useEffect(() => {
    if (isOpen === false) {
      setValue(buildValue());
    }
  }, [isOpen]);

  // Intercept every close event — including uncontrolled usage where the
  // caller passes no `isOpen`/`onOpenChange` — so an abandoned (never-applied)
  // selection is reverted and reopening shows the committed range. The
  // `[isOpen]` effect above covers the force-close path react-aria won't
  // report here; together they cover both close origins.
  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setValue(buildValue());
    }
    onOpenChange?.(open);
  };

  const handleApply = () => {
    if (value?.start && value?.end) {
      // Commit the end boundary as the last millisecond of the selected day —
      // the date-only value resolves to midnight, which would exclude the end day.
      onApply({
        startTs: dateValueToMillis(value.start),
        endTs: dateValueToMillis(value.end.add({ days: 1 })) - 1,
      });
    }
  };

  const handleCancel = () => {
    setValue(buildValue());
  };

  return (
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
};

export default DqDateRangeFilter;
