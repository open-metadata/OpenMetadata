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
import { Card, Typography } from 'antd';
import { isEqual } from 'lodash';
import { FC, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  ANNOUNCEMENT_BG,
  ANNOUNCEMENT_BORDER,
  GLOBAL_BORDER,
  TASK_BORDER,
} from '../../../constants/Feeds.constants';
import {
  Post,
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import { getTaskDetailPath } from '../../../utils/TasksUtils';
import { OwnerLabel } from '../../common/OwnerLabel/OwnerLabel.component';
import ActivityFeedCard from '../ActivityFeedCard/ActivityFeedCard';
import FeedCardFooter from '../ActivityFeedCard/FeedCardFooter/FeedCardFooter';
import ActivityFeedEditor from '../ActivityFeedEditor/ActivityFeedEditor';
import FeedListSeparator from '../FeedListSeparator/FeedListSeparator';
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
  const navigate = useNavigate();
  const { updatedFeedList: updatedThreads, relativeDays } =
    getFeedListWithRelativeDays(threads);

  const toggleReplyEditor = (id: string) => {
    onThreadIdSelect(selectedThreadId === id ? '' : id);
  };

  const handleCardClick = (task: Thread, isTask: boolean) => {
    isTask && navigate(getTaskDetailPath(task));
  };

  return (
    <div className={className}>
      {relativeDays.map((d, i) => {
        return (
          <div data-testid={`thread${i}`} key={i}>
            <FeedListSeparator relativeDay={d} />
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
                        thread.task && handleCardClick(thread, isTask)
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
                          task={thread}
                          threadId={thread.id}
                          updateThreadHandler={updateThreadHandler}
                          onConfirmation={onConfirmation}
                          onReply={() => onThreadSelect(thread.id)}
                        />
                      </div>
                      {postLength > 0 ? (
                        <div data-testid="replies-container">
                          {postLength > 1 ? (
                            <div className="m-l-lg">
                              <FeedCardFooter
                                isFooterVisible
                                lastReplyTimeStamp={lastPost?.postTs}
                                repliedUsers={repliedUniqueUsersList}
                                replies={replies}
                                threadId={thread.id}
                                onThreadSelect={() => onThreadSelect(thread.id)}
                              />
                            </div>
                          ) : null}
                          <div data-testid="latest-reply">
                            <ActivityFeedCard
                              isEntityFeed
                              className="m-l-lg"
                              feed={lastPost as Post}
                              feedType={thread.type || ThreadType.Conversation}
                              task={thread}
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
                          <ActivityFeedEditor onSave={postFeed} />
                        </div>
                      ) : null}
                      {thread.task && (
                        <div className="d-flex m-y-xs gap-2">
                          <Typography.Text className="text-grey-muted">
                            {t('label.assignee-plural')}:{' '}
                          </Typography.Text>
                          <OwnerLabel owners={thread.task.assignees} />
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
