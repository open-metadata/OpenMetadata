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
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pluralize } from '../../../utils/CommonUtils';
import { getCron } from '../../../utils/CronUtils';
import {
  combinations,
  getDayOptions,
  getHourOptions,
  getMinuteOptions,
  getMinuteSegmentOptions,
  getMonthDaysOptions,
  getMonthOptions,
  getPeriodOptions,
  toDisplay,
} from './CronEditor.constant';
import {
  Combination,
  CronEditorProp,
  CronOption,
  CronValue,
  SelectedDayOption,
  SelectedHourOption,
  SelectedYearOption,
  StateValue,
  ToDisplay,
} from './CronEditor.interface';

const CronEditor: FC<CronEditorProp> = (props) => {
  const { t } = useTranslation();
  const getCronType = (cronStr: string) => {
    for (const c in combinations) {
      if (combinations[c as keyof Combination].test(cronStr)) {
        return c;
      }
    }

    return undefined;
  };
  const getStateValue = (valueStr: string) => {
    const stateVal: StateValue = {
      selectedPeriod: '',
      selectedMinOption: {
        min: 5,
      },
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

    if (!isEmpty(t)) {
      const stateIndex = `${t('label.selected-lowercase')}${cronType
        ?.charAt(0)
        .toUpperCase()}${cronType?.substring(1)}${t('label.option')}`;
      const selectedPeriodObj = stateVal[
        stateIndex as keyof StateValue
      ] as SelectedYearOption;

      const targets = toDisplay[cronType as keyof ToDisplay];

      for (let i = 0; i < targets.length; i++) {
        const tgt = targets[i];

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
  const [value, setCronValue] = useState(props.value || '');
  const [state, setState] = useState(getStateValue(value));
  const [periodOptions] = useState(getPeriodOptions());
  const [minuteSegmentOptions] = useState(getMinuteSegmentOptions());
  const [minuteOptions] = useState(getMinuteOptions());
  const [hourOptions] = useState(getHourOptions());
  const [dayOptions] = useState(getDayOptions());
  const [monthDaysOptions] = useState(getMonthDaysOptions());
  const [monthOptions] = useState(getMonthOptions());

  const filteredPeriodOptions = useMemo(() => {
    const { includePeriodOptions } = props;
    if (includePeriodOptions) {
      return periodOptions.filter((option) =>
        includePeriodOptions.includes(option.label)
      );
    } else {
      return periodOptions;
    }
  }, [props, periodOptions]);

  const { className, disabled } = props;
  const { selectedPeriod } = state;

  const startText = t('label.schedule-to-run-every');
  const cronPeriodString = `${startText} ${selectedPeriod}`;

  const changeValue = (state: StateValue) => {
    const { onChange } = props;

    setCronValue(getCron(state) ?? '');
    onChange(getCron(state) ?? '');
  };

  const onPeriodSelect = (value: string) => {
    changeValue({ ...state, selectedPeriod: value });
    setState((prev) => ({ ...prev, selectedPeriod: value }));
  };

  const onHourOptionSelect = (value: number, key: string) => {
    const obj = { [key]: value };

    const { selectedHourOption } = state;
    const hourOption = Object.assign({}, selectedHourOption, obj);
    changeValue({ ...state, selectedHourOption: hourOption });
    setState((prev) => ({ ...prev, selectedHourOption: hourOption }));
  };

  const onMinOptionSelect = (value: number, key: string) => {
    const obj = { [key]: value };

    const { selectedMinOption } = state;
    const minOption = Object.assign({}, selectedMinOption, obj);
    changeValue({ ...state, selectedMinOption: minOption });
    setState((prev) => ({ ...prev, selectedMinOption: minOption }));
  };

  const onDayOptionSelect = (value: number, key: string) => {
    const obj = { [key]: value };

    const { selectedDayOption } = state;
    const dayOption = Object.assign({}, selectedDayOption, obj);
    changeValue({ ...state, selectedDayOption: dayOption });
    setState((prev) => ({ ...prev, selectedDayOption: dayOption }));
  };

  const onWeekOptionSelect = (value: number, key: string) => {
    const obj = {
      [key]: value,
    };

    const { selectedWeekOption } = state;
    const weekOption = Object.assign({}, selectedWeekOption, obj);
    changeValue({ ...state, selectedWeekOption: weekOption });
    setState((prev) => ({ ...prev, selectedWeekOption: weekOption }));
  };

  const onMonthOptionSelect = (value: number, key: string) => {
    const obj = { [key]: value };

    const { selectedMonthOption } = state;
    const monthOption = Object.assign({}, selectedMonthOption, obj);
    changeValue({ ...state, selectedMonthOption: monthOption });
    setState((prev) => ({ ...prev, selectedMonthOption: monthOption }));
  };

  const onYearOptionSelect = (value: number, key: string) => {
    const obj = {
      [key]: value,
    };

    const { selectedYearOption } = state;
    const yearOption = Object.assign({}, selectedYearOption, obj);
    changeValue({ ...state, selectedYearOption: yearOption });
    setState((prev) => ({ ...prev, selectedYearOption: yearOption }));
  };

  const getOptionComponent = () => {
    const optionRenderer = (o: CronOption) => {
      return { label: o.label, value: o.value };
    };

    return optionRenderer;
  };

  const getTextComp = (str: string) => {
    return <div data-testid="schedule-description">{str}</div>;
  };

  const findHourOption = (hour: number) => {
    return hourOptions.find((h) => {
      return h.value === hour;
    });
  };

  const findMinuteOption = (min: number) => {
    return minuteOptions.find((h) => {
      return h.value === min;
    });
  };

  const getHourSelect = (
    selectedOption: SelectedDayOption,
    onChangeCB: (value: number) => void
  ) => {
    const { disabled } = props;

    return (
      <Select
        className="w-full"
        data-testid="hour-options"
        disabled={disabled}
        id="hour-select"
        options={hourOptions.map(getOptionComponent())}
        value={selectedOption.hour}
        onChange={onChangeCB}
      />
    );
  };
  const getMinuteSelect = (
    selectedOption: SelectedHourOption,
    onChangeCB: (value: number) => void
  ) => {
    const { disabled } = props;

    return (
      <Select
        className="w-full"
        data-testid="minute-options"
        disabled={disabled}
        id="minute-select"
        options={minuteOptions.map(getOptionComponent())}
        value={selectedOption.min}
        onChange={onChangeCB}
      />
    );
  };

  const getMinuteSegmentSelect = (
    selectedOption: SelectedHourOption,
    onChangeCB: (value: number) => void
  ) => {
    return (
      <Select
        className="w-full"
        data-testid="minute-segment-options"
        disabled={props.disabled}
        id="minute-segment-select"
        options={minuteSegmentOptions.map(getOptionComponent())}
        value={selectedOption.min}
        onChange={onChangeCB}
      />
    );
  };

  const getBadgeOptions = (
    options: CronOption[],
    value: number,
    substrVal: number,
    onClick: (value: number) => void
  ) => {
    const { disabled } = props;
    const optionComps: JSX.Element[] = [];

    options.forEach((o, i) => {
      let strVal = o.label;

      if (substrVal) {
        strVal = strVal.substr(0, substrVal);
      }
      const comp = (
        <span
          className={`cron-badge-option ${o.value === value ? 'active' : ''} ${
            disabled || !onClick ? 'disabled' : ''
          }`}
          data-value={o.value}
          key={i}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onClick={(e: any) => onClick?.(Number(e.target.dataset.value) ?? '')}>
          {strVal}
        </span>
      );

      optionComps.push(comp);
    });

    return optionComps;
  };

  const getMinuteComponent = (cronPeriodString: string) => {
    const { selectedMinOption } = state;

    return (
      state.selectedPeriod === 'minute' && (
        <>
          <div className="tw-mb-1.5" data-testid="minute-segment-container">
            <label>{`${t('label.minute')}:`}</label>
            {getMinuteSegmentSelect(selectedMinOption, (value: number) =>
              onMinOptionSelect(value, 'min')
            )}
          </div>
          <div className="tw-col-span-2">
            {getTextComp(
              `${cronPeriodString} ${selectedMinOption.min} minutes`
            )}
          </div>
        </>
      )
    );
  };

  const getHourComponent = (cronPeriodString: string) => {
    const { selectedHourOption } = state;

    return (
      state.selectedPeriod === 'hour' && (
        <>
          <div className="tw-mb-1.5" data-testid="hour-segment-container">
            <label>{`${t('label.minute')}:`}</label>
            {getMinuteSelect(selectedHourOption, (value: number) =>
              onHourOptionSelect(value, 'min')
            )}
          </div>
          <div className="tw-col-span-2">
            {getTextComp(
              `${cronPeriodString} ${pluralize(
                +selectedHourOption.min,
                'minute'
              )} past the hour`
            )}
          </div>
        </>
      )
    );
  };

  const getDayComponent = (cronPeriodString: string) => {
    const { selectedDayOption } = state;

    const hourLabel = findHourOption(selectedDayOption.hour)?.label;
    const minuteLabel = findMinuteOption(selectedDayOption.min)?.label;

    return (
      state.selectedPeriod === 'day' && (
        <>
          <div className="tw-mb-1.5" data-testid="day-segment-container">
            <label>{`${t('label.time')}:`}</label>
            <div className="tw-flex" data-testid="time-option-container">
              {getHourSelect(selectedDayOption, (value: number) =>
                onDayOptionSelect(value, 'hour')
              )}
              <span className="tw-mx-2 tw-self-center">:</span>
              {getMinuteSelect(selectedDayOption, (value: number) =>
                onDayOptionSelect(value, 'min')
              )}
            </div>
          </div>
          <div className="tw-col-span-2">
            {getTextComp(`${cronPeriodString} at ${hourLabel}:${minuteLabel}`)}
          </div>
        </>
      )
    );
  };

  const getWeekComponent = (cronPeriodString: string) => {
    const { selectedWeekOption } = state;

    const hourLabel = findHourOption(selectedWeekOption.hour)?.label;
    const minuteLabel = findMinuteOption(selectedWeekOption.min)?.label;

    const dayLabel = dayOptions.find((d) => {
      return d.value === selectedWeekOption.dow;
    })?.label;

    return (
      state.selectedPeriod === 'week' && (
        <>
          <div className="tw-mb-1.5" data-testid="week-segment-time-container">
            <label>{`${t('label.time')}:`}</label>
            <div
              className="tw-flex"
              data-testid="week-segment-time-options-container">
              {getHourSelect(selectedWeekOption, (value: number) =>
                onWeekOptionSelect(value, 'hour')
              )}
              <span className="tw-mx-2 tw-self-center">:</span>
              {getMinuteSelect(selectedWeekOption, (value: number) =>
                onWeekOptionSelect(value, 'min')
              )}
            </div>
          </div>
          <div
            className="tw-pt-2"
            data-testid="week-segment-day-option-container">
            <span>{`${t('label.day')}:`}</span>
            <div className="cron-badge-option-container week-opt-container">
              {getBadgeOptions(
                dayOptions,
                selectedWeekOption.dow,
                1,
                (value: number) => onWeekOptionSelect(value, 'dow')
              )}
            </div>
          </div>
          <div className="tw-col-span-2">
            {getTextComp(
              `${cronPeriodString} on ${dayLabel} at ${hourLabel}:${minuteLabel}`
            )}
          </div>
        </>
      )
    );
  };

  const getMonthComponent = (cronPeriodString: string) => {
    const { selectedMonthOption } = state;

    const hourLabel = findHourOption(selectedMonthOption.hour)?.label;
    const minuteLabel = findMinuteOption(selectedMonthOption.min)?.label;

    const dateLabel = monthDaysOptions.find((d) => {
      return d.value === selectedMonthOption.dom;
    })?.label;

    return (
      state.selectedPeriod === 'month' && (
        <>
          <div className="cron-field-row">
            <span className="m-l-xs">{`${t('label.date')}:`}</span>
            <div className="cron-badge-option-container month-opt-container">
              {getBadgeOptions(
                monthDaysOptions,
                selectedMonthOption.dom,
                0,
                (value: number) => onMonthOptionSelect(value, 'dom')
              )}
            </div>
          </div>
          <div className="cron-field-row">
            <span className="m-l-xs">{`${t('label.time')}:`}</span>
            {`${getHourSelect(selectedMonthOption, (e: number) =>
              onMonthOptionSelect(e, 'hour')
            )}
            :
            ${getMinuteSelect(selectedMonthOption, (e: number) =>
              onMonthOptionSelect(e, 'min')
            )}`}
          </div>
          {getTextComp(
            `${cronPeriodString} on ${dateLabel} at ${hourLabel}:${minuteLabel}`
          )}
        </>
      )
    );
  };

  const getYearComponent = (cronPeriodString: string) => {
    const { selectedYearOption } = state;

    const hourLabel = findHourOption(selectedYearOption.hour)?.label;
    const minuteLabel = findMinuteOption(selectedYearOption.min)?.label;

    const dateLabel = monthDaysOptions.find((d) => {
      return d.value === selectedYearOption.dom;
    })?.label;
    const monthLabel = monthOptions.find((d) => {
      return d.value === selectedYearOption.mon;
    })?.label;

    return (
      state.selectedPeriod === 'year' && (
        <>
          <div className="cron-field-row">
            <span className="m-l-xs">{`${t('label.month')}:`}</span>
            <div className="cron-badge-option-container month-opt-container">
              {getBadgeOptions(
                monthOptions,
                selectedYearOption.mon,
                3,
                (value: number) => onYearOptionSelect(value, 'mon')
              )}
            </div>
          </div>
          <div className="cron-field-row">
            <span className="m-l-xs">{`${t('label.date')}:`}</span>
            <div className="cron-badge-option-container month-opt-container">
              {getBadgeOptions(
                monthDaysOptions,
                selectedYearOption.dom,
                0,
                (value: number) => onYearOptionSelect(value, 'dom')
              )}
            </div>
          </div>
          <div className="cron-field-row">
            <span className="m-l-xs">{`${t('label.time')}:`}</span>
            {`${getHourSelect(selectedYearOption, (value: number) =>
              onYearOptionSelect(value, 'hour')
            )}
            :
            ${getMinuteSelect(selectedYearOption, (value: number) =>
              onYearOptionSelect(value, 'min')
            )}`}
          </div>
          {getTextComp(
            `${cronPeriodString} on ${dateLabel} of ${monthLabel} at ${hourLabel}:${minuteLabel}`
          )}
        </>
      )
    );
  };

  return (
    <div className={`${className} cron-row`} data-testid="cron-container">
      <div className="">
        <div className="tw-grid tw-grid-cols-2 tw-gap-4">
          <div className="tw-mb-1.5" data-testid="time-dropdown-container">
            <label htmlFor="cronType">{`${t('label.every')}:`}</label>
            <Select
              className="w-full"
              data-testid="cron-type"
              disabled={disabled}
              id="cronType"
              options={filteredPeriodOptions.map(({ label, value }) => ({
                label,
                value,
              }))}
              value={selectedPeriod}
              onChange={onPeriodSelect}
            />
          </div>

          {getMinuteComponent(startText)}
          {getHourComponent(cronPeriodString)}
          {getDayComponent(cronPeriodString)}
          {getWeekComponent(cronPeriodString)}
          {getMonthComponent(cronPeriodString)}
          {getYearComponent(cronPeriodString)}
          {isEmpty(value) && (
            <p className="tw-col-span-2" data-testid="manual-segment-container">
              {t('message.pipeline-will-trigger-manually')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CronEditor;
