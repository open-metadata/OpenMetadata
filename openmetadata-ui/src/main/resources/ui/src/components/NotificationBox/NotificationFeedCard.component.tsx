/*
 *  Copyright 2022 Collate.
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

import { List, Space, Typography } from 'antd';
import React, { FC } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { ThreadType } from '../../generated/entity/feed/thread';
import {
  formatDateTime,
  getRelativeTime,
} from '../../utils/date-time/DateTimeUtils';
import { entityDisplayName, prepareFeedLink } from '../../utils/FeedUtils';
import { getTaskDetailPath } from '../../utils/TasksUtils';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import { NotificationFeedProp } from './NotificationFeedCard.interface';

const NotificationFeedCard: FC<NotificationFeedProp> = ({
  createdBy,
  entityFQN,
  entityType,
  timestamp,
  feedType,
  task,
}) => {
  const { t } = useTranslation();
  const { task: taskDetails } = task ?? {};

  return (
    <Link
      className="no-underline"
      to={
        feedType === ThreadType.Conversation
          ? prepareFeedLink(entityType, entityFQN)
          : getTaskDetailPath(task)
      }>
      <List.Item.Meta
        avatar={<ProfilePicture name={createdBy} width="32" />}
        className="m-0"
        description={
          <Space direction="vertical" size={0}>
            <Typography.Paragraph
              className="m-0"
              style={{ color: '#37352F', marginBottom: 0 }}>
              <>{createdBy}</>
              {feedType === ThreadType.Conversation ? (
                <>
                  <span> {t('message.mentioned-you-on-the-lowercase')} </span>{' '}
                  <span>{entityType} </span>
                  <Link
                    className="truncate"
                    to={prepareFeedLink(entityType, entityFQN)}>
                    {entityDisplayName(entityType, entityFQN)}
                  </Link>
                </>
              ) : (
                <>
                  <span className="p-x-xss">
                    {t('message.assigned-you-a-new-task-lowercase')}
                  </span>
                  <Link to={getTaskDetailPath(task)}>
                    {`#${taskDetails?.id}`} {taskDetails?.type}
                  </Link>
                </>
              )}
            </Typography.Paragraph>
            <Typography.Text
              style={{ color: '#6B7280', marginTop: '8px', fontSize: '12px' }}
              title={formatDateTime(timestamp)}>
              {getRelativeTime(timestamp)}
            </Typography.Text>
          </Space>
        }
        style={{ marginBottom: 0 }}
      />
    </Link>
  );
};

export default NotificationFeedCard;
