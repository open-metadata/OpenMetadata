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
