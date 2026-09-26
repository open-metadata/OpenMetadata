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
import { DateTime } from 'luxon';
import { CustomPropertyConfig } from '../../../../../generated/type/customProperty';
import {
  formatCustomPropertyDateTime,
  parseCustomPropertyDateTime,
} from '../../../../../utils/CustomProperty.utils';

type DateConfig = CustomPropertyConfig['config'];

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export interface TimeParts {
  hour: number;
  minute: number;
  second?: number;
}

export interface DateTimeEditState {
  date: DateParts | null;
  time: TimeParts | null;
  /** Kept from the stored value: the pickers cannot edit sub-second precision. */
  millisecond: number;
}

export const toDateTimeEditState = (
  value: unknown,
  typeName: string,
  config: DateConfig
): DateTimeEditState => {
  const parsed =
    typeof value === 'string' && value
      ? parseCustomPropertyDateTime(value, typeName, config)
      : undefined;

  if (!parsed?.isValid) {
    return { date: null, time: null, millisecond: 0 };
  }

  return {
    date: { year: parsed.year, month: parsed.month, day: parsed.day },
    time: { hour: parsed.hour, minute: parsed.minute, second: parsed.second },
    millisecond: parsed.millisecond,
  };
};

/**
 * Stored value in the property's configured format, or `undefined` to clear.
 * Date types clear when no date is picked (a missing time means midnight);
 * time-only values clear when no time is picked.
 */
export const fromDateTimeEditState = (
  { date, time, millisecond }: DateTimeEditState,
  typeName: string,
  config: DateConfig
): string | undefined => {
  const isTimeOnly = typeName === 'time-cp';
  if (isTimeOnly ? !time : !date) {
    return undefined;
  }

  const base = date ?? DateTime.now().startOf('day');
  const combined = DateTime.fromObject({
    year: base.year,
    month: base.month,
    day: base.day,
    hour: time?.hour ?? 0,
    minute: time?.minute ?? 0,
    second: time?.second ?? 0,
    millisecond,
  });

  return formatCustomPropertyDateTime(combined, typeName, config);
};
