import PropTypes from 'prop-types';
import React from 'react';

const Timebar = ({ title }) => {
  return (
    <div className="date-seperator mb-3" data-testid="timebar">
      <span>{title}</span>
    </div>
  );
};

Timebar.propTypes = {
  title: PropTypes.string,
};

export default Timebar;
