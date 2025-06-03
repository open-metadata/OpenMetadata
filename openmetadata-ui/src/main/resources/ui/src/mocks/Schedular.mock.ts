/*
 *  Copyright 2024 Collate.
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

import { StateValue } from '../components/Settings/Services/AddIngestion/Steps/ScheduleInterval.interface';

export const mockOldState1: StateValue = {
  selectedPeriod: 'custom',
  min: '37',
  hour: '1/2',
  dow: '1/4',
  dom: '1/4',
  cron: '37 1/2 1/4 1/4 1/4',
};

export const mockNewFormValue1: StateValue = {
  selectedPeriod: 'hour',
  min: '37',
  hour: '1/2',
  dow: '1/4',
  dom: '1/4',
  cron: '37 1/2 1/4 1/4 1/4',
};

export const mockNewFormValue2: StateValue = {
  selectedPeriod: 'day',
  min: '3/7',
  hour: '1/2',
  dow: '1/4',
  dom: '1/4',
  cron: '3/7 1/2 1/4 1/4 1/4',
};

export const mockNewFormValue3: StateValue = {
  selectedPeriod: 'week',
  min: '37',
  hour: '1/2',
  dow: '1/4',
  dom: '1/4',
  cron: '37 1/2 1/4 1/4 1/4',
};

export const mockNewFormValue4: StateValue = {
  selectedPeriod: 'month',
  min: '37',
  hour: '1/2',
  dow: '1/4',
  dom: '1/4',
  cron: '37 1/2 1/4 1/4 1/4',
};

export const mockNewFormValue5: StateValue = {
  selectedPeriod: 'custom',
  min: '0',
  hour: '23',
  dow: '4',
  dom: '1/4',
  cron: '0 0 * * *',
};
