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

import { Space, Typography } from 'antd';
import classNames from 'classnames';
import { isUndefined } from 'lodash';
import React, { FC } from 'react';
import { getFrontEndFormat } from '../../../../utils/FeedUtils';
import { getDateTimeByTimeStamp } from '../../../../utils/TimeUtils';
import RichTextEditorPreviewer from '../../../common/rich-text-editor/RichTextEditorPreviewer';
import Reactions from '../../../Reactions/Reactions';
import { FeedBodyProp } from '../ActivityFeedCard.interface';

const FeedCardBody: FC<FeedBodyProp> = ({
  message,
  announcementDetails,
  className,
  reactions,
  onReactionSelect,
}) => {
  return (
    <div className={classNames('tw-group', className)}>
      <div className="feed-meesage">
        {!isUndefined(announcementDetails) ? (
          <Space direction="vertical" size={4}>
            <Typography.Text className="tw-text-xs tw-text-grey-muted">
              Duration{' '}
              {getDateTimeByTimeStamp(announcementDetails.startTime * 1000)} to{' '}
              {getDateTimeByTimeStamp(announcementDetails.endTime * 1000)}
            </Typography.Text>
            <Typography.Text className="tw-font-semibold">
              {message}
            </Typography.Text>
            <RichTextEditorPreviewer
              className="activity-feed-card-text"
              enableSeeMoreVariant={false}
              markdown={announcementDetails.description || ''}
            />
          </Space>
        ) : (
          <RichTextEditorPreviewer
            className="activity-feed-card-text"
            enableSeeMoreVariant={false}
            markdown={getFrontEndFormat(message)}
          />
        )}
      </div>
      {Boolean(reactions?.length) && (
        <Reactions
          reactions={reactions || []}
          onReactionSelect={onReactionSelect}
        />
      )}
    </div>
  );
};

export default FeedCardBody;
