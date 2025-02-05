/*
 *  Copyright 2023 Collate.
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
import Icon from '@ant-design/icons';
import { Button, Card, Col, Row, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { isUndefined, lowerCase } from 'lodash';
import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { ReactComponent as AssigneesIcon } from '../../../assets/svg/assignees.svg';
import { ReactComponent as ChatIcon } from '../../../assets/svg/chat-icon-grey.svg';
import { ReactComponent as TaskCloseIcon } from '../../../assets/svg/ic-close-task.svg';
import { ReactComponent as TaskOpenIcon } from '../../../assets/svg/ic-open-task.svg';
import EntityPopOverCard from '../../../components/common/PopOverCard/EntityPopOverCard';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import {
  Post,
  Thread,
  ThreadTaskStatus,
} from '../../../generated/entity/feed/thread';
import { getNameFromFQN } from '../../../utils/CommonUtils';
import {
  formatDateTime,
  getRelativeTime,
} from '../../../utils/date-time/DateTimeUtils';
import EntityLink from '../../../utils/EntityLink';
import { getEntityFQN, getEntityType } from '../../../utils/FeedUtils';

import { ICON_DIMENSION_USER_PAGE } from '../../../constants/constants';
import { TASK_TYPES } from '../../../constants/Task.constant';
import { getTaskDetailPath } from '../../../utils/TasksUtils';
import { OwnerLabelNew } from '../../common/OwnerLabel/OwnerLabelNew.component';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import './task-feed-card.less';

interface TaskFeedCardProps {
  post: Post;
  feed: Thread;
  className?: string;
  showThread?: boolean;
  isOpenInDrawer?: boolean;
  isActive?: boolean;
  isForFeedTab?: boolean;
  hidePopover: boolean;
}

const TaskFeedCard = ({
  post,
  feed,
  className = '',
  showThread = true,
  isActive,
  hidePopover = false,
}: TaskFeedCardProps) => {
  const history = useHistory();
  const { t } = useTranslation();
  const { showDrawer, setActiveThread } = useActivityFeedProvider();
  const [showActions, setShowActions] = useState(false);
  const {
    threadTs: timeStamp,
    task: taskDetails,
    postsCount: postLength = 0,
  } = feed;

  const [isEditPost, setIsEditPost] = useState(false);
  const repliedUsers = [...new Set((feed?.posts ?? []).map((f) => f.from))];
  const repliedUniqueUsersList = repliedUsers.slice(0, postLength >= 3 ? 2 : 1);

  const { entityType, entityFQN } = useMemo(
    () => ({
      entityType: getEntityType(feed.about) ?? '',
      entityFQN: getEntityFQN(feed.about) ?? '',
    }),
    [feed.about]
  );

  const isEntityDetailsAvailable = useMemo(
    () => !isUndefined(entityFQN) && !isUndefined(entityType),
    [entityFQN, entityType]
  );

  const taskColumnName = useMemo(() => {
    const columnName = EntityLink.getTableColumnName(feed.about) ?? '';

    if (columnName) {
      return (
        <Typography.Text className="p-r-xss column-name">
          {columnName} {t('label.in-lowercase')}
        </Typography.Text>
      );
    }

    return null;
  }, [feed]);

  const showReplies = () => {
    showDrawer?.(feed);
  };

  const onEditPost = () => {
    setIsEditPost(!isEditPost);
  };

  const handleTaskLinkClick = () => {
    history.push({
      pathname: getTaskDetailPath(feed),
    });
    setActiveThread(feed);
  };

  const taskLinkTitleElement = useMemo(
    () =>
      isEntityDetailsAvailable && !isUndefined(taskDetails) ? (
        <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
          <Button
            className="p-0 task-feed-message-new"
            data-testid="redirect-task-button-link"
            style={{
              display: 'inline-block',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            type="link"
            onClick={handleTaskLinkClick}>
            <Typography.Text className="m-r-xss text-primary">{`#${taskDetails.id} `}</Typography.Text>

            <Typography.Text className="m-r-xss  m-r-xss">
              {TASK_TYPES[taskDetails.type]}
            </Typography.Text>

            {taskColumnName}

            <Typography.Text
              className="break-all text-primary"
              data-testid="entity-link">
              {getNameFromFQN(entityFQN)}
            </Typography.Text>

            <Typography.Text className="p-l-xss">{`(${entityType})`}</Typography.Text>
          </Button>
        </EntityPopOverCard>
      ) : null,
    [isEntityDetailsAvailable, entityFQN, entityType, taskDetails]
  );

  const handleMouseEnter = () => {
    setShowActions(true);
  };

  const handleMouseLeave = () => {
    setShowActions(false);
  };

  return (
    <Button
      block
      className="remove-button-default-styling"
      type="text"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}>
      <div
        className={classNames(className, 'task-feed-card-v1-new', {
          active: isActive,
        })}
        data-testid="task-feed-card">
        <Row gutter={[0, 14]}>
          <Col className="d-flex flex-col align-start">
            <Col>
              <Icon
                className="m-r-xs m-t-xss"
                component={
                  taskDetails?.status === ThreadTaskStatus.Open
                    ? TaskOpenIcon
                    : TaskCloseIcon
                }
                data-testid={`task-status-icon-${lowerCase(
                  taskDetails?.status
                )}`}
                style={{ fontSize: '16px' }}
              />
              {taskLinkTitleElement}
            </Col>
            <Col className="m-t-0">
              <Typography.Text>
                <UserPopOverCard
                  key={feed.createdBy}
                  userName={feed.createdBy ?? ''}>
                  <span
                    className="task-created-by-text p-r-xss"
                    data-testid="task-created-by">
                    {feed.createdBy}
                  </span>
                </UserPopOverCard>
                <span className="task-timestamp-text">
                  {t('message.created-this-task-lowercase')}
                </span>
                {timeStamp && (
                  <Tooltip title={formatDateTime(timeStamp)}>
                    <span
                      className="p-l-xss task-timestamp-text"
                      data-testid="timestamp">
                      {getRelativeTime(timeStamp)}
                    </span>
                  </Tooltip>
                )}
              </Typography.Text>
            </Col>
          </Col>
          <Col span={24}>
            <Card bordered className="activity-feed-card-message">
              <Typography.Text
                style={{ wordWrap: 'break-word', whiteSpace: 'normal' }}>
                {feed?.entityRef?.description}
              </Typography.Text>
            </Card>
          </Col>
          <Col
            className="task-feed-card-footer  d-flex align-center justify-between"
            span={24}>
            <Col className="d-flex items-center" span={10}>
              <ChatIcon className="m-r-xss" {...ICON_DIMENSION_USER_PAGE} />
              {feed.posts && feed.posts?.length > 0 && (
                <span className="posts-length m-r-xss">
                  {t(
                    feed.posts.length === 1
                      ? 'label.one-reply'
                      : 'label.number-reply-plural',
                    { number: feed.posts.length }
                  )}
                </span>
              )}
            </Col>

            <Col className="flex items-center gap-2 text-grey-muted" span={14}>
              {/* <User {...ICON_DIMENSION_USER_PAGE} /> */}
              <AssigneesIcon {...ICON_DIMENSION_USER_PAGE} />
              <OwnerLabelNew
                avatarSize={16}
                className="p-t-05"
                owners={feed?.task?.assignees}
              />
            </Col>
          </Col>
        </Row>
      </div>
    </Button>
  );
};

export default TaskFeedCard;
