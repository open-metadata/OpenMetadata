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
  fromDate,
  getLocalTimeZone,
  toCalendarDate,
  today,
} from '@internationalized/date';
import type { DatePicker } from '@openmetadata/ui-core-components';
import type { DateValue } from 'react-aria-components';

/**
 * Bridge between epoch-millis timestamps and the `@internationalized/date`
 * `DateValue`s that the core (untitled-ui) date pickers speak. Kept in one
 * place so date-range filters don't each hand-roll the conversion.
 */

export const millisToDateValue = (ms?: number): DateValue | null =>
  ms == null
    ? null
    : toCalendarDate(fromDate(new Date(ms), getLocalTimeZone()));

export const dateValueToMillis = (value: Pick<DateValue, 'toDate'>): number =>
  value.toDate(getLocalTimeZone()).getTime();

/**
 * The DateValue the core pickers take. Core resolves its own
 * `@internationalized/date` copy (a different patch version from the app's), so
 * TypeScript treats the two DateValue types as distinct even though they are
 * structurally the same. Picker values go through the helpers below so the
 * cast lives in one place.
 */
export type PickerDateValue = NonNullable<
  Parameters<typeof DatePicker>[0]['value']
>;

export const millisToPickerDateValue = (ms?: number) =>
  millisToDateValue(ms) as PickerDateValue | null;

/**
 * The last millisecond of a picked day: a date-only value resolves to midnight,
 * which would leave the end day out of a range.
 */
export const dateValueToEndOfDayMillis = (value: {
  add: (duration: { days: number }) => Pick<DateValue, 'toDate'>;
}): number => dateValueToMillis(value.add({ days: 1 })) - 1;

/**
 * The last `days` days through the end of today, bounded at local midnight -
 * the same window the core date pickers produce when a range is applied, so a
 * default range and a picked one read the same in the picker's trigger.
 */
export const getPastDaysRange = (days: number) => {
  const todayValue = today(getLocalTimeZone());

  return {
    startTs: dateValueToMillis(todayValue.subtract({ days })),
    endTs: dateValueToMillis(todayValue.add({ days: 1 })) - 1,
  };
};
