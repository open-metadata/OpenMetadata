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

import { AxiosResponse } from 'axios';
import classNames from 'classnames';
import { EntityThread, Post } from 'Models';
import React, {
  FC,
  Fragment,
  HTMLAttributes,
  useEffect,
  useState,
} from 'react';
import { getFeedById } from '../../../axiosAPIs/feedsAPI';
import { getEntityField } from '../../../utils/FeedUtils';
import Loader from '../../Loader/Loader';
import ActivityFeedCard from '../ActivityFeedCard/ActivityFeedCard';

interface ActivityFeedPanelProp extends HTMLAttributes<HTMLDivElement> {
  selectedThread: EntityThread;
  open?: boolean;
  onCancel: () => void;
}

interface FeedPanelHeaderProp
  extends HTMLAttributes<HTMLHeadingElement>,
    Pick<ActivityFeedPanelProp, 'onCancel'> {
  entityField: string;
}
interface FeedPanelOverlayProp
  extends HTMLAttributes<HTMLButtonElement>,
    Pick<ActivityFeedPanelProp, 'onCancel'> {}
interface FeedPanelBodyProp extends HTMLAttributes<HTMLDivElement> {
  threadData: EntityThread;
  isLoading: boolean;
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

const FeedPanelOverlay: FC<FeedPanelOverlayProp> = ({
  className,
  onCancel,
}) => {
  return <button className={className} onClick={onCancel} />;
};

const FeedPanelBody: FC<FeedPanelBodyProp> = ({
  threadData,
  className,
  isLoading,
}) => {
  const repliesLength = threadData?.posts?.length ?? 0;

  return (
    <Fragment>
      {isLoading ? (
        <Loader />
      ) : (
        <div className={className}>
          {threadData ? (
            <ActivityFeedCard
              isEntityFeed
              className="tw-mb-3"
              feed={threadData?.posts?.[0] as Post}
            />
          ) : null}
          {repliesLength > 1 ? (
            <Fragment>
              <div className="tw-mb-3 tw-flex">
                <span>
                  {repliesLength - 1} {repliesLength > 1 ? 'replies' : 'reply'}
                </span>
                <span className="tw-flex-auto tw-self-center tw-ml-1.5">
                  <hr />
                </span>
              </div>
              {threadData?.posts?.slice(1)?.map((reply, key) => (
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
      )}
    </Fragment>
  );
};

const ActivityFeedPanel: FC<ActivityFeedPanelProp> = ({
  open,
  selectedThread,
  onCancel,
  className,
}) => {
  const [threadData, setThreadData] = useState<EntityThread>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const entityField = getEntityField(selectedThread.about);

  useEffect(() => {
    setIsLoading(true);
    getFeedById(selectedThread.id)
      .then((res: AxiosResponse) => {
        setThreadData(res.data);
      })
      .finally(() => setIsLoading(false));
  }, [selectedThread]);

  return (
    <div className={className}>
      <FeedPanelOverlay
        className="tw-z-10 tw-fixed tw-inset-0 tw-top-16 tw-h-full tw-w-3/5 tw-bg-black tw-opacity-40"
        onCancel={onCancel}
      />
      <div
        className={classNames(
          'tw-top-16 tw-right-0 tw-w-2/5 tw-bg-white tw-fixed tw-h-full tw-shadow-md tw-transform tw-ease-in-out tw-duration-1000 tw-overflow-y-auto',
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
        <FeedPanelBody
          className="tw-h-full tw-p-4 tw-pl-8"
          isLoading={isLoading}
          threadData={threadData as EntityThread}
        />
      </div>
    </div>
  );
};

export default ActivityFeedPanel;
