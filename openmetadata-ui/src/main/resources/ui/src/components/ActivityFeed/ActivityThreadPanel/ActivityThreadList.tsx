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
import { Space } from 'antd';
import { isEqual } from 'lodash';
import React, { FC, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { useHistory } from 'react-router-dom';
import { GLOBAL_BORDER, TASK_BORDER } from '../../../constants/Feeds.constants';
import {
  Post,
  Thread,
  ThreadTaskStatus,
  ThreadType,
} from '../../../generated/entity/feed/thread';
import { getFeedListWithRelativeDays } from '../../../utils/FeedUtils';
import { getTaskDetailPath } from '../../../utils/TasksUtils';
import AssigneeList from '../../common/AssigneeList/AssigneeList';
import ActivityFeedCardV1 from '../ActivityFeedCard/ActivityFeedCardV1';
import FeedListSeparator from '../FeedListSeparator/FeedListSeparator';
import TaskBadge from '../Shared/TaskBadge';
import { ActivityThreadListProp } from './ActivityThreadPanel.interface';

const ActivityThreadList: FC<ActivityThreadListProp> = ({
  className,
  threads,
}) => {
  const { t } = useTranslation();
  const history = useHistory();
  const { updatedFeedList: updatedThreads, relativeDays } =
    getFeedListWithRelativeDays(threads);

  const handleCardClick = (task: Thread, isTask: boolean) => {
    isTask && history.push(getTaskDetailPath(task));
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

                return (
                  <Fragment key={index}>
                    <div
                      className="ant-card-feed"
                      key={`${index} - card`}
                      style={{
                        marginTop: '20px',
                        paddingTop: isTask ? '8px' : '',
                        border: isTask
                          ? `1px solid ${TASK_BORDER}`
                          : `1px solid ${GLOBAL_BORDER}`,
                      }}
                      onClick={() =>
                        thread.task && handleCardClick(thread, isTask)
                      }>
                      {isTask && (
                        <TaskBadge
                          status={thread.task?.status as ThreadTaskStatus}
                        />
                      )}
                      <div data-testid="main-message">
                        <ActivityFeedCardV1
                          className="m-0"
                          feed={thread}
                          hidePopover={false}
                          isPost={false}
                          post={mainFeed}
                          showThread={false}
                        />
                      </div>
                      {thread.task && (
                        <Space wrap className="m-y-xs" size={4}>
                          <span className="text-grey-muted">
                            {t('label.assignee-plural')}:{' '}
                          </span>
                          <AssigneeList
                            assignees={thread.task.assignees || []}
                          />
                        </Space>
                      )}
                    </div>
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
