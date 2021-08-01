import PropTypes from 'prop-types';
import React from 'react';

const QueryDetails = ({ queryDetails }) => {
  const { tagList, lastRunBy, lastRunOn, rowCount, colCount, datatypeCount } =
    queryDetails;

  return (
    <div data-testid="query-container">
      {tagList.length > 0 && (
        <p>
          <strong>Tags:</strong>
          {tagList.map((tag, index) => {
            return (
              <span className="sl-box-tag" data-testid="query-tag" key={index}>
                {tag}
              </span>
            );
          })}
        </p>
      )}

      <p>
        <strong>Last run:</strong>{' '}
        <i data-testid="run-details">
          {lastRunBy} on {lastRunOn}
        </i>{' '}
        | <strong data-testid="row-count">{rowCount}</strong> rows |{' '}
        <strong data-testid="col-count">{colCount}</strong> columns |{' '}
        <strong data-testid="datatype-count">{datatypeCount}</strong> data type
      </p>
    </div>
  );
};

QueryDetails.propTypes = {
  queryDetails: PropTypes.shape({
    tagList: PropTypes.arrayOf(PropTypes.string),
    lastRunBy: PropTypes.string,
    lastRunOn: PropTypes.string,
    rowCount: PropTypes.string,
    colCount: PropTypes.string,
    datatypeCount: PropTypes.string,
  }).isRequired,
};

export default QueryDetails;
