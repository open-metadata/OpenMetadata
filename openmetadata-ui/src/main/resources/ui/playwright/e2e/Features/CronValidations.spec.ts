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

import { PLAYWRIGHT_BASIC_TEST_TAG_OBJ } from '../../constant/config';
import { expect, test } from '../../support/fixtures/base';
import { redirectToHomePage } from '../../utils/common';
import { waitForAllLoadersToDisappear } from '../../utils/entity';
import {
  selectScheduleFrequency,
  selectScheduleType,
  setCustomCron,
} from '../../utils/scheduleInterval';

// use the admin user to login
test.use({
  storageState: 'playwright/.auth/admin.json',
});

test.describe('Cron Validations', PLAYWRIGHT_BASIC_TEST_TAG_OBJ, () => {
  const cronInvalidMessage =
    'Cron expression must have exactly 5 fields (minute hour day-of-month month day-of-week)';

  const cronInvalidDayOfWeekMessage =
    'Invalid day-of-week field. Must be 0-6, *, */n, or comma-separated values';

  test('Validate different cron expressions', async ({ page }) => {
    await redirectToHomePage(page);

    // Navigate to Settings > Applications > Search Indexing Application
    await page.goto('/settings/apps/SearchIndexingApplication');
    await waitForAllLoadersToDisappear(page);

    await page.click('[data-testid="edit-button"]');
    await selectScheduleType(page);
    await selectScheduleFrequency(page, 'custom');

    // Check Valid Crons

    // Check '0 0 * * *' to be valid
    await setCustomCron(page, '0 0 * * *');

    await expect(page.getByText('At 12:00 AM, every day')).toBeAttached();
    await expect(page.getByTestId('custom-cron-error')).not.toBeAttached();

    // Field-count validation takes precedence over field-specific errors.
    await setCustomCron(page, '0 0 1/3 * * 1');

    await expect(page.getByTestId('custom-cron-error')).toHaveText(
      cronInvalidMessage
    );

    // Check '0 0 * * 1-6' to be valid
    await setCustomCron(page, '0 0 * * 1-6');

    await expect(
      page.getByText('At 12:00 AM, Monday through Saturday')
    ).toBeAttached();
    await expect(page.getByTestId('custom-cron-error')).not.toBeAttached();

    // Check Invalid crons

    // Check every minute frequency throws an error
    await setCustomCron(page, '0/1 0 * * *');

    await expect(page.getByTestId('custom-cron-error')).toHaveText(
      'Cron schedule too frequent. Please choose at least 1-hour intervals.'
    );

    // Check six-field expressions are rejected
    await setCustomCron(page, '0/1 0 * * * 1');

    await expect(page.getByTestId('custom-cron-error')).toHaveText(
      cronInvalidMessage
    );

    // Check '0 0 * * 7' to be invalid
    await setCustomCron(page, '0 0 * * 7');

    await expect(page.getByTestId('custom-cron-error')).toHaveText(
      cronInvalidDayOfWeekMessage
    );

    // Check '0 0 * * 1 7' to be invalid
    await setCustomCron(page, '0 0 * * 1 7');

    await expect(page.getByTestId('custom-cron-error')).toHaveText(
      cronInvalidMessage
    );

    // Check '0 0 * * 1 7 67' to be invalid
    await setCustomCron(page, '0 0 * * 1 7 67');

    await expect(page.getByTestId('custom-cron-error')).toHaveText(
      cronInvalidMessage
    );

    // Check '0 0 * * 0-7' to be invalid
    await setCustomCron(page, '0 0 * * 0-7');

    await expect(page.getByTestId('custom-cron-error')).toHaveText(
      cronInvalidDayOfWeekMessage
    );

    // Check '0 0 * * 7-9' to be invalid
    await setCustomCron(page, '0 0 * * 7-9');

    await expect(page.getByTestId('custom-cron-error')).toHaveText(
      cronInvalidDayOfWeekMessage
    );

    // Check '0 0 * * -1-9' to be invalid
    await setCustomCron(page, '0 0 * * -1-9');

    await expect(page.getByTestId('custom-cron-error')).toHaveText(
      cronInvalidDayOfWeekMessage
    );

    await setCustomCron(page, '0 18 * * Fri	');

    await expect(page.getByText('At 06:00 PM, only on Friday')).toBeAttached();
    await expect(page.getByTestId('custom-cron-error')).not.toBeAttached();
  });
});
