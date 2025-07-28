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
import { Button, Col, Row, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import { isUndefined, lowerCase, noop } from 'lodash';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { ReactComponent as TaskCloseIcon } from '../../../assets/svg/ic-close-task.svg';
import { ReactComponent as TaskOpenIcon } from '../../../assets/svg/ic-open-task.svg';
import { ReactComponent as ThreadIcon } from '../../../assets/svg/thread.svg';
import EntityPopOverCard from '../../../components/common/PopOverCard/EntityPopOverCard';
import UserPopOverCard from '../../../components/common/PopOverCard/UserPopOverCard';
import { TASK_TYPES } from '../../../constants/Task.constant';
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
import { getTaskDetailPath } from '../../../utils/TasksUtils';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import ProfilePicture from '../../common/ProfilePicture/ProfilePicture';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import ActivityFeedActions from '../Shared/ActivityFeedActions';
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
  const navigate = useNavigate();
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
        <Typography.Text className="p-r-xss">
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
    navigate(getTaskDetailPath(feed));
    setActiveThread(feed);
  };

  const taskLinkTitleElement = useMemo(
    () =>
      isEntityDetailsAvailable && !isUndefined(taskDetails) ? (
        <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
          <Button
            className="p-0 task-feed-message"
            data-testid="redirect-task-button-link"
            type="link"
            onClick={handleTaskLinkClick}>
            <Typography.Text className="p-0 text-primary">{`#${taskDetails.id} `}</Typography.Text>

            <Typography.Text className="p-xss">
              {TASK_TYPES[taskDetails.type]}
            </Typography.Text>

            {taskColumnName}

            <Typography.Text className="break-all" data-testid="entity-link">
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
        className={classNames(
          className,
          'task-feed-card-v1 activity-feed-card activity-feed-card-v1',
          { active: isActive }
        )}
        data-testid="task-feed-card">
        <Row gutter={[0, 8]}>
          <Col
            className="d-flex items-center task-feed-message-container"
            span={24}>
            <Icon
              className="m-r-xs"
              component={
                taskDetails?.status === ThreadTaskStatus.Open
                  ? TaskOpenIcon
                  : TaskCloseIcon
              }
              data-testid={`task-status-icon-${lowerCase(taskDetails?.status)}`}
              style={{ fontSize: '18px' }}
            />

            {taskLinkTitleElement}
          </Col>
          <Col span={24}>
            <Typography.Text className="task-feed-body text-xs text-grey-muted">
              <UserPopOverCard
                key={feed.createdBy}
                userName={feed.createdBy ?? ''}>
                <span className="p-r-xss" data-testid="task-created-by">
                  {feed.createdBy}
                </span>
              </UserPopOverCard>
              {t('message.created-this-task-lowercase')}
              {timeStamp && (
                <Tooltip title={formatDateTime(timeStamp)}>
                  <span className="p-l-xss" data-testid="timestamp">
                    {getRelativeTime(timeStamp)}
                  </span>
                </Tooltip>
              )}
            </Typography.Text>
          </Col>
          {!showThread ? (
            <Col span={24}>
              <div className="d-flex items-center p-l-lg gap-2">
                {postLength > 0 && (
                  <>
                    <div className="thread-users-profile-pic">
                      {repliedUniqueUsersList.map((user) => (
                        <UserPopOverCard key={user} userName={user}>
                          <span
                            className="profile-image-span cursor-pointer"
                            data-testid="authorAvatar">
                            <ProfilePicture
                              name={user}
                              type="circle"
                              width="24"
                            />
                          </span>
                        </UserPopOverCard>
                      ))}
                    </div>
                    <div
                      className="d-flex items-center thread-count cursor-pointer m-l-xs"
                      onClick={!hidePopover ? showReplies : noop}>
                      <ThreadIcon width={20} />{' '}
                      <span className="text-xs p-t-xss p-l-xss">
                        {postLength}
                      </span>
                    </div>
                  </>
                )}

                <Typography.Text
                  className={classNames(
                    postLength > 0
                      ? 'm-l-sm text-sm text-grey-muted'
                      : 'text-sm text-grey-muted'
                  )}>
                  {`${t('label.assignee-plural')}: `}
                </Typography.Text>
                <OwnerLabel owners={feed?.task?.assignees} />
              </div>
            </Col>
          ) : null}
        </Row>

        {!hidePopover && showActions && (
          <ActivityFeedActions
            feed={feed}
            isPost={false}
            post={post}
            onEditPost={onEditPost}
          />
        )}
      </div>
    </Button>
  );
};

export default TaskFeedCard;
