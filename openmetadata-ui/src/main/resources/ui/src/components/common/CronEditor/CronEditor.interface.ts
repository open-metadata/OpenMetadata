/*
 *  Copyright 2022 Collate.
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

export interface SelectedMinOption {
  min: number;
}

export interface SelectedHourOption {
  min: number;
}

export interface SelectedDayOption {
  hour: number;
  min: number;
}

export interface SelectedWeekOption {
  dow: number;
  hour: number;
  min: number;
}

export interface SelectedMonthOption {
  dom: number;
  hour: number;
  min: number;
}

export interface SelectedYearOption {
  dom: number;
  mon: number;
  hour: number;
  min: number;
}

export interface CronValue {
  min: string;
  hour: string;
  dom: string;
  mon: string;
  dow: string;
}

export interface Combination {
  minute: RegExp;
  hour: RegExp;
  day: RegExp;
  week: RegExp;
  month: RegExp;
  year: RegExp;
}
export interface StateValue {
  selectedPeriod: string;
  selectedMinOption: SelectedMinOption;
  selectedHourOption: SelectedHourOption;
  selectedDayOption: SelectedDayOption;
  selectedWeekOption: SelectedWeekOption;
  selectedMonthOption: SelectedMonthOption;
  selectedYearOption: SelectedYearOption;
}

export interface ToDisplay {
  minute: Array<string>;
  hour: Array<string>;
  day: Array<string>;
  week: Array<string>;
  month: Array<string>;
  year: Array<string>;
}

export interface CronOption {
  label: string;
  value: number;
}

export interface CronEditorProp {
  onChange: (value: string) => void;
  value?: string;
  className?: string;
  disabled?: boolean;
  includePeriodOptions?: string[];
}
