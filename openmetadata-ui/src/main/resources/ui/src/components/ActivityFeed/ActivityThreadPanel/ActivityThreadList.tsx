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
import { isEqual } from 'lodash';
import React, { FC, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import {
  ANNOUNCEMENT_BG,
  ANNOUNCEMENT_BORDER,
  GLOBAL_BORDER,
  TASK_BORDER,
} from '../../../constants/Feeds.constants';
import {
  Post,
  ThreadTaskStatus,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import { getTaskDetailPath } from '../../../utils/TasksUtils';
import AssigneeList from '../../common/AssigneeList/AssigneeList';
import ActivityFeedCard from '../ActivityFeedCard/ActivityFeedCard';
import FeedCardFooter from '../ActivityFeedCard/FeedCardFooter/FeedCardFooter';
import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditor';
import FeedListSeparator from '../ActivityFeedList/FeedListSeparator';
import AnnouncementBadge from '../Shared/AnnouncementBadge';
import TaskBadge from '../Shared/TaskBadge';
import { ActivityThreadListProp } from './ActivityThreadPanel.interface';

const ActivityThreadList: FC<ActivityThreadListProp> = ({
  className,
  threads,
  selectedThreadId,
  postFeed,
  onThreadIdSelect,
  onThreadSelect,
  onConfirmation,
  updateThreadHandler,
}) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { updatedFeedList: updatedThreads, relativeDays } =
    getFeedListWithRelativeDays(threads);

  const toggleReplyEditor = (id: string) => {
    onThreadIdSelect(selectedThreadId === id ? '' : id);
  };

  const handleCardClick = (taskId: number, isTask: boolean) => {
    if (isTask) {
      history.push(getTaskDetailPath(String(taskId)));
    }
  };

  return (
    <div className={className}>
      {relativeDays.map((d, i) => {
        return (
          <div data-testid={`thread${i}`} key={i}>
            <FeedListSeparator
              className="tw-relative tw-mt-1 tw-mb-3.5"
              relativeDay={d}
            />
            {updatedThreads
              .filter((f) => f.relativeDay === d)
              .map((thread, index) => {
                const mainFeed = {
                  message: thread.message,
                  postTs: thread.threadTs,
                  from: thread.createdBy,
                  id: thread.id,
                  reactions: thread.reactions,
                } as Post;
                const isTask = isEqual(thread.type, ThreadType.Task);
                const isAnnouncement = thread.type === ThreadType.Announcement;
                const postLength = thread?.posts?.length || 0;
                const replies = thread.postsCount ? thread.postsCount - 1 : 0;
                const repliedUsers = [
                  ...new Set((thread?.posts || []).map((f) => f.from)),
                ];
                const repliedUniqueUsersList = repliedUsers.slice(
                  0,
                  postLength >= 3 ? 2 : 1
                );
                const lastPost = thread?.posts?.[postLength - 1];

                return (
                  <Fragment key={index}>
                    <Card
                      className="ant-card-feed"
                      key={`${index} - card`}
                      style={{
                        marginTop: '20px',
                        paddingTop: isTask ? '8px' : '',
                        border: isTask
                          ? `1px solid ${TASK_BORDER}`
                          : `1px solid ${
                              isAnnouncement
                                ? ANNOUNCEMENT_BORDER
                                : GLOBAL_BORDER
                            }`,
                        background: isAnnouncement ? `${ANNOUNCEMENT_BG}` : '',
                      }}
                      onClick={() =>
                        thread.task && handleCardClick(thread.task.id, isTask)
                      }>
                      {isTask && (
                        <TaskBadge
                          status={thread.task?.status as ThreadTaskStatus}
                        />
                      )}
                      {isAnnouncement && <AnnouncementBadge />}
                      <div data-testid="main-message">
                        <ActivityFeedCard
                          isEntityFeed
                          isThread
                          announcementDetails={thread.announcement}
                          entityLink={thread.about}
                          feed={mainFeed}
                          feedType={thread.type || ThreadType.Conversation}
                          taskDetails={thread.task}
                          threadId={thread.id}
                          updateThreadHandler={updateThreadHandler}
                          onConfirmation={onConfirmation}
                          onReply={() => onThreadSelect(thread.id)}
                        />
                      </div>
                      {postLength > 0 ? (
                        <div data-testid="replies-container">
                          {postLength > 1 ? (
                            <div className="tw-ml-9 tw-my-2">
                              {Boolean(lastPost) && (
                                <div className="tw-filter-seperator" />
                              )}
                              <div className="tw-flex tw-my-4">
                                <FeedCardFooter
                                  isFooterVisible
                                  lastReplyTimeStamp={lastPost?.postTs}
                                  repliedUsers={repliedUniqueUsersList}
                                  replies={replies}
                                  threadId={thread.id}
                                  onThreadSelect={() =>
                                    onThreadSelect(thread.id)
                                  }
                                />
                              </div>
                            </div>
                          ) : null}
                          <div data-testid="latest-reply">
                            <ActivityFeedCard
                              isEntityFeed
                              className="tw-ml-9"
                              feed={lastPost as Post}
                              feedType={thread.type || ThreadType.Conversation}
                              threadId={thread.id}
                              updateThreadHandler={updateThreadHandler}
                              onConfirmation={onConfirmation}
                              onReply={() => toggleReplyEditor(thread.id)}
                            />
                          </div>
                        </div>
                      ) : null}
                      {selectedThreadId === thread.id ? (
                        <div data-testid="quick-reply-editor">
                          <ActivityFeedEditor
                            buttonClass="tw-mr-4"
                            className="tw-ml-5 tw-mr-2 tw-mb-6"
                            onSave={postFeed}
                          />
                        </div>
                      ) : null}
                      {thread.task && (
                        <div className="tw-border-t tw-border-main tw-py-1">
                          <span className="tw-text-grey-muted">
                            {t('label.assignee-plural')}:{' '}
                          </span>
                          <AssigneeList
                            assignees={thread.task.assignees || []}
                            className="tw-ml-0.5 tw-align-baseline tw-inline-flex tw-flex-wrap"
                          />
                        </div>
                      )}
                    </Card>
                  </Fragment>
                );
              })}
          </div>
        );
      })}
    </div>
  );
};

export default ActivityThreadList;
