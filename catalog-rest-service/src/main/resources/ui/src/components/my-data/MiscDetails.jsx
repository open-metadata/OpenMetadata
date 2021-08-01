import PropTypes from 'prop-types';
import React from 'react';

const DescriptionDetails = ({ title, text, addSeparator }) => {
  return (
    <span data-testid="misc-details">
      <span data-testid="title">{title} :</span>{' '}
      <span data-testid="text">{text}</span>{' '}
      {addSeparator && <span data-testid="separator">{' | '}</span>}
    </span>
  );
};

DescriptionDetails.defaultProps = {
  addSeparator: true,
};

DescriptionDetails.propTypes = {
  title: PropTypes.string.isRequired,
  text: PropTypes.string.isRequired,
  addSeparator: PropTypes.bool,
};

export default DescriptionDetails;
