import PropTypes from 'prop-types';
import React from 'react';

const StepConnector = ({ isVertical }) => {
  return (
    <div className="step-connector">
      <span
        className={`step-connector-line line-${
          isVertical ? 'vertical' : 'horizontal'
        }`}
      />
    </div>
  );
};

StepConnector.propTypes = {
  isVertical: PropTypes.bool,
};

export default StepConnector;
