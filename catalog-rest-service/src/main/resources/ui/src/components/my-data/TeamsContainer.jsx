import PropTypes from 'prop-types';
import React from 'react';

const TeamsContainer = ({ teamName, selectedTeams }) => {
  return (
    <div className="filter-group mb-2">
      <input
        className="mr-1"
        type="checkbox"
        onClick={(e) => {
          selectedTeams(e, teamName);
        }}
      />
      {teamName}
    </div>
  );
};

TeamsContainer.propTypes = {
  teamName: PropTypes.string,
  selectedTeams: PropTypes.func,
};

export default TeamsContainer;
