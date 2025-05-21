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

import { LoadingState } from 'Models';
import { ReactNode } from 'react';
import { SchedularOptions } from '../../../../../enums/Schedular.enum';

export type ScheduleIntervalProps<T> = {
  status: LoadingState;
  initialData?: WorkflowExtraConfig & T;
  defaultSchedule?: string;
  includePeriodOptions?: string[];
  children?: ReactNode;
  disabled?: boolean;
  isEditMode?: boolean;
  onBack?: () => void;
  onDeploy?: (values: WorkflowExtraConfig & T) => void;
  buttonProps?: {
    okText?: string;
    cancelText?: string;
  };
  debugLog?: {
    allow?: boolean;
    initialValue?: boolean;
  };
  topChildren?: ReactNode;
  showActionButtons?: boolean;
  schedularOptions?: {
    title: string;
    description: string;
    value: SchedularOptions;
  }[];
};

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

export interface CronOption {
  label: string;
  value: string;
}
