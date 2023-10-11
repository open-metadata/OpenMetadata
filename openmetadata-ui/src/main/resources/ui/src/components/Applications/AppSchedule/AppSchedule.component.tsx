/*
 *  Copyright 2023 Collate.
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
import { Col, Divider, Row, Space, Typography } from 'antd';
import cronstrue from 'cronstrue';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AppScheduleClass } from '../../../generated/entity/applications/app';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getIngestionFrequency } from '../../../utils/CommonUtils';
import TestSuiteScheduler from '../../AddDataQualityTest/components/TestSuiteScheduler';
import { AppScheduleProps } from './AppScheduleProps.interface';

const AppSchedule = ({ appData, onCancel, onSave }: AppScheduleProps) => {
  const { t } = useTranslation();

  const cronString = useMemo(() => {
    if (appData.appSchedule) {
      const cronExp =
        (appData.appSchedule as AppScheduleClass).cronExpression ?? '';

      return cronstrue.toString(cronExp, {
        throwExceptionOnParseError: false,
      });
    }

    return '';
  }, [appData]);

  return (
    <Row>
      <Col span={24}>
        <Space size={8}>
          <Typography.Text className="right-panel-label">
            {t('label.schedule-type')}
          </Typography.Text>
          <Typography.Text className="font-medium">
            {(appData.appSchedule as AppScheduleClass).scheduleType ?? ''}
          </Typography.Text>
        </Space>
      </Col>
      <Col span={24}>
        <Space size={8}>
          <Typography.Text className="right-panel-label">
            {t('label.schedule-interval')}
          </Typography.Text>
          <Typography.Text className="font-medium">
            {cronString}
          </Typography.Text>
        </Space>
      </Col>

      <Divider />

      <Col span={24}>
        <Typography.Title level={5}>
          {t('label.update-entity', { entity: t('label.schedule') })}
        </Typography.Title>
        <TestSuiteScheduler
          isQuartzCron
          initialData={getIngestionFrequency(PipelineType.Application)}
          onCancel={onCancel}
          onSubmit={onSave}
        />
      </Col>
    </Row>
  );
};

export default AppSchedule;
