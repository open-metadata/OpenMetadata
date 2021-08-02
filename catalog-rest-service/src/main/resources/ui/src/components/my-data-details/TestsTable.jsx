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
import { Table } from 'react-bootstrap';
import LastRunStatus from './LastRunStatus';

const TestsTable = ({ testsDetails }) => {
  return (
    <Table bordered data-testid="tests-details-container">
      <thead>
        <tr>
          <th>Name</th>
          <th>Lastest Runs</th>
          <th>Last Result</th>
          <th>Owner</th>
        </tr>
      </thead>
      <tbody>
        {testsDetails.map((testDetail, index) => {
          return (
            <tr data-testid="test" key={index}>
              <td>
                <p>
                  <strong>{testDetail.name}</strong>
                </p>
                <p>{testDetail.description}</p>
              </td>
              <td>
                <LastRunStatus lastRunsData={testDetail.latestRunsDetails} />
              </td>
              <td>{testDetail.lastResult}</td>
              <td>{testDetail.owner}</td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
};

TestsTable.propTypes = {
  testsDetails: arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      description: PropTypes.string.isRequired,
      latestRunsDetails: arrayOf(PropTypes.string).isRequired,
      lastResult: PropTypes.string.isRequired,
      owner: PropTypes.string.isRequired,
    })
  ).isRequired,
};

export default TestsTable;
