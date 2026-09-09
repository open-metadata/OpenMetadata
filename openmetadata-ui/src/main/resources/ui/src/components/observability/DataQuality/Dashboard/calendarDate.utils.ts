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
} from '@internationalized/date';
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

export const dateValueToMillis = (value: DateValue): number =>
  value.toDate(getLocalTimeZone()).getTime();
