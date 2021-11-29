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
