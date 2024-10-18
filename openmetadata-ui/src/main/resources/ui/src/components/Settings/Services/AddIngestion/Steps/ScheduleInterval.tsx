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

import { CheckOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Form,
  FormProps,
  Input,
  Radio,
  Row,
  Select,
  Space,
  Typography,
} from 'antd';
import classNames from 'classnames';
import cronstrue from 'cronstrue/i18n';
import { isEmpty } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DAY_OPTIONS,
  DEFAULT_SCHEDULE_CRON,
  PERIOD_OPTIONS,
  SCHEDULAR_OPTIONS,
} from '../../../../../constants/Schedular.constants';
import { LOADING_STATE } from '../../../../../enums/common.enum';
import {
  CronTypes,
  SchedularOptions,
} from '../../../../../enums/Schedular.enum';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../../../interface/FormUtils.interface';
import {
  getCron,
  getHourMinuteSelect,
  getStateValue,
} from '../../../../../utils/CronUtils';
import { generateFormFields } from '../../../../../utils/formUtils';
import { getCurrentLocaleForConstrue } from '../../../../../utils/i18next/i18nextUtil';
import './schedule-interval.less';
import {
  ScheduleIntervalProps,
  StateValue,
  WorkflowExtraConfig,
} from './ScheduleInterval.interface';

const ScheduleInterval = <T,>({
  disabled,
  includePeriodOptions,
  onBack,
  onDeploy,
  initialData,
  status,
  children,
  debugLog = {
    allow: false,
    initialValue: false,
  },
  isEditMode = false,
  buttonProps,
  defaultSchedule = DEFAULT_SCHEDULE_CRON,
  topChildren,
}: ScheduleIntervalProps<T>) => {
  const { t } = useTranslation();
  const initialCron = isEditMode
    ? initialData?.cron
    : initialData?.cron || defaultSchedule;
  const initialValues = {
    ...initialData,
    ...getStateValue(initialCron, defaultSchedule),
  };
  const [state, setState] = useState<StateValue>(initialValues);
  const [selectedSchedular, setSelectedSchedular] =
    React.useState<SchedularOptions>(
      isEmpty(initialCron)
        ? SchedularOptions.ON_DEMAND
        : SchedularOptions.SCHEDULE
    );
  const [form] = Form.useForm<StateValue>();
  const { cron: cronString, selectedPeriod, dow } = state;

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

  const handleSelectedSchedular = useCallback(
    (value: SchedularOptions) => {
      setSelectedSchedular(value);
      let newState = getStateValue(initialData?.cron ?? defaultSchedule);
      if (value === SchedularOptions.ON_DEMAND) {
        newState = {
          ...newState,
          cron: undefined,
        };
      }
      setState(newState);
      form.setFieldsValue(newState);
    },
    [isEditMode, initialData?.cron, defaultSchedule]
  );

  const formFields: FieldProp[] = useMemo(
    () => [
      {
        name: 'enableDebugLog',
        label: t('label.enable-debug-log'),
        type: FieldTypes.SWITCH,
        required: false,
        props: {
          'data-testid': 'enable-debug-log',
        },
        formItemProps: {
          initialValue: debugLog.initialValue,
        },
        id: 'root/enableDebugLog',
        formItemLayout: FormItemLayout.HORIZONTAL,
      },
    ],
    [debugLog]
  );

  const handleFormSubmit: FormProps['onFinish'] = useCallback(
    (data: WorkflowExtraConfig & T) => {
      // Remove cron if it is empty
      onDeploy(data);
    },
    [onDeploy]
  );

  const handleValuesChange = (values: StateValue & WorkflowExtraConfig & T) => {
    const newState = { ...state, ...values };
    const cronExp = getCron(newState);
    const updatedState = { ...newState, cron: cronExp };
    form.setFieldsValue(updatedState);
    setState(updatedState);
  };

  const filteredPeriodOptions = useMemo(() => {
    if (includePeriodOptions) {
      return PERIOD_OPTIONS.filter((option) =>
        includePeriodOptions.includes(option.value)
      );
    } else {
      return PERIOD_OPTIONS;
    }
  }, [includePeriodOptions]);

  return (
    <Form
      className="schedule-interval"
      data-testid="schedule-intervel-container"
      form={form}
      initialValues={initialValues}
      layout="vertical"
      name="schedular-form"
      onFinish={handleFormSubmit}
      onValuesChange={handleValuesChange}>
      <Row gutter={[16, 16]}>
        {topChildren}
        <Col span={24}>
          <Radio.Group
            className="schedular-card-container"
            data-testid="schedular-card-container"
            value={selectedSchedular}>
            {SCHEDULAR_OPTIONS.map(({ description, title, value }) => (
              <Card
                className={classNames('schedular-card', {
                  active: value === selectedSchedular,
                })}
                key={value}
                onClick={() => handleSelectedSchedular(value)}>
                <Radio value={value}>
                  <Space direction="vertical" size={6}>
                    <Typography.Text className="font-medium text-md">
                      {title}
                    </Typography.Text>
                    <Typography.Text className="text-grey-muted">
                      {description}
                    </Typography.Text>
                  </Space>
                </Radio>
              </Card>
            ))}
          </Radio.Group>
        </Col>

        {selectedSchedular === SchedularOptions.SCHEDULE && (
          <Col span={24}>
            <Row data-testid="cron-container" gutter={[16, 16]}>
              <Col data-testid="time-dropdown-container" span={12}>
                <Form.Item
                  label={`${t('label.every')}:`}
                  labelCol={{ span: 24 }}
                  name="selectedPeriod">
                  <Select
                    className="w-full"
                    data-testid="cron-type"
                    disabled={disabled}
                    id="cronType"
                    options={filteredPeriodOptions.map(({ label, value }) => ({
                      label,
                      value,
                    }))}
                  />
                </Form.Item>
              </Col>

              <Col span={hourCol}>
                <Form.Item
                  data-testid="hour-option"
                  hidden={!showHourSelect}
                  label={`${t('label.hour')}:`}
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
                  label={`${t('label.minute')}:`}
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
                  label={`${t('label.day')}:`}
                  labelCol={{ span: 24 }}
                  name="dow">
                  <Radio.Group
                    buttonStyle="solid"
                    className="d-flex gap-2"
                    value={dow}>
                    {DAY_OPTIONS.map(({ label, value: optionValue }) => (
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
                  label={`${t('label.cron')}:`}
                  labelCol={{ span: 24 }}
                  name="cron"
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

                        return Promise.resolve();
                      },
                    },
                  ]}>
                  <Input />
                </Form.Item>
              </Col>

              {cronString && (
                <Col span={24}>
                  {cronstrue.toString(cronString, {
                    use24HourTimeFormat: false,
                    verbose: true,
                    locale: getCurrentLocaleForConstrue(), // To get localized string
                    throwExceptionOnParseError: false,
                  })}
                </Col>
              )}

              {isEmpty(cronString) && (
                <Col span={24}>
                  <p data-testid="manual-segment-container">
                    {t('message.pipeline-will-trigger-manually')}
                  </p>
                </Col>
              )}
            </Row>
          </Col>
        )}

        {debugLog.allow && (
          <Col span={24}>{generateFormFields(formFields)}</Col>
        )}

        {children && <Col span={24}>{children}</Col>}

        <Col className="d-flex justify-end" span={24}>
          <Button
            className="m-r-xs"
            data-testid="back-button"
            type="link"
            onClick={onBack}>
            <span>{buttonProps?.cancelText ?? t('label.back')}</span>
          </Button>

          {status === 'success' ? (
            <Button
              disabled
              className="w-16 opacity-100 p-x-md p-y-xxs"
              type="primary">
              <CheckOutlined />
            </Button>
          ) : (
            <Button
              className="font-medium p-x-md p-y-xxs h-auto rounded-6"
              data-testid="deploy-button"
              htmlType="submit"
              loading={status === LOADING_STATE.WAITING}
              type="primary">
              {buttonProps?.okText ?? t('label.submit')}
            </Button>
          )}
        </Col>
      </Row>
    </Form>
  );
};

export default ScheduleInterval;
