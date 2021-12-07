/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

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
