import validator from '@rjsf/validator-ajv8';
import { Col, Row, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import TestSuiteScheduler from '../../../components/AddDataQualityTest/components/TestSuiteScheduler';
import IngestionStepper from '../../../components/IngestionStepper/IngestionStepper.component';
import Loader from '../../../components/Loader/Loader';
import FormBuilder from '../../../components/common/FormBuilder/FormBuilder';
import PageLayoutV1 from '../../../components/containers/PageLayoutV1';

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import { STEPS_FOR_APP_INSTALL } from '../../../constants/Applications.constant';
import { ServiceCategory } from '../../../enums/service.enum';
import {
  CreateAppRequest,
  ScheduleTimeline,
} from '../../../generated/entity/applications/createAppRequest';
import { AppMarketPlaceDefinition } from '../../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { PipelineType } from '../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { installApplication } from '../../../rest/applicationAPI';
import { getMarketPlaceApplicationByName } from '../../../rest/applicationMarketPlaceAPI';
import searchIndexSchema from '../../../utils/ApplicationSchemas/SearchReindexAppSchema.json';
import { getIngestionFrequency } from '../../../utils/CommonUtils';
import { getMarketPlaceAppDetailsPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';

const AppInstall = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn } = useParams<{ fqn: string }>();
  const [appData, setAppData] = useState<AppMarketPlaceDefinition>();
  const [isLoading, setIsLoading] = useState(true);
  const [activeServiceStep, setActiveServiceStep] = useState(2);

  const fetchAppDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getMarketPlaceApplicationByName(fqn, 'owner');
      setAppData(data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  }, [fqn]);

  const onCancel = () => {
    history.push(getMarketPlaceAppDetailsPath(fqn));
  };

  const onSubmit = async (repeatFrequency: string) => {
    try {
      const data: CreateAppRequest = {
        appConfiguration: appData?.appConfiguration,
        appSchedule: {
          scheduleType: ScheduleTimeline.Custom,
          cronExpression: repeatFrequency,
        },
      };
      await installApplication(fqn, data);
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const RenderSelectedTab = useCallback(() => {
    if (activeServiceStep === 2) {
      return (
        <FormBuilder
          cancelText={t('label.back')}
          okText={t('label.submit')}
          disableTestConnection={true}
          serviceType={''}
          serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
          schema={searchIndexSchema}
          validator={validator}
        />
      );
    } else if (activeServiceStep === 3) {
      return (
        <TestSuiteScheduler
          initialData={getIngestionFrequency(PipelineType.Application)}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );
    }

    return <></>;
  }, [activeServiceStep]);

  useEffect(() => {
    fetchAppDetails();
  }, [fqn]);

  if (isLoading) {
    return <Loader />;
  }

  return (
    <PageLayoutV1 pageTitle={t('label.application-plural')}>
      <Row>
        <Col offset={8} span={8}>
          <Space direction="vertical" size={12}>
            <Typography.Title level={5}>{t('label.schedule')}</Typography.Title>
          </Space>
        </Col>
        <Col span={24}>
          <IngestionStepper
            steps={STEPS_FOR_APP_INSTALL}
            activeStep={activeServiceStep}
          />
        </Col>
        <Col span={24}>
          <div className="p-md">{RenderSelectedTab()}</div>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default AppInstall;
