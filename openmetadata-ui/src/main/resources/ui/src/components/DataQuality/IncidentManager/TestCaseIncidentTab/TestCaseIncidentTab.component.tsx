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

import { Typography } from 'antd';
import classNames from 'classnames';
import { RefObject, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ReactComponent as CheckIcon } from '../../../../assets/svg/ic-check.svg';
import { ReactComponent as TaskIcon } from '../../../../assets/svg/ic-task-new.svg';
import { observerOptions } from '../../../../constants/Mydata.constants';
import { EntityType } from '../../../../enums/entity.enum';
import { ThreadType } from '../../../../generated/api/feed/createThread';
import {
  Thread,
  ThreadTaskStatus,
} from '../../../../generated/entity/feed/thread';
import { useElementInView } from '../../../../hooks/useElementInView';
import { useFqn } from '../../../../hooks/useFqn';
import { useTestCaseStore } from '../../../../pages/IncidentManager/IncidentManagerDetailPage/useTestCase.store';
import ActivityFeedListV1New from '../../../ActivityFeed/ActivityFeedList/ActivityFeedListV1New.component';
import { useActivityFeedProvider } from '../../../ActivityFeed/ActivityFeedProvider/ActivityFeedProvider';
import { TaskFilter } from '../../../ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import Loader from '../../../common/Loader/Loader';
import { TaskTabNew } from '../../../Entity/Task/TaskTab/TaskTabNew.component';
import './test-case-incident-tab.style.less';

const TestCaseIncidentTab = () => {
  const { t } = useTranslation();
  const { fqn: decodedFqn } = useFqn();
  const { testCase } = useTestCaseStore();

  const owners = useMemo(() => testCase?.owners, [testCase]);

  const {
    selectedThread,
    setActiveThread,
    entityThread,
    getFeedData,
    loading,
    entityPaging,
  } = useActivityFeedProvider();
  const [elementRef, isInView] = useElementInView({
    ...observerOptions,
    root: document.querySelector('#center-container'),
    rootMargin: '0px 0px 2px 0px',
  });
  const [taskFilter, setTaskFilter] = useState<TaskFilter>('open');

  const handleFeedFetchFromFeedList = useCallback(
    (after?: string) => {
      getFeedData(
        undefined,
        after,
        ThreadType.Task,
        EntityType.TEST_CASE,
        decodedFqn
      );
    },
    [decodedFqn, getFeedData]
  );

  useEffect(() => {
    if (decodedFqn && isInView && entityPaging.after && !loading) {
      handleFeedFetchFromFeedList(entityPaging.after);
    }
  }, [entityPaging, loading, isInView, decodedFqn]);

  const handleFeedClick = useCallback(
    (feed: Thread) => {
      if (selectedThread?.id !== feed?.id) {
        setActiveThread(feed);
      }
    },
    [setActiveThread, selectedThread]
  );

  const loader = useMemo(() => (loading ? <Loader /> : null), [loading]);

  const threads = useMemo(() => {
    return entityThread.filter(
      (thread) =>
        taskFilter === 'open'
          ? thread.task?.status === ThreadTaskStatus.Open
          : thread.task?.status === ThreadTaskStatus.Closed,
      []
    );
  }, [entityThread, taskFilter]);

  const [openTasks, closedTasks] = useMemo(() => {
    return entityThread.reduce(
      (acc, curr) => {
        if (curr.task?.status === ThreadTaskStatus.Open) {
          acc[0] = acc[0] + 1;
        } else {
          acc[1] = acc[1] + 1;
        }

        return acc;
      },
      [0, 0]
    );
  }, [entityThread]);

  const handleUpdateTaskFilter = (filter: TaskFilter) => {
    setTaskFilter(filter);
  };

  const handleAfterTaskClose = () => {
    handleFeedFetchFromFeedList();
    handleUpdateTaskFilter('close');
  };

  const handleOpenCloseTaskClick = (currentFilter: TaskFilter) => {
    if (currentFilter === taskFilter) {
      return;
    }
    handleUpdateTaskFilter(taskFilter === 'close' ? 'open' : 'close');
    setActiveThread();
  };

  return (
    <div
      className="h-full incident-page-issue-tab"
      data-testid="issue-tab-container">
      <div
        className="left-container"
        data-testid="left-container"
        id="left-container">
        <div className="d-flex gap-4 p-sm p-x-lg">
          <Typography.Text
            className={classNames(
              'cursor-pointer p-l-xss d-flex items-center',
              {
                'font-medium': taskFilter === 'open',
              }
            )}
            data-testid="open-task"
            onClick={() => handleOpenCloseTaskClick('open')}>
            <TaskIcon className="m-r-xss" width={14} /> {openTasks}{' '}
            {t('label.open')}
          </Typography.Text>
          <Typography.Text
            className={classNames('cursor-pointer d-flex items-center', {
              'font-medium': taskFilter === 'close',
            })}
            data-testid="closed-task"
            onClick={() => handleOpenCloseTaskClick('close')}>
            <CheckIcon className="m-r-xss" width={14} /> {closedTasks}{' '}
            {t('label.closed')}
          </Typography.Text>
        </div>

        <ActivityFeedListV1New
          hidePopover
          activeFeedId={selectedThread?.id}
          emptyPlaceholderText={t('message.no-tasks-assigned')}
          feedList={threads}
          isForFeedTab={false}
          isLoading={false}
          selectedThread={selectedThread}
          showThread={false}
          onFeedClick={handleFeedClick}
        />
        {loader}
        <div
          className="w-full"
          data-testid="observer-element"
          id="observer-element"
          ref={elementRef as RefObject<HTMLDivElement>}
          style={{ height: '2px' }}
        />
      </div>
      <div className="right-container" data-testid="right-container">
        {loader}
        {selectedThread && !loading && (
          <div id="task-panel">
            <TaskTabNew
              entityType={EntityType.TEST_CASE}
              isForFeedTab={false}
              owners={owners}
              taskThread={selectedThread}
              onAfterClose={handleAfterTaskClose}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default TestCaseIncidentTab;
