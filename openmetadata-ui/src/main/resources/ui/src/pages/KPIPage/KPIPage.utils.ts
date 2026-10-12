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
import { KPIFormValues } from './KPIPage.interface';

export const normalizeKpiDates = (
  changes: Partial<KPIFormValues>,
  values: KPIFormValues
): Partial<Pick<KPIFormValues, 'startDate' | 'endDate'>> => {
  const updates: Partial<Pick<KPIFormValues, 'startDate' | 'endDate'>> = {};
  if (changes.startDate) {
    const startDate = changes.startDate.startOf('day');
    updates.startDate = startDate;
    if (values.endDate && startDate > values.endDate) {
      // resetField would restore the server's original end date on an edit form.
      updates.endDate = null;
    }
  }
  if (changes.endDate) {
    updates.endDate = changes.endDate.endOf('day');
    if (values.startDate && updates.endDate < values.startDate) {
      updates.startDate = changes.endDate.startOf('day');
    }
  }

  return updates;
};
