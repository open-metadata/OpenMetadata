import PropTypes from 'prop-types';
import React, { useCallback } from 'react';

const QuickReply = ({ text, onClick }) => {
  const handleClick = useCallback(
    (e) => {
      onClick(e);
    },
    [onClick]
  );

  return (
    <>
      <button className="btn btn-outline-primary btn-xs" onClick={handleClick}>
        {text}
      </button>
      {` `}
    </>
  );
};

QuickReply.propTypes = {
  text: PropTypes.string.isRequired,
  onClick: PropTypes.func.isRequired,
};

export default QuickReply;
