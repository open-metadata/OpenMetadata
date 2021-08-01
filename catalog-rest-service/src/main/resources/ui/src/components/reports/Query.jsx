import PropTypes from 'prop-types';
import React from 'react';

const Query = ({ query }) => {
  return (
    <div className="sl-query" data-testid="query-container">
      <strong>Query:</strong>
      <pre data-testid="query">{query}</pre>
    </div>
  );
};

Query.propTypes = {
  query: PropTypes.string.isRequired,
};

export default Query;
