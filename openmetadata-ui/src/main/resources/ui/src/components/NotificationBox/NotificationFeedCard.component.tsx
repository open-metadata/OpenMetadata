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
import { FC, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import {
  formatDateTime,
  getRelativeTime,
} from '../../utils/date-time/DateTimeUtils';
import { getEntityName } from '../../utils/EntityNameUtils';
import { entityDisplayName, prepareFeedLink } from '../../utils/FeedUtilsPure';
import {
  getTaskDetailPathFromTask,
  getTaskDisplayId,
} from '../../utils/TaskNavigationUtils';
import { ActivityFeedTabs } from '../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import ProfilePicture from '../common/ProfilePicture/ProfilePicture';
import { SourceType } from '../SearchedData/SearchedData.interface';
import { NotificationFeedProp } from './NotificationFeedCard.interface';
// Deep link carried by the notification written when a user is added as a
// collaborator on an AI chat conversation. Such a thread's `about` points at the
// invitee's own user record, so the generic "mentioned you on the <entity>"
// wording would send the reader to their own profile instead of the chat.
const CONVERSATION_PATH_PREFIX = '/conversations/';

const NotificationFeedCard: FC<NotificationFeedProp> = ({
  createdBy,
  entityFQN,
  entityType,
  timestamp,
  mentionNotification,
  taskEntity,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isMentionNotification = Boolean(mentionNotification && !taskEntity);
  const conversationLink = mentionNotification?.entityUrlLink;
  const isChatCollaboratorNotification = Boolean(
    isMentionNotification &&
      conversationLink?.startsWith(CONVERSATION_PATH_PREFIX)
  );
  const taskLink = useMemo(() => {
    return taskEntity ? getTaskDetailPathFromTask(taskEntity) : '';
  }, [taskEntity]);

  const handleTaskLinkClick = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      navigate(taskLink, { state: { tasksRefreshKey: Date.now() } });
    },
    [navigate, taskLink]
  );

  const taskContent = useMemo(() => {
    return (
      <>
        <span className="p-x-xss">
          {t('message.assigned-you-a-new-task-lowercase')}
        </span>
        <Link
          to={taskLink}
          onClick={(e) => {
            e.stopPropagation();
            handleTaskLinkClick(e);
          }}>
          {`#${getTaskDisplayId(taskEntity?.taskId ?? '')} ${startCase(
            taskEntity?.type ?? ''
          )}`}
        </Link>
      </>
    );
  }, [taskEntity, taskLink, handleTaskLinkClick, t]);

  const entityName = useMemo(() => {
    if (isChatCollaboratorNotification) {
      // Falsy rather than nullish: an empty headerMessage would otherwise render
      // an empty link label.
      return (
        mentionNotification?.feedInfo?.headerMessage || t('label.conversation')
      );
    }

    const entityRef = (taskEntity?.about ?? mentionNotification?.entityRef) as
      | SourceType
      | undefined;

    return entityRef
      ? getEntityName(entityRef as SourceType)
      : entityDisplayName(entityType, entityFQN);
  }, [
    entityFQN,
    entityType,
    isChatCollaboratorNotification,
    mentionNotification,
    taskEntity,
    t,
  ]);

  const mentionLink = isChatCollaboratorNotification
    ? (conversationLink as string)
    : prepareFeedLink(entityType, entityFQN, ActivityFeedTabs.ALL);

  const mentionContent = useMemo(
    () => (
      <>
        <span>
          {' '}
          {isChatCollaboratorNotification
            ? t('message.added-you-as-a-collaborator-on-lowercase')
            : t('message.mentioned-you-on-the-lowercase')}{' '}
        </span>{' '}
        {!isChatCollaboratorNotification && <span>{entityType} </span>}
        <Link
          className="truncate"
          data-testid={`notification-link-${entityName}`}
          to={mentionLink}>
          {entityName}
        </Link>
      </>
    ),
    [isChatCollaboratorNotification, entityType, entityName, mentionLink, t]
  );

  return (
    <Link
      className="no-underline"
      to={isMentionNotification ? mentionLink : taskLink}
      onClick={!isMentionNotification ? handleTaskLinkClick : undefined}>
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
              {isMentionNotification ? mentionContent : taskContent}
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
