import classNames from 'classnames';
import React from 'react';
import './IngestionStepper.css';
type Props = {
  steps: Array<{ name: string; step: number }>;
  activeStep: number;
};
const IngestionStepper = ({ steps, activeStep }: Props) => {
  return (
    <div className="ingestion-content tw-relative">
      {steps.map((step, index) => (
        <>
          {index > 0 && index < steps.length && (
            <span className="ingestion-line" />
          )}
          <div className="ingestion-wrapper" key={index}>
            <span className="tw-flex tw-flex-col">
              <span
                className={classNames('ingestion-rounder tw-self-center', {
                  active: step.step === activeStep,
                })}
              />
              <span className="tw-mt-3">{step.name}</span>
            </span>
          </div>
        </>
      ))}
    </div>
  );
};

export default IngestionStepper;
