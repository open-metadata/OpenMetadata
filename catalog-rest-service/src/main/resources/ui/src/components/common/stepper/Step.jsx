import PropTypes from 'prop-types';
import React from 'react';
import StepConnector from './StepConnector';
import StepIcon from './StepIcon';
import StepLabel from './StepLabel';

const Step = ({
  activeStep,
  index,
  name,
  totalSteps,
  isVertical,
  showStepNumber,
}) => {
  return (
    <div
      className={`step-${
        index < activeStep ? 'done' : activeStep === index ? 'doing' : 'pending'
      } step`}
      data-testid="step"
      key={name}>
      {index > 0 && index < totalSteps && (
        <StepConnector isVertical={isVertical} />
      )}
      <span className="step-container">
        <StepIcon stepNumber={showStepNumber ? index + 1 : null} />
        <StepLabel name={name} />
      </span>
    </div>
  );
};

Step.propTypes = {
  activeStep: PropTypes.number.isRequired,
  index: PropTypes.number.isRequired,
  name: PropTypes.string,
  totalSteps: PropTypes.number.isRequired,
  isVertical: PropTypes.bool,
  showStepNumber: PropTypes.bool,
};

export default Step;
