/*
 *  Copyright 2021 Collate
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

import { isUndefined } from 'lodash';
import { LoadingState } from 'Models';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getServiceDetailsPath, ROUTES } from '../../constants/constants';
import { STEPS_FOR_ADD_SERVICE } from '../../constants/services.const';
import { PageLayoutType } from '../../enums/layout.enum';
import { ServiceCategory } from '../../enums/service.enum';
import {
  ConfigData,
  DataObj,
  DataService,
} from '../../interface/service.interface';
import { getCurrentUserId } from '../../utils/CommonUtils';
import { getAddServicePath } from '../../utils/RouterUtils';
import { isIngestionSupported } from '../../utils/ServiceUtils';
import AddIngestion from '../AddIngestion/AddIngestion.component';
import SuccessScreen from '../common/success-screen/SuccessScreen';
import PageLayout from '../containers/PageLayout';
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
}: AddServiceProps) => {
  const history = useHistory();
  const [addIngestion, setAddIngestion] = useState(false);
  const [showErrorMessage, setShowErrorMessage] = useState({
    serviceType: false,
    name: false,
    duplicateName: false,
  });
  const [activeStepperStep, setActiveStepperStep] = useState(1);
  const [selectServiceType, setSelectServiceType] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');
  const [saveServiceState, setSaveServiceState] =
    useState<LoadingState>('initial');

  const handleServiceTypeClick = (type: string) => {
    setShowErrorMessage({ ...showErrorMessage, serviceType: false });
    setSelectServiceType(type);
  };

  const serviceCategoryHandler = (category: ServiceCategory) => {
    setShowErrorMessage({ ...showErrorMessage, serviceType: false });
    setSelectServiceType('');
    history.push(getAddServicePath(category));
  };

  const handleSelectServiceCancel = () => {
    history.push(ROUTES.SERVICES);
  };

  const handleSelectServiceNextClick = () => {
    if (selectServiceType) {
      setActiveStepperStep(2);
    } else {
      setShowErrorMessage({ ...showErrorMessage, serviceType: true });
    }
  };

  const handleConfigureServiceBackClick = () => {
    setActiveStepperStep(1);
  };

  const handleConfigureServiceNextClick = (descriptionValue: string) => {
    setDescription(descriptionValue);
    if (serviceName.trim()) {
      setActiveStepperStep(3);
    } else {
      setShowErrorMessage({ ...showErrorMessage, name: true });
    }
  };

  const handleAddIngestion = (value: boolean) => {
    setAddIngestion(value);
  };

  const handleConfigUpdate = (
    oData: ConfigData,
    serviceCat: ServiceCategory
  ) => {
    const data = {
      name: serviceName,
      serviceType: selectServiceType,
      description: description,
      owner: {
        id: getCurrentUserId(),
        type: 'user',
      },
    };
    const configData =
      serviceCat === ServiceCategory.PIPELINE_SERVICES
        ? { ...data, pipelineUrl: oData.pipelineUrl }
        : {
            ...data,
            connection: {
              config: oData,
            },
          };

    return new Promise<void>((resolve, reject) => {
      setSaveServiceState('waiting');
      onAddServiceSave(configData)
        .then(() => {
          setActiveStepperStep(4);
          resolve();
        })
        .catch((err) => {
          reject(err);
        })
        .finally(() => setSaveServiceState('initial'));
    });
  };

  const handleConnectionDetailsBackClick = () => {
    setActiveStepperStep(2);
  };

  const handleViewServiceClick = () => {
    if (!isUndefined(newServiceData)) {
      history.push(getServiceDetailsPath(newServiceData.name, serviceCategory));
    }
  };

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value.trim();
    setServiceName(value);
    if (value) {
      setShowErrorMessage({ ...showErrorMessage, name: false });
    }
  };

  const addNewService = () => {
    return (
      <div data-testid="add-new-service-container">
        <h6 className="tw-heading tw-text-base" data-testid="header">
          Add New Service
        </h6>
        <IngestionStepper
          activeStep={activeStepperStep}
          stepperLineClassName="add-service-line"
          steps={STEPS_FOR_ADD_SERVICE}
        />
        <div className="tw-pt-5">
          {activeStepperStep === 1 && (
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

          {activeStepperStep === 2 && (
            <ConfigureService
              description={description}
              handleValidation={handleValidation}
              serviceName={serviceName}
              showError={{
                name: showErrorMessage.name,
                duplicateName: showErrorMessage.duplicateName,
              }}
              onBack={handleConfigureServiceBackClick}
              onNext={handleConfigureServiceNextClick}
            />
          )}

          {activeStepperStep === 3 && (
            <ConnectionConfigForm
              data={
                (serviceCategory !== ServiceCategory.PIPELINE_SERVICES
                  ? {
                      connection: { config: { type: selectServiceType } },
                    }
                  : {}) as DataService
              }
              serviceCategory={serviceCategory}
              status={saveServiceState}
              onCancel={handleConnectionDetailsBackClick}
              onSave={(e) => {
                handleConfigUpdate(e.formData, serviceCategory);
              }}
            />
          )}

          {activeStepperStep > 3 && (
            <SuccessScreen
              handleIngestionClick={() => handleAddIngestion(true)}
              handleViewServiceClick={handleViewServiceClick}
              name={serviceName}
              showIngestionButton={isIngestionSupported(serviceCategory)}
            />
          )}
        </div>
      </div>
    );
  };

  const fetchRightPanel = () => {
    return (
      <>
        <h6 className="tw-heading tw-text-base">
          {addIngestion ? 'Configure Ingestion' : 'Configure Service'}
        </h6>
        <div className="tw-mb-5">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Facilis eum
          eveniet est? Aperiam perspiciatis est quis saepe optio fugiat
          necessitatibus libero, consectetur, vitae rerum ex! Lorem ipsum dolor
          sit amet consectetur adipisicing elit. Facilis eum eveniet est?
          Aperiam perspiciatis est quis saepe optio fugiat necessitatibus
          libero, consectetur, vitae rerum ex!
        </div>
      </>
    );
  };

  return (
    <PageLayout
      classes="tw-max-w-full-hd tw-h-full tw-pt-4"
      layout={PageLayoutType['2ColRTL']}
      rightPanel={fetchRightPanel()}>
      <div className="tw-form-container">
        {addIngestion ? (
          <AddIngestion
            handleAddIngestion={handleAddIngestion}
            handleViewServiceClick={handleViewServiceClick}
            serviceCategory={serviceCategory}
            serviceData={newServiceData as DataObj}
            onAddIngestionSave={onAddIngestionSave}
          />
        ) : (
          addNewService()
        )}
      </div>
    </PageLayout>
  );
};

export default AddService;
