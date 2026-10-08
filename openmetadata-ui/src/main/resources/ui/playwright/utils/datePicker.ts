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
import { expect, Locator, Page } from '@playwright/test';

/**
 * Picks `isoDate` (yyyy-MM-dd) in the core DatePicker `picker`: opens the
 * calendar, pages to the target month, clicks the day, then Apply.
 */
export const pickDateInCorePicker = async (
  page: Page,
  picker: Locator,
  isoDate: string
) => {
  const [year, month, day] = isoDate.split('-').map(Number);
  // Cell labels follow the app locale ("Tuesday, 9 July 2024" or
  // "Tuesday, July 9, 2024"); only the displayed month's days are rendered, so
  // the day number alone identifies the cell.
  const dayLabel = new RegExp(`(^|\\D)${day}(\\D|$)`);

  await picker.getByRole('button').click();
  const calendar = page
    .getByRole('dialog')
    .filter({ has: page.getByRole('grid') });
  await expect(calendar).toBeVisible();

  // The calendar renders the month twice: an aria-hidden visual <h2> and an
  // accessible one. The default (hidden-excluded) role query picks the latter.
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
};
