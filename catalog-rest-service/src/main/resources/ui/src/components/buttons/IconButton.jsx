import PropTypes from 'prop-types';
import React from 'react';

const IconButton = ({ icon, onClick, title }) => {
  return (
    <div className="icon-button" title={title} onClick={onClick}>
      {icon}
    </div>
  );
};

IconButton.propTypes = {
  icon: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  title: PropTypes.string,
};

export default IconButton;
