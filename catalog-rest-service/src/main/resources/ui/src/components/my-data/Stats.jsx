import PropTypes from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';
import Status from './Status';

const Stats = ({ tableStats, generalStats, badgeName }) => {
  if (badgeName !== 'table') {
    const { numberOfRuns, sharedWithUsersCount } = generalStats;

    return (
      <p data-testid="stats-container">
        <strong data-testid="runs-count">{numberOfRuns}</strong> Runs | Shared
        with{' '}
        <strong data-testid="users-count">{sharedWithUsersCount} users</strong>
        <Link className="sl-box-link" data-testid="stats-link" to="#">
          View recent runs
        </Link>
      </p>
    );
  } else {
    const { status, instanceCount } = tableStats;

    return (
      <p data-testid="stats-container">
        <Status text={status} />
        <Link className="sl-box-link" data-testid="stats-link" to="#">
          View all {instanceCount} instances
        </Link>
      </p>
    );
  }
};

Stats.propTypes = {
  generalStats: PropTypes.shape({
    numberOfRuns: PropTypes.string,
    sharedWithUsersCount: PropTypes.string,
  }).isRequired,
  tableStats: PropTypes.shape({
    instanceCount: PropTypes.string,
    status: PropTypes.string,
  }).isRequired,
  badgeName: PropTypes.string.isRequired,
};

export default Stats;
