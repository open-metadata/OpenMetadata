import PropTypes from 'prop-types';
import React from 'react';
import Description from '../my-data/Description';
import LikeCounter from '../my-data/LikeCounter';
import Query from './Query';

const ReportCard = ({ reportDetails }) => {
  const { dataName, likeCount, description, miscDetails, query } =
    reportDetails;

  return (
    <div className="sl-box" data-testid="report-card-container">
      <div className="sl-box-header">
        <h5 className="sl-title">
          <span data-testid="data-name">{dataName + ' '}</span>
        </h5>
        <div className="sl-box-tools">
          <LikeCounter likeCount={likeCount} />
          <button className="btn btn-like">
            <i className="fas fa-ellipsis-v" data-testid="ellipsis" />
          </button>
        </div>
      </div>
      <div className="sl-box-body">
        <Description description={description} miscDetails={miscDetails} />
        <Query query={query} />
      </div>
    </div>
  );
};

ReportCard.propTypes = {
  reportDetails: PropTypes.shape({
    dataName: PropTypes.string.isRequired,
    likeCount: PropTypes.string,
    description: PropTypes.string,
    miscDetails: PropTypes.arrayOf(
      PropTypes.shape({
        key: PropTypes.string,
        value: PropTypes.string,
      })
    ).isRequired,
    query: PropTypes.string.isRequired,
  }).isRequired,
};

export default ReportCard;
