import PropTypes from 'prop-types';
import React from 'react';

const LikeCounter = ({ likeCount }) => {
  return (
    <button className="btn btn-like" data-testid="like-button">
      <i className="fas fa-thumbs-up mr-1" data-testid="icon" />
      <span data-testid="like-count">{likeCount}</span>
    </button>
  );
};

LikeCounter.propTypes = {
  likeCount: PropTypes.string.isRequired,
};

export default LikeCounter;
