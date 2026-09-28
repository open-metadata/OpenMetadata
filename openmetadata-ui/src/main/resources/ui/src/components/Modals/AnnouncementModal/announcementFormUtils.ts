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
import { AnnouncementType } from '../../../generated/entity/feed/announcement';
import {
  AnnouncementFormValues,
  EditableAnnouncement,
} from './AnnouncementModal.interface';

/** The value format a native `<input type="date">` reads and writes. */
const DATE_INPUT_FORMAT = 'yyyy-MM-dd';

/** Epoch millis -> the string the date input binds to, in the viewer's zone. */
export const toDateInputValue = (timestamp?: number | null): string =>
  timestamp == null
    ? ''
    : DateTime.fromMillis(timestamp).toFormat(DATE_INPUT_FORMAT);

/**
 * The date input's value -> epoch millis.
 *
 * The end date resolves to the *end* of the chosen day, not its start. Both
 * dates are days, but the window is a half-open range in millis: anchoring the
 * end at 00:00 would stop the announcement as the chosen day begins, so an end
 * date of Friday would never show on Friday, and a one-day announcement
 * (start = end) would be impossible because `startTime >= endTime`.
 *
 * A cleared or half-typed field reads back as `null` rather than a NaN
 * timestamp, which is what makes it fail its required rule and keeps submit
 * disabled until a real date is picked. `null`, not `undefined`: react-hook-form
 * treats an `undefined` from `field.onChange` as "no change" and would keep the
 * previous value, so clearing the input would silently do nothing.
 */
export const fromDateInputValue = (
  value: string,
  boundary: 'start' | 'end' = 'start'
): number | null => {
  const parsed = DateTime.fromFormat(value, DATE_INPUT_FORMAT);

  if (!parsed.isValid) {
    return null;
  }

  return (boundary === 'end' ? parsed.endOf('day') : parsed).toMillis();
};

/**
 * The type-dependent fields, as both the create request and the edit patch send
 * them. Colour and name only mean something on a Custom announcement, so each is
 * dropped outside that case rather than left behind from an earlier selection.
 */
export const toAnnouncementTypeFields = ({
  type,
  color,
  customTypeName,
}: AnnouncementFormValues): Pick<
  EditableAnnouncement,
  'type' | 'color' | 'customTypeName'
> => {
  const isCustom = type === AnnouncementType.Custom;

  return {
    type,
    color: isCustom ? color : undefined,
    customTypeName: isCustom ? customTypeName?.trim() || undefined : undefined,
  };
};
