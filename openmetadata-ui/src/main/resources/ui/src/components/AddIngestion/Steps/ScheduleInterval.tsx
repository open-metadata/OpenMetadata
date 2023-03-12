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
import { Button, Col, Row } from 'antd';
import { LOADING_STATE } from 'enums/common.enum';
import React from 'react';
import { useTranslation } from 'react-i18next';
import CronEditor from '../../common/CronEditor/CronEditor';
import { ScheduleIntervalProps } from '../addIngestion.interface';

const ScheduleInterval = ({
  includePeriodOptions,
  onBack,
  onChange,
  onDeploy,
  repeatFrequency,
  status,
  submitButtonLabel,
}: ScheduleIntervalProps) => {
  const handleRepeatFrequencyChange = (repeatFrequency: string) =>
    onChange({
      repeatFrequency: repeatFrequency,
    });
  const { t } = useTranslation();

  return (
    <Row data-testid="schedule-intervel-container">
      <Col span={24}>
        <div>
          <CronEditor
            includePeriodOptions={includePeriodOptions}
            value={repeatFrequency}
            onChange={handleRepeatFrequencyChange}
          />
        </div>
      </Col>
      <Col className="d-flex justify-end mt-4" span={24}>
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
            loading={status === LOADING_STATE.WAITING}
            type="primary"
            onClick={onDeploy}>
            {submitButtonLabel}
          </Button>
        )}
      </Col>
    </Row>
  );
};

export default ScheduleInterval;
