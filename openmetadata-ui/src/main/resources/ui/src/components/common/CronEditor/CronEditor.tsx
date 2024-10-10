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

import { Button, Col, Form, Input, Row, Select } from 'antd';
import classNames from 'classnames';
import cronstrue from 'cronstrue/i18n';
import { isEmpty } from 'lodash';
import React, { ChangeEvent, useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SCHEDULE_CRON } from '../../../constants/Ingestions.constant';
import { CronTypes } from '../../../enums/Cron.enum';
import {
  getCron,
  getCronOptions,
  getHourMinuteSelect,
  getQuartzCronExpression,
  getStateValue,
} from '../../../utils/CronUtils';
import { getCurrentLocaleForConstrue } from '../../../utils/i18next/i18nextUtil';
import './cron-editor.less';
import { CronEditorProp, StateValue } from './CronEditor.interface';

const CronEditor = ({
  value,
  includePeriodOptions,
  className,
  disabled = false,
  disabledCronChange,
  onChange,
  isQuartzCron,
}: CronEditorProp) => {
  const { t } = useTranslation();

  const [state, setState] = useState<StateValue>(getStateValue(value ?? ''));

  const { periodOptions, dayOptions } = useMemo(() => getCronOptions(), []);

  const filteredPeriodOptions = useMemo(() => {
    if (includePeriodOptions) {
      return periodOptions.filter((option) =>
        includePeriodOptions.includes(option.value)
      );
    } else {
      return periodOptions;
    }
  }, [includePeriodOptions, periodOptions]);

  const { selectedPeriod } = state;

  const handleCronValueChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      onChange(e.target.value);
    },
    [onChange]
  );

  const changeValue = (state: StateValue) => {
    const cronExp = isQuartzCron
      ? getQuartzCronExpression(state)
      : getCron(state);
    onChange(cronExp ?? DEFAULT_SCHEDULE_CRON);
  };

  const onPeriodSelect = (value: string) => {
    changeValue({ ...state, selectedPeriod: value });
    if (value === 'custom') {
      onChange(DEFAULT_SCHEDULE_CRON);
    } else if (value === '') {
      onChange('');
    }
    setState((prev) => ({ ...prev, selectedPeriod: value }));
  };

  const onHourOptionSelect = (value: number, key: string) => {
    const { selectedHourOption } = state;
    const hourOption = { ...selectedHourOption, [key]: value };
    changeValue({ ...state, selectedHourOption: hourOption });
    setState((prev) => ({ ...prev, selectedHourOption: hourOption }));
  };

  const onDayOptionSelect = (value: number, key: string) => {
    const { selectedDayOption } = state;
    const dayOption = { ...selectedDayOption, [key]: value };
    changeValue({ ...state, selectedDayOption: dayOption });
    setState((prev) => ({ ...prev, selectedDayOption: dayOption }));
  };

  const onWeekOptionSelect = (value: number, key: string) => {
    const { selectedWeekOption } = state;
    const weekOption = { ...selectedWeekOption, [key]: value };
    changeValue({ ...state, selectedWeekOption: weekOption });
    setState((prev) => ({ ...prev, selectedWeekOption: weekOption }));
  };

  return (
    <Row
      className={classNames(className, 'cron-row')}
      data-testid="cron-container"
      gutter={[16, 16]}>
      <Col data-testid="time-dropdown-container" span={12}>
        <Form.Item
          initialValue={selectedPeriod}
          label={t('label.every')}
          labelCol={{ span: 24 }}>
          <Select
            className="w-full"
            data-testid="cron-type"
            disabled={disabledCronChange || disabled}
            id="cronType"
            key={`select-${selectedPeriod}`}
            options={filteredPeriodOptions.map(({ label, value }) => ({
              label,
              value,
            }))}
            value={selectedPeriod}
            onChange={onPeriodSelect}
          />
        </Form.Item>
      </Col>

      {state.selectedPeriod === 'custom' && (
        <Col span={12}>
          <Form.Item
            className="m-b-0"
            initialValue={value}
            label={t('label.cron')}
            labelCol={{ span: 24 }}
            rules={[
              {
                required: true,
                message: t('label.field-required', {
                  field: t('label.cron'),
                }),
              },
              {
                validator: async (_, value) => {
                  return cronstrue.toString(value);
                },
              },
            ]}>
            <Input type="text" value={value} onChange={handleCronValueChange} />
          </Form.Item>
        </Col>
      )}

      {state.selectedPeriod === 'week' && (
        <>
          <Col span={12}>
            <Form.Item
              data-testid="week-segment-time-container"
              label={t('label.time')}
              labelCol={{ span: 24 }}>
              <div
                className="d-flex"
                data-testid="week-segment-time-options-container">
                {getHourMinuteSelect({
                  cronType: CronTypes.HOUR,
                  selectedDayOption: state.selectedWeekOption,
                  onChange: (value: number) =>
                    onWeekOptionSelect(value, 'hour'),
                  disabled,
                })}
                <span className="m-x-sm self-center">:</span>
                {getHourMinuteSelect({
                  cronType: CronTypes.MINUTE,
                  selectedHourOption: state.selectedWeekOption,
                  onChange: (value: number) => onWeekOptionSelect(value, 'min'),
                  disabled,
                })}
              </div>
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              data-testid="week-segment-day-option-container"
              label={t('label.day')}
              labelCol={{ span: 24 }}>
              <div className="cron-badge-option-container week-opt-container">
                {dayOptions.map(({ label, value: optionValue }) => (
                  <Button
                    className={classNames('cron-badge-option', {
                      active: optionValue === state.selectedWeekOption.dow,
                      disabled,
                    })}
                    data-value={optionValue}
                    disabled={disabled}
                    key={`${label}-${optionValue}`}
                    onClick={() =>
                      onWeekOptionSelect(Number(optionValue), 'dow')
                    }>
                    {label[0]}
                  </Button>
                ))}
              </div>
            </Form.Item>
          </Col>
        </>
      )}
      <Col span={12}>
        {state.selectedPeriod === 'hour' && (
          <Form.Item
            data-testid="hour-segment-container"
            label={t('label.minute')}
            labelCol={{ span: 24 }}>
            {getHourMinuteSelect({
              cronType: CronTypes.MINUTE,
              selectedHourOption: state.selectedHourOption,
              onChange: (value: number) => onHourOptionSelect(value, 'min'),
              disabled,
            })}
          </Form.Item>
        )}
        {state.selectedPeriod === 'day' && (
          <Form.Item
            data-testid="day-segment-container"
            label={t('label.time')}
            labelCol={{ span: 24 }}>
            <div className="d-flex" data-testid="time-option-container">
              {getHourMinuteSelect({
                cronType: CronTypes.HOUR,
                selectedDayOption: state.selectedDayOption,
                onChange: (value: number) => onDayOptionSelect(value, 'hour'),
                disabled,
              })}
              <span className="m-x-sm self-center">:</span>
              {getHourMinuteSelect({
                cronType: CronTypes.MINUTE,
                selectedHourOption: state.selectedDayOption,
                onChange: (value: number) => onDayOptionSelect(value, 'min'),
                disabled,
              })}
            </div>
          </Form.Item>
        )}
      </Col>

      {value && (
        <Col span={24}>
          {cronstrue.toString(value, {
            use24HourTimeFormat: false,
            verbose: true,
            locale: getCurrentLocaleForConstrue(), // To get localized string
            throwExceptionOnParseError: false,
          })}
        </Col>
      )}

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
