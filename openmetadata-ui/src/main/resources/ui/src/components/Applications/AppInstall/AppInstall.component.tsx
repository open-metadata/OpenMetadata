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
import { IChangeEvent } from '@rjsf/core';
import { RJSFSchema } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory, useParams } from 'react-router-dom';
import TestSuiteScheduler from '../../../components/AddDataQualityTest/components/TestSuiteScheduler';
import FormBuilder from '../../../components/common/FormBuilder/FormBuilder';
import PageLayoutV1 from '../../../components/containers/PageLayoutV1';
import IngestionStepper from '../../../components/IngestionStepper/IngestionStepper.component';
import Loader from '../../../components/Loader/Loader';
import { STEPS_FOR_APP_INSTALL } from '../../../constants/Applications.constant';
import {
  GlobalSettingOptions,
  GlobalSettingsMenuCategory,
} from '../../../constants/GlobalSettings.constants';
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
import {
  getMarketPlaceAppDetailsPath,
  getSettingPath,
} from '../../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../../utils/ToastUtils';
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
  const [jsonSchema, setJsonSchema] = useState<RJSFSchema>();

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

  const goToAppPage = () => {
    history.push(
      getSettingPath(
        GlobalSettingsMenuCategory.WORKFLOW,
        GlobalSettingOptions.APPLICATIONS
      )
    );
  };

  const onSubmit = async (repeatFrequency: string) => {
    try {
      const data: CreateAppRequest = {
        appConfiguration: appConfiguration,
        appSchedule: {
          scheduleType: ScheduleTimeline.Custom,
          cronExpression: repeatFrequency,
        },
        name: fqn,
      };
      await installApplication(data);

      showSuccessToast(t('message.app-installed-successfully'));

      goToAppPage();
    } catch (error) {
      showErrorToast(error as AxiosError);
    }
  };

  const onSaveConfiguration = (data: IChangeEvent) => {
    const updatedFormData = formatFormDataForSubmit(data.formData);
    setAppConfiguration(updatedFormData);
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
              disableTestConnection
              showFormHeader
              useSelectWidget
              cancelText={t('label.back')}
              okText={t('label.submit')}
              schema={jsonSchema}
              serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
              serviceType=""
              showTestConnection={false}
              validator={validator}
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
              isQuartzCron
              initialData={getIngestionFrequency(PipelineType.Application)}
              onCancel={() => setActiveServiceStep(2)}
              onSubmit={onSubmit}
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
            activeStep={activeServiceStep}
            steps={STEPS_FOR_APP_INSTALL}
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
