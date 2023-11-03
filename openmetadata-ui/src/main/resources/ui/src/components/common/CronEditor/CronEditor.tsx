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

import { Col, Form, Input, Row, Select } from 'antd';
import classNames from 'classnames';
import cronstrue from 'cronstrue';
import { isEmpty } from 'lodash';
import React, { FC, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { pluralize } from '../../../utils/CommonUtils';
import {
  getCron,
  getQuartzCronExpression,
  getStateValue,
} from '../../../utils/CronUtils';
import {
  getDayOptions,
  getHourOptions,
  getMinuteOptions,
  getMinuteSegmentOptions,
  getMonthDaysOptions,
  getMonthOptions,
  getPeriodOptions,
} from './CronEditor.constant';
import {
  CronEditorProp,
  CronOption,
  SelectedDayOption,
  SelectedHourOption,
  StateValue,
} from './CronEditor.interface';

const CronEditor: FC<CronEditorProp> = (props) => {
  const { t } = useTranslation();

  const [value, setCronValue] = useState(props.value ?? '');
  const [state, setState] = useState(getStateValue(props.value ?? ''));
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

  const { className, disabled, disabledCronChange } = props;
  const { selectedPeriod } = state;

  const startText = t('label.schedule-to-run-every');
  const cronPeriodString = `${startText} ${selectedPeriod}`;

  const changeValue = (state: StateValue) => {
    const { onChange } = props;

    setCronValue(getCron(state) ?? value);
    const cronExp = props.isQuartzCron
      ? getQuartzCronExpression(state)
      : getCron(state);
    onChange(cronExp ?? value);
  };

  const onPeriodSelect = (value: string) => {
    changeValue({ ...state, selectedPeriod: value });
    if (value === 'custom') {
      setCronValue('0 0 * * *');
      props.onChange('0 0 * * *');
    } else if (value === '') {
      setCronValue('');
      props.onChange('');
    }
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
  ) =>
    options.map(({ label, value: optionValue }, index) => {
      let strVal = label;

      if (substrVal) {
        strVal = strVal.substr(0, substrVal);
      }

      return (
        <span
          className={`cron-badge-option ${
            optionValue === value ? 'active' : ''
          } ${props.disabled || !onClick ? 'disabled' : ''}`}
          data-value={optionValue}
          key={index}
          onClick={() => {
            onClick?.(Number(optionValue));
          }}>
          {strVal}
        </span>
      );
    });

  const getMinuteComponent = () => {
    const { selectedMinOption } = state;

    return (
      state.selectedPeriod === 'minute' && (
        <Form.Item
          data-testid="minute-segment-container"
          label={t('label.minute')}
          labelCol={{ span: 24 }}>
          {getMinuteSegmentSelect(selectedMinOption, (value: number) =>
            onMinOptionSelect(value, 'min')
          )}
        </Form.Item>
      )
    );
  };

  const getHourComponent = () => {
    const { selectedHourOption } = state;

    return (
      state.selectedPeriod === 'hour' && (
        <Form.Item
          data-testid="hour-segment-container"
          label={t('label.minute')}
          labelCol={{ span: 24 }}>
          {getMinuteSelect(selectedHourOption, (value: number) =>
            onHourOptionSelect(value, 'min')
          )}
        </Form.Item>
      )
    );
  };

  const getDayComponent = () => {
    const { selectedDayOption } = state;

    return (
      state.selectedPeriod === 'day' && (
        <>
          <Form.Item
            data-testid="day-segment-container"
            label={t('label.time')}
            labelCol={{ span: 24 }}>
            <div className="d-flex" data-testid="time-option-container">
              {getHourSelect(selectedDayOption, (value: number) =>
                onDayOptionSelect(value, 'hour')
              )}
              <span className="m-x-sm self-center">:</span>
              {getMinuteSelect(selectedDayOption, (value: number) =>
                onDayOptionSelect(value, 'min')
              )}
            </div>
          </Form.Item>
        </>
      )
    );
  };

  const getWeekComponent = () => {
    const { selectedWeekOption } = state;

    return (
      state.selectedPeriod === 'week' && (
        <>
          <Col span={12}>
            <Form.Item
              data-testid="week-segment-time-container"
              label={t('label.time')}
              labelCol={{ span: 24 }}>
              <div
                className="d-flex"
                data-testid="week-segment-time-options-container">
                {getHourSelect(selectedWeekOption, (value: number) =>
                  onWeekOptionSelect(value, 'hour')
                )}
                <span className="m-x-sm self-center">:</span>
                {getMinuteSelect(selectedWeekOption, (value: number) =>
                  onWeekOptionSelect(value, 'min')
                )}
              </div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              data-testid="week-segment-day-option-container"
              label={t('label.day')}
              labelCol={{ span: 24 }}>
              <div className="cron-badge-option-container week-opt-container">
                {getBadgeOptions(
                  dayOptions,
                  selectedWeekOption.dow,
                  1,
                  (value: number) => onWeekOptionSelect(value, 'dow')
                )}
              </div>
            </Form.Item>
          </Col>
        </>
      )
    );
  };

  const getMonthComponent = () => {
    const { selectedMonthOption } = state;

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
        </>
      )
    );
  };

  const getYearComponent = () => {
    const { selectedYearOption } = state;

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
        </>
      )
    );
  };

  const displayCronString = useMemo(() => {
    const {
      selectedYearOption,
      selectedWeekOption,
      selectedHourOption,
      selectedMinOption,
      selectedDayOption,
      selectedMonthOption,
      selectedPeriod,
    } = state;

    const dateLabel = monthDaysOptions.find((d) => {
      return d.value === selectedYearOption.dom;
    })?.label;
    const monthLabel = monthOptions.find((d) => {
      return d.value === selectedYearOption.mon;
    })?.label;

    const dayLabel = dayOptions.find((d) => {
      return d.value === selectedWeekOption.dow;
    })?.label;

    let retString = '';

    switch (selectedPeriod) {
      case 'year':
        {
          const hourLabel = findHourOption(selectedYearOption.hour)?.label;
          const minuteLabel = findMinuteOption(selectedYearOption.min)?.label;
          retString = `${cronPeriodString} on ${dateLabel} of ${monthLabel} at ${hourLabel}:${minuteLabel}`;
        }

        break;
      case 'month':
        {
          const hourLabel = findHourOption(selectedMonthOption.hour)?.label;
          const minuteLabel = findMinuteOption(selectedMonthOption.min)?.label;
          retString = `${cronPeriodString} on ${dateLabel} at ${hourLabel}:${minuteLabel}`;
        }

        break;
      case 'week':
        {
          const hourLabel = findHourOption(selectedWeekOption.hour)?.label;
          const minuteLabel = findMinuteOption(selectedWeekOption.min)?.label;
          retString = `${cronPeriodString} on ${dayLabel} at ${hourLabel}:${minuteLabel}`;
        }

        break;
      case 'day':
        {
          const hourLabel = findHourOption(selectedDayOption.hour)?.label;
          const minuteLabel = findMinuteOption(selectedDayOption.min)?.label;
          retString = `${cronPeriodString} at ${hourLabel}:${minuteLabel}`;
        }

        break;
      case 'hour':
        retString = `${cronPeriodString} ${pluralize(
          +selectedHourOption.min,
          'minute'
        )} past the hour`;

        break;
      case 'minute':
        retString = `${startText} ${selectedMinOption.min} minutes`;

        break;
      case 'custom':
        retString = cronstrue.toString(value, {
          throwExceptionOnParseError: false,
        });

        break;
    }

    return <div data-testid="schedule-description">{retString}</div>;
  }, [state, cronPeriodString, startText, value]);

  return (
    <Row
      className={classNames(className, 'cron-row')}
      data-testid="cron-container"
      gutter={[16, 0]}>
      <Col data-testid="time-dropdown-container" span={12}>
        <Form.Item
          initialValue={selectedPeriod}
          label={t('label.every')}
          labelCol={{ span: 24 }}
          name="period">
          <Select
            className="w-full"
            data-testid="cron-type"
            disabled={disabledCronChange || disabled}
            id="cronType"
            options={filteredPeriodOptions.map(({ label, value }) => ({
              label,
              value,
            }))}
            value={selectedPeriod}
            onChange={onPeriodSelect}
          />
        </Form.Item>
      </Col>

      {state.selectedPeriod === 'custom' ? (
        <Col span={12}>
          <Form.Item
            className="m-b-0"
            initialValue="0 0 * * *"
            label={t('label.cron')}
            labelCol={{ span: 24 }}
            name="cron"
            rules={[
              {
                required: true,
              },
              {
                validator: async (_, value) => {
                  return cronstrue.toString(value);
                },
              },
            ]}>
            <Input
              type="text"
              value={value}
              onChange={(e) => {
                setCronValue(e.target.value);
                props.onChange(e.target.value);
              }}
            />
          </Form.Item>
        </Col>
      ) : (
        <>
          {state.selectedPeriod === 'week' ? (
            getWeekComponent()
          ) : (
            <Col span={12}>
              {getMinuteComponent()}
              {getHourComponent()}
              {getDayComponent()}
              {getMonthComponent()}
              {getYearComponent()}
            </Col>
          )}
        </>
      )}
      <Col span={24}>{displayCronString}</Col>

      {isEmpty(value) && (
        <Col span={24}>
          <p data-testid="manual-segment-container">
            {t('message.pipeline-will-trigger-manually')}
          </p>
        </Col>
      )}
    </Row>
  );
};

export default CronEditor;
