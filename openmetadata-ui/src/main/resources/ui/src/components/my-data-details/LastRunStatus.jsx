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
