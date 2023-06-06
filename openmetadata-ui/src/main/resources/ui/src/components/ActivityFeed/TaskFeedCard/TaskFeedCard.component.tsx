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
import { Col, Row, Tooltip, Typography } from 'antd';
import classNames from 'classnames';
import AssigneeList from 'components/common/AssigneeList/AssigneeList';
import EntityPopOverCard from 'components/common/PopOverCard/EntityPopOverCard';
import UserPopOverCard from 'components/common/PopOverCard/UserPopOverCard';
import ProfilePicture from 'components/common/ProfilePicture/ProfilePicture';
import Reactions from 'components/Reactions/Reactions';
import { ReactionOperation } from 'enums/reactions.enum';
import { Post, ReactionType, Thread } from 'generated/entity/feed/thread';
import { isUndefined, toString } from 'lodash';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  entityDisplayName,
  getEntityFieldDisplay,
  getEntityFQN,
  getEntityType,
  prepareFeedLink,
} from 'utils/FeedUtils';
import { getTaskDetailPath } from 'utils/TasksUtils';
import {
  getDateTimeFromMilliSeconds,
  getDayTimeByTimeStamp,
} from 'utils/TimeUtils';
import { useActivityFeedProvider } from '../ActivityFeedProvider/ActivityFeedProvider';
import ActivityFeedActions from '../Shared/ActivityFeedActions';
import './task-feed-card.less';
import { ReactComponent as TaskOpenIcon } from '/assets/svg/ic-open-task.svg';
import { ReactComponent as ThreadIcon } from '/assets/svg/thread.svg';

interface TaskFeedCardProps {
  post: Post;
  feed: Thread;
  className?: string;
  showThread?: boolean;
  isEntityFeed?: boolean;
  isOpenInDrawer?: boolean;
}

const TaskFeedCard = ({
  post,
  feed,
  className = '',
  isEntityFeed = false,
  showThread = true,
  isOpenInDrawer = false,
}: TaskFeedCardProps) => {
  const { t } = useTranslation();
  const timeStamp = feed.threadTs;
  const taskDetails = feed.task;
  const postLength = feed?.postsCount ?? 0;
  const entityType = getEntityType(feed.about) ?? '';
  const entityFQN = getEntityFQN(feed.about) ?? '';
  const entityCheck = !isUndefined(entityFQN) && !isUndefined(entityType);
  const [isEditPost, setIsEditPost] = useState(false);
  const repliedUsers = [...new Set((feed?.posts ?? []).map((f) => f.from))];
  const repliedUniqueUsersList = repliedUsers.slice(0, postLength >= 3 ? 2 : 1);

  const { showDrawer, updateReactions } = useActivityFeedProvider();

  const showReplies = () => {
    showDrawer?.(feed);
  };

  const onEditPost = () => {
    setIsEditPost(!isEditPost);
  };

  const onReactionUpdate = (
    reaction: ReactionType,
    operation: ReactionOperation
  ) => {
    updateReactions(post, feed.id, true, reaction, operation);
  };

  const getTaskLinkElement = entityCheck && (
    <Typography.Text>
      <Link
        data-testid="tasklink"
        to={getTaskDetailPath(toString(taskDetails?.id)).pathname}
        onClick={(e) => e.stopPropagation()}>
        <span>{`#${taskDetails?.id} `}</span>
      </Link>

      <Typography.Text>{taskDetails?.type}</Typography.Text>
      <span className="m-x-xss">{t('label.for-lowercase')}</span>
      {isEntityFeed ? (
        <span className="tw-heading" data-testid="headerText-entityField">
          {getEntityFieldDisplay(feed.about)}
        </span>
      ) : (
        <>
          <span className="p-r-xss">{entityType}</span>
          <EntityPopOverCard entityFQN={entityFQN} entityType={entityType}>
            <Link
              className="break-all"
              data-testid="entitylink"
              to={prepareFeedLink(entityType, entityFQN)}
              onClick={(e) => e.stopPropagation()}>
              {entityDisplayName(entityType, entityFQN)}
            </Link>
          </EntityPopOverCard>
        </>
      )}
    </Typography.Text>
  );

  return (
    <>
      <div
        className={classNames(
          className,
          'task-feed-card-v1 activity-feed-card activity-feed-card-v1'
        )}>
        <Row gutter={[0, 8]}>
          <Col span={isOpenInDrawer ? 24 : 18}>
            <Row gutter={[0, 8]}>
              <Col className="d-flex items-center" span={24}>
                <TaskOpenIcon className="m-r-xs" width={14} />
                {getTaskLinkElement}
              </Col>
              <Col span={24}>
                <Typography.Text className="task-feed-body text-grey-muted">
                  <UserPopOverCard
                    key={feed.createdBy}
                    userName={feed.createdBy ?? ''}>
                    <span className="p-r-xss">{feed.createdBy}</span>
                  </UserPopOverCard>
                  {t('message.created-this-task-lowercase')}
                  {timeStamp && (
                    <Tooltip title={getDateTimeFromMilliSeconds(timeStamp)}>
                      <span className="p-l-xss" data-testid="timestamp">
                        {getDayTimeByTimeStamp(timeStamp)}
                      </span>
                    </Tooltip>
                  )}
                </Typography.Text>
              </Col>
            </Row>
          </Col>
          <Col
            className={`d-flex items-center gap-2 ${
              !isOpenInDrawer ? 'justify-end' : 'ml-6'
            }`}
            span={isOpenInDrawer ? 24 : 6}>
            <Typography.Text>{t('label.assignee-plural')}</Typography.Text>
            <AssigneeList
              assignees={feed?.task?.assignees || []}
              className="d-flex gap-1"
              profilePicType="circle"
              profileWidth="24"
              showUserName={false}
            />
          </Col>
        </Row>

        {!showThread && postLength > 0 && (
          <Row>
            <Col className="p-t-xs" span={24}>
              <div className="d-flex items-center p-l-lg gap-2">
                <div className="thread-users-profile-pic">
                  {repliedUniqueUsersList.map((user) => (
                    <UserPopOverCard key={user} userName={user}>
                      <span
                        className="profile-image-span cursor-pointer"
                        data-testid="authorAvatar">
                        <ProfilePicture
                          id=""
                          name={user}
                          type="circle"
                          width="24"
                        />
                      </span>
                    </UserPopOverCard>
                  ))}
                </div>
                <div
                  className="d-flex items-center thread-count cursor-pointer"
                  onClick={showReplies}>
                  <ThreadIcon width={20} />{' '}
                  <span className="text-xs p-l-xss">{postLength}</span>
                </div>
                {Boolean(feed.reactions?.length) && (
                  <Reactions
                    reactions={feed.reactions ?? []}
                    onReactionSelect={onReactionUpdate}
                  />
                )}
              </div>
            </Col>
          </Row>
        )}

        <ActivityFeedActions
          feed={feed}
          isPost={false}
          post={post}
          onEditPost={onEditPost}
        />
      </div>
    </>
  );
};

export default TaskFeedCard;
