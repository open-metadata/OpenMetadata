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

/**
 * Helpers for the ScheduleIntervalV1 scheduler used by the Add / Edit Ingestion
 * wizard. The scheduler is built on react-aria components, so selects are
 * opened through their trigger button and options are picked by role.
 */

export type ScheduleFrequency = 'hour' | 'day' | 'week' | 'month' | 'custom';

export const selectOnDemandSchedule = async (page: Page) => {
  await page.getByTestId('schedular-on-demand').click();

  await expect(page.getByTestId('cron-container')).not.toBeVisible();
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

const selectOption = async (page: Page, testId: string, option: string) => {
  await page.getByTestId(testId).getByRole('button').click();
  await page.getByRole('option', { name: option, exact: true }).click();
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
  await page.getByTestId('custom-cron-input').fill(cron);
};
