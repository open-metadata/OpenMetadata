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
import { t } from 'i18next';
import { capitalize, isEmpty, isUndefined } from 'lodash';
import { LoadingState } from 'Models';
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getServiceDetailsPath } from '../../../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../../../constants/GlobalSettings.constants';
import {
  SERVICE_DEFAULT_ERROR_MAP,
  STEPS_FOR_ADD_SERVICE,
} from '../../../../constants/Services.constant';
import { FormSubmitType } from '../../../../enums/form.enum';
import { ServiceCategory } from '../../../../enums/service.enum';
import { PipelineType } from '../../../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { useAirflowStatus } from '../../../../hooks/useAirflowStatus';
import { useApplicationStore } from '../../../../hooks/useApplicationStore';
import { ConfigData } from '../../../../interface/service.interface';
import { getServiceLogo } from '../../../../utils/CommonUtils';
import { handleEntityCreationError } from '../../../../utils/formUtils';
import {
  getAddServicePath,
  getSettingPath,
} from '../../../../utils/RouterUtils';
import {
  getServiceCreatedLabel,
  getServiceRouteFromServiceType,
  getServiceType,
} from '../../../../utils/ServiceUtils';
import ResizablePanels from '../../../common/ResizablePanels/ResizablePanels';
import ServiceDocPanel from '../../../common/ServiceDocPanel/ServiceDocPanel';
import SuccessScreen from '../../../common/SuccessScreen/SuccessScreen';
import TitleBreadcrumb from '../../../common/TitleBreadcrumb/TitleBreadcrumb.component';
import AddIngestion from '../AddIngestion/AddIngestion.component';
import IngestionStepper from '../Ingestion/IngestionStepper/IngestionStepper.component';
import ConnectionConfigForm from '../ServiceConfig/ConnectionConfigForm';
import FiltersConfigForm from '../ServiceConfig/FiltersConfigForm';
import { AddServiceProps, ServiceConfig } from './AddService.interface';
import ConfigureService from './Steps/ConfigureService';
import SelectServiceType from './Steps/SelectServiceType';

const AddService = ({
  serviceCategory,
  onAddServiceSave,
  newServiceData,
  onAddIngestionSave,
  ingestionProgress,
  isIngestionCreated,
  isIngestionDeployed,
  ingestionAction,
  showDeployButton,
  onIngestionDeploy,
  slashedBreadcrumb,
  addIngestion,
  handleAddIngestion,
}: AddServiceProps) => {
  const history = useHistory();
  const { currentUser, setInlineAlertDetails } = useApplicationStore();
  const { fetchAirflowStatus } = useAirflowStatus();

  const [showErrorMessage, setShowErrorMessage] = useState(
    SERVICE_DEFAULT_ERROR_MAP
  );
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [activeIngestionStep, setActiveIngestionStep] = useState(1);
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
    history.push(getAddServicePath(category));
  };

  // Select service
  const handleSelectServiceCancel = () => {
    history.push(
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
    const data = {
      serviceType: serviceConfig.serviceType,
      owners: [
        {
          id: currentUser?.id ?? '',
          type: 'user',
        },
      ],
      connection: {
        config: newConfigData,
      },
    };

    setServiceConfig((prev) => ({
      ...prev,
      ...data,
    }));
    setActiveServiceStep(4);
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
      await onAddServiceSave(configData);

      setActiveServiceStep(5);

      await fetchAirflowStatus();
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
    }
  };

  // View new service
  const handleViewServiceClick = () => {
    if (!isUndefined(newServiceData)) {
      history.push(getServiceDetailsPath(newServiceData.name, serviceCategory));
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

  // rendering

  const addNewServiceElement = (
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

        {activeServiceStep > 4 && (
          <SuccessScreen
            showIngestionButton
            handleIngestionClick={() => handleAddIngestion(true)}
            handleViewServiceClick={handleViewServiceClick}
            name={serviceConfig.name}
            state={FormSubmitType.ADD}
            suffix={getServiceCreatedLabel(serviceCategory)}
          />
        )}
      </div>
    </div>
  );

  useEffect(() => {
    setActiveField('');
  }, [activeIngestionStep, activeServiceStep]);

  const firstPanelChildren = (
    <div className="max-width-md w-9/10 service-form-container">
      <TitleBreadcrumb titleLinks={slashedBreadcrumb} />
      <div className="m-t-md">
        {addIngestion ? (
          <AddIngestion
            activeIngestionStep={activeIngestionStep}
            handleCancelClick={() => handleAddIngestion(false)}
            handleViewServiceClick={handleViewServiceClick}
            heading={`${t('label.add-workflow-ingestion', {
              workflow: capitalize(PipelineType.Metadata),
            })}`}
            ingestionAction={ingestionAction}
            ingestionProgress={ingestionProgress}
            isIngestionCreated={isIngestionCreated}
            isIngestionDeployed={isIngestionDeployed}
            pipelineType={PipelineType.Metadata}
            serviceCategory={serviceCategory}
            serviceData={newServiceData}
            setActiveIngestionStep={(step) => setActiveIngestionStep(step)}
            showDeployButton={showDeployButton}
            status={FormSubmitType.ADD}
            onAddIngestionSave={onAddIngestionSave}
            onFocus={handleFieldFocus}
            onIngestionDeploy={onIngestionDeploy}
          />
        ) : (
          addNewServiceElement
        )}
      </div>
    </div>
  );

  return (
    <ResizablePanels
      className="content-height-with-resizable-panel"
      firstPanel={{
        children: firstPanelChildren,
        minWidth: 700,
        flex: 0.7,
        className: 'content-resizable-panel-container',
      }}
      hideSecondPanel={
        !(serviceConfig.serviceType && activeServiceStep === 3) && !addIngestion
      }
      pageTitle={t('label.add-entity', { entity: t('label.service') })}
      secondPanel={{
        children: (
          <ServiceDocPanel
            activeField={activeField}
            isWorkflow={addIngestion}
            serviceName={serviceConfig.serviceType}
            serviceType={getServiceType(serviceCategory)}
            workflowType={PipelineType.Metadata}
          />
        ),
        className: 'service-doc-panel content-resizable-panel-container',
        minWidth: 400,
        flex: 0.3,
      }}
    />
  );
};

export default AddService;
