import PropTypes from 'prop-types';
import React from 'react';
import { Link } from 'react-router-dom';
import { getDatasetDetailsPath } from '../../constants/constants';
import { dummyData } from '../../pages/my-data/index.mock';
import Description from './Description';
import QueryDetails from './QueryDetails';

const MyData = ({ dataDetails }) => {
  const {
    name,
    owner,
    description,
    tableType,
    tier,
    usage,
    tableEntity,
    fullyQualifiedName,
    tags,
  } = dataDetails;
  const getBadgeName = () => {
    switch (tableType || tableEntity?.tableType) {
      case 'REGULAR':
        return 'table';
      case 'QUERY':
        return 'query';
      default:
        return 'table';
    }
  };
  const percentile = usage
    ? Math.round(usage.percentileRank * 10) / 10 + 'th percentile'
    : '--';
  const badgeName = getBadgeName();
  const { miscDetails, queryDetails } = dummyData;
  const newMiscDetails = [
    { key: 'Owner', value: owner?.name || tableEntity?.owner.name || '--' },
    ...miscDetails,
    { key: 'Highly Used', value: percentile },
    { key: 'Tier', value: tier || 'No Tier' },
  ];

  return (
    <div className="sl-box" data-testid="my-data-container">
      <div className="sl-box-header">
        <h5 className="sl-title">
          <Link
            data-testid="data-name"
            to={getDatasetDetailsPath(fullyQualifiedName)}>
            {name + ' '}
          </Link>
          <span
            className={'sl-box-badge badge-' + badgeName}
            data-testid="badge">
            {badgeName}
          </span>
        </h5>
        <div className="sl-box-tools">
          {/* <LikeCounter likeCount={'--'} />
          <button className="btn btn-like">
            <i className="fas fa-ellipsis-v" data-testid="ellipsis"></i>
          </button> */}
        </div>
      </div>
      <div className="sl-box-body">
        {badgeName === 'query' ? (
          <QueryDetails queryDetails={queryDetails} />
        ) : (
          <Description
            description={description || 'No description'}
            miscDetails={newMiscDetails}
            tags={[...new Set(tags)]}
          />
        )}
        {/* <Stats
          tableStats={tableStats}
          generalStats={generalStats}
          badgeName={badgeName}
        /> */}
      </div>
    </div>
  );
};

MyData.propTypes = {
  dataDetails: PropTypes.shape({
    name: PropTypes.string,
    id: PropTypes.string,
    description: PropTypes.string,
    owner: PropTypes.shape({
      name: PropTypes.string,
    }),
    tier: PropTypes.string,
    usage: PropTypes.shape({
      percentileRank: PropTypes.number,
    }),
    tableType: PropTypes.string,
    fullyQualifiedName: PropTypes.string,
    tableEntity: PropTypes.shape({
      owner: PropTypes.shape({
        name: PropTypes.string,
      }),
      tableType: PropTypes.string,
    }),
    tags: PropTypes.array,
  }),
};

export default MyData;
