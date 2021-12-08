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
          <div className="tw-relative tw-mb-3">
            <div className="tw-flex tw-justify-center">
              <hr className="tw-absolute tw-top-3 tw-border-b-2 tw-border-main tw-w-full tw-z-0" />
              <span className="tw-bg-white tw-px-4 tw-py-px tw-border tw-border-main tw-rounded tw-z-10 tw-text-grey-muted tw-font-normal">
                {d}
              </span>
            </div>
          </div>
          {feeds
            .filter((f) => f.relativeDay === d)
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
                      <span className="tw-text-grey-muted tw-pl-1 tw-text-xs">
                        {getTimeByTimeStamp(feed.updatedAt)}
                      </span>
                    </span>
                  </h6>
                </div>
                <div className="tw-pl-7">{feed.description}</div>
              </div>
            ))}
        </div>
      ))}
    </Fragment>
  );
};

export default FeedCards;
