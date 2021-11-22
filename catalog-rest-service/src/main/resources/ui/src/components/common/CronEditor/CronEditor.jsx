/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

/* eslint-disable */

import React, { useState } from 'react';
import {
  combinations,
  getDayCron,
  getDayOptions,
  getHourCron,
  getHourOptions,
  getMinuteCron,
  getMinuteOptions,
  getMonthCron,
  getMonthDaysOptions,
  getMonthOptions,
  getPeriodOptions,
  getWeekCron,
  getYearCron,
  toDisplay,
} from './CronEditor.constant';

const getCron = (state) => {
  const {
    selectedPeriod,
    selectedHourOption,
    selectedDayOption,
    selectedWeekOption,
    selectedMonthOption,
    selectedYearOption,
  } = state;

  switch (selectedPeriod) {
    case 'minute':
      return getMinuteCron({});
    case 'hour':
      return getHourCron(selectedHourOption);
    case 'day':
      return getDayCron(selectedDayOption);
    case 'week':
      return getWeekCron(selectedWeekOption);
    case 'month':
      return getMonthCron(selectedMonthOption);
    case 'year':
      return getYearCron(selectedYearOption);
    default:
      return '* * * * *';
  }
};

const CronEditor = (props) => {
  const getCronType = (cron_str) => {
    for (let t in combinations) {
      if (combinations[t].test(cron_str)) {
        return t;
      }
    }

    return undefined;
  };
  const getStateValue = (valueStr) => {
    let stateVal = {
      selectedPeriod: 'week',
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
      selectedMonthOption: {
        dom: 1,
        hour: 0,
        min: 0,
      },
      selectedYearOption: {
        dom: 1,
        mon: 1,
        hour: 0,
        min: 0,
      },
    };
    let t = getCronType(valueStr);

    let d = valueStr.split(' ');
    let v = {
      min: d[0],
      hour: d[1],
      dom: d[2],
      mon: d[3],
      dow: d[4],
    };

    stateVal.selectedPeriod = t || stateVal.selectedPeriod;

    const selectedPeriodObj =
      stateVal[
        'selected' + (t.charAt(0).toUpperCase() + t.substr(1)) + 'Option'
      ];

    let targets = toDisplay[t];

    for (let i = 0; i < targets.length; i++) {
      let tgt = targets[i];

      if (tgt == 'time') {
        selectedPeriodObj.hour = v.hour;
        selectedPeriodObj.min = v.min;
      } else {
        selectedPeriodObj[tgt] = v[tgt];
      }
    }

    return stateVal;
  };
  const [value, setCronValue] = useState(props.value || '0 0 * * 0');
  const [state, setState] = useState(getStateValue(value));
  const [periodOptions, setPeriodOptions] = useState(getPeriodOptions());
  const [minuteOptions, setMinuteOptions] = useState(getMinuteOptions());
  const [hourOptions, setHourOptions] = useState(getHourOptions());
  const [dayOptions, setDayOptions] = useState(getDayOptions());
  const [monthDaysOptions, setMonthDaysOptions] = useState(
    getMonthDaysOptions()
  );
  const [monthOptions, setMonthOptions] = useState(getMonthOptions());

  const { className, disabled } = props;
  const { selectedPeriod } = state;

  const option = periodOptions.find((o) => o.value === selectedPeriod);

  const startText = 'Repeat every';
  const cronPeriodString = `${startText} ${selectedPeriod}`;

  const changeValue = (state) => {
    const { onChange } = props;

    setCronValue(getCron(state));
    onChange(getCron(state));
  };

  const onPeriodSelect = (event) => {
    changeValue({ ...state, selectedPeriod: event.target.value });
    setState((prev) => ({ ...prev, selectedPeriod: event.target.value }));
  };

  const onHourOptionSelect = (event, key) => {
    const value = event.target.value;
    const obj = {};

    obj[key] = value;
    const { selectedHourOption } = state;
    const hourOption = Object.assign({}, selectedHourOption, obj);
    changeValue({ ...state, selectedHourOption: hourOption });
    setState((prev) => ({ ...prev, selectedHourOption: hourOption }));
  };

  const onDayOptionSelect = (event, key) => {
    const value = event.target.value;
    const obj = {};

    obj[key] = value;
    const { selectedDayOption } = state;
    const dayOption = Object.assign({}, selectedDayOption, obj);
    changeValue({ ...state, selectedDayOption: dayOption });
    setState((prev) => ({ ...prev, selectedDayOption: dayOption }));
  };

  const onWeekOptionSelect = (event, key) => {
    const value = event.target.value || event.target.dataset.value;
    const obj = {};

    obj[key] = value;
    const { selectedWeekOption } = state;
    const weekOption = Object.assign({}, selectedWeekOption, obj);
    changeValue({ ...state, selectedWeekOption: weekOption });
    setState((prev) => ({ ...prev, selectedWeekOption: weekOption }));
  };

  const onMonthOptionSelect = (event, key) => {
    const value = event.target.value || event.target.dataset.value;
    const obj = {};

    obj[key] = value;
    const { selectedMonthOption } = state;
    const monthOption = Object.assign({}, selectedMonthOption, obj);
    changeValue({ ...state, selectedMonthOption: monthOption });
    setState((prev) => ({ ...prev, selectedMonthOption: monthOption }));
  };

  const onYearOptionSelect = (event, key) => {
    const value = event.target.value || event.target.dataset.value;
    const obj = {};

    obj[key] = value;
    const { selectedYearOption } = state;
    const yearOption = Object.assign({}, selectedYearOption, obj);
    changeValue({ ...state, selectedYearOption: yearOption });
    setState((prev) => ({ ...prev, selectedYearOption: yearOption }));
  };

  const getOptionComponent = (key) => {
    return (o, i) => {
      return (
        <option key={`${key}_${i}`} value={o.value}>
          {o.label}
        </option>
      );
    };
  };

  const getTextComp = (str) => {
    return <div className="cron-string">{str}</div>;
  };

  const findHourOption = (hour) => {
    return hourOptions.find((h) => {
      return h.value == hour;
    });
  };

  const findMinuteOption = (min) => {
    return minuteOptions.find((h) => {
      return h.value == min;
    });
  };

  const getHourSelect = (selectedOption, onChangeCB) => {
    const { disabled } = props;

    return (
      <select
        className="tw-form-inputs tw-py-1 tw-ml-2 tw-px-1"
        disabled={disabled}
        value={selectedOption.hour}
        onChange={(e) => {
          e.persist();
          onChangeCB(e);
        }}>
        {hourOptions.map(getOptionComponent('hour_option'))}
      </select>
    );
  };
  const getMinuteSelect = (selectedOption, onChangeCB) => {
    const { disabled } = props;

    return (
      <select
        className="tw-form-inputs tw-py-1 tw-px-1"
        disabled={disabled}
        value={selectedOption.min}
        onChange={(e) => {
          e.persist();
          onChangeCB(e);
        }}>
        {minuteOptions.map(getOptionComponent('minute_option'))}
      </select>
    );
  };
  const getBadgeOptions = (options, value, substrVal, onClick) => {
    const { disabled } = props;
    const optionComps = [];

    options.forEach((o, i) => {
      let strVal = o.label;

      if (substrVal) {
        strVal = strVal.substr(0, substrVal);
      }
      const comp = (
        <span
          className={`cron-badge-option ${o.value == value ? 'active' : ''} ${
            disabled || !onClick ? 'disabled' : ''
          }`}
          data-value={o.value}
          key={i}
          onClick={(e) => onClick?.(e)}>
          {strVal}
        </span>
      );

      optionComps.push(comp);
    });

    return optionComps;
  };

  const getMinuteComponent = (cronPeriodString) => {
    return (
      state.selectedPeriod === 'minute' && (
        <cron-minute-component>
          {getTextComp(`${cronPeriodString}`)}
        </cron-minute-component>
      )
    );
  };

  const getHourComponent = (cronPeriodString) => {
    const { selectedHourOption } = state;

    return (
      state.selectedPeriod === 'hour' && (
        <cron-hour-component>
          <div className="cron-field-row">
            <span className="m-l-xs">Day : </span>
            <div className="cron-badge-option-container week-opt-container">
              {getBadgeOptions(dayOptions, -1, 1, null)}
            </div>
          </div>
          <div className="tw-flex tw-justify-center tw-items-center">
            <label className="tw-mr-2 tw-flex-none tw-mt-1">Minute :</label>
            {getMinuteSelect(selectedHourOption, (e) =>
              onHourOptionSelect(e, 'min')
            )}
          </div>

          {getTextComp(
            `${cronPeriodString} ${selectedHourOption.min} minute past the hour`
          )}
        </cron-hour-component>
      )
    );
  };

  const getDayComponent = (cronPeriodString) => {
    const { selectedDayOption } = state;

    const hourLabel = findHourOption(selectedDayOption.hour).label;
    const minuteLabel = findMinuteOption(selectedDayOption.min).label;

    return (
      state.selectedPeriod === 'day' && (
        <cron-day-component>
          <div className="cron-field-row">
            <span className="m-l-xs">Day : </span>
            <div className="cron-badge-option-container week-opt-container">
              {getBadgeOptions(dayOptions, -1, 1, null)}
            </div>
          </div>
          <div className="tw-flex">
            <label className="tw-mt-1">Time :</label>
            <div className="tw-flex">
              {getHourSelect(selectedDayOption, (e) =>
                onDayOptionSelect(e, 'hour')
              )}
              <span className="tw-mx-2 tw-self-center">:</span>
              {getMinuteSelect(selectedDayOption, (e) =>
                onDayOptionSelect(e, 'min')
              )}
            </div>
          </div>
          {getTextComp(`${cronPeriodString} at ${hourLabel}:${minuteLabel}`)}
        </cron-day-component>
      )
    );
  };

  const getWeekComponent = (cronPeriodString) => {
    const { selectedWeekOption } = state;

    const hourLabel = findHourOption(selectedWeekOption.hour).label;
    const minuteLabel = findMinuteOption(selectedWeekOption.min).label;

    const dayLabel = dayOptions.find((d) => {
      return d.value == selectedWeekOption.dow;
    }).label;

    return (
      state.selectedPeriod === 'week' && (
        <cron-week-component>
          <div className="cron-field-row">
            <span className="m-l-xs">Day : </span>
            <div className="cron-badge-option-container week-opt-container">
              {getBadgeOptions(dayOptions, selectedWeekOption.dow, 1, (e) =>
                onWeekOptionSelect(e, 'dow')
              )}
            </div>
          </div>
          <div className="tw-flex">
            <label className="tw-mt-1">Time :</label>
            <div className="tw-flex">
              {getHourSelect(selectedWeekOption, (e) =>
                onWeekOptionSelect(e, 'hour')
              )}
              <span className="tw-mx-2 tw-self-center">:</span>
              {getMinuteSelect(selectedWeekOption, (e) =>
                onWeekOptionSelect(e, 'min')
              )}
            </div>
          </div>

          {getTextComp(
            `${cronPeriodString} on ${dayLabel} at ${hourLabel}:${minuteLabel}`
          )}
        </cron-week-component>
      )
    );
  };

  const getMonthComponent = (cronPeriodString) => {
    const { selectedMonthOption } = state;

    const hourLabel = findHourOption(selectedMonthOption.hour).label;
    const minuteLabel = findMinuteOption(selectedMonthOption.min).label;

    const dateLabel = monthDaysOptions.find((d) => {
      return d.value == selectedMonthOption.dom;
    }).label;

    return (
      state.selectedPeriod === 'month' && (
        <cron-month-component>
          <div className="cron-field-row">
            <span className="m-l-xs">Date : </span>
            <div className="cron-badge-option-container month-opt-container">
              {getBadgeOptions(
                monthDaysOptions,
                selectedMonthOption.dom,
                0,
                (e) => onMonthOptionSelect(e, 'dom')
              )}
            </div>
          </div>
          <div className="cron-field-row">
            <span className="m-l-xs">Time : </span>
            {getHourSelect(selectedMonthOption, (e) =>
              onMonthOptionSelect(e, 'hour')
            )}
            :
            {getMinuteSelect(selectedMonthOption, (e) =>
              onMonthOptionSelect(e, 'min')
            )}
          </div>
          {getTextComp(
            `${cronPeriodString} on ${dateLabel} at ${hourLabel}:${minuteLabel}`
          )}
        </cron-month-component>
      )
    );
  };

  const getYearComponent = (cronPeriodString) => {
    const { selectedYearOption } = state;

    const hourLabel = findHourOption(selectedYearOption.hour).label;
    const minuteLabel = findMinuteOption(selectedYearOption.min).label;

    const dateLabel = monthDaysOptions.find((d) => {
      return d.value == selectedYearOption.dom;
    }).label;
    const monthLabel = monthOptions.find((d) => {
      return d.value == selectedYearOption.mon;
    }).label;

    return (
      state.selectedPeriod === 'year' && (
        <cron-year-component>
          <div className="cron-field-row">
            <span className="m-l-xs">Month : </span>
            <div className="cron-badge-option-container month-opt-container">
              {getBadgeOptions(monthOptions, selectedYearOption.mon, 3, (e) =>
                onYearOptionSelect(e, 'mon')
              )}
            </div>
          </div>
          <div className="cron-field-row">
            <span className="m-l-xs">Date : </span>
            <div className="cron-badge-option-container month-opt-container">
              {getBadgeOptions(
                monthDaysOptions,
                selectedYearOption.dom,
                0,
                (e) => onYearOptionSelect(e, 'dom')
              )}
            </div>
          </div>
          <div className="cron-field-row">
            <span className="m-l-xs">Time : </span>
            {getHourSelect(selectedYearOption, (e) =>
              onYearOptionSelect(e, 'hour')
            )}
            :
            {getMinuteSelect(selectedYearOption, (e) =>
              onYearOptionSelect(e, 'min')
            )}
          </div>
          {getTextComp(
            `${cronPeriodString} on ${dateLabel} of ${monthLabel} at ${hourLabel}:${minuteLabel}`
          )}
        </cron-year-component>
      )
    );
  };

  return (
    <div className={`${className} cron-row`}>
      <div className="">
        <div className="">
          <div className="tw-flex tw-mb-1.5">
            <label className="tw-mb-0 tw-self-center" htmlFor="ingestionType">
              Every:
            </label>
            <select
              className="tw-ml-2 tw-form-inputs tw-py-1"
              disabled={disabled}
              id="ingestionType"
              name="ingestionType"
              value={selectedPeriod}
              onChange={(e) => {
                e.persist();
                onPeriodSelect(e);
              }}>
              {periodOptions.map((t, index) => {
                return (
                  <option key={`period_option_${index}`} value={t.value}>
                    {t.label}
                  </option>
                );
              })}
            </select>
          </div>

          {getMinuteComponent(cronPeriodString)}
          {getHourComponent(cronPeriodString)}
          {getDayComponent(cronPeriodString)}
          {getWeekComponent(cronPeriodString)}
          {getMonthComponent(cronPeriodString)}
          {getYearComponent(cronPeriodString)}
        </div>
      </div>
    </div>
  );
};

export default CronEditor;
