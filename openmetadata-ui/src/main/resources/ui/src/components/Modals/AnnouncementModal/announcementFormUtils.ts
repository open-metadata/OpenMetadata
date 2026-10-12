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

/** Epoch millis -> the `yyyy-MM-dd` day they fall on in the viewer's zone. */
export const toCalendarDay = (ms: number): string =>
  DateTime.fromMillis(ms).toFormat('yyyy-MM-dd');

/**
 * The picker's chosen day (`yyyy-MM-dd`) -> epoch millis.
 *
 * The end date resolves to the *end* of the chosen day, not its start. Both
 * dates are days, but the window is a half-open range in millis: anchoring the
 * end at 00:00 would stop the announcement as the chosen day begins, so an end
 * date of Friday would never show on Friday, and a one-day announcement
 * (start = end) would be impossible because `startTime >= endTime`.
 *
 * A cleared field reads back as `null` rather than a NaN timestamp, which is
 * what makes it fail its required rule and keeps submit disabled until a real
 * date is picked. `null`, not `undefined`: react-hook-form treats an
 * `undefined` from `field.onChange` as "no change" and would keep the previous
 * value, so clearing the picker would silently do nothing.
 */
export const fromCalendarValue = (
  day: string | null,
  boundary: 'start' | 'end' = 'start'
): number | null => {
  if (!day) {
    return null;
  }

  // A bare `yyyy-MM-dd` parses to local midnight, which is already what a
  // start date wants.
  const startOfDay = DateTime.fromISO(day).toMillis();

  return boundary === 'end'
    ? DateTime.fromMillis(startOfDay).endOf('day').toMillis()
    : startOfDay;
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

/**
 * The description an announcement arrives with, as plain text to edit.
 *
 * The block editor this form used to embed stored its content as HTML, so
 * announcements written before the description became a `TextArea` arrive
 * wrapped in a paragraph — the field would otherwise offer `<p>Scheduled
 * downtime</p>` as the text to edit.
 *
 * Only that single-paragraph wrapper is unwrapped. Anything richer is left
 * verbatim rather than flattened: stripping tags would silently drop a list or
 * a link on an edit that only meant to move the dates, and the markup at least
 * still says what it is.
 *
 * The unwrapped text is also decoded. The editor serialised to HTML, so a
 * description reading `Tom & Jerry` is stored as `Tom &amp; Jerry` — left
 * encoded, that is what the author would see in the field and re-save.
 */
export const toPlainDescription = (description?: string): string => {
  const trimmed = description?.trim() ?? '';
  const [, inner] = trimmed.match(/^<p(?:\s[^>]*)?>([\s\S]*)<\/p>$/i) ?? [];

  if (inner === undefined || /<[a-z]/i.test(inner)) {
    return trimmed;
  }

  // `inner` is tag-free by the test above, so parsing it can only resolve
  // entities — there is no markup here for `textContent` to drop.
  const decoded =
    new DOMParser().parseFromString(inner, 'text/html').body.textContent ?? '';

  return decoded.trim();
};
