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

import { isUndefined, toLower } from 'lodash';
import React, { FC } from 'react';
import { getReplyText } from '../../../utils/FeedUtils';
import { getDayTimeByTimeStamp } from '../../../utils/TimeUtils';
import Avatar from '../../common/avatar/Avatar';
import { FeedFooterProp } from '../ActivityFeedCard/ActivityFeedCard.interface';

const FeedCardFooter: FC<FeedFooterProp> = ({
  repliedUsers,
  replies,
  className,
  threadId,
  onThreadSelect,
  lastReplyTimeStamp,
  isFooterVisible,
}) => {
  const repliesCount = isUndefined(replies) ? 0 : replies;

  return (
    <div className={className}>
      {!isUndefined(repliedUsers) &&
      !isUndefined(replies) &&
      isFooterVisible ? (
        <div className="tw-flex tw-group">
          {repliedUsers?.map((u, i) => (
            <Avatar
              className="tw-mt-0.5 tw-mx-0.5"
              data-testid="replied-user"
              key={i}
              name={u}
              type="square"
              width="22"
            />
          ))}
          <p
            className="tw-ml-1 link-text tw-text-xs tw-mt-1.5 tw-underline"
            data-testid="reply-count"
            onClick={() => onThreadSelect?.(threadId as string)}>
            {getReplyText(repliesCount)}
          </p>
          {lastReplyTimeStamp && repliesCount > 0 ? (
            <span
              className="tw-text-grey-muted tw-pl-2 tw-text-xs tw-font-medium tw-mt-1.5"
              data-testid="last-reply">
              Last reply{' '}
              {toLower(getDayTimeByTimeStamp(lastReplyTimeStamp as number))}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
};

export default FeedCardFooter;
