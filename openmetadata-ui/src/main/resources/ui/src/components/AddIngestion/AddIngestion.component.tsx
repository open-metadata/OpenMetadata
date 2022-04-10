import { StepperStepType } from 'Models';
import React, { useState } from 'react';
import { PageLayoutType } from '../../enums/layout.enum';
import { PipelineType } from '../../generated/api/operations/pipelines/createAirflowPipeline';
import PageLayout from '../containers/PageLayout';
import IngestionStepper from '../IngestionStepper/IngestionStepper.component';
import {
  AddIngestionProps,
  ConfigureIngestionStep,
} from './addIngestion.interface';
import ConfigureIngestion from './Steps/ConfigureIngestion';

const STEPS_FOR_ADD_INGESTION: Array<StepperStepType> = [
  { name: 'Configure Ingestion', step: 1 },
  { name: 'Schedule Interval', step: 2 },
];

const AddIngestion = ({
  serviceData,
  handleAddIngestion,
}: AddIngestionProps) => {
  const [activeStepperStep, setActiveStepperStep] = useState(1);
  const [ingestionName] = useState(
    `${serviceData.name}_${PipelineType.Metadata}`
  );
  const [configureIngestionState, setConfigureIngestionState] =
    useState<ConfigureIngestionStep>();

  const handleConfigureIngestionCancelClick = () => {
    handleAddIngestion(false);
  };

  const handleConfigureIngestionNextClick = (data: ConfigureIngestionStep) => {
    setConfigureIngestionState(data);
    setActiveStepperStep(2);
  };

  const fetchRightPanel = () => {
    return (
      <>
        <h6 className="tw-heading tw-text-base">Add Ingestion</h6>
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
      <h6 className="tw-heading tw-text-base">Add New Ingestion</h6>

      <IngestionStepper
        activeStep={activeStepperStep}
        className="tw-justify-between tw-w-10/12 tw-mx-auto"
        stepperLineClassName="add-ingestion-line"
        steps={STEPS_FOR_ADD_INGESTION}
      />

      <div className="tw-pt-7">
        {activeStepperStep === 1 && (
          <ConfigureIngestion
            ingestionName={ingestionName}
            initialData={configureIngestionState}
            onCancel={handleConfigureIngestionCancelClick}
            onNext={handleConfigureIngestionNextClick}
          />
        )}
        {activeStepperStep === 2 && <div>step 2</div>}
      </div>
    </PageLayout>
  );
};

export default AddIngestion;
