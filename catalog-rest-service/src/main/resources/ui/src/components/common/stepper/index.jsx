import PropTypes from 'prop-types';
import React from 'react';
import Step from './Step';

const Stepper = ({ steps, isVertical, activeStep, showStepNumber }) => {
  return (
    <div
      className={`stepper-list stepper-${
        isVertical ? 'vertical' : 'horizontal'
      }`}>
      {steps.map(({ name }, index) => (
        <Step
          activeStep={activeStep}
          index={index}
          isVertical={isVertical}
          key={index}
          name={name}
          showStepNumber={showStepNumber}
          totalSteps={steps.length}
        />
      ))}
    </div>
  );
};

Stepper.defaultProps = {
  activeStep: 0,
  showStepNumber: true,
};

Stepper.propTypes = {
  steps: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
    })
  ).isRequired,
  isVertical: PropTypes.bool,
  activeStep: PropTypes.number,
  showStepNumber: PropTypes.bool,
};

export default Stepper;
