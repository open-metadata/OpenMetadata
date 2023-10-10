import { Col, Row, Space, Typography } from 'antd';
import cronstrue from 'cronstrue';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  App,
  AppScheduleClass,
} from '../../../generated/entity/applications/app';
import FormBuilder from '../../common/FormBuilder/FormBuilder';
import { ServiceCategory } from '../../../enums/service.enum';
import validator from '@rjsf/validator-ajv8';
import { RJSFSchema } from '@rjsf/utils';
import { noop } from 'lodash';
import TestSuiteScheduler from '../../AddDataQualityTest/components/TestSuiteScheduler';
import { getIngestionFrequency } from '../../../utils/CommonUtils';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';

const AppSchedule = ({ appData }: { appData: App }) => {
  const { t } = useTranslation();
  const [jsonSchema, setJsonSchema] = useState<RJSFSchema>();

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

  const init = useCallback(async (fqn) => {
    const schema = await import(
      `../../../utils/ApplicationSchemas/${fqn}.json`
    );
    setJsonSchema(schema);
  }, []);

  useEffect(() => {
    init(appData.fullyQualifiedName);
  }, [appData.fullyQualifiedName]);

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

      <Col span={24}>
        {jsonSchema && (
          <FormBuilder
            formData={appData.appConfiguration}
            cancelText={t('label.back')}
            okText={t('label.submit')}
            disableTestConnection={true}
            serviceType={''}
            serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
            schema={jsonSchema}
            useSelectWidget
            validator={validator}
            showTestConnection={false}
            onCancel={noop}
            onSubmit={noop}
          />
        )}
      </Col>

      <Col span={24}>
        <TestSuiteScheduler
          initialData={getIngestionFrequency(PipelineType.Application)}
          onSubmit={noop}
          onCancel={noop}
        />
      </Col>
    </Row>
  );
};

export default AppSchedule;
