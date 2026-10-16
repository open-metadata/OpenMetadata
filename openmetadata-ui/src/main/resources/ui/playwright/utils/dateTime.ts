/*
 *  Copyright 2025 Collate.
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
import { expect, Locator, Page } from '@playwright/test';
import { isNil } from 'lodash';
import { DateTime } from 'luxon';

export const getCurrentMillis = () => DateTime.now().toMillis();

export const getEpochMillisForFutureDays = (days: number) =>
  DateTime.now().plus({ days }).toMillis();

export const formatDateTime = (date?: number) => {
  if (isNil(date)) {
    return '';
  }

  const dateTime = DateTime.fromMillis(date, { locale: 'en-US' });

  return dateTime.toLocaleString(DateTime.DATETIME_MED);
};

export const customFormatDateTime = (
  milliseconds?: number,
  format?: string
) => {
  if (isNil(milliseconds)) {
    return '';
  }
  if (!format) {
    return formatDateTime(milliseconds);
  }

  return DateTime.fromMillis(milliseconds, { locale: 'en-US' }).toFormat(
    format
  );
};

export const getDayAgoStartGMTinMillis = (days: number) =>
  DateTime.now().setZone('GMT').minus({ days }).startOf('day').toMillis();

/**
 * Picks `isoDate` (yyyy-MM-dd) in the design system's `DatePicker`, given the
 * locator for its trigger: opens the calendar, pages to the target month,
 * clicks the day, then confirms with Apply.
 *
 * The trigger is a button showing the formatted day, not a text input, so
 * `fill` has nothing to type into; and the popover keeps itself open after a
 * selection, so Apply is what dismisses it before the next field is touched.
 */
export const pickDateInCorePicker = async (
  page: Page,
  trigger: Locator,
  isoDate: string
) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  // Cell labels follow the app locale ("Tuesday, 9 July 2024" or
  // "Tuesday, July 9, 2024"); only the displayed month's days are rendered, so
  // the day number alone identifies the cell.
  const dayLabel = new RegExp(`(^|\\D)${day}(\\D|$)`);

  // The form this picker sits in is itself a dialog, so the calendar is
  // singled out by the grid only it contains.
  const calendar = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('grid') });

  // Nothing of a previous field may still be mounted: react-aria animates the
  // popover out, and a page-wide match would otherwise see two calendars and
  // fail strict mode on the second date in a form.
  await expect(calendar).toHaveCount(0);

  await trigger.click();

  await expect(calendar).toHaveCount(1);

  const heading = calendar.getByRole('heading');
  const targetMonth = year * 12 + (month - 1);
  const MAX_MONTH_STEPS = 240;
  for (let step = 0; step < MAX_MONTH_STEPS; step++) {
    const shown = new Date(`1 ${await heading.textContent()}`);
    const shownMonth = shown.getFullYear() * 12 + shown.getMonth();
    if (shownMonth === targetMonth) {
      break;
    }
    await calendar
      .getByRole('button', {
        name: shownMonth > targetMonth ? 'Previous' : 'Next',
      })
      .click();
  }

  await calendar
    .getByRole('gridcell')
    .getByRole('button', { name: dayLabel })
    .click();
  await calendar.getByRole('button', { name: 'Apply' }).click();

  // Apply commits and closes. Waiting the popover out here is what lets the
  // next field open cleanly, rather than leaving the race for the caller.
  await expect(calendar).toHaveCount(0);
};
