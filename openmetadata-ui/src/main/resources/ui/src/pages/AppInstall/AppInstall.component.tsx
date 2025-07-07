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
import { Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ErrorPlaceHolder from '../../components/common/ErrorWithPlaceholder/ErrorPlaceHolder';
import Loader from '../../components/common/Loader/Loader';
import PageLayoutV1 from '../../components/PageLayoutV1/PageLayoutV1';
import {
  default as applicationSchemaClassBase,
  default as applicationsClassBase,
} from '../../components/Settings/Applications/AppDetails/ApplicationsClassBase';
import AppInstallVerifyCard from '../../components/Settings/Applications/AppInstallVerifyCard/AppInstallVerifyCard.component';
import ApplicationConfiguration from '../../components/Settings/Applications/ApplicationConfiguration/ApplicationConfiguration';
import ScheduleInterval from '../../components/Settings/Services/AddIngestion/Steps/ScheduleInterval';
import { WorkflowExtraConfig } from '../../components/Settings/Services/AddIngestion/Steps/ScheduleInterval.interface';
import IngestionStepper from '../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import { STEPS_FOR_APP_INSTALL } from '../../constants/Applications.constant';
import { GlobalSettingOptions } from '../../constants/GlobalSettings.constants';
import { useLimitStore } from '../../context/LimitsProvider/useLimitsStore';
import { TabSpecificField } from '../../enums/entity.enum';
import {
  CreateAppRequest,
  ScheduleTimeline,
} from '../../generated/entity/applications/createAppRequest';
import {
  AppMarketPlaceDefinition,
  ScheduleType,
} from '../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { useFqn } from '../../hooks/useFqn';
import { installApplication } from '../../rest/applicationAPI';
import { getMarketPlaceApplicationByFqn } from '../../rest/applicationMarketPlaceAPI';
import { getEntityMissingError } from '../../utils/CommonUtils';
import { formatFormDataForSubmit } from '../../utils/JSONSchemaFormUtils';
import {
  getMarketPlaceAppDetailsPath,
  getSettingPath,
} from '../../utils/RouterUtils';
import { getCronDefaultValue } from '../../utils/SchedularUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './app-install.less';

const AppInstall = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const [appData, setAppData] = useState<AppMarketPlaceDefinition>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingLoading, setIsSavingLoading] = useState(false);
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [appConfiguration, setAppConfiguration] = useState();
  const [jsonSchema, setJsonSchema] = useState<RJSFSchema>();
  const { config, getResourceLimit } = useLimitStore();

  const { pipelineSchedules } =
    config?.limits?.config.featureLimits.find(
      (feature) => feature.name === 'app'
    ) ?? {};

  const stepperList = useMemo(() => {
    if (appData?.scheduleType === ScheduleType.NoSchedule) {
      return STEPS_FOR_APP_INSTALL.filter((item) => item.step !== 3);
    }

    if (!appData?.allowConfiguration) {
      return STEPS_FOR_APP_INSTALL.filter((item) => item.step !== 2);
    }

    return STEPS_FOR_APP_INSTALL;
  }, [appData]);

  const { initialOptions, defaultValue } = useMemo(() => {
    if (!appData) {
      return {};
    }

    const initialOptions = applicationsClassBase.getScheduleOptionsForApp(
      appData?.name,
      appData?.appType,
      pipelineSchedules
    );

    return {
      initialOptions,
      defaultValue: getCronDefaultValue(appData?.name ?? ''),
    };
  }, [appData?.name, appData?.appType, pipelineSchedules, config?.enable]);

  const fetchAppDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getMarketPlaceApplicationByFqn(fqn, {
        fields: TabSpecificField.OWNERS,
      });
      setAppData(data);

      const schema = await applicationSchemaClassBase.importSchema(fqn);

      setJsonSchema(schema);
    } catch (_) {
      showErrorToast(
        t('message.no-application-schema-found', { appName: fqn })
      );
    } finally {
      setIsLoading(false);
    }
  }, [fqn]);

  const onCancel = () => {
    navigate(getMarketPlaceAppDetailsPath(fqn));
  };

  const goToAppPage = () => {
    navigate(getSettingPath(GlobalSettingOptions.APPLICATIONS));
  };

  const installApp = async (data: CreateAppRequest) => {
    try {
      setIsSavingLoading(true);

      await installApplication(data);

      showSuccessToast(t('message.app-installed-successfully'));

      // Update current count when Create / Delete operation performed
      await getResourceLimit('app', true, true);

      goToAppPage();
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsSavingLoading(false);
    }
  };

  const onSubmit = async (updatedValue: WorkflowExtraConfig) => {
    const { cron } = updatedValue;
    const data: CreateAppRequest = {
      appConfiguration: appConfiguration ?? appData?.appConfiguration,
      appSchedule: {
        scheduleTimeline: isEmpty(cron)
          ? ScheduleTimeline.None
          : ScheduleTimeline.Custom,
        ...(cron ? { cronExpression: cron } : {}),
      },
      name: fqn,
      description: appData?.description,
      displayName: appData?.displayName,
    };
    installApp(data);
  };

  const onSaveConfiguration = (data: IChangeEvent) => {
    const updatedFormData = formatFormDataForSubmit(data.formData);
    setAppConfiguration(updatedFormData);
    if (appData?.scheduleType !== ScheduleType.NoSchedule) {
      setActiveServiceStep(3);
    } else {
      const data: CreateAppRequest = {
        appConfiguration: updatedFormData,
        name: fqn,
        description: appData?.description,
        displayName: appData?.displayName,
      };
      installApp(data);
    }
  };

  const renderSelectedTab = useMemo(() => {
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
          <ApplicationConfiguration
            appData={appData}
            isLoading={false}
            jsonSchema={jsonSchema}
            onCancel={() => setActiveServiceStep(1)}
            onConfigSave={onSaveConfiguration}
          />
        );
      case 3:
        return (
          <div className="m-auto bg-white w-3/5 p-md border rounded-4">
            <Typography.Title level={5}>{t('label.schedule')}</Typography.Title>
            <ScheduleInterval
              defaultSchedule={defaultValue}
              includePeriodOptions={initialOptions}
              status={isSavingLoading ? 'waiting' : 'initial'}
              onBack={() =>
                setActiveServiceStep(appData.allowConfiguration ? 2 : 1)
              }
              onDeploy={onSubmit}
            />
          </div>
        );
      default:
        return <></>;
    }
  }, [
    activeServiceStep,
    appData,
    jsonSchema,
    initialOptions,
    defaultValue,
    isSavingLoading,
  ]);

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
      <Row gutter={[0, 16]}>
        <Col span={24}>
          <IngestionStepper
            activeStep={activeServiceStep}
            steps={stepperList}
          />
        </Col>
        <Col className="app-intall-page-tabs" span={24}>
          {renderSelectedTab}
        </Col>
      </Row>
    </PageLayoutV1>
  );
};

export default AppInstall;
