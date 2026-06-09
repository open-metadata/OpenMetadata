/*
 *  Copyright 2025 Collate.
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

import { Breadcrumbs, Typography } from '@openmetadata/ui-core-components';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { LoadingState } from 'Models';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../components/common/ServiceDocPanel/ServiceDocPanel';
import ServiceFlowStepper from '../../components/Settings/Services/AddService/ServiceFlowStepper/ServiceFlowStepper';
import ServiceNameCard from '../../components/Settings/Services/AddService/ServiceNameCard/ServiceNameCard';
import SelectServiceType from '../../components/Settings/Services/AddService/Steps/SelectServiceType';
import EmbeddedConnectionConfigForm from '../../components/Settings/Services/ServiceConfig/EmbeddedConnectionConfigForm';
import FiltersConfigForm from '../../components/Settings/Services/ServiceConfig/FiltersConfigForm';
import { AUTO_PILOT_APP_NAME } from '../../constants/Applications.constant';
import {
  EXCLUDE_AUTO_PILOT_SERVICE_TYPES,
  SERVICE_DEFAULT_ERROR_MAP,
  STEPS_FOR_ADD_SERVICE,
} from '../../constants/Services.constant';
import { ServiceCategory } from '../../enums/service.enum';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { ConfigData, ServicesType } from '../../interface/service.interface';
import { triggerOnDemandApp } from '../../rest/applicationAPI';
import { postService } from '../../rest/serviceAPI';
import connectionsRouterClassBase from '../../utils/ConnectionsRouterClassBase';
import { getServiceLogo } from '../../utils/EntityDisplayUtils';
import { getEntityFeedLink } from '../../utils/EntityUtils';
import { handleEntityCreationError } from '../../utils/formUtils';
import { translateWithNestedKeys } from '../../utils/i18next/LocalUtil';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import {
  getAddServiceEntityBreadcrumb,
  getEntityTypeFromServiceCategory,
  getServiceType,
} from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { ServiceConfig } from '../AddServicePage/AddServicePage.interface';
import { useServiceNameValidation } from '../AddServicePage/useServiceNameValidation';

const EmbeddedAddServicePage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { serviceCategory } = useRequiredParams<{
    serviceCategory: ServiceCategory;
  }>();
  const { currentUser, setInlineAlertDetails } = useApplicationStore();

  const [showErrorMessage, setShowErrorMessage] = useState(
    SERVICE_DEFAULT_ERROR_MAP
  );
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [serviceConfig, setServiceConfig] = useState<ServiceConfig>({
    name: '',
    description: '',
    serviceType: '',
    connection: {
      config: {} as ConfigData,
    },
  });
  const [saveServiceState, setSaveServiceState] =
    useState<LoadingState>('initial');
  const [activeField, setActiveField] = useState<string>('');
  const {
    isServiceNameChecking,
    nameError,
    resetNameValidation,
    setNameError,
    validateServiceName,
  } = useServiceNameValidation({
    enabled: activeServiceStep === 2 && Boolean(serviceConfig.serviceType),
    serviceCategory,
    serviceName: serviceConfig.name,
  });

  const handleConnectorChangeClick = useCallback(() => {
    resetNameValidation();
    setActiveField('');
    setActiveServiceStep(1);
    setServiceConfig({
      name: '',
      description: '',
      serviceType: '',
      connection: {
        config: {} as ConfigData,
      },
    });
  }, [resetNameValidation]);

  const slashedBreadcrumb = useMemo(
    () => getAddServiceEntityBreadcrumb(serviceCategory),
    [serviceCategory]
  );

  const serviceBreadcrumb = useMemo(
    () =>
      serviceConfig.serviceType
        ? [
            {
              label: t('label.add-new-entity', {
                entity: t('label.service'),
              }),
              id: 'add-service',
            },
            {
              label: serviceConfig.serviceType,
              id: serviceConfig.serviceType,
            },
          ]
        : slashedBreadcrumb,
    [
      handleConnectorChangeClick,
      serviceCategory,
      serviceConfig.serviceType,
      slashedBreadcrumb,
      t,
    ]
  );

  const translatedSteps = useMemo(
    () =>
      STEPS_FOR_ADD_SERVICE.map((step) => ({
        ...step,
        name: translateWithNestedKeys(step.name, step.nameData),
      })),
    []
  );

  const handleServiceTypeClick = (type: string) => {
    resetNameValidation();
    setServiceConfig({
      name: '',
      description: '',
      serviceType: type,
      connection: {
        config: {} as ConfigData,
      },
    });
    setActiveServiceStep(2);
  };

  const handleServiceCategoryChange = (category: ServiceCategory) => {
    setShowErrorMessage({ ...showErrorMessage, serviceType: false });
    setServiceConfig((prev) => ({
      ...prev,
      serviceType: '',
    }));
    navigate(connectionsRouterClassBase.getAddServicePath(category));
  };

  const handleConnectionDetailsBackClick = () => setActiveServiceStep(1);

  const handleConfigUpdate = async (newConfigData: ConfigData) => {
    const serviceName = serviceConfig.name.trim();

    if (!serviceName) {
      setNameError(
        t('message.field-text-is-required', {
          fieldText: t('label.service-name'),
        })
      );

      return;
    }

    const isServiceNameAvailable = await validateServiceName(serviceName);

    if (!isServiceNameAvailable) {
      return;
    }

    const data = serviceUtilClassBase.getServiceConfigData({
      serviceName,
      serviceType: serviceConfig.serviceType,
      description: serviceConfig.description,
      userId: currentUser?.id ?? '',
      configData: newConfigData,
    });

    setServiceConfig((prev) => ({
      ...prev,
      ...data,
    }));
    setActiveServiceStep(3);
  };

  const triggerTheAutoPilotApplication = async (
    serviceDetails: ServicesType
  ) => {
    try {
      const entityType = getEntityTypeFromServiceCategory(serviceCategory);
      const entityLink = getEntityFeedLink(
        entityType,
        serviceDetails.fullyQualifiedName
      );

      await triggerOnDemandApp(AUTO_PILOT_APP_NAME, {
        entityLink,
      });
    } catch (err) {
      showErrorToast(err as AxiosError);
    }
  };

  const handleFiltersInputBackClick = () => setActiveServiceStep(2);
  const handleFiltersInputNextClick = async (config: ConfigData) => {
    const configData = {
      ...serviceConfig,
      connection: {
        config: {
          ...serviceConfig.connection.config,
          ...config,
        },
      },
    };
    setSaveServiceState('waiting');
    try {
      const serviceDetails = await postService(serviceCategory, configData);

      if (
        !EXCLUDE_AUTO_PILOT_SERVICE_TYPES.includes(
          getEntityTypeFromServiceCategory(serviceCategory)
        )
      ) {
        await triggerTheAutoPilotApplication(serviceDetails);
      }
    } catch (error) {
      handleEntityCreationError({
        error: error as AxiosError,
        entity: t('label.service'),
        entityLowercase: t('label.service-lowercase'),
        entityLowercasePlural: t('label.service-lowercase-plural'),
        setInlineAlertDetails,
        name: serviceConfig.name,
        defaultErrorType: 'create',
      });
    } finally {
      setSaveServiceState('initial');
      navigate(
        connectionsRouterClassBase.getServiceDetailsPath(
          serviceCategory,
          configData.name
        )
      );
    }
  };

  const handleFieldFocus = (fieldName: string) => {
    if (isEmpty(fieldName)) {
      return;
    }
    setTimeout(() => {
      setActiveField(fieldName);
    }, 50);
  };

  useEffect(() => {
    setActiveField('');
  }, [activeServiceStep]);

  const hideSecondPanel = useMemo(
    () =>
      !(
        serviceConfig.serviceType &&
        (activeServiceStep === 2 || activeServiceStep === 3)
      ),
    [activeServiceStep, serviceConfig.serviceType]
  );

  const handleBreadcrumbAction = useCallback(
    (id: React.Key) => {
      if (id === 'add-service') {
        handleConnectorChangeClick();
      } else if (id === 'category') {
        navigate(
          `/askCollate/connections/settings/services/${serviceCategory}`
        );
      }
    },
    [handleConnectorChangeClick, navigate, serviceCategory]
  );

  const firstPanelChildren = (
    <>
      <Breadcrumbs
        items={serviceBreadcrumb}
        onAction={handleBreadcrumbAction}
      />
      <div className="tw:mt-[22px]">
        <div data-testid="add-new-service-container">
          {serviceConfig.serviceType ? (
            <div className="tw:flex tw:items-center tw:gap-3 tw:pb-0">
              {getServiceLogo(
                serviceConfig.serviceType || '',
                'tw:size-10 tw:max-w-10 tw:max-h-10 tw:object-contain'
              )}
              <Typography
                className="tw:m-0"
                data-testid="header"
                size="text-xl"
                weight="semibold">
                {`${serviceConfig.serviceType} ${t('label.service')}`}
              </Typography>
            </div>
          ) : (
            <Typography
              className="tw:m-0"
              data-testid="header"
              size="text-xl"
              weight="semibold">
              {t('label.add-new-entity', { entity: t('label.service') })}
            </Typography>
          )}

          <ServiceFlowStepper
            activeStep={activeServiceStep}
            className="tw:mt-6"
            steps={translatedSteps}
          />
          <div className="tw:mt-[30px]">
            {activeServiceStep === 1 && (
              <SelectServiceType
                handleServiceTypeClick={handleServiceTypeClick}
                selectServiceType={serviceConfig.serviceType}
                serviceCategory={serviceCategory}
                serviceCategoryHandler={handleServiceCategoryChange}
                showError={showErrorMessage.serviceType}
              />
            )}

            {activeServiceStep === 2 && (
              <div className="tw:flex tw:flex-col tw:gap-4">
                <ServiceNameCard
                  description={serviceConfig.description}
                  name={serviceConfig.name}
                  nameError={nameError}
                  serviceType={serviceConfig.serviceType}
                  onDescriptionChange={(description) =>
                    setServiceConfig((prev) => ({ ...prev, description }))
                  }
                  onFocus={handleFieldFocus}
                  onNameChange={(name) => {
                    resetNameValidation();
                    setServiceConfig((prev) => ({ ...prev, name }));
                  }}
                />
                <EmbeddedConnectionConfigForm
                  requireTestConnection
                  cancelText={t('label.back')}
                  data={serviceConfig as ServicesType}
                  isSubmitDisabled={
                    !serviceConfig.name.trim() ||
                    Boolean(nameError) ||
                    isServiceNameChecking
                  }
                  okText={t('label.next-what-to-ingest')}
                  serviceCategory={serviceCategory}
                  serviceType={serviceConfig.serviceType}
                  status={saveServiceState}
                  onCancel={handleConnectionDetailsBackClick}
                  onFocus={handleFieldFocus}
                  onSave={async (e) => {
                    e.formData && (await handleConfigUpdate(e.formData));
                  }}
                />
              </div>
            )}

            {activeServiceStep === 3 && (
              <FiltersConfigForm
                cancelText={t('label.back')}
                data={serviceConfig as ServicesType}
                okText={t('label.create-and-deploy')}
                serviceCategory={serviceCategory}
                serviceType={serviceConfig.serviceType}
                status={saveServiceState}
                onCancel={handleFiltersInputBackClick}
                onFocus={handleFieldFocus}
                onSave={async (e) => {
                  e.formData && handleFiltersInputNextClick(e.formData);
                }}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );

  useEffect(() => {
    serviceUtilClassBase.getExtraInfo();
  }, []);

  return (
    <ResizablePanels
      className="add-service-page content-height-with-resizable-panel tw:!bg-transparent"
      firstPanel={{
        children: firstPanelChildren,
        minWidth: 700,
        flex: 0.7,
        className: 'content-resizable-panel-container',
        cardClassName: 'add-service-page-card max-width-md m-x-auto',
        allowScroll: true,
      }}
      hideSecondPanel={hideSecondPanel}
      pageTitle={t('label.add-entity', { entity: t('label.service') })}
      secondPanel={{
        children: (
          <ServiceDocPanel
            focusedMode
            activeField={activeField}
            serviceName={serviceConfig.serviceType}
            serviceType={getServiceType(serviceCategory)}
          />
        ),
        className: 'service-doc-panel content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default withPageLayout(EmbeddedAddServicePage);
