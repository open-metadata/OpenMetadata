import PropTypes from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';
import { getDatasetDetailsPath } from '../../constants/constants';
const MyDataSidebar = ({ dataDetails }) => {
  const { name, tableType, fullyQualifiedName } = dataDetails;
  const getBadgeName = () => {
    switch (tableType) {
      case 'REGULAR':
        return 'table';
      case 'QUERY':
        return 'query';
      default:
        return 'table';
    }
  };
  const badgeName = getBadgeName();

  return (
    <div className="my-data-row row mb-2">
      <div className="my-data-title col-sm-8">
        <Link
          data-placement="top"
          data-testid="data-name"
          data-toggle="tooltip"
          title={name}
          to={getDatasetDetailsPath(fullyQualifiedName)}>
          {name}
        </Link>
      </div>
      <div className="col-sm-4">
        <div className={'sl-box-badge badge-' + badgeName} data-testid="badge">
          <span>{badgeName}</span>
        </div>
      </div>
    </div>
  );
};

MyDataSidebar.propTypes = {
  dataDetails: PropTypes.shape({
    name: PropTypes.string,
    id: PropTypes.string,
    tableType: PropTypes.string,
    fullyQualifiedName: PropTypes.string,
  }),
};

export default MyDataSidebar;
