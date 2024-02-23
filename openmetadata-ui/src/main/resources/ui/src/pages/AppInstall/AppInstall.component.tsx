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
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import FormBuilder from '../../components/common/FormBuilder/FormBuilder';
import Loader from '../../components/common/Loader/Loader';
import TestSuiteScheduler from '../../components/DataQuality/AddDataQualityTest/components/TestSuiteScheduler';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import applicationSchemaClassBase from '../../components/Settings/Applications/AppDetails/ApplicationSchemaClassBase';
import AppInstallVerifyCard from '../../components/Settings/Applications/AppInstallVerifyCard/AppInstallVerifyCard.component';
import IngestionStepper from '../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import {
  APP_UI_SCHEMA,
  STEPS_FOR_APP_INSTALL,
} from '../../constants/Applications.constant';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
import { ServiceCategory } from '../../enums/service.enum';
import { AppType } from '../../generated/entity/applications/app';
import {
  CreateAppRequest,
  ScheduleTimeline,
} from '../../generated/entity/applications/createAppRequest';
import { AppMarketPlaceDefinition } from '../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { useFqn } from '../../hooks/useFqn';
import { installApplication } from '../../rest/applicationAPI';
import { getMarketPlaceApplicationByFqn } from '../../rest/applicationMarketPlaceAPI';
import { getEntityMissingError } from '../../utils/CommonUtils';
import { getCronInitialValue } from '../../utils/CronUtils';
import { formatFormDataForSubmit } from '../../utils/JSONSchemaFormUtils';
import {
  getMarketPlaceAppDetailsPath,
  getSettingPath,
} from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './app-install.less';

const AppInstall = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { fqn } = useFqn();
  const [appData, setAppData] = useState<AppMarketPlaceDefinition>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingLoading, setIsSavingLoading] = useState(false);
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [appConfiguration, setAppConfiguration] = useState();
  const [jsonSchema, setJsonSchema] = useState<RJSFSchema>();

  const stepperList = useMemo(
    () =>
      !appData?.allowConfiguration
        ? STEPS_FOR_APP_INSTALL.filter((item) => item.step !== 2)
        : STEPS_FOR_APP_INSTALL,
    [appData]
  );

  const { initialOptions, initialValue } = useMemo(() => {
    let initialOptions;

    if (appData?.name === 'DataInsightsReportApplication') {
      initialOptions = ['Week'];
    } else if (appData?.appType === AppType.External) {
      initialOptions = ['Day'];
    }

    return {
      initialOptions,
      initialValue: getCronInitialValue(
        appData?.appType ?? AppType.Internal,
        appData?.name ?? ''
      ),
    };
  }, [appData?.name, appData?.appType]);

  const fetchAppDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getMarketPlaceApplicationByFqn(fqn, {
        fields: 'owner',
      });
      setAppData(data);

      const schema = await applicationSchemaClassBase.importSchema(fqn);

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
    history.push(getSettingPath(GlobalSettingOptions.APPLICATIONS));
  };

  const onSubmit = async (repeatFrequency: string) => {
    try {
      setIsSavingLoading(true);
      const data: CreateAppRequest = {
        appConfiguration: appConfiguration ?? appData?.appConfiguration,
        appSchedule: {
          scheduleType: ScheduleTimeline.Custom,
          cronExpression: repeatFrequency,
        },
        name: fqn,
        description: appData?.description,
        displayName: appData?.displayName,
      };
      await installApplication(data);

      showSuccessToast(t('message.app-installed-successfully'));

      goToAppPage();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingLoading(false);
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
            nextButtonLabel={
              appData?.allowConfiguration
                ? t('label.configure')
                : t('label.schedule')
            }
            onCancel={onCancel}
            onSave={() =>
              setActiveServiceStep(appData?.allowConfiguration ? 2 : 3)
            }
          />
        );

      case 2:
        return (
          <div className="w-500 p-md border rounded-4">
            <FormBuilder
              showFormHeader
              useSelectWidget
              cancelText={t('label.back')}
              okText={t('label.submit')}
              schema={jsonSchema}
              serviceCategory={ServiceCategory.DASHBOARD_SERVICES}
              uiSchema={APP_UI_SCHEMA}
              validator={validator}
              onCancel={() => setActiveServiceStep(1)}
              onSubmit={onSaveConfiguration}
            />
          </div>
        );
      case 3:
        return (
          <div className="w-500 p-md border rounded-4">
            <Typography.Title level={5}>{t('label.schedule')}</Typography.Title>
            <TestSuiteScheduler
              includePeriodOptions={initialOptions}
              initialData={initialValue}
              isLoading={isSavingLoading}
              onCancel={() =>
                setActiveServiceStep(appData.allowConfiguration ? 2 : 1)
              }
              onSubmit={onSubmit}
            />
          </div>
        );
      default:
        return <></>;
    }
  }, [activeServiceStep, appData, jsonSchema, initialOptions, isSavingLoading]);

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
    <PageLayoutV1
      className="app-install-page"
      pageTitle={t('label.application-plural')}>
      <Row>
        <Col span={24}>
          <IngestionStepper
            activeStep={activeServiceStep}
            steps={stepperList}
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
