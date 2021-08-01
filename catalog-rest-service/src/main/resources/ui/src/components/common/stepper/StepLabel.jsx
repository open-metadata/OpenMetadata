import PropTypes from 'prop-types';
import React from 'react';

const StepLabel = ({ name }) => {
  return name ? <span className="step-label">{name}</span> : null;
};

StepLabel.propTypes = {
  name: PropTypes.string,
};

export default StepLabel;
