import { StepperStepType } from 'Models';
import React, { useState } from 'react';
import { useHistory } from 'react-router-dom';
import { getAddServicePath, ROUTES } from '../../constants/constants';
import { PageLayoutType } from '../../enums/layout.enum';
import { ServiceCategory } from '../../enums/service.enum';
import PageLayout from '../containers/PageLayout';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';
import { AddServiceProps } from './AddService.interface';
import ConfigureService from './Steps/ConfigureService';
import SelectServiceType from './Steps/SelectServiceType';

const STEPS_FOR_ADD_SERVICE: Array<StepperStepType> = [
  { name: 'Select Service Type', step: 1 },
  { name: 'Configure Service', step: 2 },
  { name: 'Connection Details', step: 3 },
];

const AddService = ({ serviceCategory }: AddServiceProps) => {
  const history = useHistory();
  const [showErrorMessage, setShowErrorMessage] = useState({
    serviceType: false,
    name: false,
    duplicateName: false,
  });
  const [activeStepperStep, setActiveStepperStep] = useState(2);
  const [selectServiceType, setSelectServiceType] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [description, setDescription] = useState('');

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

  const handleConfigureServiceNextClick = (description: string) => {
    setDescription(description);
    if (serviceName.trim()) {
      setActiveStepperStep(3);
    } else {
      setShowErrorMessage({ ...showErrorMessage, name: true });
    }
  };

  const handleValidation = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.value;
    const name = event.target.name;

    switch (name) {
      case 'serviceName':
        setServiceName(value.trim());
        setShowErrorMessage({ ...showErrorMessage, name: false });

        break;
    }
  };

  const fetchRightPanel = () => {
    return (
      <>
        <h6 className="tw-heading tw-text-base">Add Service</h6>
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
      classes="tw-max-w-full-hd tw-h-full tw-bg-white tw-pt-4"
      layout={PageLayoutType['2ColRTL']}
      rightPanel={fetchRightPanel()}>
      <h6 className="tw-heading tw-text-base">Add New Service</h6>
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
        {activeStepperStep === 3 && <p>Connection Details</p>}
      </div>
    </PageLayout>
  );
};

export default AddService;
