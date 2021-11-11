import React from 'react';
import './IngestionStepper.css';
type Props = {
  isVertical: boolean;
  steps: Array<{ name: string }>;
};
const IngestionStepper = ({ steps }: Props) => {
  return (
    <div className="ingestion-content tw-relative">
      {steps.map((step, index) => (
        <>
          {index > 0 && index < steps.length && (
            <span className="ingestion-line" />
          )}
          <div className="ingestion-wrapper" key={index}>
            <span className="tw-flex tw-flex-col">
              <span className="ingestion-rounder tw-self-center" />
              <span className="tw-mt-3">{step.name}</span>
            </span>
          </div>
        </>
      ))}
    </div>
  );
};

export default IngestionStepper;
