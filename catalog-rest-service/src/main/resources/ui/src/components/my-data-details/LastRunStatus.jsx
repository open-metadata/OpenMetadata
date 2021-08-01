import PropTypes, { arrayOf } from 'prop-types';
import React from 'react';

const LastRunStatus = ({ lastRunsData }) => {
  const dataCount = lastRunsData.length;
  const getClassName = (statusString) => {
    switch (statusString) {
      case 'Success':
        return 'bg-success';
      case 'Failed':
        return 'bg-danger';
      case 'Unknown':
        return 'bg-grey';
      default:
        return statusString;
    }
  };

  return (
    <div className="last-runs" data-testid="last-run-status-container">
      {lastRunsData.map((lastRunData, index) => {
        return (
          <span
            className={getClassName(lastRunData)}
            data-testid={
              'run-status-' + (index === dataCount - 1 ? 'long' : 'short')
            }
            key={index}>
            {index === dataCount - 1 ? lastRunData : '\u00a0'}
          </span>
        );
      })}
    </div>
  );
};

LastRunStatus.propTypes = {
  lastRunsData: arrayOf(PropTypes.string).isRequired,
};

export default LastRunStatus;
