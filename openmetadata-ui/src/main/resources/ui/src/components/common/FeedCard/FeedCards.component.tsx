import React, { FC, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getEntityLink } from '../../../utils/TableUtils';
import Avatar from '../avatar/Avatar';
interface Feed {
  updatedAt: number;
  updatedBy: string;
  description: ReactNode;
  entityName: string;
  entityType: string;
  fqn: string;
}
interface FeedCardsProp {
  feeds: Array<Feed>;
}

const FeedCards: FC<FeedCardsProp> = ({ feeds = [] }: FeedCardsProp) => {
  return (
    <div className="tw-grid tw-grid-rows-1 tw-grid-cols-1 tw-mt-3">
      <div className="tw-relative tw-mb-3">
        <div className="tw-flex tw-justify-center">
          <hr className="tw-absolute tw-top-3 tw-border-b-2 tw-border-main tw-w-full tw-z-0" />
          <span className="tw-bg-white tw-px-4 tw-py-px tw-border tw-border-main tw-rounded tw-z-10 tw-text-grey-muted tw-font-normal">
            Today
          </span>
        </div>
      </div>
      {feeds
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((feed, i) => (
          <div
            className="tw-bg-white tw-p-3 tw-border tw-border-main tw-rounded-md tw-mb-3"
            key={i}>
            <div className="tw-flex tw-mb-1">
              <Avatar name={feed.updatedBy} width="24" />
              <h6 className="tw-flex tw-items-center tw-m-0 tw-heading tw-pl-2">
                {feed.updatedBy}
                <span className="tw-pl-1 tw-font-normal">
                  updated{' '}
                  <Link to={getEntityLink(feed.entityType, feed.fqn)}>
                    <span className="link-text">{feed.entityName}</span>
                  </Link>
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
