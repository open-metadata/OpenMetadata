import { IChangeEvent } from '@rjsf/core';
import validator from '@rjsf/validator-ajv8';
import { Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import TestSuiteScheduler from '../../../components/AddDataQualityTest/components/TestSuiteScheduler';
import IngestionStepper from '../../../components/IngestionStepper/IngestionStepper.component';
import Loader from '../../../components/Loader/Loader';
import FormBuilder from '../../../components/common/FormBuilder/FormBuilder';
import PageLayoutV1 from '../../../components/containers/PageLayoutV1';
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
import {
  getEntityMissingError,
  getIngestionFrequency,
} from '../../../utils/CommonUtils';
import { formatFormDataForSubmit } from '../../../utils/JSONSchemaFormUtils';
import { getMarketPlaceAppDetailsPath } from '../../../utils/RouterUtils';
import { showErrorToast } from '../../../utils/ToastUtils';
import ErrorPlaceHolder from '../../common/error-with-placeholder/ErrorPlaceHolder';
import AppInstallVerifyCard from '../AppInstallVerifyCard/AppInstallVerifyCard.component';

const AppInstall = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn } = useParams<{ fqn: string }>();
  const [appData, setAppData] = useState<AppMarketPlaceDefinition>();
  const [isLoading, setIsLoading] = useState(true);
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [appConfiguration, setAppConfiguration] = useState();
  const [jsonSchema, setJsonSchema] = useState();

  const fetchAppDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getMarketPlaceApplicationByName(fqn, 'owner');
      setAppData(data);

      const schema = await import(
        `../../../utils/ApplicationSchemas/${fqn}.json`
      );
      setJsonSchema(schema);
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
        appConfiguration: appConfiguration,
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

  const onSaveConfiguration = (data: IChangeEvent) => {
    const updatedFormData = formatFormDataForSubmit(data.formData);
    setAppConfiguration(updatedFormData);
    console.log(updatedFormData);
    setActiveServiceStep(3);
  };

  const RenderSelectedTab = useCallback(() => {
    if (!appData || !jsonSchema) {
      return <></>;
    }

    switch (activeServiceStep) {
      case 1:
        return (
          <AppInstallVerifyCard
            appData={appData}
            onCancel={onCancel}
            onSave={() => setActiveServiceStep(2)}
          />
        );
      case 2:
        return (
          <div className="w-500">
            <FormBuilder
              cancelText={t('label.back')}
              okText={t('label.submit')}
              disableTestConnection={true}
              serviceType={''}
              serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
              schema={jsonSchema}
              showFormHeader
              useSelectWidget
              validator={validator}
              showTestConnection={false}
              onCancel={() => setActiveServiceStep(1)}
              onSubmit={onSaveConfiguration}
            />
          </div>
        );
      case 3:
        return (
          <div className="w-500">
            <Typography.Title level={5}>{t('label.schedule')}</Typography.Title>
            <TestSuiteScheduler
              initialData={getIngestionFrequency(PipelineType.Application)}
              onSubmit={onSubmit}
              onCancel={() => setActiveServiceStep(2)}
            />
          </div>
        );
      default:
        return <></>;
    }
  }, [activeServiceStep, appData, jsonSchema]);

  useEffect(() => {
    fetchAppDetails();
  }, [fqn]);

  if (isLoading) {
    return <Loader />;
  }

  if (!appData) {
    return (
      <ErrorPlaceHolder>
        {getEntityMissingError('application', fqn)}
      </ErrorPlaceHolder>
    );
  }

  return (
    <PageLayoutV1 pageTitle={t('label.application-plural')}>
      <Row>
        <Col span={24}>
          <IngestionStepper
            steps={STEPS_FOR_APP_INSTALL}
            activeStep={activeServiceStep}
          />
        </Col>
        <Col span={24}>
          <div className="p-md flex-center">{RenderSelectedTab()}</div>
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default AppInstall;
