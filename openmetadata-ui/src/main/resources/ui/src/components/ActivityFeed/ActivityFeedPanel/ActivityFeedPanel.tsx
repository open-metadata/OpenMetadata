import classNames from 'classnames';
import { Post } from 'Models';
import React, { FC, Fragment, HTMLAttributes } from 'react';
import { getEntityField } from '../../../utils/FeedUtils';
import ActivityFeedCard from '../ActivityFeedCard/ActivityFeedCard';

interface ActivityFeedPanelProp extends HTMLAttributes<HTMLDivElement> {
  replies: Post[];
  threadLink: string;
  open?: boolean;
  onCancel: () => void;
}

interface FeedPanelHeaderProp
  extends HTMLAttributes<HTMLHeadingElement>,
    Pick<ActivityFeedPanelProp, 'onCancel'> {
  entityField: string;
}

const FeedPanelHeader: FC<FeedPanelHeaderProp> = ({
  onCancel,
  entityField,
  className,
}) => {
  return (
    <header className={className}>
      <div className="tw-flex tw-justify-between tw-py-3">
        <p>
          Thread on <span className="tw-heading">{entityField}</span>
        </p>
        <svg
          className="tw-w-5 tw-h-5 tw-ml-1 tw-cursor-pointer"
          data-testid="closeDrawer"
          fill="none"
          stroke="#6B7280"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          onClick={onCancel}>
          <path
            d="M6 18L18 6M6 6l12 12"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </div>
      <hr className="tw--mx-4" />
    </header>
  );
};

const ActivityFeedPanel: FC<ActivityFeedPanelProp> = ({
  open,
  replies,
  threadLink,
  onCancel,
}) => {
  const entityField = getEntityField(threadLink);
  const repliesLength = replies.length - 1;
  const mainPost = replies[0];

  return (
    <div>
      <button
        className="tw-z-10 tw-fixed tw-inset-0 tw-top-16 tw-h-full tw-w-3/5 tw-bg-black tw-opacity-40"
        onClick={onCancel}
      />

      <div
        className={classNames(
          'tw-top-16 tw-right-0 tw-w-2/5 tw-bg-white tw-fixed tw-h-full tw-shadow-md tw-transform tw-ease-in-out tw-duration-1000',
          {
            'tw-translate-x-0': open,
            'tw-translate-x-full': !open,
          }
        )}>
        <FeedPanelHeader
          className="tw-px-4 tw-shadow-sm"
          entityField={entityField as string}
          onCancel={onCancel}
        />
        <div className="tw-h-full tw-overflow-y-auto tw-p-4 tw-pl-8">
          <ActivityFeedCard isEntityFeed className="tw-mb-3" feed={mainPost} />
          {replies.length > 1 ? (
            <Fragment>
              <p className="tw-mb-3 tw-flex">
                <span>
                  {repliesLength} {repliesLength > 1 ? 'replies' : 'reply'}
                </span>
                <span className="tw-flex-auto tw-self-center tw-ml-1.5">
                  <hr />
                </span>
              </p>
              {replies.slice(1).map((reply, key) => (
                <ActivityFeedCard
                  isEntityFeed
                  className="tw-mb-3"
                  feed={reply}
                  key={key}
                />
              ))}
            </Fragment>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default ActivityFeedPanel;
