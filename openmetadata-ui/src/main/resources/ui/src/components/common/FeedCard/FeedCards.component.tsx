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

import classNames from 'classnames';
import React, { FC, Fragment, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { getEntityLink } from '../../../utils/TableUtils';
import { getTimeByTimeStamp } from '../../../utils/TimeUtils';
import Avatar from '../avatar/Avatar';
interface Feed {
  updatedAt: number;
  updatedBy: string;
  description: ReactNode;
  entityName: string;
  entityType: string;
  fqn: string;
  relativeDay: string;
}

interface FeedCardsProp {
  feeds: Array<Feed>;
  relativeDays: Array<string>;
}

const FeedCards: FC<FeedCardsProp> = ({
  feeds = [],
  relativeDays = [],
}: FeedCardsProp) => {
  return (
    <Fragment>
      {relativeDays.map((d, i) => (
        <div className="tw-grid tw-grid-rows-1 tw-grid-cols-1 tw-mt-3" key={i}>
          <div className="tw-relative tw-mt-3 tw-mb-3.5">
            <div className="tw-flex tw-justify-center">
              <hr className="tw-absolute tw-top-3 tw-border-b-2 tw-border-main tw-w-full tw-z-0" />
              <span className="tw-bg-white tw-px-4 tw-py-px tw-border tw-border-primary tw-rounded tw-z-10 tw-text-primary tw-font-medium">
                {d}
              </span>
            </div>
          </div>
          {feeds
            .filter((f) => f.relativeDay === d)
            .map((feed, i) => (
              <div key={i}>
                <div
                  className={classNames('tw-flex tw-mb-1.5', {
                    'tw-mt-5': i !== 0,
                  })}>
                  <Avatar name={feed.updatedBy} width="24" />
                  <h6 className="tw-flex tw-items-center tw-m-0 tw-heading tw-pl-2">
                    {feed.updatedBy}
                    <span className="tw-pl-1 tw-font-normal">
                      updated {feed.entityType}{' '}
                      <Link to={getEntityLink(feed.entityType, feed.fqn)}>
                        <span className="link-text">{feed.entityName}</span>
                      </Link>
                      <span className="tw-text-grey-muted tw-pl-1 tw-text-xs">
                        {getTimeByTimeStamp(feed.updatedAt)}
                      </span>
                    </span>
                  </h6>
                </div>
                <div
                  className={classNames(
                    'tw-bg-white tw-p-3 tw-pb-1 tw-border tw-border-main tw-rounded-md tw-ml-7'
                  )}>
                  <div>{feed.description}</div>
                </div>
              </div>
            ))}
        </div>
      ))}
    </Fragment>
  );
};

export default FeedCards;
