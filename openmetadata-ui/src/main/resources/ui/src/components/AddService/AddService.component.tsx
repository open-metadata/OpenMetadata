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

import { Card, Space, Typography } from 'antd';
import ResizablePanels from 'components/common/ResizablePanels/ResizablePanels';
import {
  SERVICE_DEFAULT_ERROR_MAP,
  STEPS_FOR_ADD_SERVICE,
} from 'constants/Services.constant';
import { useAirflowStatus } from 'hooks/useAirflowStatus';
import { t } from 'i18next';
import { capitalize, isUndefined } from 'lodash';
import { LoadingState } from 'Models';
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getServiceDetailsPath } from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { delimiterRegex, nameWithSpace } from '../../constants/regex.constants';
import { FormSubmitType } from '../../enums/form.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { PipelineType } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { ConfigData } from '../../interface/service.interface';
import {
  getCurrentUserId,
  getServiceLogo,
  isUrlFriendlyName,
} from '../../utils/CommonUtils';
import { getAddServicePath, getSettingPath } from '../../utils/RouterUtils';
import {
  getServiceCreatedLabel,
  getServiceRouteFromServiceType,
  getServiceType,
} from '../../utils/ServiceUtils';
import AddIngestion from '../AddIngestion/AddIngestion.component';
import ServiceDocPanel from '../common/ServiceDocPanel/ServiceDocPanel';
import SuccessScreen from '../common/success-screen/SuccessScreen';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';
import ConnectionConfigForm from '../ServiceConfig/ConnectionConfigForm';
import { AddServiceProps } from './AddService.interface';
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
  const { fetchAirflowStatus } = useAirflowStatus();

  const [showErrorMessage, setShowErrorMessage] = useState(
    SERVICE_DEFAULT_ERROR_MAP
  );
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [activeIngestionStep, setActiveIngestionStep] = useState(1);
  const [selectServiceType, setSelectServiceType] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [saveServiceState, setSaveServiceState] =
    useState<LoadingState>('initial');
  const [activeField, setActiveField] = useState<string>('');

  const handleServiceTypeClick = (type: string) => {
    setShowErrorMessage({ ...showErrorMessage, serviceType: false });
    setServiceName('');
    setDescription('');
    setSelectServiceType(type);
  };

  const handleServiceCategoryChange = (category: ServiceCategory) => {
    setShowErrorMessage({ ...showErrorMessage, serviceType: false });
    setSelectServiceType('');
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
    if (selectServiceType) {
      setActiveServiceStep(2);
    } else {
      setShowErrorMessage({ ...showErrorMessage, serviceType: true });
    }
  };

  // Configure service name
  const handleConfigureServiceBackClick = () => setActiveServiceStep(1);
  const handleConfigureServiceNextClick = (descriptionValue: string) => {
    setDescription(descriptionValue.trim());

    if (!serviceName.trim()) {
      setShowErrorMessage({ ...showErrorMessage, name: true, isError: true });
    } else if (nameWithSpace.test(serviceName)) {
      setShowErrorMessage({
        ...showErrorMessage,
        nameWithSpace: true,
        isError: true,
      });
    } else if (delimiterRegex.test(serviceName)) {
      setShowErrorMessage({
        ...showErrorMessage,
        delimit: true,
        isError: true,
      });
    } else if (!isUrlFriendlyName(serviceName.trim())) {
      setShowErrorMessage({
        ...showErrorMessage,
        specialChar: true,
        isError: true,
      });
    } else if (serviceName.length < 1 || serviceName.length > 128) {
      setShowErrorMessage({
        ...showErrorMessage,
        nameLength: true,
        isError: true,
      });
    } else if (!showErrorMessage.isError) {
      setActiveServiceStep(3);
    }
  };

  // Service connection
  const handleConnectionDetailsBackClick = () => setActiveServiceStep(2);
  const handleConfigUpdate = async (newConfigData: ConfigData) => {
    const data = {
      name: serviceName,
      serviceType: selectServiceType,
      description: description,
      owner: {
        id: getCurrentUserId(),
        type: 'user',
      },
    };
    const configData = {
      ...data,
      connection: {
        config: newConfigData,
      },
    };
    setSaveServiceState('waiting');
    try {
      await onAddServiceSave(configData);

      setActiveServiceStep(4);

      await fetchAirflowStatus();
    } catch (error) {
      return error;
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

  // Service name validation
  const handleServiceNameValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    setServiceName(value);
    if (value) {
      setShowErrorMessage({
        ...showErrorMessage,
        name: false,
        delimit: false,
        specialChar: false,
        nameLength: false,
        isError: false,
      });
    }
  };

  // Service focused field
  const handleFieldFocus = (fieldName: string) => setActiveField(fieldName);

  // rendering

  const addNewServiceElement = (
    <div data-testid="add-new-service-container">
      {selectServiceType ? (
        <Space>
          {getServiceLogo(selectServiceType || '', 'h-6')}{' '}
          <Typography className="text-base" data-testid="header">
            {`${selectServiceType} ${t('label.service')}`}
          </Typography>
        </Space>
      ) : (
        <Typography className="text-base" data-testid="header">
          {t('label.add-new-entity', { entity: t('label.service') })}
        </Typography>
      )}

      <IngestionStepper
        activeStep={activeServiceStep}
        steps={STEPS_FOR_ADD_SERVICE}
      />
      <div className="tw-pt-5">
        {activeServiceStep === 1 && (
          <SelectServiceType
            handleServiceTypeClick={handleServiceTypeClick}
            selectServiceType={selectServiceType}
            serviceCategory={serviceCategory}
            serviceCategoryHandler={handleServiceCategoryChange}
            showError={showErrorMessage.serviceType}
            onCancel={handleSelectServiceCancel}
            onNext={handleSelectServiceNextClick}
          />
        )}

        {activeServiceStep === 2 && (
          <ConfigureService
            description={description}
            handleValidation={handleServiceNameValidation}
            serviceName={serviceName}
            showError={{
              name: showErrorMessage.name,
              duplicateName: showErrorMessage.duplicateName,
              nameWithSpace: showErrorMessage.nameWithSpace,
              delimit: showErrorMessage.delimit,
              specialChar: showErrorMessage.specialChar,
              nameLength: showErrorMessage.nameLength,
              allowChar: showErrorMessage.allowChar,
            }}
            onBack={handleConfigureServiceBackClick}
            onNext={handleConfigureServiceNextClick}
          />
        )}

        {activeServiceStep === 3 && (
          <ConnectionConfigForm
            cancelText={t('label.back')}
            serviceCategory={serviceCategory}
            serviceType={selectServiceType}
            status={saveServiceState}
            onCancel={handleConnectionDetailsBackClick}
            onFocus={handleFieldFocus}
            onSave={(e) => {
              handleConfigUpdate(e.formData);
            }}
          />
        )}

        {activeServiceStep > 3 && (
          <SuccessScreen
            showIngestionButton
            handleIngestionClick={() => handleAddIngestion(true)}
            handleViewServiceClick={handleViewServiceClick}
            name={serviceName}
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
      <Card className="p-lg m-t-md">
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
            onIngestionDeploy={onIngestionDeploy}
          />
        ) : (
          addNewServiceElement
        )}
      </Card>
    </div>
  );

  return (
    <ResizablePanels
      firstPanel={{ children: firstPanelChildren, minWidth: 700, flex: 0.7 }}
      hideSecondPanel={
        !(selectServiceType && activeServiceStep === 3) && !addIngestion
      }
      pageTitle={t('label.add-entity', { entity: t('label.service') })}
      secondPanel={{
        children: (
          <ServiceDocPanel
            activeField={activeField}
            serviceName={selectServiceType}
            serviceType={getServiceType(serviceCategory)}
          />
        ),
        className: 'service-doc-panel',
        minWidth: 60,
        overlay: {
          displayThreshold: 200,
          header: t('label.setup-guide'),
          rotation: 'counter-clockwise',
        },
      }}
    />
  );
};

export default AddService;
