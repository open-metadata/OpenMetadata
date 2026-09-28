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
 * The date input's value -> epoch millis at the start of that day. A cleared or
 * half-typed field reads back as `undefined` rather than a NaN timestamp, which
 * is also what makes the field fail its `required` rule and keeps submit
 * disabled until a real date is picked.
 */
export const fromDateInputValue = (value: string): number | null => {
  const parsed = DateTime.fromFormat(value, DATE_INPUT_FORMAT);

  // `null`, not `undefined`: react-hook-form treats an `undefined` from
  // `field.onChange` as "no change" and keeps the previous value, so clearing
  // the input would silently do nothing.
  return parsed.isValid ? parsed.toMillis() : null;
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
