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

export interface ScheduleIntervalHandle {
  submit: () => void;
}

export interface ScheduleIntervalProps {
  value?: string;
  onChange?: (value: string | undefined) => void;
  disabled?: boolean;
  includePeriodOptions?: string[];
  defaultSchedule?: string;
  entity?: string;
  /**
   * Notifies the owner of the submit action whether the scheduler currently
   * holds a usable value. A custom cron that is empty or malformed is reported
   * as invalid so the form can block submission - an empty schedule is only
   * valid through the On Demand card.
   */
  onValidityChange?: (isValid: boolean) => void;
}

export interface WorkflowExtraConfig {
  cron?: string;
  enableDebugLog?: boolean;
}

export interface IngestionExtraConfig {
  retries?: number;
  raiseOnError?: boolean;
}

export interface Combination {
  hour: RegExp;
  day: RegExp;
  week: RegExp;
  month: RegExp;
}
export interface StateValue {
  selectedPeriod: string;
  hour: string;
  min: string;
  dow: string;
  dom: string;
  cron?: string;
}
