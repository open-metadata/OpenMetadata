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

import { Select } from 'antd';
import { isEmpty, toNumber } from 'lodash';
import React from 'react';
import {
  combinations,
  getDayCron,
  getDayOptions,
  getHourCron,
  getHourOptions,
  getMinuteOptions,
  getPeriodOptions,
  getWeekCron,
  SELECTED_PERIOD_OPTIONS,
  toDisplay,
} from '../components/common/CronEditor/CronEditor.constant';
import {
  Combination,
  CronOption,
  CronType,
  CronValue,
  SelectedDayOption,
  SelectedHourOption,
  SelectedYearOption,
  StateValue,
  ToDisplay,
} from '../components/common/CronEditor/CronEditor.interface';
import { CronTypes } from '../enums/Cron.enum';
import { AppType } from '../generated/entity/applications/app';

export const getQuartzCronExpression = (state: StateValue) => {
  const {
    selectedPeriod,
    selectedHourOption,
    selectedDayOption,
    selectedWeekOption,
  } = state;

  switch (selectedPeriod) {
    case 'hour':
      return `0 ${selectedHourOption.min} * * * ?`;
    case 'day':
      return `0 ${selectedDayOption.min} ${selectedDayOption.hour} * * ?`;
    case 'week':
      return `0 ${selectedWeekOption.min} ${selectedWeekOption.hour} ? * ${
        // Quartz cron format accepts 1-7 or SUN-SAT so need to increment index by 1
        // Ref: https://www.quartz-scheduler.org/api/2.1.7/org/quartz/CronExpression.html
        selectedWeekOption.dow + 1
      }`;
    default:
      return null;
  }
};

export const getCron = (state: StateValue) => {
  const {
    selectedPeriod,
    selectedHourOption,
    selectedDayOption,
    selectedWeekOption,
  } = state;

  switch (selectedPeriod) {
    case 'hour':
      return getHourCron(selectedHourOption);
    case 'day':
      return getDayCron(selectedDayOption);
    case 'week':
      return getWeekCron(selectedWeekOption);
    default:
      return null;
  }
};

const getCronType = (cronStr: string) => {
  for (const c in combinations) {
    if (combinations[c as keyof Combination].test(cronStr)) {
      return c;
    }
  }

  return 'custom';
};

export const getStateValue = (valueStr: string) => {
  const stateVal: StateValue = {
    selectedPeriod: '',
    selectedHourOption: {
      min: 0,
    },
    selectedDayOption: {
      hour: 0,
      min: 0,
    },
    selectedWeekOption: {
      dow: 1,
      hour: 0,
      min: 0,
    },
  };
  const cronType = getCronType(valueStr);

  const d = valueStr ? valueStr.split(' ') : [];
  const v: CronValue = {
    min: d[0],
    hour: d[1],
    dom: d[2],
    mon: d[3],
    dow: d[4],
  };

  stateVal.selectedPeriod = cronType || stateVal.selectedPeriod;

  if (!isEmpty(cronType) && cronType !== 'custom') {
    const stateIndex =
      SELECTED_PERIOD_OPTIONS[(cronType as CronType) || 'hour'];
    const selectedPeriodObj = stateVal[
      stateIndex as keyof StateValue
    ] as SelectedYearOption;

    const targets = toDisplay[cronType as keyof ToDisplay];

    for (const element of targets) {
      const tgt = element;

      if (tgt === 'time') {
        selectedPeriodObj.hour = toNumber(v.hour);
        selectedPeriodObj.min = toNumber(v.min);
      } else {
        selectedPeriodObj[tgt as keyof SelectedYearOption] = toNumber(
          v[tgt as keyof CronValue]
        );
      }
    }
  }

  return stateVal;
};

export const getCronInitialValue = (appType: AppType, appName: string) => {
  const value = {
    min: 0,
    hour: 0,
  };

  let initialValue = getHourCron(value);

  if (appName === 'DataInsightsReportApplication') {
    initialValue = getWeekCron({ ...value, dow: 0 });
  } else if (appType === AppType.External) {
    initialValue = getDayCron(value);
  }

  return initialValue;
};

const getOptionComponent = () => {
  const optionRenderer = (o: CronOption) => {
    return { label: o.label, value: o.value };
  };

  return optionRenderer;
};

export const getCronOptions = () => {
  const periodOptions = getPeriodOptions();
  const dayOptions = getDayOptions();

  return {
    periodOptions,
    dayOptions,
  };
};

export const getHourMinuteSelect = ({
  cronType,
  disabled,
  selectedDayOption,
  selectedHourOption,
  onChange,
}: {
  cronType: CronTypes.MINUTE | CronTypes.HOUR;
  disabled: boolean;
  selectedDayOption?: SelectedDayOption;
  selectedHourOption?: SelectedHourOption;
  onChange: (value: number) => void;
}) => (
  <Select
    className="w-full"
    data-testid={`${cronType}-options`}
    disabled={disabled}
    id={`${cronType}-select`}
    options={
      cronType === CronTypes.MINUTE
        ? getMinuteOptions().map(getOptionComponent())
        : getHourOptions().map(getOptionComponent())
    }
    value={
      cronType === CronTypes.MINUTE
        ? selectedHourOption?.min
        : selectedDayOption?.hour
    }
    onChange={onChange}
  />
);
