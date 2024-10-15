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

import { Col, Form, Input, Radio, Row, Select } from 'antd';
import classNames from 'classnames';
import cronstrue from 'cronstrue/i18n';
import { isEmpty } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SCHEDULE_CRON } from '../../../constants/Ingestions.constant';
import { CronTypes } from '../../../enums/Cron.enum';
import {
  getCron,
  getCronOptions,
  getHourMinuteSelect,
} from '../../../utils/CronUtils';
import { getCurrentLocaleForConstrue } from '../../../utils/i18next/i18nextUtil';
import './cron-editor.less';
import { CronEditorProp, StateValue } from './CronEditor.interface';

const CronEditor = ({
  includePeriodOptions,
  className,
  disabled = false,
  disabledCronChange,
  onChange,
}: CronEditorProp) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance<StateValue>();
  const selectedPeriod = Form.useWatch('selectedPeriod', form);
  const scheduleInterval = Form.useWatch('scheduleInterval', form);
  const dow = Form.useWatch('dow', form);
  const {
    showMinuteSelect,
    showHourSelect,
    showWeekSelect,
    minuteCol,
    hourCol,
    weekCol,
  } = useMemo(() => {
    const isHourSelected = selectedPeriod === 'hour';
    const isDaySelected = selectedPeriod === 'day';
    const isWeekSelected = selectedPeriod === 'week';
    const showMinuteSelect = isHourSelected || isDaySelected || isWeekSelected;
    const showHourSelect = isDaySelected || isWeekSelected;
    const showWeekSelect = isWeekSelected;
    const minuteCol = isHourSelected ? 12 : 6;

    return {
      showMinuteSelect,
      showHourSelect,
      showWeekSelect,
      minuteCol: showMinuteSelect ? minuteCol : 0,
      hourCol: showHourSelect ? 6 : 0,
      weekCol: showWeekSelect ? 24 : 0,
    };
  }, [selectedPeriod]);

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

  const changeValue = (state: StateValue) => {
    const cronExp = getCron(state);
    onChange(cronExp ?? DEFAULT_SCHEDULE_CRON);
  };

  return (
    <Row
      className={classNames('cron-row', className)}
      data-testid="cron-container"
      gutter={[16, 16]}>
      <Col data-testid="time-dropdown-container" span={12}>
        <Form.Item
          label={t('label.every')}
          labelCol={{ span: 24 }}
          name="selectedPeriod">
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
            onChange={(value) => {
              changeValue({
                ...form.getFieldsValue(),
                selectedPeriod: value,
              });
            }}
          />
        </Form.Item>
      </Col>

      <Col span={hourCol}>
        <Form.Item
          data-testid="hour-option"
          hidden={!showHourSelect}
          label={t('label.hour')}
          labelCol={{ span: 24 }}
          name="hour">
          {getHourMinuteSelect({
            cronType: CronTypes.HOUR,
            disabled,
          })}
        </Form.Item>
      </Col>
      <Col span={minuteCol}>
        <Form.Item
          data-testid="minute-option"
          hidden={!showMinuteSelect}
          label={t('label.minute')}
          labelCol={{ span: 24 }}
          name="min">
          {getHourMinuteSelect({
            cronType: CronTypes.MINUTE,
            disabled,
          })}
        </Form.Item>
      </Col>
      <Col span={weekCol}>
        <Form.Item
          data-testid="week-segment-day-option-container"
          hidden={!showWeekSelect}
          label={t('label.day')}
          labelCol={{ span: 24 }}
          name="dow">
          <Radio.Group buttonStyle="solid" className="d-flex gap-2" value={dow}>
            {dayOptions.map(({ label, value: optionValue }) => (
              <Radio.Button
                className="week-selector-buttons"
                data-value={optionValue}
                disabled={disabled}
                key={`${label}-${optionValue}`}
                value={optionValue}>
                {label[0]}
              </Radio.Button>
            ))}
          </Radio.Group>
        </Form.Item>
      </Col>

      <Col span={selectedPeriod === 'custom' ? 12 : 0}>
        <Form.Item
          hidden={selectedPeriod !== 'custom'}
          label={t('label.cron')}
          labelCol={{ span: 24 }}
          name="scheduleInterval"
          rules={[
            {
              required: true,
              message: t('label.field-required', {
                field: t('label.cron'),
              }),
            },
            {
              validator: async (_, value) => {
                // Check if cron is valid and get the description
                const description = cronstrue.toString(value);

                // Check if cron has a frequency of less than an hour
                const isFrequencyInMinutes = /Every \d* *minute/.test(
                  description
                );
                if (isFrequencyInMinutes) {
                  return Promise.reject(
                    t('message.cron-less-than-hour-message')
                  );
                }
                Promise.resolve();
              },
            },
          ]}>
          <Input />
        </Form.Item>
      </Col>

      {scheduleInterval && (
        <Col span={24}>
          {cronstrue.toString(scheduleInterval, {
            use24HourTimeFormat: false,
            verbose: true,
            locale: getCurrentLocaleForConstrue(), // To get localized string
            throwExceptionOnParseError: false,
          })}
        </Col>
      )}

      {isEmpty(scheduleInterval) && (
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
