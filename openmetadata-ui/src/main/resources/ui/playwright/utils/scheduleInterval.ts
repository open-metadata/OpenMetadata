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
import { expect, Page } from '@playwright/test';
import { chooseSelectOption } from './common';

/**
 * Helpers for the ScheduleInterval scheduler used by the Add / Edit Ingestion
 * wizard. The scheduler is built on react-aria components, so selects are
 * opened through their trigger button and options are picked by role.
 */

export type ScheduleFrequency = 'hour' | 'day' | 'week' | 'month' | 'custom';

export const selectOnDemandSchedule = async (page: Page) => {
  const onDemand = page.getByTestId('schedular-on-demand');

  // The scheduler remounts while the form above it settles, so a click begun
  // then races the remount: Playwright reports the option as "not stable",
  // then "element was detached from the DOM, retrying", and keeps retrying
  // against a node that no longer exists. Unbounded, that ran out the whole
  // 900s budget of the DataContracts test and surfaced as "Target page,
  // context or browser has been closed" rather than as anything about the
  // scheduler. Bound each attempt so a detach re-resolves the locator.
  //
  // Re-clicking is safe: on-demand and schedule are two states of one control,
  // so selecting on-demand twice leaves it exactly where the first click did.
  await expect(async () => {
    await onDemand.click({ timeout: 10_000 });
    await expect(page.getByTestId('cron-container')).not.toBeVisible({
      timeout: 5_000,
    });
  }).toPass({ timeout: 60_000 });
};

export const selectScheduleType = async (page: Page) => {
  await page.getByTestId('schedular-schedule').click();

  await expect(page.getByTestId('cron-container')).toBeVisible();
};

export const selectScheduleFrequency = async (
  page: Page,
  frequency: ScheduleFrequency
) => {
  await page.getByTestId('cron-container').waitFor();
  await page.getByTestId(`frequency-${frequency}`).click();
};

export const expectScheduleFrequencySelected = async (
  page: Page,
  frequency: ScheduleFrequency
) => {
  await expect(page.getByTestId(`frequency-${frequency}`)).toHaveAttribute(
    'aria-pressed',
    'true'
  );
};

const selectOption = async (page: Page, testId: string, option: string) => {
  await chooseSelectOption(
    page.getByTestId(testId).getByRole('button'),
    page.getByRole('option', { name: option, exact: true })
  );
};

export const selectScheduleMinute = async (page: Page, minute: string) =>
  selectOption(page, 'minute-options', minute);

export const selectScheduleDayOfWeek = async (page: Page, day: string) =>
  selectOption(page, 'day-options', day);

export const selectScheduleDayOfMonth = async (page: Page, date: string) =>
  selectOption(page, 'date-options', date);

/**
 * Fills the react-aria time field segments. `hour` and `minute` are two digit
 * strings and `period` is either AM or PM, matching the 12 hour cycle the
 * scheduler renders.
 */
export const setScheduleTime = async (
  page: Page,
  {
    hour,
    minute,
    period,
  }: { hour: string; minute: string; period: 'AM' | 'PM' }
) => {
  const timePicker = page.getByTestId('time-picker');

  await timePicker.getByRole('spinbutton', { name: 'hour' }).click();
  await page.keyboard.type(hour);
  await page.keyboard.type(minute);
  await page.keyboard.type(period === 'AM' ? 'a' : 'p');
};

export const setCustomCron = async (page: Page, cron: string) => {
  await page.getByTestId('custom-cron-input').getByRole('textbox').fill(cron);
};
