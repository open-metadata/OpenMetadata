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

import { getNextCronRunTimestamp } from './CronUtils';

describe('getNextCronRunTimestamp', () => {
  it('returns the next hourly run in the configured timezone', async () => {
    const currentTimestamp = Date.parse('2026-08-07T11:47:00.000Z');

    await expect(
      getNextCronRunTimestamp('10 * * * *', 'UTC', currentTimestamp)
    ).resolves.toBe(Date.parse('2026-08-07T12:10:00.000Z'));
  });

  it('supports ranges, steps, and named weekdays', async () => {
    const currentTimestamp = Date.parse('2026-08-07T17:30:00.000Z');

    await expect(
      getNextCronRunTimestamp(
        '0 9-17/2 * * MON-FRI',
        'America/New_York',
        currentTimestamp
      )
    ).resolves.toBe(Date.parse('2026-08-07T19:00:00.000Z'));
  });

  it('returns undefined for unsupported or invalid schedules and timezones', async () => {
    await expect(
      getNextCronRunTimestamp('0 10 * * * *', 'UTC')
    ).resolves.toBeUndefined();
    await expect(
      getNextCronRunTimestamp('invalid', 'UTC')
    ).resolves.toBeUndefined();
    await expect(
      getNextCronRunTimestamp('0 0 * * *', 'Invalid/Timezone')
    ).resolves.toBeUndefined();
  });
});
