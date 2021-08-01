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
