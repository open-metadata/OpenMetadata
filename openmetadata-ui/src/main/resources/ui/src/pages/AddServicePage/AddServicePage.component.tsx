/*
 *  Copyright 2022 Collate.
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

import { Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import { LoadingState } from 'Models';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import ResizablePanels from '../../components/common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../components/common/ServiceDocPanel/ServiceDocPanel';
import TitleBreadcrumb from '../../components/common/TitleBreadcrumb/TitleBreadcrumb.component';
import ConfigureService from '../../components/Settings/Services/AddService/Steps/ConfigureService';
import SelectServiceType from '../../components/Settings/Services/AddService/Steps/SelectServiceType';
import IngestionStepper from '../../components/Settings/Services/Ingestion/IngestionStepper/IngestionStepper.component';
import ConnectionConfigForm from '../../components/Settings/Services/ServiceConfig/ConnectionConfigForm';
import FiltersConfigForm from '../../components/Settings/Services/ServiceConfig/FiltersConfigForm';
import { AUTO_PILOT_APP_NAME } from '../../constants/Applications.constant';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import {
  SERVICE_DEFAULT_ERROR_MAP,
  STEPS_FOR_ADD_SERVICE,
} from '../../constants/Services.constant';
import { ServiceCategory } from '../../enums/service.enum';
import { withPageLayout } from '../../hoc/withPageLayout';
import { useApplicationStore } from '../../hooks/useApplicationStore';
import { ConfigData, ServicesType } from '../../interface/service.interface';
import { triggerOnDemandApp } from '../../rest/applicationAPI';
import { postService } from '../../rest/serviceAPI';
import { getServiceLogo } from '../../utils/CommonUtils';
import { getEntityFeedLink } from '../../utils/EntityUtils';
import { handleEntityCreationError } from '../../utils/formUtils';
import {
  getAddServicePath,
  getServiceDetailsPath,
  getSettingPath,
} from '../../utils/RouterUtils';
import serviceUtilClassBase from '../../utils/ServiceUtilClassBase';
import {
  getAddServiceEntityBreadcrumb,
  getEntityTypeFromServiceCategory,
  getServiceRouteFromServiceType,
  getServiceType,
} from '../../utils/ServiceUtils';
import { showErrorToast } from '../../utils/ToastUtils';
import { useRequiredParams } from '../../utils/useRequiredParams';
import { ServiceConfig } from './AddServicePage.interface';

const AddServicePage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { serviceCategory } =
    useRequiredParams<{ serviceCategory: ServiceCategory }>();
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

  const slashedBreadcrumb = getAddServiceEntityBreadcrumb(serviceCategory);

  const handleServiceTypeClick = (type: string) => {
    setShowErrorMessage({ ...showErrorMessage, serviceType: false });
    setServiceConfig({
      name: '',
      description: '',
      serviceType: type,
      connection: {
        config: {} as ConfigData,
      },
    });
  };

  const handleServiceCategoryChange = (category: ServiceCategory) => {
    setShowErrorMessage({ ...showErrorMessage, serviceType: false });
    setServiceConfig((prev) => ({
      ...prev,
      serviceType: '',
    }));
    navigate(getAddServicePath(category));
  };

  // Select service
  const handleSelectServiceCancel = () => {
    navigate(
      getSettingPath(
        GlobalSettingsMenuCategory.SERVICES,
        getServiceRouteFromServiceType(serviceCategory)
      )
    );
  };

  const handleSelectServiceNextClick = () => {
    if (serviceConfig.serviceType) {
      setActiveServiceStep(2);
    } else {
      setShowErrorMessage({ ...showErrorMessage, serviceType: true });
    }
  };

  // Configure service name
  const handleConfigureServiceBackClick = () => setActiveServiceStep(1);
  const handleConfigureServiceNextClick = (
    value: Pick<ServiceConfig, 'name' | 'description'>
  ) => {
    setServiceConfig((prev) => ({
      ...prev,
      ...value,
    }));
    setActiveServiceStep(3);
  };

  // Service connection
  const handleConnectionDetailsBackClick = () => setActiveServiceStep(2);
  const handleConfigUpdate = (newConfigData: ConfigData) => {
    const data = serviceUtilClassBase.getServiceConfigData({
      serviceName: serviceConfig.name,
      serviceType: serviceConfig.serviceType,
      description: serviceConfig.description,
      userId: currentUser?.id ?? '',
      configData: newConfigData,
    });

    setServiceConfig((prev) => ({
      ...prev,
      ...data,
    }));
    setActiveServiceStep(4);
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

  // Filters Input step
  const handleFiltersInputBackClick = () => setActiveServiceStep(3);
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

      await triggerTheAutoPilotApplication(serviceDetails);
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
      navigate(getServiceDetailsPath(configData.name, serviceCategory));
    }
  };

  // Service focused field
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
        (activeServiceStep === 3 || activeServiceStep === 4)
      ),
    [activeServiceStep, serviceConfig.serviceType]
  );

  const firstPanelChildren = (
    <>
      <TitleBreadcrumb titleLinks={slashedBreadcrumb} />
      <div className="m-t-md">
        <div data-testid="add-new-service-container">
          {serviceConfig.serviceType ? (
            <Space className="p-b-xs">
              {getServiceLogo(serviceConfig.serviceType || '', 'h-6')}{' '}
              <Typography className="text-base" data-testid="header">
                {`${serviceConfig.serviceType} ${t('label.service')}`}
              </Typography>
            </Space>
          ) : (
            <Typography className="text-base p-b-xs" data-testid="header">
              {t('label.add-new-entity', { entity: t('label.service') })}
            </Typography>
          )}

          <IngestionStepper
            activeStep={activeServiceStep}
            steps={STEPS_FOR_ADD_SERVICE}
          />
          <div className="m-t-lg">
            {activeServiceStep === 1 && (
              <SelectServiceType
                handleServiceTypeClick={handleServiceTypeClick}
                selectServiceType={serviceConfig.serviceType}
                serviceCategory={serviceCategory}
                serviceCategoryHandler={handleServiceCategoryChange}
                showError={showErrorMessage.serviceType}
                onCancel={handleSelectServiceCancel}
                onNext={handleSelectServiceNextClick}
              />
            )}

            {activeServiceStep === 2 && (
              <ConfigureService
                serviceName={serviceConfig.name}
                onBack={handleConfigureServiceBackClick}
                onNext={handleConfigureServiceNextClick}
              />
            )}

            {activeServiceStep === 3 && (
              <ConnectionConfigForm
                cancelText={t('label.back')}
                data={serviceConfig as ServicesType}
                okText={t('label.next')}
                serviceCategory={serviceCategory}
                serviceType={serviceConfig.serviceType}
                status={saveServiceState}
                onCancel={handleConnectionDetailsBackClick}
                onFocus={handleFieldFocus}
                onSave={async (e) => {
                  e.formData && handleConfigUpdate(e.formData);
                }}
              />
            )}

            {activeServiceStep === 4 && (
              <FiltersConfigForm
                cancelText={t('label.back')}
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
      className="content-height-with-resizable-panel"
      firstPanel={{
        children: firstPanelChildren,
        minWidth: 700,
        flex: 0.7,
        className: 'content-resizable-panel-container',
        cardClassName: 'max-width-md m-x-auto',
        allowScroll: true,
      }}
      hideSecondPanel={hideSecondPanel}
      pageTitle={t('label.add-entity', { entity: t('label.service') })}
      secondPanel={{
        children: (
          <ServiceDocPanel
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

export default withPageLayout(AddServicePage);
