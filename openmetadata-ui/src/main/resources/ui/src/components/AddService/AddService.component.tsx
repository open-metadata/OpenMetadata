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
import { STEPS_FOR_ADD_SERVICE } from 'constants/Services.constant';
import { t } from 'i18next';
import { capitalize, isUndefined } from 'lodash';
import { LoadingState } from 'Models';
import React, { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { addLocalResource } from 'utils/i18next/LocalUtil';
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
  getServiceIngestionStepGuide,
  getServiceRouteFromServiceType,
  getServiceType,
} from '../../utils/ServiceUtils';
import AddIngestion from '../AddIngestion/AddIngestion.component';
import SuccessScreen from '../common/success-screen/SuccessScreen';
import TitleBreadcrumb from '../common/title-breadcrumb/title-breadcrumb.component';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';
import ConnectionConfigForm from '../ServiceConfig/ConnectionConfigForm';
import { AddServiceProps } from './AddService.interface';
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
  onAirflowStatusCheck,
}: AddServiceProps) => {
  const history = useHistory();
  const [showErrorMessage, setShowErrorMessage] = useState({
    serviceType: false,
    name: false,
    duplicateName: false,
    nameWithSpace: false,
    delimit: false,
    specialChar: false,
    nameLength: false,
    allowChar: false,
    isError: false,
  });
  const [activeServiceStep, setActiveServiceStep] = useState(1);
  const [activeIngestionStep, setActiveIngestionStep] = useState(1);
  const [selectServiceType, setSelectServiceType] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [saveServiceState, setSaveServiceState] =
    useState<LoadingState>('initial');
  const [isAirflowRunning, setIsAirflowRunning] = useState(true);

  const [activeField, setActiveField] = useState<string>('');

  const resetServiceData = () => {
    setServiceName('');
    setDescription('');
  };

  const handleServiceTypeClick = (type: string) => {
    setShowErrorMessage({ ...showErrorMessage, serviceType: false });
    resetServiceData();
    setSelectServiceType(type);
  };

  const serviceCategoryHandler = (category: ServiceCategory) => {
    setShowErrorMessage({ ...showErrorMessage, serviceType: false });
    setSelectServiceType('');
    history.push(getAddServicePath(category));
  };

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

  const handleConfigureServiceBackClick = () => {
    setActiveServiceStep(2);
  };

  const handleServiceRequirementsBackClick = () => {
    setActiveServiceStep(1);
  };
  const handleServiceRequirementsNextClick = () => {
    setActiveServiceStep(3);
  };

  const handleConfigureServiceNextClick = (descriptionValue: string) => {
    setDescription(descriptionValue);

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
      setActiveServiceStep(4);
    }
  };

  const handleAirflowStatusCheck = () => {
    return new Promise<void>((resolve) => {
      onAirflowStatusCheck()
        .then(() => {
          setIsAirflowRunning(true);
        })
        .catch(() => {
          setIsAirflowRunning(false);
        })
        .finally(() => resolve());
    });
  };

  const handleConfigUpdate = (oData: ConfigData) => {
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
        config: oData,
      },
    };

    return new Promise<void>((resolve, reject) => {
      setSaveServiceState('waiting');
      onAddServiceSave(configData)
        .then(() => {
          handleAirflowStatusCheck().finally(() => {
            setActiveServiceStep(4);
            resolve();
          });
        })
        .catch((err) => {
          reject(err);
        })
        .finally(() => setSaveServiceState('initial'));
    });
  };

  const handleConnectionDetailsBackClick = () => {
    setActiveServiceStep(3);
  };

  const handleViewServiceClick = () => {
    if (!isUndefined(newServiceData)) {
      history.push(getServiceDetailsPath(newServiceData.name, serviceCategory));
    }
  };

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    setServiceName(value);
    if (value) {
      setShowErrorMessage({
        ...showErrorMessage,
        name: false,
        isError: false,
        delimit: false,
        specialChar: false,
        nameLength: false,
      });
    }
  };

  const handleFieldFocus = (fieldName: string) => setActiveField(fieldName);

  const addNewService = () => {
    return (
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
              serviceCategoryHandler={serviceCategoryHandler}
              showError={showErrorMessage.serviceType}
              onCancel={handleSelectServiceCancel}
              onNext={handleSelectServiceNextClick}
            />
          )}

          {activeServiceStep === 2 && (
            <ServiceRequirements
              selectServiceType={selectServiceType}
              onCancel={handleServiceRequirementsBackClick}
              onNext={handleServiceRequirementsNextClick}
            />
          )}

          {activeServiceStep === 3 && (
            <ConfigureService
              description={description}
              handleValidation={handleValidation}
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
  };

  const isDeployed = () => {
    return activeIngestionStep >= 3 && !showDeployButton;
  };

  const fetchRightPanel = () => {
    const stepData = addIngestion ? activeIngestionStep : activeServiceStep;

    return getServiceIngestionStepGuide({
      step: stepData,
      isIngestion: addIngestion,
      ingestionName: `${serviceName}_${PipelineType.Metadata}`,
      serviceName,
      ingestionType: PipelineType.Metadata,
      showDeployTitle: isDeployed(),
      isUpdated: false,
      isAirflowSetup: isAirflowRunning,
      activeField,
      serviceType: selectServiceType,
    });
  };

  useEffect(() => {
    if (selectServiceType) {
      addLocalResource(selectServiceType, getServiceType(serviceCategory));
    }
  }, [selectServiceType, serviceCategory]);

  return (
    <div className="tw-self-center">
      {' '}
      <PageLayoutV1
        className="tw-max-w-full-hd tw-h-full tw-pt-4"
        header={<TitleBreadcrumb titleLinks={slashedBreadcrumb} />}
        pageTitle={t('label.add-entity', { entity: t('label.service') })}
        rightPanel={fetchRightPanel()}>
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
            addNewService()
          )}
        </Card>
      </PageLayoutV1>
    </div>
  );
};

export default AddService;
