import PropTypes from 'prop-types';
import React from 'react';
import { stringToSlug } from '../../utils/StringsUtils';

const StatusText = ({ text }) => {
  const classes =
    stringToSlug(text, '-') === 'ready-to-use' ? 'success' : 'danger';

  return (
    <>
      <i
        className={'fas fa-circle text-' + classes + ' mr-1'}
        data-testid="status-icon"
      />
      <span className={'text-' + classes} data-testid="status-text">
        {text}
      </span>
    </>
  );
};

StatusText.propTypes = {
  text: PropTypes.string.isRequired,
};

export default StatusText;
