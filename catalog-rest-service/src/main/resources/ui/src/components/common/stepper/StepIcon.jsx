import PropTypes from 'prop-types';
import React from 'react';

const StepIcon = ({ stepNumber }) => {
  return (
    <span className="step-icon" data-testid="step-icon">
      {stepNumber}
    </span>
  );
};

StepIcon.propTypes = {
  stepNumber: PropTypes.number,
};

export default StepIcon;
