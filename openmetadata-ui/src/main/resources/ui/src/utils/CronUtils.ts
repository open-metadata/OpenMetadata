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

export const getNextCronRunTimestamp = async (
  scheduleInterval: string,
  timezone = 'UTC',
  currentTimestamp = Date.now()
): Promise<number | undefined> => {
  if (scheduleInterval.trim().split(/\s+/).length !== 5) {
    return undefined;
  }

  try {
    const { CronExpressionParser } = await import('cron-parser');
    const expression = CronExpressionParser.parse(scheduleInterval, {
      currentDate: new Date(currentTimestamp),
      tz: timezone,
    });

    return expression.next().toDate().getTime();
  } catch {
    return undefined;
  }
};
