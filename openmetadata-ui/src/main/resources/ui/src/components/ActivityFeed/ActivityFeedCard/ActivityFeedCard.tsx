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
import { Post } from 'Models';
import React, { FC, HTMLAttributes } from 'react';
import { getTimeByTimeStamp } from '../../../utils/TimeUtils';
import Avatar from '../../common/avatar/Avatar';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';

interface ActivityFeedCardProp extends HTMLAttributes<HTMLDivElement> {
  feed: Post;
  replies: number;
}

const ActivityFeedCard: FC<ActivityFeedCardProp> = ({
  feed,
  className,
  replies,
}) => {
  return (
    <div className={classNames(className)}>
      <div className={classNames('tw-flex tw-mb-1.5')}>
        <Avatar name={feed.from} width="24" />
        <h6 className="tw-flex tw-items-center tw-m-0 tw-heading tw-pl-2">
          {feed.from}
          <span className="tw-text-grey-muted tw-pl-1 tw-text-xs">
            {getTimeByTimeStamp(feed.postTs)}
          </span>
        </h6>
      </div>
      <div className="tw-ml-7 tw-w-4/5">
        <RichTextEditorPreviewer
          className="activity-feed-card-text"
          enableSeeMoreVariant={false}
          markdown={feed.message}
        />
      </div>
      <p className="tw-text-right link-text">
        {replies > 1 ? `${replies} replies` : `${replies} reply`}
      </p>
    </div>
  );
};

export default ActivityFeedCard;
