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

import { Card } from 'antd';
import classNames from 'classnames';
import { isEqual } from 'lodash';
import React, { FC, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import {
  Post,
  ThreadTaskStatus,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { getTaskDetailPath } from '../../../utils/TasksUtils';
import AssigneeList from '../../common/AssigneeList/AssigneeList';
import ActivityFeedCard from '../ActivityFeedCard/ActivityFeedCard';
import FeedCardFooter from '../ActivityFeedCard/FeedCardFooter/FeedCardFooter';
import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditor';
import AnnouncementBadge from '../Shared/AnnouncementBadge';
import TaskBadge from '../Shared/TaskBadge';
import { FeedListBodyProp } from './ActivityFeedList.interface';
import './FeedListBody.less';

const FeedListBody: FC<FeedListBodyProp> = ({
  updatedFeedList,
  relativeDay,
  isEntityFeed,
  onThreadSelect,
  onThreadIdSelect,
  postFeed,
  onViewMore,
  selectedThreadId,
  onConfirmation,
  updateThreadHandler,
}) => {
  const { t } = useTranslation();
  const history = useHistory();
  const toggleReplyEditor = (id: string) => {
    onThreadIdSelect(selectedThreadId === id ? '' : id);
  };

  const onReplyThread = (id: string) => {
    onThreadSelect(id);
    onViewMore();
  };

  const getFeedEditor = (id: string) => {
    return selectedThreadId === id ? (
      <ActivityFeedEditor
        buttonClass="tw-mr-4"
        className="tw-ml-5 tw-mr-2"
        data-testid="quick-reply-editor"
        onSave={postFeed}
      />
    ) : null;
  };

  const getThreadFooter = (
    postLength: number,
    repliedUsers: Array<string>,
    replies: number,
    threadId: string,
    lastPost?: Post
  ) => {
    return (
      <div className="tw-ml-9 tw-my-2">
        {Boolean(lastPost) && <div className="tw-filter-seperator" />}
        {postLength > 1 ? (
          <div className="tw-flex tw-my-4">
            <FeedCardFooter
              isFooterVisible
              lastReplyTimeStamp={lastPost?.postTs}
              repliedUsers={repliedUsers}
              replies={replies}
              threadId={threadId}
              onThreadSelect={(id: string) => {
                onThreadIdSelect('');
                onThreadSelect(id);
                onViewMore();
              }}
            />
          </div>
        ) : null}
      </div>
    );
  };

  const handleCardClick = (taskId: number, isTask: boolean) => {
    if (isTask) {
      history.push(getTaskDetailPath(String(taskId)));
    }
  };

  return (
    <Fragment>
      {updatedFeedList
        .filter((f) => f.relativeDay === relativeDay)
        .map((feed, index) => {
          const mainFeed = {
            message: feed.message,
            postTs: feed.threadTs,
            from: feed.createdBy,
            id: feed.id,
            reactions: feed.reactions,
          } as Post;
          const isTask = isEqual(feed.type, ThreadType.Task);
          const isAnnouncement = feed.type === ThreadType.Announcement;
          const postLength = feed?.posts?.length || 0;
          const replies = feed.postsCount ? feed.postsCount - 1 : 0;
          const repliedUsers = [
            ...new Set((feed?.posts || []).map((f) => f.from)),
          ];
          const repliedUniqueUsersList = repliedUsers.slice(
            0,
            postLength >= 3 ? 2 : 1
          );
          const lastPost = feed?.posts?.[postLength - 1];

          return (
            <Card
              className={classNames(
                'ant-card-feed relative m-t-md',
                isTask || isAnnouncement ? 'p-t-xs' : '',
                isTask
                  ? 'task-feed-card'
                  : isAnnouncement
                  ? 'announcement-feed-card'
                  : ''
              )}
              key={`${index} - card`}
              onClick={() =>
                feed.task && handleCardClick(feed.task.id, isTask)
              }>
              {isTask && (
                <TaskBadge status={feed.task?.status as ThreadTaskStatus} />
              )}
              {isAnnouncement && <AnnouncementBadge />}
              <div data-testid="message-container" key={index}>
                <ActivityFeedCard
                  isThread
                  announcementDetails={feed.announcement}
                  data-testid="main-message"
                  entityLink={feed.about}
                  feed={mainFeed}
                  feedType={feed.type || ThreadType.Conversation}
                  isEntityFeed={isEntityFeed}
                  taskDetails={feed.task}
                  threadId={feed.id}
                  updateThreadHandler={updateThreadHandler}
                  onConfirmation={onConfirmation}
                  onReply={() => onReplyThread(feed.id)}
                />
                {postLength > 0 ? (
                  <Fragment>
                    {getThreadFooter(
                      postLength,
                      repliedUniqueUsersList,
                      replies,
                      feed.id,
                      lastPost
                    )}
                    <ActivityFeedCard
                      className="tw-ml-9"
                      data-testid="latest-message"
                      feed={lastPost as Post}
                      feedType={feed.type || ThreadType.Conversation}
                      isEntityFeed={isEntityFeed}
                      threadId={feed.id}
                      updateThreadHandler={updateThreadHandler}
                      onConfirmation={onConfirmation}
                      onReply={() => toggleReplyEditor(feed.id)}
                    />
                    {getFeedEditor(feed.id)}
                  </Fragment>
                ) : null}
              </div>
              {feed.task && (
                <div className="tw-border-t tw-border-main tw-py-1 tw-flex">
                  <span className="tw-text-grey-muted">
                    {t('label.assignee-plural')}:{' '}
                  </span>
                  <AssigneeList
                    assignees={feed.task.assignees || []}
                    className="tw-ml-0.5 tw-align-middle tw-inline-flex tw-flex-wrap"
                  />
                </div>
              )}
            </Card>
          );
        })}
    </Fragment>
  );
};

export default FeedListBody;
