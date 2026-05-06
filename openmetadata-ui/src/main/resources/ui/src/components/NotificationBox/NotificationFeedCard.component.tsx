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
import { startCase } from 'lodash';
import { FC, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  formatDateTime,
  getRelativeTime,
} from '../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../utils/EntityUtils';
import { entityDisplayName, prepareFeedLink } from '../../utils/FeedUtils';
import {
  getTaskDetailPathFromTask,
  getTaskDisplayId,
} from '../../utils/TasksUtils';
import { ActivityFeedTabs } from '../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import { SourceType } from '../SearchedData/SearchedData.interface';
import { NotificationFeedProp } from './NotificationFeedCard.interface';

const NotificationFeedCard: FC<NotificationFeedProp> = ({
  createdBy,
  entityFQN,
  entityType,
  timestamp,
  mentionNotification,
  taskEntity,
}) => {
  const { t } = useTranslation();
  const isMentionNotification = Boolean(mentionNotification && !taskEntity);
  const taskLink = useMemo(() => {
    return taskEntity ? getTaskDetailPathFromTask(taskEntity) : '';
  }, [taskEntity]);

  const taskContent = useMemo(() => {
    return (
      <>
        <span className="p-x-xss">
          {t('message.assigned-you-a-new-task-lowercase')}
        </span>
        <Link to={taskLink}>
          {`#${getTaskDisplayId(taskEntity?.taskId ?? '')} ${startCase(
            taskEntity?.type ?? ''
          )}`}
        </Link>
      </>
    );
  }, [taskEntity, taskLink, t]);

  const entityName = useMemo(() => {
    const entityRef = (taskEntity?.about ?? mentionNotification?.entityRef) as
      | SourceType
      | undefined;

    return entityRef
      ? getEntityName(entityRef as SourceType)
      : entityDisplayName(entityType, entityFQN);
  }, [entityFQN, entityType, mentionNotification, taskEntity]);

  return (
    <Link
      className="no-underline"
      to={
        isMentionNotification
          ? prepareFeedLink(entityType, entityFQN, ActivityFeedTabs.ALL)
          : taskLink
      }>
      <List.Item.Meta
        avatar={<ProfilePicture name={createdBy} width="32" />}
        className="m-0"
        description={
          <Space
            data-testid={`notification-item-${entityName}`}
            direction="vertical"
            size={0}>
            <Typography.Paragraph
              className="m-0"
              style={{ color: '#37352F', marginBottom: 0 }}>
              <>{createdBy}</>
              {isMentionNotification ? (
                <>
                  <span> {t('message.mentioned-you-on-the-lowercase')} </span>{' '}
                  <span>{entityType} </span>
                  <Link
                    className="truncate"
                    data-testid={`notification-link-${entityName}`}
                    to={prepareFeedLink(
                      entityType,
                      entityFQN,
                      ActivityFeedTabs.ALL
                    )}>
                    {entityName}
                  </Link>
                </>
              ) : (
                taskContent
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
