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
import {
    dateValueToMillis,
    millisToDateValue
} from './calendarDate.utils';

type PickerRange = { start: DateValue; end: DateValue } | null;

export interface DqDateRangeFilterProps {
  startTs?: number;
  endTs?: number;
  /** `sm` shrinks the core `md` trigger to match the sm filter inputs. */
  size?: 'sm' | 'md';
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

  // Discard any uncommitted (staged) selection whenever the picker closes —
  // including when single-open coordination force-closes it (isOpen -> false,
  // which react-aria won't report via onOpenChange) — so reopening shows the
  // applied range, not an abandoned one.
  useEffect(() => {
    if (isOpen === false) {
      setValue(buildValue());
    }
  }, [isOpen]);

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

  const picker = (
    <DateRangePicker
      isOpen={isOpen}
      value={value}
      onApply={handleApply}
      onCancel={handleCancel}
      onChange={setValue}
      onOpenChange={onOpenChange}
    />
  );

  // The core DateRangePicker trigger is a hardcoded `md` button; scope-override
  // its inline trigger padding down to `sm` so it lines up with the sm inputs.
  return size === 'sm' ? (
    <div className="tw:[&_button]:px-3! tw:[&_button]:py-2!">{picker}</div>
  ) : (
    picker
  );
};

export default DqDateRangeFilter;
