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

import { Card } from 'antd';
import PageLayoutV1 from 'components/containers/PageLayoutV1';
import {
  SERVICE_DEFAULT_ERROR_MAP,
  STEPS_FOR_ADD_SERVICE,
} from 'constants/Services.constant';
import { useAirflowStatus } from 'hooks/useAirflowStatus';
import { t } from 'i18next';
import { capitalize, cloneDeep, isUndefined } from 'lodash';
import { LoadingState } from 'Models';
import React, { useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getServiceDetailsPath } from '../../constants/constants';
import { GlobalSettingsMenuCategory } from '../../constants/GlobalSettings.constants';
import { delimiterRegex, nameWithSpace } from '../../constants/regex.constants';
import { FormSubmitType } from '../../enums/form.enum';
import { ServiceCategory } from '../../enums/service.enum';
import { PipelineType } from '../../generated/entity/services/ingestionPipelines/ingestionPipeline';
import { ConfigData, DataObj } from '../../interface/service.interface';
import { getCurrentUserId, isUrlFriendlyName } from '../../utils/CommonUtils';
import { getAddServicePath, getSettingPath } from '../../utils/RouterUtils';
import {
  getServiceCreatedLabel,
  getServiceRouteFromServiceType,
  getServiceType,
} from '../../utils/ServiceUtils';
import AddIngestion from '../AddIngestion/AddIngestion.component';
import SuccessScreen from '../common/success-screen/SuccessScreen';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';
import ConnectionConfigForm from '../ServiceConfig/ConnectionConfigForm';
import { AddServiceProps } from './AddService.interface';
import ServiceRightPanel from './RightPanel/RightPanel';
import ConfigureService from './Steps/ConfigureService';
import SelectServiceType from './Steps/SelectServiceType';
import ServiceRequirements from './Steps/ServiceRequirements';

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

  // Service requirements
  const handleServiceRequirementsBackClick = () => setActiveServiceStep(1);
  const handleServiceRequirementsNextClick = () => setActiveServiceStep(3);

  // Configure service name
  const handleConfigureServiceBackClick = () => setActiveServiceStep(2);
  const handleConfigureServiceNextClick = (descriptionValue: string) => {
    setDescription(descriptionValue.trim());

    const trimmedServiceName = serviceName.trim();

    let errorObj = cloneDeep(showErrorMessage);

    if (!trimmedServiceName) {
      errorObj = { ...errorObj, name: true };
    } else if (nameWithSpace.test(trimmedServiceName)) {
      errorObj = { ...errorObj, nameWithSpace: true };
    } else if (delimiterRegex.test(trimmedServiceName)) {
      errorObj = { ...errorObj, delimit: true };
    } else if (!isUrlFriendlyName(trimmedServiceName)) {
      errorObj = { ...errorObj, specialChar: true };
    } else if (
      trimmedServiceName.length < 1 ||
      trimmedServiceName.length > 128
    ) {
      errorObj = { ...errorObj, nameLength: true };
    } else {
      setActiveServiceStep(4);
    }
    setShowErrorMessage(errorObj);
  };

  // Service connection
  const handleConnectionDetailsBackClick = () => setActiveServiceStep(3);
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

      setActiveServiceStep(5);

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
      });
    }
  };

  // Service focused field
  const handleFieldFocus = (fieldName: string) => setActiveField(fieldName);

  // Flag to check if pipeline is deployed or not
  const isDeployed = useMemo(
    () => activeIngestionStep >= 3 && !showDeployButton,
    [activeIngestionStep, showDeployButton]
  );

  // rendering

  const addNewServiceElement = (
    <div data-testid="add-new-service-container">
      <h6 className="tw-heading tw-text-base" data-testid="header">
        {t('label.add-new-entity', { entity: t('label.service') })}
      </h6>
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
          <ServiceRequirements
            serviceName={selectServiceType}
            serviceType={getServiceType(serviceCategory)}
            onBack={handleServiceRequirementsBackClick}
            onNext={handleServiceRequirementsNextClick}
          />
        )}

        {activeServiceStep === 3 && (
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

        {activeServiceStep === 4 && (
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

        {activeServiceStep > 4 && (
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

  return (
    <PageLayoutV1
      className="tw-max-w-full-hd tw-h-full tw-pt-4"
      header={<TitleBreadcrumb titleLinks={slashedBreadcrumb} />}
      pageTitle={t('label.add-entity', { entity: t('label.service') })}
      rightPanel={
        <ServiceRightPanel
          activeField={activeField}
          activeStep={addIngestion ? activeIngestionStep : activeServiceStep}
          ingestionName={`${serviceName}_${PipelineType.Metadata}`}
          isIngestion={addIngestion}
          isUpdating={false}
          pipelineType={PipelineType.Metadata}
          selectedService={selectServiceType}
          selectedServiceCategory={serviceCategory}
          serviceName={serviceName}
          showDeployedTitle={isDeployed}
        />
      }>
      <Card className="p-lg">
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
            serviceData={newServiceData as DataObj}
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
    </PageLayoutV1>
  );
};

export default AddService;
