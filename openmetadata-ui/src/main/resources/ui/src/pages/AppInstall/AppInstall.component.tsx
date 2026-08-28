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
import { Button } from '@openmetadata/ui-core-components';
import { IChangeEvent } from '@rjsf/core';
import { RJSFSchema } from '@rjsf/utils';
import { Col, Row, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import React, {
  FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import { AppPlugin } from '../../components/Settings/Applications/plugins/AppPlugin';
import ScheduleInterval from '../../components/Settings/Services/AddIngestion/Steps/ScheduleInterval';
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
  AppType,
  ScheduleType,
} from '../../generated/entity/applications/marketplace/appMarketPlaceDefinition';
import { EntityReference } from '../../generated/entity/type';
import { useFqn } from '../../hooks/useFqn';
import { installApplication } from '../../rest/applicationAPI';
import { getMarketPlaceApplicationByFqn } from '../../rest/applicationMarketPlaceAPI';
import {
  getCronDefaultValue,
  getDefaultScheduleValue,
} from '../../utils/CronExpressionUtils';
import { getEntityMissingError } from '../../utils/EntityDisplayPureUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { formatFormDataForSubmit } from '../../utils/JSONSchemaFormUtils';
import {
  getMarketPlaceAppDetailsPath,
  getSettingPath,
} from '../../utils/RouterUtils';
import { showErrorToast, showSuccessToast } from '../../utils/ToastUtils';
import './app-install.less';

const AppInstall = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { fqn } = useFqn();
  const [appData, setAppData] = useState<AppMarketPlaceDefinition>();
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingLoading, setIsSavingLoading] = useState(false);
  const [scheduleValue, setScheduleValue] = useState<string>();
  // `undefined` is a valid on-demand selection, so initialization needs its own flag.
  const isScheduleInitialized = useRef(false);
  const [isScheduleValid, setIsScheduleValid] = useState(true);
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [appConfiguration, setAppConfiguration] = useState();
  const [jsonSchema, setJsonSchema] = useState<RJSFSchema>();
  const [pluginComponent, setPluginComponent] = useState<FC | null>(null);
  const { config, getResourceLimit } = useLimitStore();
  const [selectedIngestionRunner, setSelectedIngestionRunner] = useState<
    EntityReference | undefined
  >(undefined);
  const shouldShowIngestionRunner =
    appData?.appType === AppType.External && appData?.supportsIngestionRunner;

  const { pipelineSchedules } =
    config?.limits?.config.featureLimits.find(
      (feature) => feature.name === 'app'
    ) ?? {};

  const stepperList = useMemo(() => {
    let steps = STEPS_FOR_APP_INSTALL;
    if (appData?.scheduleType === ScheduleType.NoSchedule) {
      steps = steps.filter((item) => item.step !== 3);
    }

    if (!appData?.allowConfiguration) {
      steps = steps.filter((item) => item.step !== 2);
    }

    return steps.map((step) => ({
      ...step,
      name: t(step.name),
    }));
  }, [appData, t]);

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

  const openScheduleStep = useCallback(() => {
    if (!isScheduleInitialized.current) {
      setScheduleValue(
        getDefaultScheduleValue({
          defaultSchedule: defaultValue,
          includePeriodOptions: initialOptions,
          allowNoSchedule: true,
        })
      );
      isScheduleInitialized.current = true;
    }
    setIsScheduleValid(true);
    setActiveServiceStep(3);
  }, [defaultValue, initialOptions]);

  const fetchAppDetails = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getMarketPlaceApplicationByFqn(fqn, {
        fields: TabSpecificField.OWNERS,
      });
      setAppData(data);

      const schema = await applicationSchemaClassBase.importSchema(fqn);

      setJsonSchema(schema);

      // Check if this app has a plugin with a custom install component
      if (data.name) {
        const PluginClass = applicationsClassBase.appPluginRegistry[data.name];
        if (PluginClass) {
          const pluginInstance: AppPlugin = new PluginClass(data.name, false);
          if (pluginInstance.getAppInstallComponent) {
            const Component = pluginInstance.getAppInstallComponent(data);
            if (Component) {
              setPluginComponent(() => Component);
            }
          }
        }
      }
    } catch (_) {
      showErrorToast(t('server.no-application-schema-found', { appName: fqn }));
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

  const onSubmit = async () => {
    const cron = scheduleValue;
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
      ingestionRunner: shouldShowIngestionRunner
        ? selectedIngestionRunner
        : undefined,
    };
    installApp(data);
  };

  const onSaveConfiguration = (
    data: IChangeEvent & { ingestionRunner?: EntityReference }
  ) => {
    const { formData, ingestionRunner } = data;

    const updatedFormData = formatFormDataForSubmit(formData);
    setAppConfiguration(updatedFormData);
    const ingestionRunnerRef = ingestionRunner
      ? {
          id: ingestionRunner.id,
          type: 'ingestionRunner',
          name: ingestionRunner.name,
          fullyQualifiedName: ingestionRunner.fullyQualifiedName,
        }
      : undefined;
    setSelectedIngestionRunner(ingestionRunnerRef);

    if (appData?.scheduleType !== ScheduleType.NoSchedule) {
      openScheduleStep();
    } else {
      const requestData: CreateAppRequest = {
        appConfiguration: updatedFormData,
        name: fqn,
        description: appData?.description,
        displayName: appData?.displayName,
        ...(ingestionRunnerRef ? { ingestionRunner: ingestionRunnerRef } : {}),
      };
      installApp(requestData);
    }
  };

  const renderSelectedTab = useMemo(() => {
    if (!appData || !jsonSchema) {
      return <></>;
    }

    const ApplicationConfigurationComponent =
      applicationsClassBase.getApplicationConfigurationComponent();

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
            onSave={() => {
              if (appData?.allowConfiguration) {
                setActiveServiceStep(2);
              } else {
                openScheduleStep();
              }
            }}
          />
        );

      case 2:
        return (
          <ApplicationConfigurationComponent
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
              value={scheduleValue}
              onChange={setScheduleValue}
              onValidityChange={setIsScheduleValid}
            />
            <div className="tw:mt-4 tw:flex tw:justify-end tw:gap-3">
              <Button
                color="secondary"
                data-testid="back-button"
                size="sm"
                type="button"
                onPress={() =>
                  setActiveServiceStep(appData.allowConfiguration ? 2 : 1)
                }>
                {t('label.back')}
              </Button>
              <Button
                color="primary"
                data-testid="deploy-button"
                isDisabled={!isScheduleValid}
                isLoading={isSavingLoading}
                size="sm"
                type="button"
                onPress={onSubmit}>
                {t('label.create')}
              </Button>
            </div>
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
    isScheduleValid,
    openScheduleStep,
    scheduleValue,
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
      pageTitle={
        appData
          ? t('label.install-entity', { entity: getEntityName(appData) })
          : t('label.application-plural')
      }>
      {pluginComponent ? (
        // Render plugin's custom app details component
        React.createElement(pluginComponent)
      ) : (
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
      )}
    </PageLayoutV1>
  );
};

export default AppInstall;
