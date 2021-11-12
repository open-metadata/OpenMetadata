import classNames from 'classnames';
import React, { Fragment } from 'react';
import './IngestionStepper.css';
type Props = {
  steps: Array<{ name: string; step: number }>;
  activeStep: number;
};
const IngestionStepper = ({ steps, activeStep }: Props) => {
  return (
    <div className="ingestion-content tw-relative">
      {steps.map((step, index) => (
        <Fragment key={index}>
          {index > 0 && index < steps.length && (
            <span className="ingestion-line" />
          )}
          <div className="ingestion-wrapper" key={index}>
            <span className="tw-flex tw-flex-col">
              <span
                className={classNames(
                  'ingestion-rounder tw-self-center',
                  {
                    active: step.step === activeStep,
                  },
                  { completed: step.step < activeStep }
                )}
              />
              <span className="tw-mt-2 tw-text-xs">{step.name}</span>
            </span>
          </div>
        </Fragment>
      ))}
    </div>
  );
};

export default IngestionStepper;
