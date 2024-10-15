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
  Radio,
  Row,
  Space,
  Typography,
} from 'antd';
import classNames from 'classnames';
import { isEmpty } from 'lodash';
import React, { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_SCHEDULE_CRON } from '../../../../../constants/Ingestions.constant';
import { SCHEDULAR_OPTIONS } from '../../../../../constants/Schedular.constants';
import { LOADING_STATE } from '../../../../../enums/common.enum';
import { SchedularOptions } from '../../../../../enums/Schedular.enum';
import {
  FieldProp,
  FieldTypes,
  FormItemLayout,
} from '../../../../../interface/FormUtils.interface';
import { getCron, getStateValue } from '../../../../../utils/CronUtils';
import { generateFormFields } from '../../../../../utils/formUtils';
import { getDefaultIngestionSchedule } from '../../../../../utils/IngestionUtils';
import CronEditor from '../../../../common/CronEditor/CronEditor';
import { StateValue } from '../../../../common/CronEditor/CronEditor.interface';
import { ScheduleIntervalProps } from '../IngestionWorkflow.interface';
import './schedule-interval.less';

const ScheduleInterval = ({
  disabledCronChange,
  includePeriodOptions,
  onBack,
  onChange,
  onDeploy,
  savedScheduleInterval,
  scheduleInterval,
  status,
  submitButtonLabel,
  children,
  allowEnableDebugLog = false,
  debugLogInitialValue = false,
  isEditMode = false,
}: ScheduleIntervalProps) => {
  const { t } = useTranslation();
  const initialValues = getStateValue(
    scheduleInterval || DEFAULT_SCHEDULE_CRON
  );
  const [state, setState] = useState<StateValue>(initialValues);
  const [selectedSchedular, setSelectedSchedular] =
    React.useState<SchedularOptions>(
      isEmpty(scheduleInterval)
        ? SchedularOptions.ON_DEMAND
        : SchedularOptions.SCHEDULE
    );
  const [form] = Form.useForm<StateValue>();
  const { scheduleInterval: scheduleIntervalFormValue } = state;

  const handleSelectedSchedular = useCallback(
    (value: SchedularOptions) => {
      setSelectedSchedular(value);
      if (value === SchedularOptions.ON_DEMAND) {
        onChange('');
      } else {
        onChange(
          getDefaultIngestionSchedule({
            scheduleInterval:
              scheduleIntervalFormValue ?? savedScheduleInterval,
            isEditMode,
          })
        );
      }
    },
    [
      isEditMode,
      selectedSchedular,
      savedScheduleInterval,
      scheduleIntervalFormValue,
    ]
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
          initialValue: debugLogInitialValue,
        },
        id: 'root/enableDebugLog',
        formItemLayout: FormItemLayout.HORIZONTAL,
      },
    ],
    [debugLogInitialValue]
  );

  const handleFormSubmit: FormProps['onFinish'] = useCallback(
    (data) => {
      onDeploy({
        enableDebugLog: data.enableDebugLog,
      });
    },
    [onDeploy]
  );

  const handleValuesChange = (values: StateValue) => {
    const newState = { ...state, ...values };
    const cronExp = getCron(newState);
    const updatedState = { ...newState, scheduleInterval: cronExp };
    form.setFieldsValue(updatedState);
    setState(updatedState);
    onChange(cronExp ?? DEFAULT_SCHEDULE_CRON);
  };

  return (
    <Form
      data-testid="schedule-intervel-container"
      form={form}
      initialValues={initialValues}
      layout="vertical"
      onFinish={handleFormSubmit}
      onValuesChange={handleValuesChange}>
      <Row gutter={[16, 16]}>
        <Col span={24}>
          <Radio.Group
            className="schedular-card-container"
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
            <CronEditor
              disabledCronChange={disabledCronChange}
              includePeriodOptions={includePeriodOptions}
              value={scheduleInterval}
              onChange={onChange}
            />
          </Col>
        )}

        {allowEnableDebugLog && (
          <Col span={24}>{generateFormFields(formFields)}</Col>
        )}

        {children && <Col span={24}>{children}</Col>}

        <Col className="d-flex justify-end" span={24}>
          <Button
            className="m-r-xs"
            data-testid="back-button"
            type="link"
            onClick={onBack}>
            <span>{t('label.back')}</span>
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
              {submitButtonLabel}
            </Button>
          )}
        </Col>
      </Row>
    </Form>
  );
};

export default ScheduleInterval;
