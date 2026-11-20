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
import { useMemo } from 'react';
import { useLimitStore } from '../../../../context/LimitsProvider/useLimitsStore';
import { App } from '../../../../generated/entity/applications/app';
import { getCronDefaultValue } from '../../../../utils/CronExpressionUtils';
import applicationsClassBase from '../AppDetails/ApplicationsClassBase';

export interface AppScheduleOptions {
  /** Schedule periods the picker offers; `undefined` offers them all. */
  initialOptions?: string[];
  /** Cron the picker starts from when the app has no schedule. */
  defaultCron: string;
}

/** The schedule choices an app allows under the current plan limits, and its default cron. */
export const useAppScheduleOptions = (appData: App): AppScheduleOptions => {
  const { config } = useLimitStore();
  const { pipelineSchedules } =
    config?.limits?.config.featureLimits.find(
      (feature) => feature.name === 'app'
    ) ?? {};

  return useMemo(
    () => ({
      initialOptions: applicationsClassBase.getScheduleOptionsForApp(
        appData.name,
        appData.appType,
        pipelineSchedules
      ),
      defaultCron: getCronDefaultValue(appData.name),
    }),
    [appData.name, appData.appType, pipelineSchedules]
  );
};
