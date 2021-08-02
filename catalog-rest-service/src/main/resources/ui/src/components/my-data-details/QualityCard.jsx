/*
  * Licensed to the Apache Software Foundation (ASF) under one or more
  * contributor license agreements. See the NOTICE file distributed with
  * this work for additional information regarding copyright ownership.
  * The ASF licenses this file to You under the Apache License, Version 2.0
  * (the "License"); you may not use this file except in compliance with
  * the License. You may obtain a copy of the License at

  * http://www.apache.org/licenses/LICENSE-2.0

  * Unless required by applicable law or agreed to in writing, software
  * distributed under the License is distributed on an "AS IS" BASIS,
  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  * See the License for the specific language governing permissions and
  * limitations under the License.
*/

import PropTypes, { arrayOf } from 'prop-types';
import React from 'react';
import LastRunStatus from './LastRunStatus';

const QualityCard = ({ heading, lastRunsData, lastRunResults }) => {
  const lastStatus = lastRunsData[lastRunsData.length - 1];
  const statusIconClass = () => {
    switch (lastStatus) {
      case 'Success':
        return 'text-success';
      case 'Failed':
        return 'text-danger';
      case 'Unknown':
        return 'text-grey';
      default:
        return lastStatus;
    }
  };

  return (
    <div className="sl-box" data-testid="quality-card-container">
      <div className="sl-box-header">
        <h4 className="sl-title-big">
          <i
            className={'quality-status-icon fa fa-circle ' + statusIconClass()}
            data-testid="run-status-icon"
          />
          <span className="pl-2 pr-2" data-testid="quality-card-heading">
            {heading}
          </span>
          <i
            className="quality-status-icon fa fa-info-circle"
            data-testid="icon"
          />
        </h4>
      </div>
      <div className="sl-box-body">
        <div>
          <strong>Last Runs:</strong>
          <LastRunStatus lastRunsData={lastRunsData} />
        </div>
        <p>
          <strong>Last Results:</strong>{' '}
          <span data-testid="last-run-results">{lastRunResults}</span>
        </p>
      </div>
    </div>
  );
};

QualityCard.propTypes = {
  heading: PropTypes.string.isRequired,
  lastRunsData: arrayOf(PropTypes.string).isRequired,
  lastRunResults: PropTypes.string.isRequired,
};

export default QualityCard;
