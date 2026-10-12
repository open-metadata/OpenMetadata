/*
 *  Copyright 2023 Collate.
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
import { KPIFormValues } from './KPIPage.interface';
import { normalizeKpiDates } from './KPIPage.utils';
const date = (day: number) =>
  DateTime.fromObject(
    { year: 2026, month: 10, day, hour: 14 },
    { zone: 'Asia/Kolkata' }
  );
const values = { startDate: date(12), endDate: date(16) } as KPIFormValues;

it('clears a loaded end date when a new start moves beyond it', () => {
  const updated = normalizeKpiDates({ startDate: date(20) }, values);

  expect(updated.startDate?.toISO()).toBe(date(20).startOf('day').toISO());
  expect(updated.endDate).toBeNull();
});

it('moves the start to the beginning of an earlier end day', () => {
  const updated = normalizeKpiDates({ endDate: date(10) }, values);

  expect(updated.startDate?.toISO()).toBe(date(10).startOf('day').toISO());
  expect(updated.endDate?.toISO()).toBe(date(10).endOf('day').toISO());
});

it('keeps an existing valid range and does not revive a cleared date', () => {
  expect(normalizeKpiDates({ startDate: date(14) }, values)).toEqual({
    startDate: date(14).startOf('day'),
  });
  expect(normalizeKpiDates({ endDate: null }, values)).toEqual({});
});
