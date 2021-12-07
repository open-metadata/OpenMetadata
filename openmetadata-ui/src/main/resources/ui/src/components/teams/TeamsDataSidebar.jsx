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

const TeamsDataSidebar = ({ teamDetails }) => {
  const { name, users } = teamDetails;

  return (
    <div className="teams-row mb-2">
      <div className="teams-title ">
        <div className="tw-has-tooltip tw-truncate tw-cursor-pointer tw-w-40">
          <span className="tw-tooltip tw-shadow-lg tw-px-2 tw-py-1 tw-bg-black tw-text-white tw-ml-16 tw-mt-2 ">
            {name}
          </span>
          {name}
        </div>
      </div>
      <div className="team-size">
        <span data-testid="team-size">{users?.length || 0}</span>
      </div>
    </div>
  );
};

TeamsDataSidebar.propTypes = {
  teamDetails: PropTypes.shape({
    name: PropTypes.string,
    users: PropTypes.array,
  }),
};

export default TeamsDataSidebar;
