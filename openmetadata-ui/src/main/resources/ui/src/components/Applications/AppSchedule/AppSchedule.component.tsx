import { Col, Divider, Row, Space, Typography } from 'antd';
import cronstrue from 'cronstrue';
import { noop } from 'lodash';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  App,
  AppScheduleClass,
} from '../../../generated/entity/applications/app';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { getIngestionFrequency } from '../../../utils/CommonUtils';
import TestSuiteScheduler from '../../AddDataQualityTest/components/TestSuiteScheduler';

const AppSchedule = ({ appData }: { appData: App }) => {
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
            {t('label.schedule-type')} :
          </Typography.Text>
          <Typography.Text className="font-medium">
            {(appData.appSchedule as AppScheduleClass).scheduleType ?? ''}
          </Typography.Text>
        </Space>
      </Col>
      <Col span={24}>
        <Space size={8}>
          <Typography.Text className="right-panel-label">
            {t('label.schedule-interval')} :
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
          initialData={getIngestionFrequency(PipelineType.Application)}
          isQuartzCron
          onSubmit={(value: string) => {
            console.log(value);
          }}
          onCancel={noop}
        />
      </Col>
    </Row>
  );
};

export default AppSchedule;
