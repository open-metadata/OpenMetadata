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

/** The value format a native `<input type="date">` reads and writes. */
const DATE_INPUT_FORMAT = 'yyyy-MM-dd';

/** Epoch millis -> the string the date input binds to, in the viewer's zone. */
export const toDateInputValue = (timestamp: number): string =>
  DateTime.fromMillis(timestamp).toFormat(DATE_INPUT_FORMAT);

/**
 * The date input's value -> epoch millis at the start of that day. Returns the
 * current value untouched while the field is empty or half-typed, so clearing
 * the input cannot write a NaN timestamp into the form.
 */
export const fromDateInputValue = (value: string, fallback: number): number => {
  const parsed = DateTime.fromFormat(value, DATE_INPUT_FORMAT);

  return parsed.isValid ? parsed.toMillis() : fallback;
};
