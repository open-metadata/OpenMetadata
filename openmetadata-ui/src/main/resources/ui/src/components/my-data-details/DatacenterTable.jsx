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

import PropTypes, { arrayOf } from 'prop-types';
import React from 'react';
import { Table } from 'react-bootstrap';
import LastRunStatus from './LastRunStatus';

const DatacenterTable = ({ datacenterDetails }) => {
  return (
    <Table
      bordered
      className="table-quality"
      data-testid="datacenter-details-container">
      <thead>
        <tr>
          <th>Name</th>
          <th>Lastest Runs</th>
          <th>Last Result</th>
        </tr>
      </thead>
      <tbody>
        {datacenterDetails.map((datacenterDetail, index) => {
          return (
            <tr data-testid="datacenter" key={index}>
              <td>{datacenterDetail.name}</td>
              <td>
                <LastRunStatus
                  lastRunsData={datacenterDetail.latestRunsDetails}
                />
              </td>
              <td>{datacenterDetail.lastResult}</td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
};

DatacenterTable.propTypes = {
  datacenterDetails: arrayOf(
    PropTypes.shape({
      name: PropTypes.string.isRequired,
      latestRunsDetails: arrayOf(PropTypes.string).isRequired,
      lastResult: PropTypes.string.isRequired,
    })
  ).isRequired,
};

export default DatacenterTable;
