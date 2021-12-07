import React, { FC, ReactNode } from 'react';
import Avatar from '../avatar/Avatar';

// const FEED_MOCK_DATA = [
//   {
//     updatedBy: 'Sanket Shah',
//     description: (
//       <div>
//         <p>+ Added tags PII.Sensitive, PersonalData.Personal, User.Address</p>
//         <p>- Removed column transaction_id.description</p>
//       </div>
//     ),
//     entityName: 'dim_shop',
//   },
//   {
//     updatedBy: 'Akash Jain',
//     description: (
//       <div>
//         <p>+ Added tags PII.Sensitive, PersonalData.Personal, User.Address</p>
//         <p>- Removed column transaction_id.description</p>
//       </div>
//     ),
//     entityName: 'dim_shop',
//   },
//   {
//     updatedBy: 'Aashit Kothari',
//     description: (
//       <div>
//         <p>+ Added tags PII.Sensitive, PersonalData.Personal, User.Address</p>
//         <p>- Removed column transaction_id.description</p>
//       </div>
//     ),
//     entityName: 'dim_shop',
//   },
//   {
//     updatedBy: 'Sachin Chaurasiya',
//     description: (
//       <div>
//         <p>+ Added tags PII.Sensitive, PersonalData.Personal, User.Address</p>
//         <p>- Removed column transaction_id.description</p>
//       </div>
//     ),
//     entityName: 'dim_shop',
//   },
//   {
//     updatedBy: 'Parth Panchal',
//     description: (
//       <div>
//         <p>+ Added tags PII.Sensitive, PersonalData.Personal, User.Address</p>
//         <p>- Removed column transaction_id.description</p>
//       </div>
//     ),
//     entityName: 'dim_shop',
//   },
// ];

interface Feed {
  updatedBy: string;
  description: ReactNode;
  entityName: string;
  entityType: string;
}
interface FeedCardsProp {
  feeds: Array<Feed>;
}

const FeedCards: FC<FeedCardsProp> = ({ feeds = [] }: FeedCardsProp) => {
  return (
    <div className="tw-grid tw-grid-rows-1 tw-grid-cols-1 tw-mt-3">
      {feeds.map((feed, i) => (
        <div
          className="tw-bg-white tw-p-3 tw-border tw-border-main tw-rounded-md tw-mb-3"
          key={i}>
          <div className="tw-flex tw-mb-1">
            <Avatar name={feed.updatedBy} width="24" />
            <h6 className="tw-flex tw-items-center tw-m-0 tw-heading tw-pl-2">
              {feed.updatedBy}
              <span className="tw-pl-1 tw-font-normal">
                Updated <span className="link-text">{feed.entityName}</span>
              </span>
            </h6>
          </div>
          <div className="tw-pl-7">{feed.description}</div>
        </div>
      ))}
    </div>
  );
};

export default FeedCards;
